import requests
import json

def debug_parking():
    print("--- Parking API ---")
    try:
        # Mocking the local environment might be hard, so let's check if we can reach it if dev server is running
        r = requests.get("http://127.0.0.1:5173/api/parking")
        if r.status_code == 200:
            data = r.json()
            features = data.get('features', [])
            if features:
                print(f"Total features: {len(features)}")
                print("First feature properties:", json.dumps(features[0]['properties'], indent=2))
                print("First feature geometry type:", features[0]['geometry']['type'])
            else:
                print("No features found")
        else:
            print(f"Error: {r.status_code}")
    except Exception as e:
        print(f"Error fetching parking: {e}")

def debug_aq():
    print("\n--- Air Quality API ---")
    try:
        r = requests.get("http://127.0.0.1:5173/api/air-quality")
        if r.status_code == 200:
            data = r.json()
            features = data.get('features', [])
            if features:
                print(f"Total features: {len(features)}")
                print("First feature properties:", json.dumps(features[0]['properties'], indent=2))
            else:
                print("No features found")
        else:
            print(f"Error: {r.status_code}")
    except Exception as e:
        print(f"Error fetching AQ: {e}")

if __name__ == "__main__":
    debug_parking()
    debug_aq()
