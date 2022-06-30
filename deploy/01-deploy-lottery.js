const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  let vrfcoodinatorV2Address

  if (developmentChains.includes(network.name)) {
    const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    vrfcoodinatorV2Address = VRFCoordinatorV2Mock.address
    const transactionResponse = await VRFCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait(1)
    subscriptionId = transactionReceipt.events[0].args.subId
    // Fund the subscription
    // Usually, you will need link token on a real network
    VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
  } else {
    vrfcoodinatorV2Address = networkConfig[chainId]["vrfCoordinatorv2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
  }

  const entraceFee = networkConfig[chainId]["entraceFee"]
  const gasLane = networkConfig[chainId]["gasLane"]
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
  const interval = networkConfig[chainId]["interval"]

  const args = [
    vrfcoodinatorV2Address,
    entraceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]
  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmation: network.config.blockConfirmations || 1,
  })

  // Verify the deployment
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying...")
    await verify(lottery.address, arguments)
  }
  
}

module.exports.tags = ["all", "lottery"]
