import os
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        os.makedirs("verification", exist_ok=True)

        # Launch with mobile viewport
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True
        )
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:8788/?stopId=U452Z1P&stopName=Malostranská")

        # Dismiss Welcome Modal
        welcome_btn = page.get_by_role("button", name=r"Začínáme|Get Started")
        try:
            welcome_btn.wait_for(state="visible", timeout=5000)
            print("Dismissing welcome modal...")
            welcome_btn.click()
        except:
            print("Welcome modal not visible")

        # Wait for drawer
        drawer = page.locator('[data-slot="drawer-content"]')
        try:
            drawer.wait_for(state="visible", timeout=10000)
            print("Drawer visible on mobile.")
        except:
            print("Drawer NOT visible!")
            page.screenshot(path="verification/failed_mobile_drawer.png")
            browser.close()
            return

        page.screenshot(path="verification/mobile_drawer_before_swipe.png")

        # Swipe down to close
        # DrawerHeader is a good target for swipe
        header = page.locator('[data-slot="drawer-header"]')
        box = header.bounding_box()

        print(f"Swiping down from {box['x'] + box['width']/2}, {box['y'] + box['height']/2}...")

        page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
        page.mouse.down()
        # Swipe down 400px
        page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2 + 500, steps=20)
        page.mouse.up()

        # Wait for potential close
        time.sleep(1)

        is_visible = drawer.is_visible()
        print(f"Drawer visible after swipe: {is_visible}")

        page.screenshot(path="verification/mobile_drawer_after_swipe.png")

        browser.close()

if __name__ == "__main__":
    run()
