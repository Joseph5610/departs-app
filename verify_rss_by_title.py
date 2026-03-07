from playwright.sync_api import sync_playwright
import time
import re

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 400, 'height': 800})

        try:
            page.goto("http://localhost:4173", wait_until="networkidle")
            page.wait_for_selector("canvas", timeout=15000)

            # Close welcome modal
            welcome_btn = page.get_by_role("button", name=re.compile(r"Začínáme|Get Started"))
            if welcome_btn.is_visible():
                welcome_btn.click()
                time.sleep(1)

            # Click button by title
            alerts_btn = page.locator('button[title="Incidents and Exclusions"]')
            if alerts_btn.is_visible():
                print("Clicking Alerts button...")
                alerts_btn.click()
                time.sleep(2)
                page.screenshot(path="verify_rss_modal_final_success.png")

                # Check for tabs
                tabs = page.get_by_role("tab").all()
                for tab in tabs:
                    text = tab.inner_text()
                    print(f"Found tab: {text}")
                    if "Exclusions" in text or "Výluky" in text:
                        tab.click()
                        time.sleep(1)
                        page.screenshot(path="verify_rss_exclusions_final_success.png")
            else:
                print("Alerts button not found by title.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
