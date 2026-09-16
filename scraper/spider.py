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
    "https://setaigrupogp.com.br/empreendimentos/",
    "https://apto.vc/br/pb/joao-pessoa/",
    "https://ocaconstrutora.com.br/empreendimentos/",
    "https://massai.com.br/empreendimentos",
    "https://ecoconstrucoes.com.br/imoveis/",
    "https://www.teixeiradecarvalho.com.br/lancamentos",
    "https://construtoraatlantis.com.br/",
    "https://neoabc.com.br/",
    "https://www.tropicalconstrutora.com.br/",
    "https://sejaconvive.com.br/",
    "https://nordesteinc.com.br/",
    "https://inoveconstrucao.com.br/",
    "https://engemaxconstrucoes.com.br/",
    "https://drxconstrucoes.com.br/",
    "https://eqcomvc.com.br/",
    "https://mouradubeux.com.br/",
    "https://planc.com.br/",
    "https://hofmannstation.com.br/"
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
            'blog', 'contato', 'entregues', 'imoveis',
            'paraibanamente', 'pg-principal',
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
        if 'imoveis' in parts:
            # Needs to be a specific property, not just /imoveis/ or a category
            # Ensure the path is longer than just the category keywords
            clean_parts = [p for p in parts if p]
            if len(clean_parts) > 1 and clean_parts[-1] not in {'lancamentos', 'em-construcao', 'prontos-para-morar'}:
                logger.debug(f"Accepting {url} for seed {seed_url}")
                return True
            else:
                logger.debug(f"Discarding {url}: path is just a category for construtorabrascon.com.br")
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

    elif 'apto.vc' in seed_url:
        # Expected format: /br/pb/joao-pessoa/bairro/empreendimento or similar for other cities
        # Needs to be at least 5 parts to be a specific property.
        if len(parts) >= 5 and parts[0] == 'br' and parts[1] == 'pb' and parts[2] in ['joao-pessoa', 'cabedelo', 'conde']:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for apto.vc")
            return False

    elif 'ocaconstrutora.com.br' in seed_url:
        if 'empreendimento' in parts and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for ocaconstrutora.com.br")
            return False

    elif 'massai.com.br' in seed_url:
        if 'empreendimentos' in parts and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for massai.com.br")
            return False

    elif 'ecoconstrucoes.com.br' in seed_url:
        if 'imoveis' in parts and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for ecoconstrucoes.com.br")
            return False

    elif 'teixeiradecarvalho.com.br' in seed_url:
        property_keywords = {'imoveis', 'imovel', 'empreendimento', 'empreendimentos', 'lancamentos'}
        # Check if any part is in the property keywords and there's another part indicating a specific property
        if any(keyword in parts for keyword in property_keywords) and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for teixeiradecarvalho.com.br")
            return False

    elif any(domain in seed_url for domain in [
        'construtoraatlantis.com.br', 'neoabc.com.br', 'sejaconvive.com.br',
        'nordesteinc.com.br', 'inoveconstrucao.com.br', 'engemaxconstrucoes.com.br',
        'drxconstrucoes.com.br', 'eqcomvc.com.br'
    ]):
        property_keywords = {'imoveis', 'imovel', 'empreendimento', 'empreendimentos', 'lancamentos', 'joao-pessoa'}

        # We need a property keyword, PLUS an actual specific property name in the path.
        # If the path just ends in the keyword (or keyword + empty string from trailing slash), it's just the catalog.
        clean_parts = [p for p in parts if p]
        has_keyword = any(keyword in clean_parts for keyword in property_keywords)
        has_property_name = False

        if has_keyword:
            # Find the index of the last keyword found
            last_kw_idx = -1
            for i, part in enumerate(clean_parts):
                if part in property_keywords:
                    last_kw_idx = i

            # Ensure there is a path segment AFTER the property keyword
            if last_kw_idx != -1 and last_kw_idx < len(clean_parts) - 1:
                has_property_name = True

        if has_keyword and has_property_name:
            logger.debug(f"Accepting {url} for boutique seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for boutique seed {seed_url}")
            return False

    elif 'tropicalconstrutora.com.br' in seed_url:
        # tropical uses a query parameter id format: /imovel.php?id=...
        if 'imovel.php' in parts and 'id=' in url:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for tropicalconstrutora.com.br")
            return False

    elif 'mouradubeux.com.br' in seed_url:
        if 'imoveis' in parts and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for mouradubeux.com.br")
            return False

    elif 'planc.com.br' in seed_url:
        if 'empreendimento' in parts and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for planc.com.br")
            return False

    elif 'hofmannstation.com.br' in seed_url:
        if 'imoveis' in parts and len([p for p in parts if p]) > 1:
            logger.debug(f"Accepting {url} for seed {seed_url}")
            return True
        else:
            logger.debug(f"Discarding {url}: not a specific property path for hofmannstation.com.br")
            return False

    logger.debug(f"Discarding {url}: no matching rules for seed {seed_url}")
    return False

def extract_slug_from_url(url: str) -> str:
    parsed_url = urlparse(url)
    path = parsed_url.path.strip('/')

    # Handle Tropical Construtora query parameter format
    if 'tropicalconstrutora.com.br' in url and 'id=' in parsed_url.query:
        # Generate slug based on the ID parameter
        query_params = dict(q.split('=') for q in parsed_url.query.split('&') if '=' in q)
        if 'id' in query_params:
            return generate_slug(f"tropical-{query_params['id']}")

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

                # Pagination & Load More Loop
                max_pages = 10
                for current_page in range(max_pages):
                    # Incremental scroll to trigger lazy loading on current view
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
                    await page.wait_for_timeout(2000) # Small buffer after scrolling

                    # Try to find and click a "Load More" or "Next Page" button
                    try:
                        # Generalized selector for common Brazilian real estate pagination buttons
                        button = await page.query_selector(
                            "button:has-text('Carregar mais'), "
                            "button:has-text('Ver mais'), "
                            "a:has-text('Carregar mais'), "
                            "a:has-text('Ver mais'), "
                            "a:has-text('Próxima'), "
                            "a:has-text('Próximo'), "
                            "li.next a, "
                            ".pagination-next"
                        )
                        if button and await button.is_visible():
                            logger.info(f"Clicking 'Load More' / 'Next' button on {seed}")
                            await button.click()
                            await page.wait_for_timeout(3000) # Wait for new content to load
                        else:
                            # No visible pagination button found, assume we reached the end
                            break
                    except Exception as e:
                        logger.debug(f"Pagination click failed or not found on {seed}: {e}")
                        break

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
