from playwright.sync_api import sync_playwright
import time
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()

        # Mock vehicle detail
        page.route("**/api/vehicle-detail*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "gtfs_trip_id": "trip-1",
                "route_short_name": "A",
                "trip_headsign": "Depo Hostivař",
                "delay": 0,
                "state_position": "on_track",
                "vehicle_descriptor": {
                    "operator": "DPP",
                    "vehicle_registration_number": "1234",
                    "is_air_conditioned": True
                },
                "geometry": {"type": "Point", "coordinates": [14.43, 50.08]},
                "stop_times": {
                    "features": [
                        {
                            "properties": {
                                "stop_name": "Muzeum",
                                "stop_sequence": 1,
                                "arrival_time": "12:00:00",
                                "realtime_arrival_time": "12:00:00"
                            }
                        },
                        {
                            "properties": {
                                "stop_name": "Můstek",
                                "stop_sequence": 2,
                                "arrival_time": "12:02:00",
                                "realtime_arrival_time": "12:02:00"
                            }
                        }
                    ]
                }
            })
        ))

        # Mock stops
        page.route("**/api/stops", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [14.43, 50.08]},
                        "properties": {
                            "stop_id": "U123Z1",
                            "stop_name": "Muzeum",
                            "location_type": 1,
                            "zone_id": "P"
                        }
                    }
                ]
            })
        ))

        # Mock departures
        page.route("**/api/departures*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "departures": [
                    {
                        "timestamp": "2026-02-17T12:00:00Z",
                        "scheduled": "2026-02-17T12:00:00Z",
                        "delay": 0,
                        "line": "A",
                        "type": "1",
                        "directionId": "1",
                        "headsign": "Depo Hostivař",
                        "isCanceled": False,
                        "tripId": "trip-1",
                        "vehicleId": "veh-1"
                    }
                ]
            })
        ))

        try:
            page.goto("http://localhost:8788")
            page.click("text=Get started")

            page.fill("input[placeholder*='Search']", "Muzeum")
            page.click("text=Muzeum")

            # Click connection
            print("Clicking connection...")
            page.wait_for_selector("text=Depo Hostivař", timeout=10000)
            page.click("text=Depo Hostivař")

            # Wait for VehicleDetail header
            page.wait_for_selector("h3:has-text('Depo Hostivař')", timeout=10000)
            page.screenshot(path="verification/vehicle_detail.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
