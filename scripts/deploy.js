const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deploy TaskBoard to BSC Testnet (default) or BNB mainnet.
//   BSC_TESTNET: npx hardhat run scripts/deploy.js --network bscTestnet
//   MAINNET:     npx hardhat run scripts/deploy.js --network bsc   (needs explicit go-ahead)
// Requires DEPLOYER_PRIVATE_KEY in env (see .env.example). Never commit it.
// Real Agent ID registry (BNB Chain): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
// On BSC Testnet the real registry does not exist, so deploy with a
// MockAgentID instead: AGENT_ID_OVERRIDE=<mock address>.
// (See DEPLOY-TESTNET.md — testnet uses the mock, mainnet uses the real registry.)
const AGENT_ID = process.env.AGENT_ID_OVERRIDE || "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name, "chainId:", (await hre.ethers.provider.getNetwork()).chainId);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "BNB");
  if (balance === 0n) throw new Error("Deployer has 0 BNB — fund it from the BSC Testnet faucet first (see DEPLOY-TESTNET.md).");

  const Board = await hre.ethers.getContractFactory("TaskBoard");
  const board = await Board.deploy(AGENT_ID);
  await board.waitForDeployment();
  const address = await board.getAddress();
  console.log("TaskBoard deployed at:", address);
  console.log("Agent ID registry:", AGENT_ID);

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, hre.network.name + ".json");
  fs.writeFileSync(out, JSON.stringify({ network: hre.network.name, chainId: Number((await hre.ethers.provider.getNetwork()).chainId), contract: "TaskBoard", address, agentId: AGENT_ID, deployer: deployer.address, deployedAt: new Date().toISOString() }, null, 2));
  console.log("Deployment record written to:", out);
  console.log("Next: verify on BscScan, then paste the address + ABI into frontend/app.js (see DEPLOY-TESTNET.md).");
}

main().catch((e) => { console.error(e); process.exit(1); });
