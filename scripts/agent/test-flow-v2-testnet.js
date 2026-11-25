// test-flow-v2-testnet.js — end-to-end test of the TaskBoardV2 points system
// on BSC Testnet, driven through the real agent scripts.
//   node scripts/agent/test-flow-v2-testnet.js
//
// TESTNET ONLY. It refuses to run on mainnet. Flow:
//   deployer creates 3 tasks (40 + 50 + 10 points, 0.002 tBNB reward each)
//   worker claims + proves each; deployer approves each
//   after 40 pts: claimBNB is LOCKED (plan mode prints LOCKED, nothing sent)
//   after 90 pts: still LOCKED
//   after 100 pts: claim-bnb.js --execute withdraws the 0.006 tBNB pending
// Private keys are passed to child processes through env vars only and are
// NEVER printed. The throwaway worker key is discarded after the run.
const { spawnSync } = require("child_process");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const BOARD_V2_TESTNET = "0x5aCafb6d81e820Aa2FfEC7e616f26958147A7cEF";
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
    fs.readFileSync(path.join(ROOT, "frontend", "abi-v2.js"), "utf8")
      .replace(/^window\.AGENTBOARD_V2_ABI\s*=\s*/, "").replace(/;\s*$/, "")
  );
  const provider = new ethers.JsonRpcProvider(TESTNET_RPC, 97);
  const deployer = new ethers.Wallet(deployerKey, provider);
  const board = new ethers.Contract(BOARD_V2_TESTNET, abi, deployer);
  const mock = new ethers.Contract(MOCK_AGENT_ID, ["function setBalance(address,uint256)", "function balanceOf(address) view returns (uint256)"], deployer);

  // 1. Fresh worker wallet (throwaway): fund + grant mock Agent ID.
  const worker = ethers.Wallet.createRandom().connect(provider);
  console.log("Worker (claimer):", worker.address);
  await (await deployer.sendTransaction({ to: worker.address, value: ethers.parseEther("0.01"), gasPrice: ethers.parseUnits("3", "gwei") })).wait();
  await (await mock.setBalance(worker.address, 1, { gasPrice: ethers.parseUnits("3", "gwei") })).wait();
  console.log("Worker funded + mock Agent ID granted.");
  const workerKey = worker.privateKey;

  // 2. Three tasks: 40 + 50 + 10 points, 0.002 tBNB reward each.
  const plan = [40, 50, 10];
  for (let i = 0; i < plan.length; i++) {
    const taskId = Number(await board.taskCount()) + 1;
    await (await board.createTask(`V2 points test task ${taskId}`, plan[i], { value: ethers.parseEther("0.002"), gasPrice: ethers.parseUnits("3", "gwei") })).wait();
    console.log(`Task #${taskId} created (${plan[i]} points, 0.002 tBNB escrow).`);
    runAgent("claim.js", ["--network", "testnet", "--id", String(taskId), "--execute"], workerKey);
    runAgent("submit-proof.js", ["--network", "testnet", "--id", String(taskId), "--proof", "https://github.com/nurhidayat1234/agentboard", "--execute"], workerKey);
    runAgent("approve.js", ["--network", "testnet", "--id", String(taskId), "--execute"], deployerKey);
    const pts = Number(await board.points(worker.address));
    const pending = await board.pendingBNB(worker.address);
    console.log(`After task #${taskId}: worker points=${pts}, pending=${ethers.formatEther(pending)} tBNB.`);
    if (pts < 100) {
      // Claim must be LOCKED: plan mode refuses, and the contract reverts.
      const out = runAgent("claim-bnb.js", ["--network", "testnet"], workerKey);
      if (!out.includes("LOCKED")) throw new Error(`Expected LOCKED at ${pts} points`);
      try {
        await board.connect(worker).claimBNB.staticCall();
        throw new Error("claimBNB should have reverted below 100 points");
      } catch (e) {
        if (!String(e.message).includes("need 100 points")) throw e;
      }
      console.log(`LOCKED confirmed at ${pts} points (script + on-chain revert).`);
    }
  }

  // 3. At 100 points: claim the whole pending balance.
  const pts = Number(await board.points(worker.address));
  if (pts !== 100) throw new Error(`Expected 100 points, got ${pts}`);
  const workerBefore = await provider.getBalance(worker.address);
  runAgent("claim-bnb.js", ["--network", "testnet", "--execute"], workerKey);
  let workerAfter = workerBefore;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    workerAfter = await provider.getBalance(worker.address);
    if (workerAfter > workerBefore) break;
  }
  const pendingAfter = await board.pendingBNB(worker.address);
  const ptsAfter = Number(await board.points(worker.address));
  console.log(`Worker balance: ${ethers.formatEther(workerBefore)} -> ${ethers.formatEther(workerAfter)} tBNB.`);
  console.log(`Pending after claim: ${ethers.formatEther(pendingAfter)} tBNB; points after claim: ${ptsAfter}.`);
  if (pendingAfter !== 0n) throw new Error("Flow failed: pending not fully withdrawn");
  if (ptsAfter !== 100) throw new Error("Flow failed: points should stay at 100 after claiming");
  if (!(workerAfter > workerBefore)) throw new Error("Flow failed: worker did not receive the BNB");
  console.log("V2 TESTNET FLOW OK");
}

main().catch((e) => { console.error(e); process.exit(1); });
