import asyncio
import logging
import sys
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from playwright.async_api import async_playwright
from spider import discover_urls
from crawler import fetch_url

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

    logger.info("Starting crawler process")
    semaphore = asyncio.Semaphore(5)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Spider module integration
        new_urls = await discover_urls(browser, db)

        if not new_urls:
            logger.info("No new URLs discovered. Exiting.")
        else:
            logger.info(f"Discovered {len(new_urls)} new URLs to process.")
            tasks = [fetch_url(url, browser, db, semaphore) for url in new_urls]
            await asyncio.gather(*tasks)

        await browser.close()

def main():
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
