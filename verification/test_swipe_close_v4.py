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
        # Bypass welcome modal using localStorage
        page.add_init_script("localStorage.setItem('departs_welcome_seen', 'true')")

        # Use a stop that definitely has data
        page.goto("http://localhost:8788/?stopId=U452Z1P&stopName=Malostranská")

        # Wait for drawer
        drawer = page.locator('[data-slot="drawer-content"]')
        try:
            drawer.wait_for(state="visible", timeout=10000)
            print("Drawer visible on mobile.")

            # Ensure it is actually on screen
            bbox = drawer.bounding_box()
            print(f"Drawer bounding box: {bbox}")

            if bbox['y'] >= 844:
                 print("Drawer is technically 'visible' but off-screen!")
                 # Wait a bit more or try to force it?
                 time.sleep(2)
                 bbox = drawer.bounding_box()
                 print(f"Drawer bounding box after wait: {bbox}")
        except:
            print("Drawer NOT visible!")
            page.screenshot(path="verification/failed_mobile_drawer_v4.png")
            browser.close()
            return

        page.screenshot(path="verification/mobile_drawer_before_swipe_v4.png")

        # Swipe down to close
        # Target the header
        header = page.locator('[data-slot="drawer-header"]')
        box = header.bounding_box()

        if box:
            print(f"Swiping down from {box['x'] + box['width']/2}, {box['y'] + box['height']/2}...")

            # We use a touch gesture
            page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
            page.mouse.down()
            # Swipe down significantly
            page.mouse.move(box['x'] + box['width']/2, 840, steps=50)
            page.mouse.up()

            # Wait for animation
            print("Waiting for animation...")
            time.sleep(2)

            is_visible = drawer.is_visible()
            print(f"Drawer visible after swipe: {is_visible}")

            if is_visible:
                 bbox_after = drawer.bounding_box()
                 print(f"Drawer bounding box after swipe: {bbox_after}")
        else:
            print("Could not find header box for swipe!")

        page.screenshot(path="verification/mobile_drawer_after_swipe_v4.png")

        browser.close()

if __name__ == "__main__":
    run()
