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
            page.screenshot(path="verification/height_verify_failed.png")
            browser.close()
            return

        # Check height
        box = drawer.bounding_box()
        viewport_height = 844
        max_allowed_height = viewport_height * 0.82

        print(f"Drawer height: {box['height']}px (Max allowed: {max_allowed_height}px)")

        if box['height'] > max_allowed_height + 5: # Small buffer for borders/etc
            print(f"FAILURE: Drawer too high! {box['height']} > {max_allowed_height}")
        else:
            print("SUCCESS: Drawer height is within limits.")

        page.screenshot(path="verification/height_verify_drawer_open.png")

        # Swipe down to close
        header = page.locator('[data-slot="drawer-header"]')
        header_box = header.bounding_box()

        print(f"Swiping down from {header_box['x'] + header_box['width']/2}, {header_box['y'] + header_box['height']/2}...")
        page.mouse.move(header_box['x'] + header_box['width']/2, header_box['y'] + header_box['height']/2)
        page.mouse.down()
        page.mouse.move(header_box['x'] + header_box['width']/2, 840, steps=50)
        page.mouse.up()

        time.sleep(2)
        is_visible = drawer.is_visible()
        print(f"Drawer visible after swipe: {is_visible}")

        page.screenshot(path="verification/height_verify_drawer_closed.png")

        browser.close()

if __name__ == "__main__":
    run()
