from playwright.sync_api import sync_playwright, expect
import time
import re

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile-like viewport
        page = browser.new_page(viewport={'width': 400, 'height': 800})

        try:
            print("Navigating to app...")
            page.goto("http://localhost:4173", wait_until="networkidle")

            # Wait for content
            page.wait_for_selector("canvas", timeout=15000)

            # Dismiss welcome modal
            welcome_btn = page.get_by_role("button", name=re.compile(r"Začínáme|Get Started"))
            if welcome_btn.is_visible():
                welcome_btn.click()
                time.sleep(1)

            # Click alerts button using coordinates as locators were unreliable in previous steps
            # In a 400x800 viewport, the control panel is at the right edge
            # Alerts button is typically 3rd from top in the control stack
            print("Clicking alerts button by coordinates (375, 175)...")
            page.mouse.click(375, 175)

            time.sleep(2)
            page.screenshot(path="verify_rss_modal_final.png")
            print("Screenshot saved: verify_rss_modal_final.png")

            # Try to click exclusions tab
            # In the 400px mobile view, the modal is full screen or centered.
            # Tabs are at the top. Let's try coordinates for the second tab (Exclusions).
            print("Clicking exclusions tab by coordinates (260, 100)...")
            page.mouse.click(260, 100)
            time.sleep(2)
            page.screenshot(path="verify_rss_exclusions_final.png")
            print("Screenshot saved: verify_rss_exclusions_final.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verify_rss_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
