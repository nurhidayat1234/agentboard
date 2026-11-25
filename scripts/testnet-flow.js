const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// End-to-end flow test on BSC Testnet with real on-chain calls:
// deployer creates a task, a second wallet (funded + granted a mock
// Agent ID) claims it, submits proof, deployer approves -> payout.
//   npx hardhat run scripts/testnet-flow.js --network bscTestnet
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const boardRec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "bscTestnet.json"), "utf8"));
  const mockRec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "bscTestnet-mock-agentid.json"), "utf8"));
  const board = await hre.ethers.getContractAt("TaskBoard", boardRec.address);
  const mock = await hre.ethers.getContractAt("MockAgentID", mockRec.address);

  const worker = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("Worker (claimer):", worker.address);
  await (await deployer.sendTransaction({ to: worker.address, value: hre.ethers.parseEther("0.05") })).wait();
  await (await mock.setBalance(worker.address, 1)).wait();
  console.log("Worker funded + mock Agent ID granted.");

  const boardAsWorker = board.connect(worker);
  const taskId = Number(await board.taskCount()) + 1;
  await (await board.createTask("Testnet demo task", { value: hre.ethers.parseEther("0.01") })).wait();
  console.log("Task #" + taskId + " created by deployer (0.01 tBNB escrow).");
  await (await boardAsWorker.claimTask(taskId)).wait();
  console.log("Task claimed by worker.");
  await (await boardAsWorker.submitProof(taskId, "https://github.com/nurhidayat1234/agentboard")).wait();
  console.log("Proof submitted by worker.");
  const boardBefore = await hre.ethers.provider.getBalance(boardRec.address);
  const workerBefore = await hre.ethers.provider.getBalance(worker.address);
  await (await board.approveTask(taskId)).wait();
  // BSC testnet seed nodes can return stale balances right after a block;
  // poll until the escrow is observed released (max ~30s).
  let boardAfter = boardBefore;
  let workerAfter = workerBefore;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    boardAfter = await hre.ethers.provider.getBalance(boardRec.address);
    workerAfter = await hre.ethers.provider.getBalance(worker.address);
    if (boardAfter === 0n) break;
  }
  console.log("Approved. Board escrow:", hre.ethers.formatEther(boardBefore), "->", hre.ethers.formatEther(boardAfter), "tBNB.");
  console.log("Worker balance:", hre.ethers.formatEther(workerBefore), "->", hre.ethers.formatEther(workerAfter), "tBNB (net +0.01 minus worker's own claim/submit gas).");
  const task = await board.tasks(taskId);
  console.log("Task #" + taskId + " status:", ["Open", "Claimed", "Submitted", "Completed", "Cancelled"][Number(task.status)]);
  if (Number(task.status) !== 3) throw new Error("Flow failed: task not Completed");
  if (boardAfter !== 0n) throw new Error("Flow failed: escrow not fully released");
  console.log("TESTNET FLOW OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
