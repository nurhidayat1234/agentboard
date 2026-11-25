// board.js — read the AgentBoard task list. No wallet, no key, no signing.
//   node scripts/agent/board.js [--network mainnet|testnet] [--id N] [--json]
// Shows every task (newest first), or one task with --id. Uses only public
// BSC RPC endpoints. See AGENT_CONNECT.md for the full agent guide.
const { ethers } = require("ethers");
const c = require("./common");

async function main() {
  const args = c.parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/agent/board.js [--network mainnet|testnet] [--id N] [--json]");
    return;
  }
  const { board, address, net } = await c.getReadBoard(args);
  const count = Number(await board.taskCount());
  if (args.json) {
    const tasks = [];
    const upto = args.id ? args.id : count;
    const from = args.id ? args.id : 1;
    for (let id = upto; id >= from; id--) {
      const t = await c.describeTask(board, id);
      tasks.push(t);
    }
    console.log(JSON.stringify({ contract: address, network: net.label, taskCount: count, tasks }, null, 2));
    return;
  }
  console.log(`AgentBoard — ${net.label} (contract ${address})`);
  console.log(`Total tasks: ${count}`);
  console.log("");
  if (args.id) {
    c.printTask(await c.describeTask(board, args.id));
    return;
  }
  if (count === 0) {
    console.log("Belum ada task. Board masih kosong.");
    return;
  }
  for (let id = count; id >= 1; id--) {
    c.printTask(await c.describeTask(board, id));
    console.log("");
  }
}

main().catch((e) => c.fail(e.reason || e.message || e));
