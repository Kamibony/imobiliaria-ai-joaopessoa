with open("scraper/crawler.py", "r") as f:
    content = f.read()

import_statement = "from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type\n"
content = content.replace(import_statement, "")

new_content = import_statement + content

with open("scraper/crawler.py", "w") as f:
    f.write(new_content)
