import os
from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from schemas import ProjectSchema

class EmptyHTMLError(Exception):
    pass

from google.genai.errors import APIError

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(APIError), # Retry only on API errors (like 429/503)
)
def parse_html_to_project(html_content: str) -> ProjectSchema:
    """Parses HTML content using Gemini to extract real estate data according to the ProjectSchema schema."""

    if not html_content or html_content.strip() == "":
        raise EmptyHTMLError("HTML content cannot be empty.")

    prompt = f"""
    Extract real estate project information from the following HTML content.
    Map the data to the provided schema.
    If an image URL is not found, leave it as null.

    HTML Content:
    {html_content}
    """

    client = genai.Client(vertexai=True, location="us-central1")
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ProjectSchema,
        ),
    )

    if not response.text:
        raise ValueError("Received empty response from Gemini.")

    # Pydantic will validate the JSON string returned by Gemini.
    # The new google-genai library with structured output returns JSON string.
    # We can parse it directly with Pydantic.
    return ProjectSchema.model_validate_json(response.text)
