import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')

TARGET_URLS = [
    'https://portoinc.com.br/',
    'https://somosghc.com/imovel/artus-vivence/'
]

# Standard User-Agent to avoid simple blocks
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def extract_visible_text(html_content):
    """Extracts only the visible text from HTML content, cleaning up whitespace."""
    soup = BeautifulSoup(html_content, 'html.parser')

    # Remove script and style elements
    for script_or_style in soup(['script', 'style']):
        script_or_style.decompose()

    # Get text
    text = soup.get_text(separator=' ')

    # Clean up excessive whitespaces
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = ' '.join(chunk for chunk in chunks if chunk)

    return text

def scrape_and_send(url):
    print(f"Starting to scrape: {url}")
    try:
        # Fetch HTML
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()

        # Extract text
        raw_text = extract_visible_text(response.text)

        # Construct JSON payload
        payload = {
            "source": "python_scraper",
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

    except requests.exceptions.RequestException as e:
        print(f"Failure processing {url}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred for {url}: {e}")

def main():
    if not WEBHOOK_SECRET:
        print("Warning: WEBHOOK_SECRET is not set. The webhook request might fail due to lack of authorization.")

    for url in TARGET_URLS:
        scrape_and_send(url)
        print("-" * 40)

if __name__ == "__main__":
    main()
