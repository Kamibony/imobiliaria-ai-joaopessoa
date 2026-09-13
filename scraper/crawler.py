import logging
import re
import unicodedata
import asyncio
from parser import parse_html_to_project
from pydantic import ValidationError

logger = logging.getLogger(__name__)

def generate_slug(text: str) -> str:
    """Generate a URL-friendly slug from a string."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    text = re.sub(r'[-\s]+', '-', text)
    return text

def process_and_save(html_content: str, url: str, db):
    """Synchronous parsing and saving to Firestore."""
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

async def fetch_url(url: str, browser, db, semaphore: asyncio.Semaphore):
    async with semaphore:
        logger.info(f"Processing URL: {url}")
        try:
            page = await browser.new_page()
            logger.info(f"Navigating to {url}...")
            await page.goto(url, wait_until="networkidle")

            # Programmatic auto-scroll to the absolute bottom of the page
            logger.info("Scrolling to the bottom of the page...")
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

            # Brief explicit wait after scrolling
            logger.info("Waiting for front-end state updates and animations...")
            await page.wait_for_timeout(3000)

            # Payload Optimization: strip out unnecessary tags
            logger.info("Stripping out unnecessary tags (<script>, <style>, <svg>, <iframe>)...")
            await page.evaluate("""
                const tagsToRemove = ['script', 'style', 'svg', 'iframe'];
                tagsToRemove.forEach(tag => {
                    const elements = document.querySelectorAll(tag);
                    elements.forEach(el => el.remove());
                });
            """)

            html_content = await page.content()
            logger.info("Successfully extracted HTML content.")
            await page.close()

            logger.info("Sending extracted HTML to Gemini for parsing and saving...")
            await asyncio.to_thread(process_and_save, html_content, url, db)

        except Exception as e:
            logger.error(f"Failed to fetch or process {url}: {e}")
