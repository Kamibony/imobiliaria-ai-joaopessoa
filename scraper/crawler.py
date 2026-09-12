import logging
import sys
from playwright.sync_api import sync_playwright
from parser import parse_html_to_lancamento
from pydantic import ValidationError

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

TARGET_URL = "https://example.com/lancamentos-joao-pessoa"  # Placeholder URL

def main():
    logger.info(f"Starting crawler for {TARGET_URL}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            logger.info("Navigating to page...")
            page.goto(TARGET_URL, wait_until="networkidle")
            html_content = page.content()
            logger.info("Successfully extracted HTML content.")

        except Exception as e:
            logger.error(f"Failed to fetch or render page: {e}")
            browser.close()
            sys.exit(1)

        browser.close()

    logger.info("Sending extracted HTML to Gemini for parsing...")

    try:
        # In a real scenario with multiple projects on a page, the prompt/schema
        # would likely be a list of Lancamentos. Here we parse what we assume
        # is a single project or the AI parses the first one it finds matching the schema.
        result = parse_html_to_lancamento(html_content)

        logger.info("\n--- Extracted Real Estate Project ---")
        print(result.model_dump_json(indent=2))
        logger.info("-------------------------------------")

    except ValidationError as ve:
        logger.error(f"Pydantic Validation Error during parsing: {ve}")
    except Exception as e:
        logger.error(f"Error during AI parsing: {e}")

if __name__ == "__main__":
    main()
