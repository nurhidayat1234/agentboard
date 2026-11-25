# Browser E2E for the testnet open board: two throwaway wallets, NEITHER holds a
# Mock Agent ID. Drives the real website UI through a minimal injected
# EIP-1193 provider (the shim is the wallet: it signs + broadcasts with a low
# gas price, everything else passes through to the BSC Testnet RPC).
#   .venv-test/bin/python demo/test-browser-e2e.py
# Requires /tmp/browser-e2e-wallets.json (created by the funding step).
import json, os, sys
from playwright.sync_api import sync_playwright

W = json.load(open("/tmp/browser-e2e-wallets.json"))
CREATOR, CLAIMER = W["creator"], W["claimer"]

SHIM = """
const ACCOUNTS = [
  { addr: "%s", key: "%s" },
  { addr: "%s", key: "%s" },
];
let active = 0;
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random()*1e9), method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}
window.ethereum = {
  isMetaMask: true,
  request: async ({ method, params }) => {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [ACCOUNTS[active].addr];
    if (method === "eth_chainId") return "0x61";
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    if (method === "eth_sendTransaction") {
      const tx = params[0];
      const wallet = new window.ethers.Wallet(ACCOUNTS[active].key);
      const nonce = await rpc("eth_getTransactionCount", [ACCOUNTS[active].addr, "pending"]);
      const raw = await wallet.signTransaction({
        to: tx.to, data: tx.data, value: tx.value || "0x0",
        gasLimit: tx.gas || tx.gasLimit || 600000,
        gasPrice: window.ethers.parseUnits("0.1", "gwei"),
        nonce: Number(nonce), chainId: 97,
      });
      return await rpc("eth_sendRawTransaction", [raw]);
    }
    return await rpc(method, params || []);
  },
  on: () => {}, removeListener: () => {},
};
window.__switchAccount = (i) => { active = i; };
""" % (CREATOR["address"], CREATOR["key"], CLAIMER["address"], CLAIMER["key"])

def short(a):
    return a[:6] + "…" + a[-4:]

