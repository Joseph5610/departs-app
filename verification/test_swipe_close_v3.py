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
        # Clear storage to ensure welcome modal is visible or check if we can skip it
        page = context.new_page()

        print("Navigating to app...")
        # Use a stop that definitely has data to ensure the drawer has content
        page.goto("http://localhost:8788/?stopId=U452Z1P&stopName=Malostranská")

        # Dismiss Welcome Modal if it exists
        try:
            # The button text is localized. Let's try to find it by role and then click.
            # In Czech it's "Začínáme", in English it's "Get Started"
            # We can also look for the button with ArrowRight icon or just the one button in the dialog.
            page.wait_for_selector('button:has-text("Začínáme"), button:has-text("Get Started")', timeout=5000)
            print("Welcome modal detected. Clicking button...")
            page.click('button:has-text("Začínáme"), button:has-text("Get Started")')
            time.sleep(1) # Wait for it to close
        except:
            print("Welcome modal not found via text.")

        # Wait for drawer
        drawer = page.locator('[data-slot="drawer-content"]')
        try:
            drawer.wait_for(state="visible", timeout=10000)
            print("Drawer visible on mobile.")

            # Print drawer bounding box
            bbox = drawer.bounding_box()
            print(f"Drawer bounding box: {bbox}")
        except:
            print("Drawer NOT visible!")
            # It might be behind the welcome modal if it failed to click.
            page.screenshot(path="verification/failed_mobile_drawer_v3.png")
            browser.close()
            return

        page.screenshot(path="verification/mobile_drawer_before_swipe_v3.png")

        # Swipe down to close
        # Target the header
        header = page.locator('[data-slot="drawer-header"]')
        box = header.bounding_box()

        print(f"Swiping down from {box['x'] + box['width']/2}, {box['y'] + box['height']/2}...")

        # We use a touch gesture
        page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
        page.mouse.down()
        # Swipe down significantly
        page.mouse.move(box['x'] + box['width']/2, box['y'] + 600, steps=50)
        page.mouse.up()

        # Wait for animation
        print("Waiting for animation...")
        time.sleep(2)

        is_visible = drawer.is_visible()
        print(f"Drawer visible after swipe: {is_visible}")

        if is_visible:
             bbox_after = drawer.bounding_box()
             print(f"Drawer bounding box after swipe: {bbox_after}")

        page.screenshot(path="verification/mobile_drawer_after_swipe_v3.png")

        browser.close()

if __name__ == "__main__":
    run()
