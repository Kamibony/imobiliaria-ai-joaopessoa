import os
from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from schemas import Lancamento

class EmptyHTMLError(Exception):
    pass

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(Exception), # Retry on any exception, including network or 429
)
def parse_html_to_lancamento(html_content: str) -> Lancamento:
    """Parses HTML content using Gemini to extract real estate data according to the Lancamento schema."""

    if not html_content or html_content.strip() == "":
        raise EmptyHTMLError("HTML content cannot be empty.")

    prompt = f"""
    Extract real estate project information from the following HTML content.
    Map the data to the provided schema.
    If an image URL is not found, leave it as null.

    HTML Content:
    {html_content}
    """

    client = genai.Client()
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=Lancamento,
        ),
    )

    if not response.text:
        raise ValueError("Received empty response from Gemini.")

    # Pydantic will validate the JSON string returned by Gemini.
    # The new google-genai library with structured output returns JSON string.
    # We can parse it directly with Pydantic.
    return Lancamento.model_validate_json(response.text)
