// claim-bnb.js — withdraw the pending BNB balance (TaskBoardV2 only).
//   node scripts/agent/claim-bnb.js [--network mainnet|testnet]
//     [--from 0x...] [--baw] [--execute]
//
// Only works once the caller has at least 100 points (POINTS_TO_CLAIM).
// Claiming withdraws the WHOLE pending balance; points are NOT spent.
// Modes (nothing is broadcast unless you ask for it):
//   default   plan only: checks points + pending balance, simulates the
//             call, prints the calldata + the exact `baw` commands.
//   --baw     print the `baw contract-call preview` command for your Agentic
//             Wallet (needs --from, or AGENT_PRIVATE_KEY to derive it).
//   --execute send the transaction with AGENT_PRIVATE_KEY from .env.
//             This is the explicit approval for THIS run only.
// See AGENT_CONNECT.md and PLAN.md ("Point System (v3)") for the rules.
const { ethers } = require("ethers");
const c = require("./common");

async function main() {
  const args = c.parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/agent/claim-bnb.js [--network mainnet|testnet] [--from 0x...] [--baw] [--execute]");
    return;
  }
  const { board, provider, address, net } = await c.getReadBoard(args);
  const sender = c.getSenderAddress(args);
  if (!sender) {
    console.log("No sender known (set AGENT_PRIVATE_KEY in .env or pass --from 0x...).");
    console.log("Nothing was sent.");
    return;
  }
  if (typeof board.points !== "function" || typeof board.claimBNB !== "function") {
    c.fail("This contract has no points system (v1). claimBNB needs TaskBoardV2 — try --network testnet.");
  }
  const myPoints = Number(await board.points(sender));
  const pending = await board.pendingBNB(sender);
  console.log(`Agent ${sender} on ${net.label}`);
  console.log(`Points: ${myPoints} / 100 · Pending BNB: ${ethers.formatEther(pending)}`);
  if (myPoints < 100) {
    console.log(`LOCKED — you need ${100 - myPoints} more points before you can claim. Complete more tasks.`);
    return;
  }
  if (pending === 0n) {
    console.log("Nothing to claim — your pending balance is 0.");
    return;
  }
  console.log(`Simulating claimBNB() — would withdraw ${ethers.formatEther(pending)} BNB…`);
  const data = c.encodeCall("claimBNB", [], args.network);
  const readOnly = board.connect(provider);
  try {
    await readOnly.claimBNB.staticCall({ from: sender });
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
  console.log(`Broadcasting claimBNB() from ${sender} on ${net.label}…`);
  const boardAsSender = board.connect(wallet);
  const tx = await boardAsSender.claimBNB({ gasPrice: ethers.parseUnits(net.gasPriceGwei, "gwei") });
  console.log("Tx hash: " + tx.hash);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber} (status ${receipt.status}).`);
  console.log(`Withdrew ${ethers.formatEther(pending)} BNB. Pending is now 0; points stay at ${myPoints}.`);
}

main().catch((e) => c.fail(e.reason || e.message || e));
