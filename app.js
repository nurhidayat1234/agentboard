// AgentBoard frontend v3 — points system (V2) on testnet, v1 on mainnet.
// Reads are public (read-only BSC RPC, no wallet needed). Writes need a
// connected wallet holding an Agent ID, confirmed in the wallet.
// - Mainnet (default): TaskBoard v1 0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE
//   (the contract in the Binance submission). Approve pays the reward out
//   immediately; there is no points system here yet.
// - Testnet (?network=testnet or the toggle): TaskBoardV2
//   0x5aCafb6d81e820Aa2FfEC7e616f26958147A7cEF — points per task (creator sets
//   1-100, default 10), reward goes to a pending balance on approve, and
//   claimBNB() withdraws it once the claimer has 100 points.
// ABIs: abi.js (v1) and abi-v2.js (v2).
const NETWORKS = {
  mainnet: {
    label: "BNB Chain",
    chainId: 56,
    contract: "0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE",
    abiKey: "AGENTBOARD_ABI",
    agentId: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
    rpcs: ["https://bsc-dataseed.binance.org/", "https://bsc-dataseed1.defibit.io/", "https://bsc-dataseed1.ninicoin.io/"],
    gasPriceGwei: "1",
    hasPoints: false,
  },
  testnet: {
    label: "BSC Testnet",
    chainId: 97,
    contract: "0x5aCafb6d81e820Aa2FfEC7e616f26958147A7cEF",
    abiKey: "AGENTBOARD_V2_ABI",
    agentId: "0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE", // MockAgentID
    rpcs: ["https://data-seed-prebsc-1-s1.binance.org:8545/", "https://data-seed-prebsc-2-s1.binance.org:8545/", "https://bsc-testnet-dataseed.bnbchain.org/"],
    gasPriceGwei: "3",
    hasPoints: true,
  },
};
const AGENT_ID_ABI = ["function balanceOf(address account) view returns (uint256)"];
const POINTS_TO_CLAIM = 100;

const params = new URLSearchParams(location.search);
let network = params.get("network") === "testnet" ? "testnet" : "mainnet";
let NET = NETWORKS[network];

let provider = null; // wallet provider (BrowserProvider), only after connect
let signer = null;
let myAddress = "";
let isAgentHolder = false;
let readContract = null; // Contract bound to the read-only provider
let myTasksCache = [];

const $ = (id) => document.getElementById(id);
const STATUS = ["Open", "Claimed", "Submitted", "Completed", "Cancelled"];

function getAbi() {
  const abi = window[NET.abiKey];
  if (!abi) throw new Error("ABI belum ada (" + NET.abiKey + ").");
  return abi;
}

async function getReadContract() {
  if (readContract) return readContract;
  let lastErr = null;
  for (const url of NET.rpcs) {
    try {
      const rpc = new ethers.JsonRpcProvider(url, NET.chainId);
      const c = new ethers.Contract(NET.contract, getAbi(), rpc);
      await c.taskCount(); // probe: this endpoint really answers
      readContract = c;
      return c;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Semua RPC publik tidak menjawab.");
}

function getWriteContract() {
  if (!signer) {
    $("createMsg").textContent = "Hubungkan wallet dulu — aksi tulis butuh wallet pemegang Agent ID.";
    return null;
  }
  return new ethers.Contract(NET.contract, getAbi(), signer);
}

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "-";
}

async function switchChain() {
  const chainIdHex = "0x" + NET.chainId.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (e) {
    if (e.code === 4902 && network === "testnet") {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: chainIdHex, chainName: "BSC Testnet", nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 }, rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"], blockExplorerUrls: ["https://testnet.bscscan.com/"] }],
      });
    } else {
      throw e;
    }
  }
}

