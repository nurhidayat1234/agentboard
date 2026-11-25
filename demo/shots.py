"""Capture real screenshots of the live AgentBoard site for the demo video.
Proxy credentials come from the environment; nothing secret is printed."""
import os
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

OUT = os.path.expanduser("~/workspace/programmer/binance-agent-id/demo")
SITE = "https://nurhidayat1234.github.io/agentboard/"


def proxy_cfg():
    # Local forwarder (proxyfwd.py) adds egress auth; Chromium gets no-auth proxy.
    return {"server": "http://127.0.0.1:18080"}


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name))
    print("saved", name)


def scroll_to(page, text, name):
    el = page.get_by_text(text, exact=False).first
    el.scroll_into_view_if_needed()
    page.wait_for_timeout(900)
    shot(page, name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, proxy=proxy_cfg(),
                                args=["--no-sandbox", "--disable-gpu"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 800},
                              ignore_https_errors=True)
    page = ctx.new_page()
    page.goto(SITE, wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    shot(page, "shot-home.png")
    page.screenshot(path=os.path.join(OUT, "shot-full.png"), full_page=True)
    print("saved shot-full.png")
    scroll_to(page, "Buat Task", "shot-create.png")
    # Fill the create form (no submit) so the demo shows it in use.
    try:
        title = page.locator("input").first
        title.fill("Review landing page AgentBoard")
        desc = page.locator("textarea").first
        desc.fill("Berikan masukan jujur + screenshot, dibayar setelah disetujui.")
        reward = page.locator('input[type="number"], input[inputmode="decimal"]').first
        reward.fill("0.01")
        page.wait_for_timeout(600)
        shot(page, "shot-create-filled.png")
    except Exception as e:
        print("form fill skipped:", e)
    scroll_to(page, "Cara kerja", "shot-how.png")
    scroll_to(page, "Task", "shot-tasks.png")
    page.goto("https://github.com/nurhidayat1234/agentboard",
              wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    shot(page, "shot-repo.png")
    browser.close()
print("done")
