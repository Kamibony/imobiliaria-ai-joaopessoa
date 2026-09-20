from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
import re
import unicodedata
import asyncio
import os
import requests
from parser import parse_html_to_project, parse_catalog_to_projects
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

def save_project_to_firestore(result, url: str, db):
    """Helper to save a single project result to Firestore."""
    import uuid

    logger.info("\n--- Extracted Real Estate Project ---")
    print(result.model_dump_json(indent=2))
    logger.info("-------------------------------------")

    if getattr(result, 'status', None) == "OUT_OF_SCOPE":
        logger.warning(f"Project '{result.name}' discarded due to strict geo-fencing (OUT_OF_SCOPE).")
        return

    data_to_save = result.model_dump(mode='json', exclude_none=False, by_alias=True)

    # Remove units from parent document to avoid nesting arrays unnecessarily
    units = data_to_save.pop('units', [])

    # Calculate Summary
    if units:
        min_area = float('inf')
        max_area = float('-inf')
        min_beds = float('inf')
        min_price = float('inf')

        for unit in units:
            if unit.get('area_m2') is not None:
                min_area = min(min_area, unit['area_m2'])
                max_area = max(max_area, unit['area_m2'])
            if unit.get('bedrooms') is not None:
                min_beds = min(min_beds, unit['bedrooms'])
            if unit.get('snapshots') and len(unit['snapshots']) > 0 and unit['snapshots'][0].get('price_brl') is not None:
                min_price = min(min_price, unit['snapshots'][0]['price_brl'])

        summary = {}
        if min_area != float('inf'):
            summary['min_area_m2'] = min_area
        if max_area != float('-inf'):
            summary['max_area_m2'] = max_area
        if min_beds != float('inf'):
            summary['min_bedrooms'] = min_beds
        if min_price != float('inf'):
            summary['min_price_brl'] = min_price

        if summary:
            data_to_save['summary'] = summary
    else:
        data_to_save['summary'] = None

    # Geocoding Step
    neighborhood = result.location.neighborhood if result.location and getattr(result.location, 'neighborhood', None) else ''
    address = result.location.address if result.location and getattr(result.location, 'address', None) else ''

    queries_to_try = []
    if address and neighborhood:
        queries_to_try.append(f"{result.name}, {address}, {neighborhood}, João Pessoa, PB")
        queries_to_try.append(f"{address}, {neighborhood}, João Pessoa, PB")
    elif neighborhood:
        queries_to_try.append(f"{result.name}, {neighborhood}, João Pessoa, PB")

    if neighborhood:
        queries_to_try.append(f"{neighborhood}, João Pessoa, PB")

    for i, query in enumerate(queries_to_try):
        coordinates = geocode_address(query)
        if coordinates:
            data_to_save['coordinates'] = coordinates
            if query == f"{neighborhood}, João Pessoa, PB":
                data_to_save['is_approximate_location'] = True
            else:
                data_to_save['is_approximate_location'] = False
            break

    data_to_save['has_units'] = bool(units)
    data_to_save['source_url'] = url

    slug = generate_slug(result.name)

    # Check if document already exists to preserve resolution_state
    existing_doc_ref = None
    existing_resolution_state = None

    # Check by slug
    doc_ref_by_slug = db.collection('projects').document(slug)
    doc_snapshot = doc_ref_by_slug.get()

    if doc_snapshot.exists:
        existing_doc_ref = doc_ref_by_slug
        existing_resolution_state = doc_snapshot.to_dict().get('resolution_state')
    else:
        # Check by source_url
        query_ref = db.collection('projects').where('source_url', '==', url).limit(1).get()
        if query_ref:
            existing_doc_ref = query_ref[0].reference
            existing_resolution_state = query_ref[0].to_dict().get('resolution_state')
            slug = existing_doc_ref.id  # Use the existing ID

    critical_missing = False
    if not result.name or not str(result.name).strip():
        critical_missing = True
    if not neighborhood or not str(neighborhood).strip():
        critical_missing = True

    if existing_doc_ref is not None:
        doc_ref = existing_doc_ref
        if critical_missing:
            data_to_save['resolution_state'] = 'staged'
        else:
            data_to_save['resolution_state'] = existing_resolution_state if existing_resolution_state else 'staged'
    else:
        doc_ref = doc_ref_by_slug
        data_to_save['resolution_state'] = 'staged'

    data_to_save['id'] = slug

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

