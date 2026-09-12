from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, HttpUrl, Field


class Bairro(str, Enum):
    CABO_BRANCO = "Cabo Branco"
    TAMBAU = "Tambaú"
    MANAIRA = "Manaíra"
    BESSA = "Bessa"
    OUTRO = "Outro"

class Status(str, Enum):
    NA_PLANTA = "na_planta"
    EM_CONSTRUCAO = "em_construcao"
    PRONTO = "pronto"

class PositionToSea(str, Enum):
    BEIRA_MAR = "beira_mar"
    QUADRA_MAR = "quadra_mar"
    MIOLO = "miolo"

class Coordinates(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None

class Location(BaseModel):
    neighborhood: Optional[Bairro] = Field(default=None, description="Bairro onde o empreendimento está localizado")
    position_to_sea: Optional[PositionToSea] = Field(default=None, description="Posição em relação ao mar")
    distance_to_beach_meters: Optional[int] = Field(default=None, description="Distância para a praia em metros (null se não encontrado)")
    coordinates: Optional[Coordinates] = Field(default_factory=Coordinates, description="Coordenadas geográficas")

class TargetPersona(BaseModel):
    pt_BR: Optional[List[str]] = Field(default_factory=list, alias="pt-BR", description="Público-alvo em português")
    en: Optional[List[str]] = Field(default_factory=list, description="Target persona in English")

class LocalAdvantage(BaseModel):
    pt_BR: Optional[str] = Field(default=None, alias="pt-BR", description="Vantagem local em português")
    en: Optional[str] = Field(default=None, description="Local advantage in English")

class AIContext(BaseModel):
    target_persona: Optional[TargetPersona] = Field(default_factory=TargetPersona)
    investment_roi_estimated_percent: Optional[float] = Field(default=None, description="ROI estimado em porcentagem (null se não encontrado)")
    local_advantage: Optional[LocalAdvantage] = Field(default_factory=LocalAdvantage)

class Assets(BaseModel):
    logo: Optional[str] = None
    hero_images: Optional[List[str]] = Field(default_factory=list)
    brochures: Optional[List[str]] = Field(default_factory=list)

class ProjectSchema(BaseModel):
    id: Optional[str] = Field(default=None, description="Document ID / URL slug")
    name: str = Field(description="Nome do empreendimento imobiliário")
    developer: Optional[str] = Field(default=None, description="Nome da construtora responsável")
    delivery_date: Optional[str] = Field(default=None, description="Data de entrega (ISO 8601 ou texto)")
    status: Optional[Status] = Field(default=None, description="Status da obra")
    amenities: Optional[List[str]] = Field(default_factory=list, description="Lista de comodidades")
    location: Optional[Location] = Field(default_factory=Location)
    ai_context: Optional[AIContext] = Field(default_factory=AIContext)
    assets: Optional[Assets] = Field(default_factory=Assets)
    manual_hero_image_url: Optional[str] = Field(default=None, description="URL da imagem principal do empreendimento (usar string da URL)")
    resolution_state: str = Field(default="staged", description="Estado de resolução do projeto")
    has_units: bool = Field(default=False, description="Indica se o projeto tem unidades cadastradas")
