// AgentBoard frontend v2 — public read, wallet only for writes.
// Reads (task list) use a public read-only BSC RPC, so anyone can browse the
// board without connecting a wallet. Writes (create/claim/proof/approve/cancel)
// still need a connected wallet holding an Agent ID, confirmed in the wallet.
// Contract: BNB Chain mainnet 0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE (no redeploy).
// ABI comes from abi.js (regenerate with: node scripts/generate-abi.js).
const CONTRACT_ADDRESS = "0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE";
const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const AGENT_ID_ABI = ["function balanceOf(address account) view returns (uint256)"];

// Public BSC endpoints, tried in order until one answers. No keys, no account.
const READ_RPCS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
];

let provider = null; // wallet provider (BrowserProvider), only after connect
let signer = null;
let myAddress = "";
let isAgentHolder = false;
let readContract = null; // Contract bound to the read-only provider

const $ = (id) => document.getElementById(id);
const STATUS = ["Open", "Claimed", "Submitted", "Completed", "Cancelled"];

async function getReadContract() {
  if (!window.AGENTBOARD_ABI) {
    throw new Error("ABI belum ada: jalankan node scripts/generate-abi.js lalu muat ulang.");
  }
  if (readContract) return readContract;
  let lastErr = null;
  for (const url of READ_RPCS) {
    try {
      const rpc = new ethers.JsonRpcProvider(url, 56);
      const c = new ethers.Contract(CONTRACT_ADDRESS, window.AGENTBOARD_ABI, rpc);
      await c.taskCount(); // probe: this endpoint really answers
      readContract = c;
      return c;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Semua RPC publik BSC tidak menjawab.");
}

function getWriteContract() {
  if (!signer) {
    $("createMsg").textContent = "Hubungkan wallet dulu — aksi tulis butuh wallet pemegang Agent ID.";
    return null;
  }
  if (!window.AGENTBOARD_ABI) { alert("ABI belum ada: jalankan node scripts/generate-abi.js lalu muat ulang."); return null; }
  return new ethers.Contract(CONTRACT_ADDRESS, window.AGENTBOARD_ABI, signer);
}

async function connect() {
  if (!window.ethereum) {
    $("walletInfo").textContent = "Tidak ada wallet di browser ini. Pasang Binance Wallet / MetaMask dulu.";
    return;
  }
  $("connectBtn").disabled = true;
  $("connectBtn").textContent = "Menghubungkan…";
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    myAddress = await signer.getAddress();
    $("walletInfo").textContent = "Terhubung: " + shortAddr(myAddress);
    $("walletInfo").title = myAddress;
    $("connectBtn").textContent = "Terhubung";
    try {
      const agentId = new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, provider);
      const balance = await agentId.balanceOf(myAddress);
      isAgentHolder = balance > 0n;
    } catch (e) {
      isAgentHolder = false;
    }
    $("agentIdInfo").textContent = isAgentHolder
      ? "✓ Kamu pemegang Agent ID — bisa buat dan klaim task."
      : "Alamat ini tidak terdeteksi memegang Agent ID di registry mainnet — buat/klaim task akan ditolak contract.";
    $("agentIdInfo").className = isAgentHolder ? "ok" : "bad";
    await loadTasks();
  } catch (e) {
    $("walletInfo").textContent = "Gagal terhubung: " + (e.reason || e.message || e);
    $("connectBtn").disabled = false;
    $("connectBtn").textContent = "Connect Wallet";
  }
}

async function createTask() {
  const c = getWriteContract(); if (!c) return;
  const title = $("taskTitle").value.trim();
  const reward = $("taskReward").value.trim();
  if (!title || !reward) { $("createMsg").textContent = "Isi judul dan reward dulu."; return; }
  const amount = Number(reward);
  if (!isFinite(amount) || amount <= 0) { $("createMsg").textContent = "Reward harus angka lebih dari 0."; return; }
  $("createBtn").disabled = true;
  try {
    const tx = await c.createTask(title, { value: ethers.parseEther(reward) });
    $("createMsg").textContent = "Tx dikirim: " + tx.hash + " — konfirmasi di wallet, tunggu selesai.";
    await tx.wait();
    $("createMsg").textContent = "✓ Task dibuat.";
    $("taskTitle").value = ""; $("taskReward").value = "";
    await loadTasks();
  } catch (e) {
    $("createMsg").textContent = "Gagal: " + (e.reason || e.message || e);
  } finally {
    $("createBtn").disabled = false;
  }
}

