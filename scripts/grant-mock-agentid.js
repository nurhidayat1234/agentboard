const hre = require("hardhat");
// Grant a mock Agent ID to an address on BSC Testnet.
//   GRANT_ADDRESS=0x... npx hardhat run scripts/grant-mock-agentid.js --network bscTestnet
// MOCK address is read from deployments/bscTestnet-mock-agentid.json.
const fs = require("fs");
const path = require("path");

async function main() {
  const address = process.env.GRANT_ADDRESS;
  if (!address) throw new Error("Usage: GRANT_ADDRESS=0x... npx hardhat run scripts/grant-mock-agentid.js --network bscTestnet");
  const rec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "bscTestnet-mock-agentid.json"), "utf8"));
  const mock = await hre.ethers.getContractAt("MockAgentID", rec.address);
  const tx = await mock.setBalance(address, 1);
  await tx.wait();
  console.log("Mock Agent ID granted to", address, "on mock", rec.address);
}
main().catch((e) => { console.error(e); process.exit(1); });
