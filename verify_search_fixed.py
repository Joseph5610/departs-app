from playwright.sync_api import Page, expect, sync_playwright
import time
import json

def verify_multi_line_search(page: Page):
    requests = []
    page.on("request", lambda request: requests.append(request.url) if "/api/vehicles" in request.url else None)

    # 1. Arrange: Go to the app
    page.goto("http://localhost:5173")

    # Bypass welcome modal
    page.evaluate("localStorage.setItem('departs_welcome_seen', 'true')")
    page.reload()

    time.sleep(5) # Wait for initial load
    requests.clear()

    # 2. Act: Search for multiple lines
    search_input = page.locator("input[type='text']")
    search_input.fill("136, C")
    time.sleep(1)

    # Wait for and click the filter button
    filter_button = page.locator("button:has-text('136, C')")
    filter_button.click()

    time.sleep(3)
    print("Requests after Search filter:", [r for r in requests])

    # 3. Screenshot
    page.screenshot(path="search_multi_verify.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
        page = context.new_page()
        try:
            verify_multi_line_search(page)
        finally:
            browser.close()
