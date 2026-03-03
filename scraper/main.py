import os
import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from duckduckgo_search import DDGS

# Load environment variables
load_dotenv()

WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData')
GET_TARGET_URLS_URL = os.environ.get('GET_TARGET_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/getTargetUrls')
ADD_DISCOVERED_URLS_URL = os.environ.get('ADD_DISCOVERED_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/addDiscoveredUrls')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')

def discover_new_urls():
    print("Starting discovery agent: searching for new URLs using DuckDuckGo...")
    query = "lançamento imobiliário Cabo Branco OR Tambaú João Pessoa"

    try:
        results = DDGS().text(query, max_results=15)
        discovered_urls = [result.get("href") for result in results if result.get("href")]

        if not discovered_urls:
            print("No URLs discovered from DuckDuckGo Search.")
            return

        print(f"Discovered {len(discovered_urls)} URLs. Sending to webhook...")

        webhook_headers = {
            'Authorization': f'Bearer {WEBHOOK_SECRET}',
            'Content-Type': 'application/json'
        }

        webhook_response = requests.post(ADD_DISCOVERED_URLS_URL, json=discovered_urls, headers=webhook_headers, timeout=15)
        webhook_response.raise_for_status()
        print(f"Success! Discovery webhook responded: {webhook_response.json()}")

    except requests.exceptions.RequestException as e:
        print(f"Failed to send new URLs to webhook: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during discovery: {e}")

def scrape_and_send(url, page):
    print(f"Starting to scrape: {url}")
    try:
        # Navigate to URL and wait for JS to render
        page.goto(url, wait_until="networkidle", timeout=30000)

        # Extract text using Playwright
        raw_text = page.locator('body').inner_text()

        # Construct JSON payload
        payload = {
            "source": "python_playwright_scraper",
            "url": url,
            "raw_text": raw_text
        }

        # Prepare headers for Webhook
        webhook_headers = {
            'Authorization': f'Bearer {WEBHOOK_SECRET}',
            'Content-Type': 'application/json'
        }

        # Send POST request to WEBHOOK_URL
        print(f"Sending data to webhook for: {url}")
        webhook_response = requests.post(WEBHOOK_URL, json=payload, headers=webhook_headers, timeout=15)
        webhook_response.raise_for_status()

        print(f"Success! Data sent for: {url}")

    except PlaywrightTimeoutError:
        print(f"Timeout processing {url}")
    except requests.exceptions.RequestException as e:
        print(f"Webhook failure processing {url}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred for {url}: {e}")

def main():
    if not WEBHOOK_SECRET:
        print("Warning: WEBHOOK_SECRET is not set. The webhook request might fail due to lack of authorization.")

    # Run discovery agent before fetching target URLs
    discover_new_urls()

    print(f"Fetching dynamic target URLs from: {GET_TARGET_URLS_URL}")
    auth_headers = {
        'Authorization': f'Bearer {WEBHOOK_SECRET}'
    }

    try:
        response = requests.get(GET_TARGET_URLS_URL, headers=auth_headers, timeout=15)
        response.raise_for_status()
        target_urls = response.json()
        print(f"Retrieved {len(target_urls)} URLs to scrape.")
    except Exception as e:
        print(f"Failed to retrieve target URLs: {e}")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        )
        page = context.new_page()

        for url in target_urls:
            scrape_and_send(url, page)
            print("-" * 40)

        context.close()
        browser.close()

if __name__ == "__main__":
    main()
