import os
import requests
import base64
import hashlib
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

# Configure Logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData')
GET_TARGET_URLS_URL = os.environ.get('GET_TARGET_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/getTargetUrls')
GET_DISCOVERY_SOURCES_URL = os.environ.get('GET_DISCOVERY_SOURCES_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/getDiscoverySources')
REPORT_DETECTED_CHANGE_URL = os.environ.get('REPORT_DETECTED_CHANGE_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/reportDetectedChange')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', os.environ.get('API_SECRET', 'dev_secret_fallback')).strip()

FILTER_URLS_URL = os.environ.get('FILTER_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/filterDiscoveredUrls')
ADD_DISCOVERED_URLS_URL = os.environ.get('ADD_DISCOVERED_URLS_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/addDiscoveredUrls')


def scrape_and_send(target: dict, page: Page, session: requests.Session):
    url = target.get('url')
    last_content_hash = target.get('last_content_hash')
    logger.info(f"Starting to scrape: {url}")
    try:
        # Navigate to URL and wait for JS to render
        page.goto(url, wait_until="networkidle", timeout=30000)

        # Semantic DOM Reduction: Strip unwanted elements before text extraction
        page.evaluate('''() => {
            const elementsToRemove = document.querySelectorAll('header, footer, nav, aside, script, style, noscript, iframe');
            elementsToRemove.forEach(el => el.remove());
        }''')

        # Extract text using Playwright, prioritizing semantically dense tags
        if page.locator('main').count() > 0:
            raw_text = page.locator('main').inner_text()
        elif page.locator('article').count() > 0:
             raw_text = page.locator('article').inner_text()
        else:
            raw_text = page.locator('body').inner_text()

        # Compute SHA-256 hash of the cleaned text
        new_hash = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()

        # Diffing Loop
        if last_content_hash and last_content_hash == new_hash:
            logger.info(f"No Change detected for {url}. Hashes match ({new_hash}). Skipping extraction.")
            return

        logger.info(f"Change detected for {url} or new URL. Generating payload...")

        payload = {
            "source": "python_playwright_scraper",
            "url": url,
            "raw_text": raw_text
        }

        # Multimodal Fallback: if text is too short, capture a screenshot
        encoded_image = None
        if len(raw_text) < 500:
            logger.warning(f"Extracted text too short ({len(raw_text)} chars) for {url}. Capturing screenshot for multimodal fallback.")
            screenshot_bytes = page.screenshot(full_page=True)
            encoded_image = base64.b64encode(screenshot_bytes).decode('utf-8')
            payload["image_base64"] = encoded_image

        if last_content_hash is None:
            # First time scraping, go directly to ingestPropertyData
            logger.info(f"Sending initial data to ingest webhook for: {url}")
            webhook_response = session.post(WEBHOOK_URL, json=payload, timeout=130)
            webhook_response.raise_for_status()
            logger.info(f"Success! Initial data sent for: {url}")
        else:
            # Change detected on existing URL, send to reportDetectedChange
            logger.info(f"Sending changed data to review queue for: {url}")
            change_payload = {
                "url": url,
                "new_hash": new_hash,
                "raw_text": raw_text,
                "image_base64": encoded_image
            }
            webhook_response = session.post(REPORT_DETECTED_CHANGE_URL, json=change_payload, timeout=130)
            webhook_response.raise_for_status()
            logger.info(f"Success! Change reported for: {url}")

    except PlaywrightTimeoutError:
        logger.warning(f"Timeout processing {url}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Webhook failure processing {url}: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred for {url}: {e}")


def discovery_phase(page: Page, session: requests.Session):
    logger.info("Starting AI-Driven Discovery Phase...")

    try:
        logger.info(f"Fetching dynamic discovery sources from: {GET_DISCOVERY_SOURCES_URL}")
        response = session.get(GET_DISCOVERY_SOURCES_URL, timeout=30)
        response.raise_for_status()
        sources_data = response.json()
        # Ensure we're extracting just the source string for crawling
        seed_domains = [item.get('source') for item in sources_data if item.get('source') and item.get('type') == 'URL']
        logger.info(f"Retrieved {len(seed_domains)} discovery sources.")
    except Exception as e:
        logger.error(f"Failed to retrieve discovery sources: {e}")
        seed_domains = []

    all_filtered_urls = []

    for seed_url in seed_domains:
        logger.info(f"Crawling seed domain: {seed_url}")
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
                logger.warning(f"No links found on {seed_url}")
                continue

            logger.info(f"Found {len(links)} links on {seed_url}. Sending to AI for filtering...")

            # Send to filter endpoint (using 120s timeout as Gemini can be slow)
            response = session.post(FILTER_URLS_URL, json=links, timeout=130)
            response.raise_for_status()

            filtered_urls = response.json()
            logger.info(f"AI identified {len(filtered_urls)} relevant URLs from {seed_url}")
            all_filtered_urls.extend(filtered_urls)

        except PlaywrightTimeoutError:
            logger.warning(f"Timeout crawling seed domain {seed_url}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Error filtering links from {seed_url}: {e}")
        except Exception as e:
            logger.error(f"An unexpected error occurred during discovery on {seed_url}: {e}")

    if all_filtered_urls:
        normalized_filtered_urls = [url.strip().rstrip('/') for url in all_filtered_urls]
        logger.info(f"Total AI-discovered URLs: {len(normalized_filtered_urls)}. Pushing to backend...")
        try:
            add_response = session.post(ADD_DISCOVERED_URLS_URL, json=normalized_filtered_urls, timeout=30)
            add_response.raise_for_status()
            result = add_response.json()
            logger.info(f"Successfully pushed discovered URLs: {result.get('message')}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Error adding discovered URLs to backend: {e}")
        except Exception as e:
            logger.error(f"An unexpected error occurred pushing discovered URLs: {e}")
    else:
        logger.info("No relevant URLs discovered in this run.")


def main():
    if WEBHOOK_SECRET == 'dev_secret_fallback':
        logger.warning("Warning: Using the dev fallback secret for authorization. Do not use in production.")

    # Configure requests session with retry logic
    session = requests.Session()
    session.headers.update({
        'Authorization': f'Bearer {WEBHOOK_SECRET}',
        'Content-Type': 'application/json'
    })

    retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retries)
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        )
        page = context.new_page()


        # Run the discovery phase before ingestion
        discovery_phase(page, session)

        logger.info(f"Fetching dynamic target URLs from: {GET_TARGET_URLS_URL}")

        try:
            response = session.get(GET_TARGET_URLS_URL, timeout=30)
            response.raise_for_status()
            target_urls = response.json()
            logger.info(f"Retrieved {len(target_urls)} URLs to scrape.")
        except Exception as e:
            logger.error(f"Failed to retrieve target URLs: {e}")
            context.close()
            browser.close()
            return

        for target in target_urls:
            scrape_and_send(target, page, session)
            logger.info("-" * 40)

        context.close()
        browser.close()

if __name__ == "__main__":
    main()
