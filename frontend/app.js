// AgentBoard frontend — full flow v1.
// Fill CONTRACT_ADDRESS after deploy (see deployments/bscTestnet.json or bsc.json).
// ABI comes from abi.js (regenerate with: node scripts/generate-abi.js).
const CONTRACT_ADDRESS = ""; // contoh: "0x..."
const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const AGENT_ID_ABI = ["function balanceOf(address account) view returns (uint256)"];

let provider = null;
let signer = null;
let myAddress = "";
let contract = null;
let isAgentHolder = false;

const $ = (id) => document.getElementById(id);
const STATUS = ["Open", "Claimed", "Submitted", "Completed", "Cancelled"];

function getContract() {
  if (!CONTRACT_ADDRESS) { alert("Contract belum di-deploy: isi CONTRACT_ADDRESS di app.js dulu."); return null; }
  if (!window.AGENTBOARD_ABI) { alert("ABI belum ada: jalankan node scripts/generate-abi.js lalu muat ulang."); return null; }
  if (!contract) contract = new ethers.Contract(CONTRACT_ADDRESS, window.AGENTBOARD_ABI, signer);
  return contract;
}

async function connect() {
  if (!window.ethereum) {
    $("walletInfo").textContent = "Tidak ada wallet di browser ini. Pasang Binance Wallet / MetaMask dulu.";
    return;
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  myAddress = await signer.getAddress();
  $("walletInfo").textContent = "Terhubung: " + myAddress;
  // Agent ID check against the real registry (mainnet). On testnet the
  // deployed contract points at a MockAgentID instead — see DEPLOY-TESTNET.md.
  try {
    const agentId = new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, provider);
    const balance = await agentId.balanceOf(myAddress);
    isAgentHolder = balance > 0n;
  } catch (e) {
    isAgentHolder = false;
  }
  $("agentIdInfo").textContent = isAgentHolder
    ? "Kamu pemegang Agent ID. Bisa buat dan klaim task."
    : "Alamat ini tidak terdeteksi memegang Agent ID di registry mainnet — buat/klaim task akan ditolak contract.";
  await loadTasks();
}

async function createTask() {
  const c = getContract(); if (!c) return;
  const title = $("taskTitle").value.trim();
  const reward = $("taskReward").value.trim();
  if (!title || !reward) { $("createMsg").textContent = "Isi judul dan reward dulu."; return; }
  try {
    const tx = await c.createTask(title, { value: ethers.parseEther(reward) });
    $("createMsg").textContent = "Tx dikirim: " + tx.hash + " — konfirmasi di wallet, tunggu selesai.";
    await tx.wait();
    $("createMsg").textContent = "Task dibuat.";
    $("taskTitle").value = ""; $("taskReward").value = "";
    await loadTasks();
  } catch (e) {
    $("createMsg").textContent = "Gagal: " + (e.reason || e.message || e);
  }
}

async function act(fnName, id, arg) {
  const c = getContract(); if (!c) return;
  try {
    const tx = arg !== undefined ? await c[fnName](id, arg) : await c[fnName](id);
    await tx.wait();
    await loadTasks();
  } catch (e) {
    alert("Gagal: " + (e.reason || e.message || e));
  }
}

async function loadTasks() {
  const box = $("tasks");
  const c = getContract();
  if (!c) { box.textContent = "Contract belum diisi di app.js (belum deploy)."; return; }
  try {
    const count = Number(await c.taskCount());
    if (count === 0) { box.textContent = "Belum ada task. Buat task pertama di atas."; return; }
    box.innerHTML = "";
    for (let id = count; id >= 1; id--) {
      const t = await c.tasks(id);
      const status = STATUS[Number(t.status)];
      const reward = ethers.formatEther(t.reward);
      const card = document.createElement("div");
      card.className = "task";
      card.innerHTML =
        "<h3>#" + t.id + " — " + escapeHtml(t.title) + "</h3>" +
        "<p>Status: <b>" + status + "</b> · Reward: <b>" + reward + " BNB</b></p>" +
        "<p>Creator: <code>" + t.creator + "</code><br>Claimer: <code>" + (t.claimer === ethers.ZeroAddress ? "-" : t.claimer) + "</code></p>" +
        (t.proof ? "<p>Bukti: " + escapeHtml(t.proof) + "</p>" : "");
      if (status === "Open" && myAddress && myAddress.toLowerCase() !== t.creator.toLowerCase()) {
        const b = document.createElement("button");
        b.textContent = "Klaim Task";
        b.onclick = () => act("claimTask", id);
        card.appendChild(b);
      }
      if (status === "Open" && myAddress && myAddress.toLowerCase() === t.creator.toLowerCase()) {
        const b = document.createElement("button");
        b.textContent = "Batalkan (refund)";
        b.onclick = () => act("cancelTask", id);
        card.appendChild(b);
      }
      if (status === "Claimed" && myAddress && myAddress.toLowerCase() === t.claimer.toLowerCase()) {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Link/teks bukti pengerjaan";
        const b = document.createElement("button");
        b.textContent = "Submit Bukti";
        b.onclick = () => {
          if (!input.value.trim()) { alert("Isi bukti dulu."); return; }
          act("submitProof", id, input.value.trim());
        };
        card.appendChild(input);
        card.appendChild(b);
      }
      if (status === "Submitted" && myAddress && myAddress.toLowerCase() === t.creator.toLowerCase()) {
        const b = document.createElement("button");
        b.textContent = "Setujui & Cairkan Reward";
        b.onclick = () => act("approveTask", id);
        card.appendChild(b);
      }
      box.appendChild(card);
    }
  } catch (e) {
    box.textContent = "Gagal memuat task: " + (e.reason || e.message || e);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("connectBtn").addEventListener("click", connect);
$("createBtn").addEventListener("click", createTask);
$("refreshBtn").addEventListener("click", loadTasks);
