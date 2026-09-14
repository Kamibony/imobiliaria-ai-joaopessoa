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
    "https://somosghc.com/imoveis/",
    "https://alliance.com.br/",
    "https://construtorabrascon.com.br/imoveis/",
    "https://abcconstrucoes.com.br/empreendimentos/",
    "https://setaigrupogp.com.br/empreendimentos/"
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

    elif 'alliance.com.br' in seed_url:
        if 'imovel' in parts:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: 'imovel' not in path for alliance.com.br")
            return False

    elif 'construtorabrascon.com.br' in seed_url:
        invalid_keywords = {'lancamentos', 'em-construcao', 'prontos-para-morar'}
        if 'imoveis' in parts:
            for part in parts:
                if part in invalid_keywords:
                    logger.debug(f"Discarding {url}: found invalid keyword '{part}' for construtorabrascon.com.br")
                    return False
            # Needs to be a specific property, not just /imoveis/
            if len([p for p in parts if p]) > 1:
                logger.debug(f"Accepting {url} for seed {seed_url}")
                return True
            else:
                logger.debug(f"Discarding {url}: path is just /imoveis/ for construtorabrascon.com.br")
                return False
        else:
            logger.debug(f"Discarding {url}: 'imoveis' not in path for construtorabrascon.com.br")
            return False

    elif 'abcconstrucoes.com.br' in seed_url:
        if 'imovel' in parts:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: 'imovel' not in path for abcconstrucoes.com.br")
            return False

    elif 'setaigrupogp.com.br' in seed_url:
        if 'empreendimentos' in parts:
            if len([p for p in parts if p]) > 1:
                logger.debug(f"Accepting {url} for seed {seed_url}")
                return True
            else:
                logger.debug(f"Discarding {url}: path is just /empreendimentos/ for setaigrupogp.com.br")
                return False
        else:
            logger.debug(f"Discarding {url}: 'empreendimentos' not in path for setaigrupogp.com.br")
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

        # Retry logic for seed URLs
        max_retries = 3
        for attempt in range(max_retries):
            try:
                page = await browser.new_page()
                # Use domcontentloaded for faster loading and avoid waiting for all tracking scripts
                await page.goto(seed, wait_until="domcontentloaded", timeout=30000)

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
                break # Success, break out of retry loop
            except Exception as e:
                logger.warning(f"Error spidering {seed} (attempt {attempt + 1}/{max_retries}): {e}")
                try:
                    await page.close()
                except:
                    pass
                if attempt == max_retries - 1:
                    logger.error(f"Failed to spider seed {seed} after {max_retries} attempts.")
                else:
                    await asyncio.sleep(2 ** attempt) # Exponential backoff

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
