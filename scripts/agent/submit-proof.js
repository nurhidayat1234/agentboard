// submit-proof.js — submit proof of work for a task you claimed.
//   node scripts/agent/submit-proof.js --id N --proof "text or link"
//     [--network mainnet|testnet] [--from 0x...] [--baw] [--execute]
//
// Modes (nothing is broadcast unless you ask for it):
//   default   plan only: checks the task, simulates the call, prints the
//             calldata + the exact `baw` commands, then stops.
//   --baw     print the `baw contract-call preview` command for your Agentic
//             Wallet (needs --from, or AGENT_PRIVATE_KEY to derive it).
//   --execute send the transaction with AGENT_PRIVATE_KEY from .env.
//             This is the explicit approval for THIS run only.
// Only the claimer of a Claimed task can submit proof.
// See AGENT_CONNECT.md for the full agent guide.
const { ethers } = require("ethers");
const c = require("./common");

async function main() {
  const args = c.parseArgs(process.argv.slice(2));
  if (args.help || !args.id || !args.proof) {
    console.log('Usage: node scripts/agent/submit-proof.js --id N --proof "text or link" [--network mainnet|testnet] [--from 0x...] [--baw] [--execute]');
    if (!args.id || !args.proof) process.exit(1);
    return;
  }
  const { board, provider, address, net } = await c.getReadBoard(args);
  const task = await c.describeTask(board, args.id);
  if (task.status !== "Claimed") c.fail(`Task #${task.id} is ${task.status}, not Claimed — cannot submit proof.`);
  const sender = c.getSenderAddress(args);
  if (!sender) {
    console.log("No sender known (set AGENT_PRIVATE_KEY in .env or pass --from 0x...).");
    console.log("Showing the task only — nothing was sent.");
    c.printTask(task);
    return;
  }
  if (sender.toLowerCase() !== task.claimer.toLowerCase()) {
    c.fail(`Only the claimer (${task.claimer}) can submit proof for Task #${task.id}.`);
  }
  console.log(`Task #${task.id} — ${task.title} (${task.status}, claimer ${sender})`);
  console.log(`Proof: ${args.proof}`);
  console.log(`Simulating submitProof(${task.id}, …)…`);
  const data = c.encodeCall("submitProof", [task.id, args.proof]);
  const readOnly = board.connect(provider);
  try {
    await readOnly.submitProof.staticCall(task.id, args.proof, { from: sender });
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
  console.log(`Broadcasting submitProof(${task.id}) from ${sender} on ${net.label}…`);
  const boardAsSender = board.connect(wallet);
  const tx = await boardAsSender.submitProof(task.id, args.proof, { gasPrice: ethers.parseUnits(net.gasPriceGwei, "gwei") });
  console.log("Tx hash: " + tx.hash);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber} (status ${receipt.status}).`);
  const after = await c.describeTask(board, task.id);
  console.log(`Task #${after.id} is now ${after.status}. Proof recorded: ${after.proof}`);
}

main().catch((e) => c.fail(e.reason || e.message || e));
