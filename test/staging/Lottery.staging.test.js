const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery unit test", function () {
          let lottery, lotteryEntraceFee, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract("Lottery", deployer)
              lotteryEntraceFee = await lottery.getEntraceFee()
          })

          describe("fulfillRandomWords", function () {
              it("works with live chainlink keepers and chainlink vrf, we get a random winner", async function () {
                  // Enter the lottery
                  console.log("Setting up test...")
                  const startingTimestamp = await lottery.getLatestTimestamp()
                  const accounts = await ethers.getSigners()

                  // setup listener before we enter the lottery
                  // just in case the blockchain move REALLY fast
                  // listener
                  console.log("Setting up Listener...")
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              // add our asserts here
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await lottery.getLatestTimestamp()

                              await expect(lottery.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(lotteryState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEntraceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimestamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(e)
                          }
                      })
                      // Then entering the lottery
                      console.log("Entering Raffle...")
                      await lottery.enterLottery({ value: lotteryEntraceFee })

                      console.log("Ok, time to wait...")
                      const winnerStartingBalance = await accounts[0].getBalance()

                      // And this code WONT finish until our listener has finished listening!
                  })
              })
          })
      })
