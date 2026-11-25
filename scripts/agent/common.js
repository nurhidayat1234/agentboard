// Shared helpers for the AgentBoard agent scripts (scripts/agent/).
// See AGENT_CONNECT.md (repo root) for the full guide.
//
// Safety rules, enforced here and in every script that uses this module:
//  - Private keys come ONLY from the AGENT_PRIVATE_KEY environment variable.
//    They are never printed, never written to a file, and never sent anywhere
//    except as a signer for the single transaction the user approved.
//  - By default every write script only PLANS: it reads the task, simulates
//    the call, and prints the calldata + the exact `baw` commands. Nothing
//    is broadcast until the user re-runs with --execute (key path) or runs
//    the printed `baw contract-call execute` themselves (Agentic Wallet path).
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const STATUS = ["Open", "Claimed", "Submitted", "Completed", "Cancelled"];

const NETWORKS = {
  mainnet: {
    label: "BNB Chain",
    chainId: 56,
    binanceChainId: 56,
    deployment: "bsc.json",
    rpcs: [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/",
    ],
    // Real SPACE ID Agent ID registry (set at deploy time).
    agentId: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
    gasPriceGwei: "1",
  },
  testnet: {
    label: "BSC Testnet",
    chainId: 97,
    binanceChainId: 97,
    // Points system (v2) is live on testnet; mainnet still runs v1.
    deployment: "bscTestnet-v2.json",
    rpcs: [
      "https://data-seed-prebsc-1-s1.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://bsc-testnet-dataseed.bnbchain.org/",
    ],
    // MockAgentID on testnet (address recorded in the deployment file).
    agentId: null,
    gasPriceGwei: "3",
  },
};

// The ABI file comes from the deployment record (v1: abi.js, v2: abi-v2.js),
// so the same scripts work against either contract version.
function loadAbiFile(file) {
  const text = fs.readFileSync(path.join(PROJECT_ROOT, "frontend", file), "utf8");
  const json = text.replace(/^window\.AGENTBOARD(_V2)?_ABI\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(json);
}

function loadAbi(network) {
  const dep = loadDeployment(network || "mainnet");
  return loadAbiFile(dep.abi || "abi.js");
}

function loadDeployment(network) {
  return JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, "deployments", NETWORKS[network].deployment), "utf8")
  );
}

function parseArgs(argv) {
  const args = { network: "mainnet", execute: false, baw: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") args.network = argv[++i];
    else if (a === "--rpc") args.rpc = argv[++i];
    else if (a === "--id") args.id = Number(argv[++i]);
    else if (a === "--proof") args.proof = argv[++i];
    else if (a === "--from") args.from = argv[++i];
    else if (a === "--execute") args.execute = true;
    else if (a === "--baw") args.baw = true;
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  if (!NETWORKS[args.network]) {
    throw new Error(`Unknown network "${args.network}" (use --network mainnet|testnet).`);
  }
  return args;
}

async function getReadBoard(args) {
  const net = NETWORKS[args.network];
  const dep = loadDeployment(args.network);
  const abi = loadAbiFile(dep.abi || "abi.js");
  const urls = args.rpc ? [args.rpc] : net.rpcs;
  let lastErr = null;
  for (const url of urls) {
    try {
      const provider = new ethers.JsonRpcProvider(url, net.chainId);
      const board = new ethers.Contract(dep.address, abi, provider);
      await board.taskCount(); // probe: this endpoint really answers
      return { board, provider, address: dep.address, agentId: dep.agentId, net };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No BSC RPC endpoint answered.");
}

// Build a signer from AGENT_PRIVATE_KEY. Returns null when unset — the
// caller must then stay in plan/baw mode. The key value is never logged.
function getWallet(args, provider) {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) return null;
  const wallet = new ethers.Wallet(key, provider);
  return wallet;
}

function getSenderAddress(args) {
  if (args.from) return args.from;
  const key = process.env.AGENT_PRIVATE_KEY;
  if (key) return new ethers.Wallet(key).address;
  return null;
}

function encodeCall(fn, fnArgs, network) {
  const iface = new ethers.Interface(loadAbi(network));
  return iface.encodeFunctionData(fn, fnArgs);
}

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "-";
}

async function describeTask(board, id) {
  const t = await board.tasks(id);
  if (Number(t.id) === 0) throw new Error(`Task #${id} does not exist.`);
  return {
    id: Number(t.id),
    title: t.title,
    creator: t.creator,
    claimer: t.claimer,
    reward: ethers.formatEther(t.reward),
    rewardWei: t.reward.toString(),
    status: STATUS[Number(t.status)],
    proof: t.proof,
    // v2 only: points the task pays on approve. Undefined on v1.
    points: t.points !== undefined ? Number(t.points) : null,
  };
}

function printTask(t) {
  console.log(`#${t.id} — ${t.title}`);
  console.log(`  Status: ${t.status} · Reward: ${t.reward} BNB` + (t.points !== null ? ` · Points: ${t.points}` : ""));
  console.log(`  Creator: ${t.creator}`);
  console.log(`  Claimer: ${t.claimer === ethers.ZeroAddress ? "-" : t.claimer}`);
  if (t.proof) console.log(`  Proof: ${t.proof}`);
}

function bawCommands({ chainId, from, to, valueWei, data }) {
  const preview =
    `baw contract-call preview --binanceChainId ${chainId} --from ${from} ` +
    `--to ${to} --value ${valueWei} --inputData ${data} --json`;
  return {
    preview,
    executeNote: "After you confirm the preview (simulation clean, no risks), run:\n  baw contract-call execute --requestId <requestId from the preview> --json",
  };
}

function fail(msg) {
  console.error("Error: " + msg);
  process.exit(1);
}

module.exports = {
  NETWORKS,
  STATUS,
  parseArgs,
  loadAbi,
  loadAbiFile,
  loadDeployment,
  getReadBoard,
  getWallet,
  getSenderAddress,
  encodeCall,
  shortAddr,
  describeTask,
  printTask,
  bawCommands,
  fail,
};
