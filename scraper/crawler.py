import logging
import sys
import re
import unicodedata
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from playwright.sync_api import sync_playwright
from parser import parse_html_to_project
from pydantic import ValidationError

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

TARGET_URLS = [
    "https://abcconstrucoes.com.br/imovel/the-diamond/",
    "https://mgaconstrucoes.com.br/soho/",
    "https://setaigrupogp.com.br/empreendimentos/setai/pininfarina/",
    "https://abcconstrucoes.com.br/imovel/epic-jane-miranda/",
    "https://chavesconstrutora.com.br/imoveis/chaves-de-manaira/",
    "https://alliance.com.br/imovel/horizon/",
]

def generate_slug(text: str) -> str:
    """Generate a URL-friendly slug from a string."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    text = re.sub(r'[-\s]+', '-', text)
    return text

def main():
    logger.info("Initializing Firebase Admin SDK...")
    try:
        # Initialize Firebase Admin using Application Default Credentials (ADC)
        firebase_admin.initialize_app()
        db = firestore.client()
        logger.info("Firebase initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        sys.exit(1)

    logger.info("Starting crawler for multiple URLs")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for url in TARGET_URLS:
            logger.info(f"Processing URL: {url}")
            try:
                page = browser.new_page()
                logger.info(f"Navigating to {url}...")
                page.goto(url, wait_until="networkidle")

                # Programmatic auto-scroll to the absolute bottom of the page
                logger.info("Scrolling to the bottom of the page...")
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

                # Brief explicit wait after scrolling
                logger.info("Waiting for front-end state updates and animations...")
                page.wait_for_timeout(3000)

                # Payload Optimization: strip out unnecessary tags
                logger.info("Stripping out unnecessary tags (<script>, <style>, <svg>, <iframe>)...")
                page.evaluate("""
                    const tagsToRemove = ['script', 'style', 'svg', 'iframe'];
                    tagsToRemove.forEach(tag => {
                        const elements = document.querySelectorAll(tag);
                        elements.forEach(el => el.remove());
                    });
                """)

                html_content = page.content()
                logger.info("Successfully extracted HTML content.")
                page.close()

                logger.info("Sending extracted HTML to Gemini for parsing...")

                try:
                    result = parse_html_to_project(html_content)

                    logger.info("\n--- Extracted Real Estate Project ---")
                    print(result.model_dump_json(indent=2))
                    logger.info("-------------------------------------")

                    data_to_save = result.model_dump(mode='json', exclude_none=False, by_alias=True)

                    # Ensure routing to Staging
                    data_to_save['resolution_state'] = 'staged'
                    data_to_save['has_units'] = False

                    # Upsert into Firestore
                    slug = generate_slug(result.name)
                    data_to_save['id'] = slug
                    doc_ref = db.collection('projects').document(slug)

                    logger.info(f"Saving to Firestore: collection 'projects', document '{slug}'...")
                    doc_ref.set(data_to_save, merge=True)
                    logger.info(f"Successfully saved data to Firestore for {url}")

                except ValidationError as ve:
                    logger.error(f"Pydantic Validation Error during parsing for {url}: {ve}")
                except Exception as e:
                    logger.error(f"Error during AI parsing for {url}: {e}")

            except Exception as e:
                logger.error(f"Failed to fetch or process {url}: {e}")

        browser.close()

if __name__ == "__main__":
    main()
