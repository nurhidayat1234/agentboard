const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deploy MockAgentID on BSC Testnet so the Agent ID gate can be tested
// there (the real SPACE ID registry only exists on BNB mainnet).
//   npx hardhat run scripts/deploy-mock-agentid.js --network bscTestnet
// Then: AGENT_ID_OVERRIDE=<mock address> npx hardhat run scripts/deploy.js --network bscTestnet
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const Mock = await hre.ethers.getContractFactory("MockAgentID");
  const mock = await Mock.deploy();
  await mock.waitForDeployment();
  const address = await mock.getAddress();
  console.log("MockAgentID deployed at:", address);
  // Give the deployer a mock Agent ID so it can create tasks in tests.
  await (await mock.setBalance(deployer.address, 1)).wait();
  console.log("Mock Agent ID granted to deployer.");
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, hre.network.name + "-mock-agentid.json"),
    JSON.stringify({ network: hre.network.name, contract: "MockAgentID", address, deployer: deployer.address, deployedAt: new Date().toISOString() }, null, 2));
  console.log("Next: AGENT_ID_OVERRIDE=" + address + " npx hardhat run scripts/deploy.js --network bscTestnet");
}
main().catch((e) => { console.error(e); process.exit(1); });
