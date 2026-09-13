import asyncio
import logging
from urllib.parse import urlparse
from playwright.async_api import Browser
from crawler import generate_slug

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

SEED_URLS = [
    "https://mgaconstrucoes.com.br/todos-empreendimentos/",
    "https://bauten.cc/",
    "https://somosghc.com/imoveis/"
]

def is_valid_property_link(url: str, seed_url: str) -> bool:
    parsed_url = urlparse(url)
    parsed_seed = urlparse(seed_url)

    url_netloc = parsed_url.netloc.removeprefix('www.')
    seed_netloc = parsed_seed.netloc.removeprefix('www.')
    if url_netloc != seed_netloc:
        logger.debug(f"Discarding {url}: netloc mismatch ({url_netloc} != {seed_netloc})")
        return False

    path = parsed_url.path.strip('/')
    if not path:
        logger.debug(f"Discarding {url}: missing path")
        return False

    parts = path.split('/')

    if 'mgaconstrucoes.com.br' in seed_url:
        invalid_keywords = {
            'blog', 'contato', 'em-construcao', 'entregues', 'imoveis',
            'lancamentos', 'paraibanamente', 'pg-principal',
            'politica-de-privacidade', 'quem-somos', 'todos-empreendimentos',
            'trabalhe-conosco'
        }
        for part in parts:
            if part in invalid_keywords:
                logger.debug(f"Discarding {url}: found invalid keyword '{part}'")
                return False
        logger.debug(f"Accepting {url} for seed {seed_url}")
        return True

    elif 'bauten.cc' in seed_url:
        if 'empreendimentos' in parts:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: 'empreendimentos' not in path")
            return False

    elif 'somosghc.com' in seed_url:
        if 'imovel' in parts and 'imoveis' not in parts:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: invalid path structure for somosghc.com")
            return False

    logger.debug(f"Discarding {url}: no matching rules for seed {seed_url}")
    return False

def extract_slug_from_url(url: str) -> str:
    path = urlparse(url).path.strip('/')
    if not path:
        return ""
    last_part = path.split('/')[-1]
    return generate_slug(last_part)

async def discover_urls(browser: Browser, db) -> list[str]:
    discovered_urls = set()

    for seed in SEED_URLS:
        logger.info(f"Spidering seed URL: {seed}")
        try:
            page = await browser.new_page()
            await page.goto(seed, wait_until="networkidle")

            # Programmatic scroll and wait
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(3000)

            hrefs = await page.evaluate("Array.from(document.querySelectorAll('a')).map(a => a.href)")

            for href in hrefs:
                if not href:
                    continue

                parsed_href = urlparse(href)
                # Reconstruct clean URL without hash or query
                clean_url = f"{parsed_href.scheme}://{parsed_href.netloc}{parsed_href.path}"

                if is_valid_property_link(clean_url, seed):
                    discovered_urls.add(clean_url)

            await page.close()
        except Exception as e:
            logger.error(f"Error spidering {seed}: {e}")

    logger.info(f"Discovered {len(discovered_urls)} potential property URLs. Deduplicating...")
    new_urls = []

    for url in discovered_urls:
        slug = extract_slug_from_url(url)
        if not slug:
            continue

        # Deduplicate against Firestore
        doc_ref = db.collection('projects').document(slug)
        doc = await asyncio.to_thread(doc_ref.get)

        if not doc.exists:
            new_urls.append(url)
        else:
            logger.info(f"Skipping {url} - already exists in DB as {slug}")

    logger.info(f"Spider found {len(new_urls)} new URLs to scrape.")
    return new_urls
