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

        print("Navigating to app (Mobile)...")
        page.add_init_script("localStorage.setItem('departs_welcome_seen', 'true')")
        page.goto("http://localhost:8788/?stopId=U452Z1P&stopName=Malostranská")

        # Wait for drawer and ensure it's open
        drawer = page.locator('[data-slot="drawer-content"]')
        try:
            drawer.wait_for(state="visible", timeout=10000)
            print("Drawer visible on mobile.")
            # Wait for any entrance animations
            time.sleep(2)
        except:
            print("Drawer NOT visible!")
            page.screenshot(path="verification/final_mobile_failed.png")
            browser.close()
            return

        # Check for handle
        handle = page.locator('[data-slot="drawer-handle"]')
        if handle.is_visible():
            print("Drawer handle is visible.")
        else:
            print("Drawer handle NOT found!")

        page.screenshot(path="verification/final_mobile_drawer_open.png")

        # Swipe down to close
        header = page.locator('[data-slot="drawer-header"]')
        box = header.bounding_box()

        print(f"Swiping down from {box['x'] + box['width']/2}, {box['y'] + box['height']/2}...")
        page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
        page.mouse.down()
        page.mouse.move(box['x'] + box['width']/2, 840, steps=50)
        page.mouse.up()

        time.sleep(2)
        is_visible = drawer.is_visible()
        print(f"Drawer visible after swipe: {is_visible}")

        page.screenshot(path="verification/final_mobile_drawer_closed.png")

        browser.close()

if __name__ == "__main__":
    run()
