import os
from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from schemas.generated.models import Project as ProjectSchema

class EmptyHTMLError(Exception):
    pass

from google.genai.errors import APIError

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(2),
    retry=retry_if_exception_type(APIError), # Retry only on API errors (like 429/503)
)
def parse_html_to_project(text_content: str) -> ProjectSchema:
    """Parses text content using Gemini to extract real estate data according to the ProjectSchema schema."""

    if not text_content or text_content.strip() == "":
        raise EmptyHTMLError("Text content cannot be empty.")

    prompt = f"""
    Extract real estate project information from the following pure text content using the exact structured output schema provided.

    You are reading pure text (not HTML).

    CRITICAL RULES FOR UNIT EXTRACTION:
    Look carefully for price tables, available units, square meters (m²), and bedroom counts. You MUST extract this into the units array so the system can calculate starting prices.
    If you cannot find a detailed table of specific units, but the text mentions a starting price (e.g., 'A partir de R$ X') along with an area or bedroom count, you MUST create at least ONE generic unit in the `units` array representing this baseline offer. Set its `unit_number` to 'Unidade Base' or 'A partir de', and assign the baseline price and minimum area to it so the system captures the financial starting point.
    Each unit should have its `snapshots` field populated with a `PropertySnapshot` object containing the `price_brl` and `timestamp` (current ISO datetime), and `source` (e.g. the developer name or 'scraper').

    CRITICAL RULES FOR AI GEO-FENCING (STRICT SCOPE):
    You MUST act as a strict geographic gatekeeper.
    Allowed Scope: The project MUST be located in João Pessoa OR the adjacent coastal premium neighborhoods of Cabedelo (e.g., Intermares, Camboinha, Ponta de Campina).
    Target Neighborhoods: Cabo Branco, Tambaú, Manaíra, Bessa, Altiplano, Jardim Oceania, Brisamar, Miramar.
    Rejection Logic: If you determine the project is located in a completely different city outside this coastal zone (such as Bananeiras, Campina Grande, etc.), you MUST set the `status` field explicitly to "review_needed".

    CRITICAL RULES FOR AI CONTEXT GENERATION (João Pessoa Market):
    You MUST dynamically generate the `ai_context` field (specifically `target_persona` and `local_advantage` in 'pt-BR' and 'en') based on the following strict rules:

    1. If Neighborhood is Tambaú or Cabo Branco AND area is small (<50m2):
       - Target Persona: ["Investors", "Digital Nomads"]
       - Local advantage: Highlight short-term rental liquidity, Airbnb potential, and proximity to the tourist hub.

    2. If Neighborhood is Manaíra or Bessa AND area is 90m2 - 150m2:
       - Target Persona: ["Families"]
       - Local advantage: Highlight the "Missing Middle" solution, stability, and family-oriented amenities (Condomínio clube).

    3. If Neighborhood is Altiplano OR area is very large/luxury:
       - Target Persona: ["UHNWI", "Investors"]
       - Local advantage: Highlight extreme exclusivity, vertical living or biofilia, and branded architecture.

    Text Content:
    {text_content}
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
