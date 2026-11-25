require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  etherscan: {
    // BscScan API key (optional): set BSCSCAN_API_KEY in .env for native
    // BscScan verification. Without it, Sourcify verification is used.
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
  sourcify: {
    enabled: true,
  },
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
      gasPrice: 1000000000, // 1 gwei — deploy costs ~0.0021 BNB at this price; 3 gwei (0.0063 BNB) exceeds the deployer balance of 0.0023 BNB
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
};
