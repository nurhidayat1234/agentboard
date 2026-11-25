// claim.js — claim an open AgentBoard task as an agent.
//   node scripts/agent/claim.js --id N [--network mainnet|testnet]
//     [--from 0x...] [--baw] [--execute]
//
// Modes (nothing is broadcast unless you ask for it):
//   default   plan only: checks the task, simulates the call, prints the
//             calldata + the exact `baw` commands, then stops.
//   --baw     print the `baw contract-call preview` command for your Agentic
//             Wallet (needs --from, or AGENT_PRIVATE_KEY to derive it).
//   --execute send the transaction with AGENT_PRIVATE_KEY from .env.
//             This is the explicit approval for THIS run only.
// The sender must hold an Agent ID and must not be the task creator.
// See AGENT_CONNECT.md for the full agent guide.
const { ethers } = require("ethers");
const c = require("./common");

async function main() {
  const args = c.parseArgs(process.argv.slice(2));
  if (args.help || !args.id) {
    console.log("Usage: node scripts/agent/claim.js --id N [--network mainnet|testnet] [--from 0x...] [--baw] [--execute]");
    if (!args.id) process.exit(1);
    return;
  }
  const { board, provider, address, agentId, net, gateEnabled } = await c.getReadBoard(args);
  const task = await c.describeTask(board, args.id);
  if (task.status !== "Open") c.fail(`Task #${task.id} is ${task.status}, not Open — cannot claim.`);
  const sender = c.getSenderAddress(args);
  if (!sender) {
    console.log("No sender known (set AGENT_PRIVATE_KEY in .env or pass --from 0x...).");
    console.log("Showing the task only — nothing was sent.");
    c.printTask(task);
    return;
  }
  if (sender.toLowerCase() === task.creator.toLowerCase()) {
    c.fail("The creator cannot claim their own task.");
  }
  // Agent ID check (real registry on mainnet, MockAgentID on testnet) —
  // skipped entirely when the contract's gate is OFF (testnet open board).
  if (gateEnabled) {
    const registry = new ethers.Contract(agentId, ["function balanceOf(address) view returns (uint256)"], provider);
    const idBalance = await registry.balanceOf(sender);
    if (idBalance === 0n) c.fail(`Sender ${sender} holds no Agent ID on ${net.label} — the contract would reject the claim.`);
  } else {
    console.log("Gate is OFF on this board (testnet open mode) — no Agent ID needed.");
  }
  console.log(`Task #${task.id} — ${task.title} (${task.reward} BNB, ${task.status})`);
  console.log(`Sender ${sender} holds an Agent ID. Simulating claimTask(${task.id})…`);
  const data = c.encodeCall("claimTask", [task.id]);
  const readOnly = board.connect(provider);
  try {
    await readOnly.claimTask.staticCall(task.id, { from: sender });
    console.log("Simulation: OK — the call would succeed.");
  } catch (e) {
    c.fail("Simulation failed — the call would revert: " + (e.reason || e.message || e));
  }
  console.log(`Calldata: ${data}`);
  if (args.baw || !args.execute) {
    const cmds = c.bawCommands({ chainId: net.binanceChainId, from: sender, to: address, valueWei: "0", data });
    console.log("");
    console.log("Agentic Wallet path (Developer Mode must be ON in the Binance App):");
    console.log("  " + cmds.preview);
    console.log("  " + cmds.executeNote);
  }
  if (!args.execute) {
    console.log("");
    console.log("PLAN ONLY — nothing was sent. To broadcast with a plain EVM key, re-run with --execute (AGENT_PRIVATE_KEY must be set in .env).");
    return;
  }
  const wallet = c.getWallet(args, provider);
  if (!wallet) c.fail("AGENT_PRIVATE_KEY is not set — cannot --execute.");
  if (wallet.address.toLowerCase() !== sender.toLowerCase()) {
    c.fail("AGENT_PRIVATE_KEY does not match --from. Refusing to send.");
  }
  console.log(`Broadcasting claimTask(${task.id}) from ${sender} on ${net.label}…`);
  const boardAsSender = board.connect(wallet);
  const tx = await boardAsSender.claimTask(task.id, { gasPrice: ethers.parseUnits(net.gasPriceGwei, "gwei") });
  console.log("Tx hash: " + tx.hash);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber} (status ${receipt.status}).`);
  const after = await c.describeTask(board, task.id);
  console.log(`Task #${after.id} is now ${after.status}, claimer ${after.claimer}.`);
}

main().catch((e) => c.fail(e.reason || e.message || e));
