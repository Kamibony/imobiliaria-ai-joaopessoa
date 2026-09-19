import asyncio
import logging
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from spider import discover_urls
from crawler import fetch_url
import uuid

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def async_main(target_missing_units: bool = False):
    logger.info("Initializing Firebase Admin SDK...")
    try:
        # Initialize Firebase Admin using Application Default Credentials (ADC)
        firebase_admin.initialize_app()
        db = firestore.client()
        logger.info("Firebase initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        sys.exit(1)

    job_id = str(uuid.uuid4())
    job_ref = db.collection('scraper_jobs').document(job_id)

    logger.info(f"Starting crawler process. Job ID: {job_id}")

    try:
        job_ref.set({
            "status": "running",
            "started_at": firestore.SERVER_TIMESTAMP,
            "metrics": {
                "urls_discovered": 0,
                "urls_processed": 0,
                "urls_failed": 0
            }
        })
    except Exception as e:
        logger.error(f"Failed to create job tracking document: {e}")
        sys.exit(1)

    semaphore = asyncio.Semaphore(5)

    try:
        async with Stealth().use_async(async_playwright()) as p:
            browser = await p.chromium.launch(headless=True)

            new_urls = []

            if target_missing_units:
                logger.info("Targeting existing projects with missing units or summary...")
                # Query Firestore for projects missing units or summary
                projects_ref = db.collection('projects')

                # Note: Firestore does not support OR queries across different fields well natively,
                # so we can query all and filter in python (or do two queries).
                # To be safe and since the collection is small (~200), we'll fetch all and filter.
                docs = projects_ref.stream()
                for doc in docs:
                    data = doc.to_dict()
                    has_units = data.get('has_units', False)
                    summary = data.get('summary')
                    source_url = data.get('source_url')

                    if (not has_units or not summary) and source_url:
                        new_urls.append(source_url)

                logger.info(f"Found {len(new_urls)} existing projects to re-process.")
            else:
                # Spider module integration
                new_urls = await discover_urls(browser, db)

            if not new_urls:
                logger.info("No new URLs to process. Exiting.")
                job_ref.set({
                    "status": "completed",
                    "ended_at": firestore.SERVER_TIMESTAMP,
                    "metrics": {"urls_discovered": 0}
                }, merge=True)
            else:
                logger.info(f"Processing {len(new_urls)} URLs.")
                job_ref.set({
                    "metrics": {"urls_discovered": len(new_urls)}
                }, merge=True)

                tasks = [fetch_url(url, browser, db, semaphore, job_ref) for url in new_urls]
                await asyncio.gather(*tasks)

            await browser.close()

        job_ref.set({
            "status": "completed",
            "ended_at": firestore.SERVER_TIMESTAMP
        }, merge=True)

    except Exception as e:
        logger.error(f"Fatal error during scraper execution: {e}")
        job_ref.set({
            "status": "failed",
            "ended_at": firestore.SERVER_TIMESTAMP,
            "error": str(e)
        }, merge=True)
        raise

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Real Estate Scraper")
    parser.add_argument(
        "--target-missing-units",
        action="store_true",
        help="Target existing projects with missing units or summary instead of running a full spider crawl."
    )
    args = parser.parse_args()

    asyncio.run(async_main(target_missing_units=args.target_missing_units))

if __name__ == "__main__":
    main()