def main():
    errors = []
    dialogs = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, proxy={"server": "http://127.0.0.1:18080", "bypass": "localhost,127.0.0.1"}, args=["--no-sandbox", "--disable-gpu"])
        page = b.new_page(viewport={"width": 1280, "height": 900}, ignore_https_errors=True)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
        page.add_init_script(SHIM)
        page.goto("http://127.0.0.1:8139/?network=testnet", wait_until="domcontentloaded")
        page.wait_for_timeout(8000)

        # 1. Connect as creator (no Agent ID).
        page.click("#connectBtn")
        page.wait_for_selector("text=Terhubung:", timeout=30000)
        # The Agent ID / gate message is set after an async RPC read, so wait for it.
        page.wait_for_function("() => document.getElementById('agentIdInfo').textContent.length > 0", timeout=30000)
        assert short(CREATOR["address"]) in page.locator("#walletInfo").inner_text()
        assert "Testnet terbuka" in page.locator("#agentIdInfo").inner_text()
        assert "tidak terdeteksi" not in page.locator("#agentIdInfo").inner_text()
        print("1. Connected as creator (no Agent ID) — open-board message shown.")

        # 2. Create a task: 100 points, 0.00005 tBNB reward.
        # (If a previous run already created it, reuse that task instead.)
        page.click("#refreshBtn")
        page.wait_for_timeout(5000)
        if "Browser E2E open-board task" not in page.locator("#tasks").inner_text():
            page.fill("#taskTitle", "Browser E2E open-board task")
            page.fill("#taskReward", "0.00005")
            page.fill("#taskPoints", "100")
            page.click("#createBtn")
            page.wait_for_selector("text=Task dibuat", timeout=90000)
            page.wait_for_selector("text=Browser E2E open-board task", timeout=60000)
            print("2. Task created via UI by a wallet with NO Agent ID.")
        else:
            print("2. Task already exists from an earlier run — reusing it.")

        # 3. Switch to claimer, connect, claim.
        page.evaluate("window.__switchAccount(1)")
        page.click("#connectBtn")
        # Wait for the NEW address specifically — "Terhubung" is already on screen from the creator connect.
        page.wait_for_function("(addr) => document.getElementById('walletInfo').textContent.includes(addr)", arg=short(CLAIMER["address"]), timeout=30000)
        page.wait_for_function("() => document.getElementById('agentIdInfo').textContent.length > 0", timeout=30000)
        assert short(CLAIMER["address"]) in page.locator("#walletInfo").inner_text()
        page.click("#refreshBtn")
        page.wait_for_timeout(5000)
        card = page.locator("article.task", has_text="Browser E2E open-board task")
        def card_status():
            # inner_text() returns the CSS-rendered text (badges are uppercased
            # by text-transform), so normalize to upper case for comparisons.
            return card.locator(".badge").inner_text().strip().upper()
        # 3. Claim (skip if a previous run already claimed/proved/approved it).
        # Read the status ONCE per step: the list re-renders async, so a second
        # read a moment later can disagree with the first.
        if (st := card_status()) == "OPEN":
            card.locator("text=Klaim Task").click(timeout=30000)
            card.locator("text=CLAIMED").wait_for(state="visible", timeout=90000)
            print("3. Claimed via UI by a second wallet with NO Agent ID.")
        else:
            print(f"3. Claim skipped — task already {st}.")

        # 4. Submit proof.
        if (st := card_status()) == "CLAIMED":
            card.locator("input[placeholder='Link/teks bukti pengerjaan']").fill("https://github.com/nurhidayat1234/agentboard")
            card.locator("text=Submit Bukti").click(timeout=30000)
            card.locator("text=SUBMITTED").wait_for(state="visible", timeout=90000)
            print("4. Proof submitted via UI.")
        else:
            print(f"4. Proof skipped — task already {st}.")

        # 5. Switch back to creator, approve.
        page.evaluate("window.__switchAccount(0)")
        page.click("#connectBtn")
        page.wait_for_function("(addr) => document.getElementById('walletInfo').textContent.includes(addr)", arg=short(CREATOR["address"]), timeout=30000)
        page.wait_for_function("() => document.getElementById('agentIdInfo').textContent.length > 0", timeout=30000)
        page.click("#refreshBtn")
        page.wait_for_timeout(5000)
        st = card_status()
        if st == "SUBMITTED":
            card.locator("text=Setujui & Cairkan Reward").click(timeout=30000)
            card.locator("text=COMPLETED").wait_for(state="visible", timeout=90000)
            print("5. Approved via UI — task COMPLETED.")
        else:
            print(f"5. Approve skipped — task already {st}.")

        # 6. Dashboard as claimer: 100 points, pending 0.00005, claim enabled.
        page.evaluate("window.__switchAccount(1)")
        page.click("#connectBtn")
        page.wait_for_function("(addr) => document.getElementById('walletInfo').textContent.includes(addr)", arg=short(CLAIMER["address"]), timeout=30000)
        page.wait_for_function("() => document.getElementById('agentIdInfo').textContent.length > 0", timeout=30000)
        page.wait_for_timeout(3000)
        assert page.locator("#dashboard").is_visible()
        # Dashboard reads can lag the RPC a block behind; wait for the real value.
        page.wait_for_function("() => document.getElementById('dashPoints').textContent.trim() === '100'", timeout=60000)
        assert "0.00005" in page.locator("#dashPending").inner_text()
        assert page.locator("#claimBtn").is_enabled()
        page.click("#claimBtn")
        page.wait_for_selector("text=BNB berhasil diklaim", timeout=90000)
        print("6. Dashboard: 100 points, Claim BNB button enabled and withdrew the pending balance.")
        b.close()
    print("console errors:", errors if errors else "none")
    print("dialogs:", dialogs if dialogs else "none")
    assert not errors
    print("BROWSER E2E OPEN-BOARD OK")

main()