def process_and_save(text_content: str, url: str, db):
    """Synchronous parsing and saving to Firestore."""
    from datetime import datetime, timezone

    def enrich_project(proj):
        # Filter out projects lacking a name
        if not proj.name or not proj.name.strip():
            return None

        # Enforce ID generation explicitly in Python
        proj.id = generate_slug(proj.name)

        # Enforce timestamps on units
        if proj.units:
            now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            for unit in proj.units:
                if unit.snapshots:
                    for snapshot in unit.snapshots:
                        snapshot.timestamp = now_iso

        return proj

    try:
        if 'apto.vc/br/pb/joao-pessoa' in url:
            logger.info(f"Catalog Extraction Mode activated for {url}")
            result_list = parse_catalog_to_projects(text_content)
            for project_result in result_list.projects:
                enriched = enrich_project(project_result)
                if enriched is None:
                    logger.warning("Skipping project due to missing or empty name.")
                    continue
                try:
                    save_project_to_firestore(enriched, url, db)
                except Exception as inner_e:
                    logger.error(f"Error saving a project from catalog {url}: {inner_e}")
        else:
            result = parse_html_to_project(text_content)
            enriched = enrich_project(result)
            if enriched is not None:
                save_project_to_firestore(enriched, url, db)
            else:
                logger.warning("Skipping parsed single project due to missing or empty name.")

    except ValidationError as ve:
        logger.error(f"Pydantic Validation Error during parsing for {url}: {ve}")
    except Exception as e:
        logger.error(f"Error during AI parsing for {url}: {e}")


async def extract_html_with_playwright(url: str, browser) -> list[str]:
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

        if 'apto.vc/br/pb/joao-pessoa' in url:
            logger.info("Catalog mode detected. Extracting property cards...")
            cards = await page.evaluate("""
                () => {
                    let results = [];
                    let elements = document.querySelectorAll('*');
                    for (let el of elements) {
                        if (el.innerText && el.innerText.includes('Venda a partir de') && el.innerText.length > 50 && el.innerText.length < 500) {
                            let hasMatchingChild = false;
                            for (let child of el.children) {
                                if (child.innerText && child.innerText.includes('Venda a partir de') && child.innerText.length > 50 && child.innerText.length < 500) {
                                    hasMatchingChild = true;
                                    break;
                                }
                            }
                            if (!hasMatchingChild) {
                                results.push(el.innerText.trim());
                            }
                        }
                    }
                    // Deduplicate
                    return Array.from(new Set(results));
                }
            """)
            logger.info(f"Successfully extracted {len(cards)} property cards.")
            return cards
        else:
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
            return [html_content]
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
            extracted_texts = await fetch_with_retry()
            logger.info("Sending extracted content to Gemini for parsing and saving...")

            if 'apto.vc/br/pb/joao-pessoa' in url:
                # Chunking logic for catalog extraction
                chunk_size = 5
                for i in range(0, len(extracted_texts), chunk_size):
                    chunk = extracted_texts[i:i+chunk_size]
                    logger.info(f"Processing catalog chunk {i//chunk_size + 1} of {(len(extracted_texts) - 1)//chunk_size + 1}")
                    chunk_text = "\n\n---\n\n".join(chunk)
                    await asyncio.to_thread(process_and_save, chunk_text, url, db)
            else:
                # Normal single project extraction
                if extracted_texts:
                    await asyncio.to_thread(process_and_save, extracted_texts[0], url, db)

            if job_ref:
                job_ref.set({"metrics": {"urls_processed": firestore.Increment(1)}}, merge=True)

        except Exception as e:
            logger.error(f"Completely failed to process {url}: {e}")
            if job_ref:
                job_ref.set({"metrics": {"urls_failed": firestore.Increment(1)}}, merge=True)