async function connect() {
  if (!window.ethereum) {
    $("walletInfo").textContent = "Tidak ada wallet di browser ini. Pasang Binance Wallet / MetaMask dulu.";
    return;
  }
  $("connectBtn").disabled = true;
  $("connectBtn").textContent = "Menghubungkan…";
  try {
    await switchChain();
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    myAddress = await signer.getAddress();
    $("walletInfo").textContent = "Terhubung: " + shortAddr(myAddress) + " (" + NET.label + ")";
    $("walletInfo").title = myAddress;
    $("connectBtn").textContent = "Terhubung";
    try {
      const agentId = new ethers.Contract(NET.agentId, AGENT_ID_ABI, provider);
      const balance = await agentId.balanceOf(myAddress);
      isAgentHolder = balance > 0n;
    } catch (e) {
      isAgentHolder = false;
    }
    $("agentIdInfo").textContent = isAgentHolder
      ? "✓ Kamu pemegang Agent ID — bisa buat dan klaim task."
      : "Alamat ini tidak terdeteksi memegang Agent ID di " + NET.label + " — buat/klaim task akan ditolak contract.";
    $("agentIdInfo").className = isAgentHolder ? "ok" : "bad";
    await loadTasks();
    await loadDashboard();
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
  let taskPoints = 10;
  if (NET.hasPoints) {
    taskPoints = Number($("taskPoints").value);
    if (!Number.isInteger(taskPoints) || taskPoints < 1 || taskPoints > 100) {
      $("createMsg").textContent = "Point harus bilangan 1–100.";
      return;
    }
  }
  $("createBtn").disabled = true;
  try {
    const value = ethers.parseEther(reward);
    const gasPrice = ethers.parseUnits(NET.gasPriceGwei, "gwei");
    const tx = NET.hasPoints
      ? await c.createTask(title, taskPoints, { value, gasPrice })
      : await c.createTask(title, { value, gasPrice });
    $("createMsg").textContent = "Tx dikirim: " + tx.hash + " — konfirmasi di wallet, tunggu selesai.";
    await tx.wait();
    $("createMsg").textContent = "✓ Task dibuat" + (NET.hasPoints ? ` (${taskPoints} point).` : ".");
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
    const gasPrice = ethers.parseUnits(NET.gasPriceGwei, "gwei");
    const tx = arg !== undefined
      ? await c[fnName](id, arg, { gasPrice })
      : await c[fnName](id, { gasPrice });
    await tx.wait();
    await loadTasks();
    await loadDashboard();
  } catch (e) {
    alert("Gagal: " + (e.reason || e.message || e));
  }
}

async function claimBNB() {
  const c = getWriteContract(); if (!c) return;
  $("claimBtn").disabled = true;
  try {
    const tx = await c.claimBNB({ gasPrice: ethers.parseUnits(NET.gasPriceGwei, "gwei") });
    $("claimMsg").textContent = "Tx dikirim: " + tx.hash + " — tunggu selesai.";
    await tx.wait();
    $("claimMsg").textContent = "✓ BNB berhasil diklaim.";
    await loadDashboard();
  } catch (e) {
    $("claimMsg").textContent = "Gagal: " + (e.reason || e.message || e);
  } finally {
    $("claimBtn").disabled = false;
  }
}

async function loadDashboard() {
  const dash = $("dashboard");
  if (!myAddress) { dash.style.display = "none"; return; }
  dash.style.display = "block";
  if (!NET.hasPoints) {
    $("dashPoints").textContent = "—";
    $("dashProgress").style.width = "0%";
    $("dashProgressText").textContent = "Point system belum live di mainnet — coba di testnet (toggle di atas).";
    $("dashDone").textContent = "—";
    $("dashPending").textContent = "—";
    $("claimBtn").disabled = true;
    $("claimMsg").textContent = "Claim BNB (point) hanya tersedia di testnet untuk saat ini.";
    renderMyTasks();
    return;
  }
  try {
    const c = await getReadContract();
    const pts = Number(await c.points(myAddress));
    const pending = await c.pendingBNB(myAddress);
    const done = Number(await c.tasksCompleted(myAddress));
    $("dashPoints").textContent = pts;
    $("dashProgress").style.width = Math.min(100, pts) + "%";
    $("dashProgressText").textContent = pts >= POINTS_TO_CLAIM
      ? "✓ 100 point tercapai — saldo pending bisa diklaim."
      : `${pts} / 100 point — butuh ${POINTS_TO_CLAIM - pts} lagi untuk klaim.`;
    $("dashDone").textContent = done;
    $("dashPending").textContent = ethers.formatEther(pending) + " BNB";
    const canClaim = pts >= POINTS_TO_CLAIM && pending > 0n;
    $("claimBtn").disabled = !canClaim;
    $("claimMsg").textContent = canClaim
      ? "Siap diklaim: seluruh saldo pending akan masuk ke wallet kamu."
      : (pending === 0n ? "Belum ada saldo pending." : `Terkunci — butuh ${POINTS_TO_CLAIM - pts} point lagi.`);
  } catch (e) {
    $("dashProgressText").textContent = "Gagal memuat dashboard: " + (e.reason || e.message || e);
  }
  renderMyTasks();
}

function renderMyTasks() {
  const box = $("myTasks");
  if (!myAddress) { box.innerHTML = ""; return; }
  const mine = myTasksCache.filter((t) => t.creator === myAddress || t.claimer === myAddress);
  if (mine.length === 0) {
    box.innerHTML = '<p class="muted">Belum ada task yang kamu buat atau klaim di ' + NET.label + '.</p>';
    return;
  }
  box.innerHTML = "";
  for (const t of mine) {
    const row = document.createElement("div");
    row.className = "mytask";
    const role = t.creator === myAddress ? "Creator" : "Claimer";
    row.innerHTML = "<b>#" + t.id + " — " + escapeHtml(t.title) + "</b> · " + STATUS[Number(t.status)] +
      " · " + role + " · " + ethers.formatEther(t.reward) + " BNB" +
      (t.points !== null && t.points !== undefined ? " · " + t.points + " point" : "");
    box.appendChild(row);
  }
}

async function loadTasks() {
  const box = $("tasks");
  const label = $("taskCountLabel");
  box.innerHTML = '<p class="muted">Memuat task dari ' + NET.label + '…</p>';
  try {
    const c = await getReadContract();
    const count = Number(await c.taskCount());
    if (label) label.textContent = count === 0 ? "Belum ada task" : count + (count === 1 ? " task" : " task");
    myTasksCache = [];
    if (count === 0) {
      box.innerHTML = '<div class="empty"><p><b>Belum ada task.</b></p><p class="muted">Jadilah yang pertama — buat task di atas (butuh wallet pemegang Agent ID).</p></div>';
      renderMyTasks();
      return;
    }
    box.innerHTML = "";
    for (let id = count; id >= 1; id--) {
      const t = await c.tasks(id);
      const status = STATUS[Number(t.status)];
      const reward = ethers.formatEther(t.reward);
      const pts = t.points !== undefined ? Number(t.points) : null;
      myTasksCache.push({ id: Number(t.id), title: t.title, creator: t.creator, claimer: t.claimer, reward: t.reward, status: Number(t.status), points: pts });
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
      meta.innerHTML = "Reward: <b>" + reward + " BNB</b>" +
        (pts !== null ? " · Points: <b>" + pts + "</b>" : "") +
        " · Creator: <code>" + shortAddr(t.creator) + "</code> · Claimer: <code>" + (t.claimer === ethers.ZeroAddress ? "-" : shortAddr(t.claimer)) + "</code>";
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
    renderMyTasks();
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

function setNetwork(next) {
  network = next;
  NET = NETWORKS[next];
  readContract = null;
  provider = null; signer = null; myAddress = ""; isAgentHolder = false;
  myTasksCache = [];
  $("walletInfo").textContent = "Belum terhubung. Daftar task di bawah tetap bisa dilihat tanpa wallet.";
  $("agentIdInfo").textContent = "";
  $("connectBtn").disabled = false;
  $("connectBtn").textContent = "Connect Wallet";
  $("dashboard").style.display = "none";
  document.querySelectorAll(".net-btn").forEach((b) => b.classList.toggle("active", b.dataset.net === next));
  $("pointsField").style.display = NET.hasPoints ? "block" : "none";
  $("contractAddr").textContent = NET.contract;
  $("contractAddrFooter").textContent = NET.contract;
  const url = new URL(location.href);
  if (next === "testnet") url.searchParams.set("network", "testnet");
  else url.searchParams.delete("network");
  history.replaceState(null, "", url);
  loadTasks();
}

$("connectBtn").addEventListener("click", connect);
$("createBtn").addEventListener("click", createTask);
$("refreshBtn").addEventListener("click", loadTasks);
$("claimBtn").addEventListener("click", claimBNB);
document.querySelectorAll(".net-btn").forEach((b) => b.addEventListener("click", () => setNetwork(b.dataset.net)));

// Init: apply the network from the URL, then load the public task list.
document.querySelectorAll(".net-btn").forEach((b) => b.classList.toggle("active", b.dataset.net === network));
$("pointsField").style.display = NET.hasPoints ? "block" : "none";
$("contractAddr").textContent = NET.contract;
$("contractAddrFooter").textContent = NET.contract;
loadTasks();
