from playwright.sync_api import Page, expect, sync_playwright
import time
import json

def verify_zoom_data(page: Page):
    requests = []
    page.on("request", lambda request: requests.append(request.url) if "/api/vehicles" in request.url else None)

    # 1. Arrange: Go to the app
    page.goto("http://localhost:5173")

    # Bypass welcome modal
    page.evaluate("localStorage.setItem('departs_welcome_seen', 'true')")
    page.reload()

    # Wait for initial load
    time.sleep(2)
    requests.clear()

    # Move to zoom 10
    page.evaluate("""() => {
        window.dispatchEvent(new CustomEvent('map-move-test', { detail: { zoom: 10, center: [14.43, 50.07] } }));
    }""")

    # Since we can't easily dispatch map events from outside, we can just use the URL sync logic or just wait
    # Actually, the easiest way is to use page.goto with parameters if the app supports it
    page.goto("http://localhost:5173/?lat=50.07&lng=14.43&z=10")

    time.sleep(5) # Wait for debounce and request

    print("Requests at zoom 10:", [r for r in requests])

    # 3. Screenshot
    page.screenshot(path="zoom_debug.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
        page = context.new_page()
        try:
            verify_zoom_data(page)
        finally:
            browser.close()
