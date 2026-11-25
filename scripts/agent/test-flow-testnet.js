// test-flow-testnet.js — end-to-end test of the agent scripts on BSC Testnet.
//   node scripts/agent/test-flow-testnet.js
//
// TESTNET ONLY. It refuses to run on mainnet. It creates a fresh task with
// the testnet deployer key, funds + grants a mock Agent ID to a fresh throwaway
// worker wallet, then runs the real agent scripts for the full flow:
//   claim.js -> submit-proof.js -> approve.js  (each with --execute)
// and verifies the task ends Completed with the escrow released.
// Private keys are passed to child processes through env vars only and are
// NEVER printed. The throwaway worker key is discarded after the run.
const { spawnSync } = require("child_process");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const BOARD_TESTNET = "0xAD057270a866292913a7739Ef0Fe1EFC3941CDDe";
const MOCK_AGENT_ID = "0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE";

function runAgent(script, args, key) {
  const res = spawnSync("node", [path.join(__dirname, script), ...args], {
    cwd: ROOT,
    env: { ...process.env, AGENT_PRIVATE_KEY: key || "" },
    encoding: "utf8",
  });
  process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) throw new Error(`${script} exited with ${res.status}`);
  return res.stdout;
}

async function main() {
  const deployerKey = fs.readFileSync(path.join(ROOT, "deployer-testnet-key.txt"), "utf8").trim();
  const abi = JSON.parse(
    fs.readFileSync(path.join(ROOT, "frontend", "abi.js"), "utf8")
      .replace(/^window\.AGENTBOARD_ABI\s*=\s*/, "").replace(/;\s*$/, "")
  );
  const provider = new ethers.JsonRpcProvider(TESTNET_RPC, 97);
  const deployer = new ethers.Wallet(deployerKey, provider);
  const board = new ethers.Contract(BOARD_TESTNET, abi, deployer);
  const mock = new ethers.Contract(MOCK_AGENT_ID, ["function setBalance(address,uint256)", "function balanceOf(address) view returns (uint256)"], deployer);

  // 1. Fresh worker wallet (throwaway): fund + grant mock Agent ID.
  const worker = ethers.Wallet.createRandom().connect(provider);
  console.log("Worker (claimer):", worker.address);
  await (await deployer.sendTransaction({ to: worker.address, value: ethers.parseEther("0.05"), gasPrice: ethers.parseUnits("3", "gwei") })).wait();
  await (await mock.setBalance(worker.address, 1, { gasPrice: ethers.parseUnits("3", "gwei") })).wait();
  console.log("Worker funded + mock Agent ID granted.");

  // 2. Deployer creates a task (0.01 tBNB escrow). Next id = taskCount + 1.
  const taskId = Number(await board.taskCount()) + 1;
  await (await board.createTask("Agent script test task", { value: ethers.parseEther("0.01"), gasPrice: ethers.parseUnits("3", "gwei") })).wait();
  console.log(`Task #${taskId} created by deployer (0.01 tBNB escrow).`);

  // 3. Plan mode first: --baw output must print a valid preview command, and send nothing.
  console.log("--- --baw plan output (must send nothing) ---");
  const planOut = runAgent("claim.js", ["--network", "testnet", "--id", String(taskId), "--baw", "--from", worker.address], "");
  if (!planOut.includes("baw contract-call preview --binanceChainId 97")) {
    throw new Error("baw preview command not printed as expected");
  }
  const stillOpen = await board.tasks(taskId);
  if (Number(stillOpen.status) !== 0) throw new Error("Plan mode sent a transaction!");
  console.log("Plan mode OK: task still Open, nothing broadcast.");

  // 4. Full flow through the real agent scripts.
  const workerKey = worker.privateKey;
  runAgent("claim.js", ["--network", "testnet", "--id", String(taskId), "--execute"], workerKey);
  runAgent("submit-proof.js", ["--network", "testnet", "--id", String(taskId), "--proof", "https://github.com/nurhidayat1234/agentboard", "--execute"], workerKey);
  const boardBefore = await provider.getBalance(BOARD_TESTNET);
  const workerBefore = await provider.getBalance(worker.address);
  runAgent("approve.js", ["--network", "testnet", "--id", String(taskId), "--execute"], deployerKey);

  // 5. Verify (poll: testnet seed nodes can return stale balances).
  let boardAfter = boardBefore;
  let workerAfter = workerBefore;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    boardAfter = await provider.getBalance(BOARD_TESTNET);
    workerAfter = await provider.getBalance(worker.address);
    if (boardAfter === 0n) break;
  }
  const task = await board.tasks(taskId);
  console.log(`Task #${taskId} status: ${["Open", "Claimed", "Submitted", "Completed", "Cancelled"][Number(task.status)]}`);
  console.log(`Board escrow: ${ethers.formatEther(boardBefore)} -> ${ethers.formatEther(boardAfter)} tBNB.`);
  console.log(`Worker balance: ${ethers.formatEther(workerBefore)} -> ${ethers.formatEther(workerAfter)} tBNB.`);
  if (Number(task.status) !== 3) throw new Error("Flow failed: task not Completed");
  if (boardAfter !== 0n) throw new Error("Flow failed: escrow not fully released");
  console.log("AGENT SCRIPTS TESTNET FLOW OK");
}

main().catch((e) => { console.error(e); process.exit(1); });