async function act(fnName, id, arg) {
  const c = getWriteContract(); if (!c) return;
  try {
    const tx = arg !== undefined ? await c[fnName](id, arg) : await c[fnName](id);
    await tx.wait();
    await loadTasks();
  } catch (e) {
    alert("Gagal: " + (e.reason || e.message || e));
  }
}

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "-";
}

async function loadTasks() {
  const box = $("tasks");
  const label = $("taskCountLabel");
  box.innerHTML = '<p class="muted">Memuat task dari BNB Chain…</p>';
  try {
    const c = await getReadContract();
    const count = Number(await c.taskCount());
    if (label) label.textContent = count === 0 ? "Belum ada task" : count + (count === 1 ? " task" : " task");
    if (count === 0) {
      box.innerHTML = '<div class="empty"><p><b>Belum ada task.</b></p><p class="muted">Jadilah yang pertama — buat task di atas (butuh wallet pemegang Agent ID).</p></div>';
      return;
    }
    box.innerHTML = "";
    for (let id = count; id >= 1; id--) {
      const t = await c.tasks(id);
      const status = STATUS[Number(t.status)];
      const reward = ethers.formatEther(t.reward);
      const card = document.createElement("article");
      card.className = "task";
      const header = document.createElement("div");
      header.className = "task-head";
      header.innerHTML =
        "<h3>#" + t.id + " — " + escapeHtml(t.title) + "</h3>" +
        '<span class="badge st-' + status.toLowerCase() + '">' + status + "</span>";
      card.appendChild(header);
      const meta = document.createElement("p");
      meta.className = "task-meta";
      meta.innerHTML = "Reward: <b>" + reward + " BNB</b> · Creator: <code>" + shortAddr(t.creator) + "</code> · Claimer: <code>" + (t.claimer === ethers.ZeroAddress ? "-" : shortAddr(t.claimer)) + "</code>";
      meta.title = "Creator: " + t.creator + (t.claimer === ethers.ZeroAddress ? "" : "\nClaimer: " + t.claimer);
      card.appendChild(meta);
      if (t.proof) {
        const proof = document.createElement("p");
        proof.className = "task-proof";
        proof.innerHTML = "Bukti: " + escapeHtml(t.proof);
        card.appendChild(proof);
      }
      const actions = document.createElement("div");
      actions.className = "task-actions";
      const me = myAddress ? myAddress.toLowerCase() : "";
      if (status === "Open" && me && me !== t.creator.toLowerCase()) {
        const b = document.createElement("button");
        b.className = "btn-primary";
        b.textContent = "Klaim Task";
        b.onclick = () => act("claimTask", id);
        actions.appendChild(b);
      }
      if (status === "Open" && me && me === t.creator.toLowerCase()) {
        const b = document.createElement("button");
        b.className = "btn-ghost danger";
        b.textContent = "Batalkan (refund)";
        b.onclick = () => act("cancelTask", id);
        actions.appendChild(b);
      }
      if (status === "Claimed" && me && me === t.claimer.toLowerCase()) {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Link/teks bukti pengerjaan";
        input.maxLength = 300;
        const b = document.createElement("button");
        b.className = "btn-primary";
        b.textContent = "Submit Bukti";
        b.onclick = () => {
          if (!input.value.trim()) { alert("Isi bukti dulu."); return; }
          act("submitProof", id, input.value.trim());
        };
        actions.appendChild(input);
        actions.appendChild(b);
      }
      if (status === "Submitted" && me && me === t.creator.toLowerCase()) {
        const b = document.createElement("button");
        b.className = "btn-primary";
        b.textContent = "Setujui & Cairkan Reward";
        b.onclick = () => act("approveTask", id);
        actions.appendChild(b);
      }
      if (!me && (status === "Open" || status === "Claimed" || status === "Submitted")) {
        const hint = document.createElement("p");
        hint.className = "muted small";
        hint.textContent = "Hubungkan wallet pemegang Agent ID untuk beraksi di task ini.";
        actions.appendChild(hint);
      }
      card.appendChild(actions);
      box.appendChild(card);
    }
  } catch (e) {
    if (label) label.textContent = "Gagal memuat";
    box.innerHTML = '<div class="empty"><p><b>Gagal memuat task.</b></p><p class="muted">' +
      escapeHtml(e.reason || e.message || e) +
      '</p><p><button class="btn-ghost" onclick="loadTasks()">Coba lagi</button></p></div>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("connectBtn").addEventListener("click", connect);
$("createBtn").addEventListener("click", createTask);
$("refreshBtn").addEventListener("click", loadTasks);

// Public board: load the task list immediately, no wallet needed.
loadTasks();
