const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery unit test", function () {
      let lottery, vrfCoordinatorV2Mock, lotteryEntraceFee, deployer, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        lottery = await ethers.getContract("Lottery", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        lotteryEntraceFee = await lottery.getEntraceFee()
        interval = await lottery.getInterval()
      })

      describe("constructor", async function () {
        it("initializes the Lottery correctly", async function () {
          // Ideally we make our test have just 1 assert per "it"
          const lotteryState = await lottery.getLotteryState()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterLottery", function () {
        it("revert if they dont pay enough", async function () {
          await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughETHEntered")
        })
        it("records players when they enter", async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          const playerFromContract = await lottery.getPlayer(0)
          assert.equal(playerFromContract, deployer)
        })
        it("emit event on enter", async function () {
          await expect(lottery.enterLottery({ value: lotteryEntraceFee })).to.emit(
            lottery,
            "LotteryEnter"
          )
        })
        it("doesnt allow entrace when lottery is calculating", async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          // We pretend to be chainlink keeper
          await lottery.performUpkeep([])
          await expect(lottery.enterLottery({ value: lotteryEntraceFee })).to.be.revertedWith(
            "Lottery__NotOpen"
          )
        })
      })

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any eth", async function () {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]) // kena code mcm ni sbb dia public sahaja bkn public view so kean panggil callStatic
          assert(!upkeepNeeded)
        })
        it("returns false if lottery not open", async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          await lottery.performUpkeep([])
          const lotteryState = await lottery.getLotteryState()
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert.equal(lotteryState.toString(), "1")
          assert.equal(upkeepNeeded, false)
        })
        it("returns false if enough time hasn't passed", async () => {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth, and is open", async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", function () {
        it("It only can run if checkUpkeep is true", async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const tx = await lottery.performUpkeep([])
          assert(tx)
        })

        it("reverts when checkupkeep is false", async function () {
          await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__upKeepNotNeeded")
        })
        it("updates the lottery state, emits and event, and calls the vrf coodinator", async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const txResponse = await lottery.performUpkeep([])
          const txReceipt = await txResponse.wait(1)
          const requestId = txReceipt.events[1].args.requestId
          const lotteryState = await lottery.getLotteryState()
          //assert(requestId.toNumber() > 0)
          assert(lotteryState.toString() == "1")
          
        })
      })

      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await lottery.enterLottery({ value: lotteryEntraceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })
        it("can only be call after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
          ).to.be.revertedWith("nonexistent request")
        })
        // waaaay to big
        it("pick a winner, resets the lottery, and sends money", async function () {
          const additionalEntrances = 3
          const startingAccountIndex = 1 // 0=deployer
          const accounts = await ethers.getSigners()

          // acah2 mcm ramai orang masuk lottery~~
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrances; i++) {
            const accountConnectedLottery = lottery.connect(accounts[i])
            await accountConnectedLottery.enterLottery({ value: lotteryEntraceFee })
          }
          const startingTimestamp = await lottery.getLatestTimestamp()

          // setting up listener
          // below, we will fire the event, and the listener will pick up, and resolve
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              console.log("Found the event!")
              try {
                // kita check semua sblm dia dpt winner
                console.log(recentWinner)
                console.log(accounts[2].address)
                console.log(accounts[0].address)
                console.log(accounts[1].address)
                console.log(accounts[3].address)
                const recentWinner = await lottery.getRecentWinner()
                const lotteryState = await lottery.getLotteryState()
                const numPlayers = await lottery.getPlayer()
                const endingTimeStamp = await lottery.getLatestTimestamp()
                const winnerEndingBalance = await accounts[1].getBalance()
                assert.equal(lotteryState.toString(), "0")
                assert.equal(numPlayers.toString(), "0")
                assert(endingTimeStamp > startingTimestamp)

                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(
                    lotteryEntraceFee.mull(additionalEntrances).add(lotteryEntraceFee).toString()
                  )
                )
              } catch (e) {
                reject(e)
              }
              resolve()
            })
            // performUpkeep (mock being Chainlink Keepers)
            // fulfillRandomWords (mock being Chainlink VRF)
            // we will have to wait for the fulfillRandomWords to be called
            const tx = await lottery.performUpkeep()
            const txReceipt = await tx.wait(1)
            const winnerStartingBalance = await accounts[1].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              lottery.address
            )
          })
        })
      })
    })
