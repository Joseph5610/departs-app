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

            # List all buttons and their labels/titles
            buttons = page.locator('button').all()
            print(f"Found {len(buttons)} buttons.")
            for i, btn in enumerate(buttons):
                label = btn.get_attribute('aria-label') or ""
                title = btn.get_attribute('title') or ""
                text = btn.inner_text() or ""
                box = btn.bounding_box()
                print(f"Button {i}: Label='{label}', Title='{title}', Text='{text}', Box={box}")

                if "Mimořádnosti" in label or "Alerts" in label or "Mimořádnosti" in title:
                    print(f"!!! Found Alerts button at {box}")
                    btn.click()
                    time.sleep(2)
                    page.screenshot(path="verify_rss_found_click.png")

                    # If modal opened, try to find tabs
                    tabs = page.get_by_role("tab").all()
                    print(f"Found {len(tabs)} tabs.")
                    for j, tab in enumerate(tabs):
                        t_text = tab.inner_text()
                        t_box = tab.bounding_box()
                        print(f"Tab {j}: Text='{t_text}', Box={t_box}")
                        if "Výluky" in t_text or "Exclusions" in t_text:
                            tab.click()
                            time.sleep(1)
                            page.screenshot(path="verify_rss_exclusions_found.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
