#!/usr/bin/env python3
"""Render the built dashboard and take the three entry screenshots."""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent
URL = (ROOT / "out" / "dashboard" / "index.html").as_uri()
DEST = ROOT / "screenshots"
DEST.mkdir(exist_ok=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(URL)
    page.wait_for_selector("tbody tr[data-slug]")
    page.wait_for_timeout(400)

    # 1 — the board, as it opens (rank 1 selected, detail alongside).
    page.screenshot(path=str(DEST / "1-board.png"))

    # 2 — a watchlist protocol's detail view: Gauntlet (rank 3).
    page.click("tbody tr[data-slug='gauntlet']")
    page.wait_for_timeout(350)
    page.screenshot(path=str(DEST / "2-detail.png"))

    # 3 — a filtered view: Lending only, watchlist only, with a filtered row's detail open
    # so the panel agrees with the board it sits beside.
    page.select_option("#cat", "Lending")
    page.check("#wl")
    page.wait_for_timeout(350)
    page.click("tbody tr[data-slug]")
    page.wait_for_timeout(350)
    page.screenshot(path=str(DEST / "3-filtered.png"))

    browser.close()

for f in sorted(DEST.glob("*.png")):
    print(f.name, f.stat().st_size)
