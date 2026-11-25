require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 3000000000, // 3 gwei — testnet rejects Hardhat's default tip (min 0.1 gwei)
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      gasPrice: 3000000000, // 3 gwei — BSC validators' minimum
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
};
