import os
import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Load environment variables
load_dotenv()

WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData')
GET_TARGET_URLS_URL = os.environ.get('GET_TARGET_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/getTargetUrls')
ADD_DISCOVERED_URLS_URL = os.environ.get('ADD_DISCOVERED_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/addDiscoveredUrls')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')

def discover_urls_from_zap(page):
    print("Starting discovery agent: searching for new URLs using ZAP Imoveis Portal Index...")
    z_cabo_branco = "https://www.zapimoveis.com.br/venda/imoveis/pb+joao-pessoa+bairros+cabo-branco/"
    z_tambau = "https://www.zapimoveis.com.br/venda/imoveis/pb+joao-pessoa+bairros+tambau/"

    seed_urls = [z_cabo_branco, z_tambau]
    discovered_urls = []

    for seed_url in seed_urls:
        print(f"Scraping index: {seed_url}")
        try:
            page.goto(seed_url, wait_until="domcontentloaded", timeout=60000)
            # Wait for property cards to load, often containing /imovel/ in their links
            page.wait_for_selector('a[href*="/imovel/"]', timeout=30000)

            links = page.locator('a[href*="/imovel/"]').evaluate_all('''(elements) => elements.map(el => el.href)''')
            for link in links:
                if link not in discovered_urls:
                    discovered_urls.append(link)
        except Exception as e:
            print(f"Failed to extract from {seed_url}: {e}")

    if not discovered_urls:
        print("No URLs discovered from ZAP Imoveis Index.")
        return

    print(f"Discovered {len(discovered_urls)} URLs. Sending to webhook...")

    webhook_headers = {
        'Authorization': f'Bearer {WEBHOOK_SECRET}',
        'Content-Type': 'application/json'
    }

    try:
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

        # Strip unwanted elements before text extraction to prevent passing too much noise to AI
        page.evaluate('''() => {
            const elementsToRemove = document.querySelectorAll('header, footer, nav, script, style, noscript, iframe');
            elementsToRemove.forEach(el => el.remove());
        }''')

        # Extract text using Playwright, prioritizing <main> tag
        if page.locator('main').count() > 0:
            raw_text = page.locator('main').inner_text()
        else:
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

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        )
        page = context.new_page()

        # Run discovery agent before fetching target URLs
        discover_urls_from_zap(page)

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
            context.close()
            browser.close()
            return

        for url in target_urls:
            scrape_and_send(url, page)
            print("-" * 40)

        context.close()
        browser.close()

if __name__ == "__main__":
    main()
