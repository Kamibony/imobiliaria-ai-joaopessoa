import asyncio
import logging
import sys
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from playwright.async_api import async_playwright
from spider import discover_urls
from crawler import fetch_url
import uuid

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def async_main():
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
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)

            # Spider module integration
            new_urls = await discover_urls(browser, db)

            if not new_urls:
                logger.info("No new URLs discovered. Exiting.")
                job_ref.set({
                    "status": "completed",
                    "ended_at": firestore.SERVER_TIMESTAMP,
                    "metrics": {"urls_discovered": 0}
                }, merge=True)
            else:
                logger.info(f"Discovered {len(new_urls)} new URLs to process.")
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
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
