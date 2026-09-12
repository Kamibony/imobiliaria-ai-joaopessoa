import pytest
from pydantic import ValidationError

from schemas import Lancamento, Bairro
from parser import parse_html_to_lancamento

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
    mock_response.text = '{"nome": "Residencial Brisa do Mar", "construtora": "Construtora Alliance", "bairro": "Cabo Branco", "fase_obra": "Em construção", "hero_image_url": "https://example.com/brisa.jpg"}'
    mocker.patch('google.genai.models.Models.generate_content', return_value=mock_response)

    result = parse_html_to_lancamento(MOCK_HTML_VALID)
    assert isinstance(result, Lancamento)
    assert result.nome == "Residencial Brisa do Mar"
    assert result.construtora == "Construtora Alliance"
    assert result.bairro == Bairro.CABO_BRANCO
    assert result.fase_obra == "Em construção"
    assert str(result.hero_image_url).rstrip("/") == "https://example.com/brisa.jpg"


def test_parse_html_missing_image(mocker):
    """Test parsing HTML where the hero image URL is missing."""
    mock_response = mocker.MagicMock()
    mock_response.text = '{"nome": "Edifício Solar das Águas", "construtora": "Setai Construtora", "bairro": "Tambaú", "fase_obra": "Lançamento", "hero_image_url": null}'
    mocker.patch('google.genai.models.Models.generate_content', return_value=mock_response)

    result = parse_html_to_lancamento(MOCK_HTML_MISSING_IMAGE)
    assert isinstance(result, Lancamento)
    assert result.nome == "Edifício Solar das Águas"
    assert result.construtora == "Setai Construtora"
    assert result.bairro == Bairro.TAMBAU
    assert result.fase_obra == "Lançamento"
    assert result.hero_image_url is None


def test_parse_empty_html():
    """Test parsing an empty HTML string. It should ideally raise an error or return a specific state, depending on implementation.
    Here we expect it to raise an Exception since no valid data can be extracted to fulfill required fields."""
    from parser import EmptyHTMLError
    from tenacity import RetryError
    with pytest.raises((EmptyHTMLError, RetryError)):
        parse_html_to_lancamento(MOCK_HTML_EMPTY)
