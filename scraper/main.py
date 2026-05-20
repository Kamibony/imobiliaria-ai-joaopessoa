import os
import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

# Load environment variables
load_dotenv()

WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData')
GET_TARGET_URLS_URL = os.environ.get('GET_TARGET_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/getTargetUrls')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')

FILTER_URLS_URL = os.environ.get('FILTER_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/filterDiscoveredUrls')
ADD_DISCOVERED_URLS_URL = os.environ.get('ADD_DISCOVERED_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/addDiscoveredUrls')
SEED_DOMAINS = [
    'https://massai.com.br/empreendimentos'
]


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


def discovery_phase(page):
    print("Starting AI-Driven Discovery Phase...")
    auth_headers = {
        'Authorization': f'Bearer {WEBHOOK_SECRET}',
        'Content-Type': 'application/json'
    }

    all_filtered_urls = []

    for seed_url in SEED_DOMAINS:
        print(f"Crawling seed domain: {seed_url}")
        try:
            page.goto(seed_url, wait_until="networkidle", timeout=30000)

            # Extract links with their text context
            links = page.evaluate('''() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors.map(a => ({
                    text: a.innerText.trim() || a.getAttribute('title') || '',
                    href: a.href
                })).filter(link => link.href && link.href.startsWith('http'));
            }''')

            if not links:
                print(f"No links found on {seed_url}")
                continue

            print(f"Found {len(links)} links on {seed_url}. Sending to AI for filtering...")

            # Send to filter endpoint (using 120s timeout as Gemini can be slow)
            response = requests.post(FILTER_URLS_URL, json=links, headers=auth_headers, timeout=130)
            response.raise_for_status()

            filtered_urls = response.json()
            print(f"AI identified {len(filtered_urls)} relevant URLs from {seed_url}")
            all_filtered_urls.extend(filtered_urls)

        except PlaywrightTimeoutError:
            print(f"Timeout crawling seed domain {seed_url}")
        except requests.exceptions.RequestException as e:
            print(f"Error filtering links from {seed_url}: {e}")
        except Exception as e:
            print(f"An unexpected error occurred during discovery on {seed_url}: {e}")

    if all_filtered_urls:
        normalized_filtered_urls = [url.strip().rstrip('/') for url in all_filtered_urls]
        print(f"Total AI-discovered URLs: {len(normalized_filtered_urls)}. Pushing to backend...")
        try:
            add_response = requests.post(ADD_DISCOVERED_URLS_URL, json=normalized_filtered_urls, headers=auth_headers, timeout=30)
            add_response.raise_for_status()
            result = add_response.json()
            print(f"Successfully pushed discovered URLs: {result.get('message')}")
        except requests.exceptions.RequestException as e:
            print(f"Error adding discovered URLs to backend: {e}")
        except Exception as e:
            print(f"An unexpected error occurred pushing discovered URLs: {e}")
    else:
        print("No relevant URLs discovered in this run.")


def main():
    if not WEBHOOK_SECRET:
        print("Warning: WEBHOOK_SECRET is not set. The webhook request might fail due to lack of authorization.")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        )
        page = context.new_page()


        # Run the discovery phase before ingestion
        discovery_phase(page)

        print(f"Fetching dynamic target URLs from: {GET_TARGET_URLS_URL}")

        auth_headers = {
            'Authorization': f'Bearer {WEBHOOK_SECRET}'
        }

        try:
            response = requests.get(GET_TARGET_URLS_URL, headers=auth_headers, timeout=15)
            response.raise_for_status()
            raw_target_urls = response.json()
            target_urls = [url.strip().rstrip('/') for url in raw_target_urls]
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
