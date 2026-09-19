from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
import re
import unicodedata
import asyncio
import os
import requests
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

def geocode_address(address: str) -> dict:
    """Uses Google Maps Geocoding API to fetch lat/lng coordinates."""
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_MAPS_API_KEY environment variable not set. Skipping geocoding.")
        return None

    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": f"{address}, João Pessoa, PB, Brazil",
            "key": api_key
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("status") == "OK" and data.get("results"):
            location = data["results"][0]["geometry"]["location"]
            logger.info(f"Geocoding successful for '{address}': {location}")
            return {"lat": location["lat"], "lng": location["lng"]}
        else:
            logger.warning(f"Geocoding failed for '{address}': {data.get('status')} - {data.get('error_message', '')}")
            return None
    except Exception as e:
        logger.error(f"Error during geocoding for '{address}': {e}")
        return None

def process_and_save(text_content: str, url: str, db):
    """Synchronous parsing and saving to Firestore."""
    try:
        import uuid
        result = parse_html_to_project(text_content)

        logger.info("\n--- Extracted Real Estate Project ---")
        print(result.model_dump_json(indent=2))
        logger.info("-------------------------------------")

        if getattr(result, 'status', None) == "OUT_OF_SCOPE":
            logger.warning(f"Project '{result.name}' discarded due to strict geo-fencing (OUT_OF_SCOPE).")
            return

        data_to_save = result.model_dump(mode='json', exclude_none=False, by_alias=True)

        # Remove units from parent document to avoid nesting arrays unnecessarily
        units = data_to_save.pop('units', [])

        # Geocoding Step
        neighborhood = result.location.get('neighborhood', '') if result.location else ''
        if neighborhood:
            search_query = f"{result.name}, {neighborhood}"
            coordinates = geocode_address(search_query)
            if coordinates:
                data_to_save['coordinates'] = coordinates

        # Ensure routing to Staging
        data_to_save['resolution_state'] = 'staged'
        data_to_save['has_units'] = bool(units)
        data_to_save['source_url'] = url

        # Upsert into Firestore
        slug = generate_slug(result.name)
        data_to_save['id'] = slug
        doc_ref = db.collection('projects').document(slug)

        logger.info(f"Saving to Firestore: collection 'projects', document '{slug}'...")
        doc_ref.set(data_to_save, merge=True)
        logger.info(f"Successfully saved project data to Firestore for {url}")

        # Save units to subcollection
        if units:
            logger.info(f"Saving {len(units)} units to Firestore subcollection 'projects/{slug}/units'...")
            batch = db.batch()
            for unit in units:
                unit_id = unit.get('id') or str(uuid.uuid4())
                unit['id'] = unit_id
                unit_ref = doc_ref.collection('units').document(unit_id)
                batch.set(unit_ref, unit, merge=True)
            batch.commit()
            logger.info(f"Successfully saved units to Firestore for {url}")

    except ValidationError as ve:
        logger.error(f"Pydantic Validation Error during parsing for {url}: {ve}")
    except Exception as e:
        logger.error(f"Error during AI parsing for {url}: {e}")


async def extract_html_with_playwright(url: str, browser) -> str:
    page = await browser.new_page()
    try:
        logger.info(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Incremental auto-scroll to ensure lazy loaded content renders
        logger.info("Scrolling incrementally to the bottom of the page...")
        await page.evaluate("""
            async () => {
                await new Promise((resolve, reject) => {
                    let totalHeight = 0;
                    let distance = window.innerHeight;
                    let timer = setInterval(() => {
                        let scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if(totalHeight >= scrollHeight - window.innerHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 300); // Scroll every 300ms
                });
            }
        """)

        # Brief explicit wait after scrolling
        logger.info("Waiting for front-end state updates and animations...")
        await page.wait_for_timeout(2000)

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
