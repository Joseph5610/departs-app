import os
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        os.makedirs("verification", exist_ok=True)

        # Launch with desktop viewport
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()

        print("Navigating to app (Desktop)...")
        page.add_init_script("localStorage.setItem('departs_welcome_seen', 'true')")
        page.goto("http://localhost:8788/?stopId=U452Z1P&stopName=Malostranská")

        # Wait for sidebar
        sidebar = page.locator('[role="dialog"]') # @base-ui SheetContent
        try:
            sidebar.wait_for(state="visible", timeout=10000)
            print("Sidebar visible on desktop.")
        except:
            print("Sidebar NOT visible on desktop!")
            page.screenshot(path="verification/failed_desktop_sidebar.png")
            browser.close()
            return

        page.screenshot(path="verification/desktop_sidebar_initial.png")

        # Click on the map (outside sidebar)
        print("Clicking outside sidebar on map...")
        page.mouse.click(800, 400)

        # Sidebar should still be visible
        time.sleep(1)
        is_visible = sidebar.is_visible()
        print(f"Sidebar visible after map click: {is_visible}")

        page.screenshot(path="verification/desktop_sidebar_after_click.png")

        browser.close()

if __name__ == "__main__":
    run()
