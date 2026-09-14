from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
import re
import unicodedata
import asyncio
from parser import parse_html_to_project
from pydantic import ValidationError
from firebase_admin import firestore
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

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


async def extract_html_with_playwright(url: str, browser) -> str:
    page = await browser.new_page()
    try:
        logger.info(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

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
        return html_content
    finally:
        await page.close()

async def fetch_url(url: str, browser, db, semaphore: asyncio.Semaphore, job_ref=None):
    async with semaphore:
        logger.info(f"Processing URL: {url}")

        # Define tenacity retry wrapper here to capture variables if needed,
        # or apply to extract_html_with_playwright directly

        @retry(
            wait=wait_exponential(multiplier=1, min=2, max=10),
            stop=stop_after_attempt(3),
            retry=retry_if_exception_type((PlaywrightTimeoutError, Exception)),
            before_sleep=lambda retry_state: logger.warning(
                f"Retrying fetch for {url} due to {retry_state.outcome.exception()} (attempt {retry_state.attempt_number})"
            )
        )
        async def fetch_with_retry():
            return await extract_html_with_playwright(url, browser)

        try:
            html_content = await fetch_with_retry()
            logger.info("Sending extracted HTML to Gemini for parsing and saving...")
            await asyncio.to_thread(process_and_save, html_content, url, db)

            if job_ref:
                job_ref.set({"metrics": {"urls_processed": firestore.Increment(1)}}, merge=True)

        except Exception as e:
            logger.error(f"Completely failed to process {url}: {e}")
            if job_ref:
                job_ref.set({"metrics": {"urls_failed": firestore.Increment(1)}}, merge=True)
