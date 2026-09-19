import pytest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from pydantic import ValidationError

from schemas.generated.models import Project as ProjectSchema
from parser import parse_html_to_project


@pytest.fixture(autouse=True)
def mock_google_auth(mocker):
    """Mock google.auth.default to prevent DefaultCredentialsError when genai.Client initializes."""
    mocker.patch('google.auth.default', return_value=(mocker.MagicMock(), 'dummy-project'))

MOCK_HTML_VALID = """
<div class="project-card">
    <h1 class="title">Residencial Brisa do Mar</h1>
    <span class="developer">Construtora Alliance</span>
    <div class="location">Cabo Branco</div>
    <div class="status">Em construção</div>
    <img class="hero-image" src="https://example.com/brisa.jpg" alt="Fachada do Residencial Brisa do Mar" />
</div>
"""

MOCK_HTML_MISSING_IMAGE = """
<div class="project-card">
    <h1 class="title">Edifício Solar das Águas</h1>
    <span class="developer">Setai Construtora</span>
    <div class="location">Tambaú</div>
    <div class="status">Lançamento</div>
    <!-- Imagem não disponível -->
</div>
"""

MOCK_HTML_EMPTY = ""


def test_parse_valid_html(mocker):
    """Test parsing a valid HTML snippet containing all fields."""
    mock_response = mocker.MagicMock()
    mock_response.text = '{"name": "Residencial Brisa do Mar", "developer": "Construtora Alliance", "location": {"neighborhood": "Cabo Branco"}, "status": "em_construcao", "manual_hero_image_url": "https://example.com/brisa.jpg"}'
    mocker.patch('google.genai.models.Models.generate_content', return_value=mock_response)

    result = parse_html_to_project(MOCK_HTML_VALID)
    assert isinstance(result, ProjectSchema)
    assert result.name == "Residencial Brisa do Mar"
    assert result.developer == "Construtora Alliance"
    assert result.location.neighborhood == "Cabo Branco"
    assert result.status == "em_construcao"
    assert str(result.manual_hero_image_url).rstrip("/") == "https://example.com/brisa.jpg"
    assert (result.resolution_state.value if hasattr(result.resolution_state, "value") else result.resolution_state) == "staged"
    assert result.ai_context is None or result.ai_context.model_dump(by_alias=True) == {"target_persona": {"pt-BR": None, "en": None}, "investment_roi_estimated_percent": None, "local_advantage": {"pt-BR": None, "en": None}}


def test_parse_html_missing_image(mocker):
    """Test parsing HTML where the hero image URL is missing."""
    mock_response = mocker.MagicMock()
    mock_response.text = '{"name": "Edifício Solar das Águas", "developer": "Setai Construtora", "location": {"neighborhood": "Tambaú"}, "status": "na_planta", "manual_hero_image_url": null}'
    mocker.patch('google.genai.models.Models.generate_content', return_value=mock_response)

    result = parse_html_to_project(MOCK_HTML_MISSING_IMAGE)
    assert isinstance(result, ProjectSchema)
    assert result.name == "Edifício Solar das Águas"
    assert result.developer == "Setai Construtora"
    assert result.location.neighborhood == "Tambaú"
    assert result.status == "na_planta"
    assert result.manual_hero_image_url is None
    assert (result.resolution_state.value if hasattr(result.resolution_state, "value") else result.resolution_state) == "staged"
    assert result.ai_context is None or result.ai_context.model_dump(by_alias=True) == {"target_persona": {"pt-BR": None, "en": None}, "investment_roi_estimated_percent": None, "local_advantage": {"pt-BR": None, "en": None}}


def test_parse_empty_html():
    """Test parsing an empty HTML string. It should ideally raise an error or return a specific state, depending on implementation.
    Here we expect it to raise an Exception since no valid data can be extracted to fulfill required fields."""
    from parser import EmptyHTMLError
    from tenacity import RetryError
    with pytest.raises((EmptyHTMLError, RetryError)):
        parse_html_to_project(MOCK_HTML_EMPTY)
