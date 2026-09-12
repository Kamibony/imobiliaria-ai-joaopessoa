from enum import Enum
from typing import Optional

from pydantic import BaseModel, HttpUrl, Field


class Bairro(str, Enum):
    CABO_BRANCO = "Cabo Branco"
    TAMBAU = "Tambaú"
    MANAIRA = "Manaíra"
    BESSA = "Bessa"
    OUTRO = "Outro"


class Lancamento(BaseModel):
    nome: str = Field(description="Nome do empreendimento imobiliário")
    construtora: str = Field(description="Nome da construtora responsável")
    bairro: Bairro = Field(description="Bairro onde o empreendimento está localizado")
    fase_obra: str = Field(description="Fase atual da obra (ex: Lançamento, Em construção, Pronto para morar)")
    hero_image_url: Optional[HttpUrl] = Field(default=None, description="URL da imagem principal do empreendimento")
