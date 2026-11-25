"""Local test of the AgentBoard v2 frontend: task list must load with NO wallet."""
import os
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8137/"
OUT = os.path.expanduser("~/workspace/programmer/binance-agent-id/demo")
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        proxy={"server": "http://127.0.0.1:18080", "bypass": "localhost,127.0.0.1"},
        args=["--no-sandbox", "--disable-gpu"])
    page = browser.new_page(viewport={"width": 1280, "height": 900},
                            ignore_https_errors=True)
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(12000)  # let the public RPC calls finish
    tasks = page.locator("#tasks").inner_text()
    label = page.locator("#taskCountLabel").inner_text()
    wallet = page.locator("#walletInfo").inner_text()
    print("tasks box:", repr(tasks[:200]))
    print("count label:", repr(label))
    print("wallet info:", repr(wallet))
    assert "Belum ada task" in tasks, "empty state not shown"
    assert "Gagal" not in tasks, "load failed"
    assert label == "Belum ada task", f"unexpected label: {label}"
    # Refresh button must work without a wallet too.
    page.locator("#refreshBtn").click()
    page.wait_for_timeout(8000)
    tasks2 = page.locator("#tasks").inner_text()
    assert "Belum ada task" in tasks2, "refresh broke the list"
    # Create without wallet must ask to connect, not crash.
    page.locator("#taskTitle").fill("Test")
    page.locator("#taskReward").fill("0.01")
    page.locator("#createBtn").click()
    page.wait_for_timeout(1500)
    print("create msg:", repr(page.locator("#createMsg").inner_text()))
    assert "Hubungkan wallet" in page.locator("#createMsg").inner_text()
    page.screenshot(path=os.path.join(OUT, "v2-desktop.png"))
    # Mobile viewport.
    mob = browser.new_page(viewport={"width": 390, "height": 844},
                           ignore_https_errors=True)
    mob.goto(URL, wait_until="domcontentloaded")
    mob.wait_for_timeout(12000)
    mob.screenshot(path=os.path.join(OUT, "v2-mobile.png"))
    print("mobile tasks box:", repr(mob.locator("#tasks").inner_text()[:120]))
    browser.close()

print("console errors:", errors if errors else "none")
print("LOCAL TEST OK")
