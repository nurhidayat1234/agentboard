const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deploy TaskBoardV2 (points system) to BSC Testnet (default) or BNB mainnet.
//   TESTNET: npx hardhat run scripts/deploy-v2.js --network bscTestnet
//   MAINNET: npx hardhat run scripts/deploy-v2.js --network bsc
//            (ONLY after hawkeye says "gas" for the mainnet migration — see PLAN.md.)
// Requires DEPLOYER_PRIVATE_KEY in env (see .env.example). Never commit it.
// Real Agent ID registry (BNB Chain): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
// On BSC Testnet the real registry does not exist, so deploy with a
// MockAgentID instead: AGENT_ID_OVERRIDE=<mock address>.
// The record is written to deployments/<network>-v2.json so the v1 record
// (and the submitted mainnet v1 address) is never overwritten.
const AGENT_ID = process.env.AGENT_ID_OVERRIDE || "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name, "chainId:", (await hre.ethers.provider.getNetwork()).chainId);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "BNB");
  if (balance === 0n) throw new Error("Deployer has 0 BNB — fund it first (see DEPLOY-TESTNET.md).");

  const Board = await hre.ethers.getContractFactory("TaskBoardV2");
  const board = await Board.deploy(AGENT_ID);
  await board.waitForDeployment();
  const address = await board.getAddress();
  console.log("TaskBoardV2 deployed at:", address);
  console.log("Agent ID registry:", AGENT_ID);
  console.log("POINTS_TO_CLAIM:", (await board.POINTS_TO_CLAIM()).toString());

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, hre.network.name + "-v2.json");
  fs.writeFileSync(out, JSON.stringify({ network: hre.network.name, chainId: Number((await hre.ethers.provider.getNetwork()).chainId), contract: "TaskBoardV2", abi: "abi-v2.js", address, agentId: AGENT_ID, deployer: deployer.address, deployedAt: new Date().toISOString() }, null, 2));
  console.log("Deployment record written to:", out);
}

main().catch((e) => { console.error(e); process.exit(1); });
