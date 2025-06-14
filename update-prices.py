import requests, json, os

UPDATE_URL = "https://api.jsonbin.io/v3/b/684db7dd8a456b7966ae2a8a"
ACCESS_KEY = ""

PRICE_FILE_PATH = "prices.json"

def update_json_bin():
    if not os.path.exists(PRICE_FILE_PATH):
        print(f"Error: '{PRICE_FILE_PATH}' not found in the current directory.")
        return

    try:
        with open(PRICE_FILE_PATH, 'r', encoding='utf-8') as f:
            prices_data = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{PRICE_FILE_PATH}'. Please check its format.")
        return
    except Exception as e:
        print(f"Error reading '{PRICE_FILE_PATH}': {e}")
        return

    headers = {
        'Content-Type': 'application/json',
        'X-Access-Key': ACCESS_KEY,
    }

    try:
        print(f"Attempting to update JSONBin at: {UPDATE_URL}")

        # Send the PUT request with the JSON data
        response = requests.put(UPDATE_URL, headers=headers, json=prices_data)
        response.raise_for_status()

        print("JSONBin.io update successful!")
        print("Response:", response.json())

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        print(f"Response content: {response.text}")
    except requests.exceptions.ConnectionError as conn_err:
        print(f"Connection error occurred: {conn_err}")
    except requests.exceptions.Timeout as timeout_err:
        print(f"Timeout error occurred: {timeout_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"An error occurred during the request: {req_err}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    with open("apikeys") as f:
        ACCESS_KEY = f.read()
    update_json_bin()