from playwright.sync_api import sync_playwright, expect

def test_layout(page):
    # Mock API
    page.route("**/api/stops**", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"type": "FeatureCollection", "features": [{"type": "Feature", "id": 1, "properties": {"stop_id": "U123Z1P", "stop_name": "Hlavní nádraží", "platform_code": "1", "is_train": 1}, "geometry": {"type": "Point", "coordinates": [14.4378, 50.0755]}}]}'
    ))

    page.goto("http://localhost:8788/?skipTutorial=true")
    expect(page.get_by_test_id("map-controls")).to_be_visible(timeout=15000)

    # 1024x768 is a good "small desktop" resolution to show the conflict fix
    page.set_viewport_size({"width": 1024, "height": 768})

    # Open sidebar
    search_input = page.get_by_test_id("search-input")
    search_input.fill("Hlavní")
    stop_item = page.get_by_test_id("search-item-stop-Hlavní nádraží-1")
    expect(stop_item).to_be_visible()
    stop_item.click()

    expect(page.get_by_test_id("detail-panel")).to_be_visible()
    page.wait_for_timeout(1000) # Wait for transitions

    page.screenshot(path="verification/layout_fix_1024.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_layout(page)
        finally:
            browser.close()
