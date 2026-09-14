from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class BilingualPersona(BaseModel):
    pt_BR: List[str] = Field(default_factory=list, alias="pt-BR")
    en: List[str] = Field(default_factory=list)

class BilingualAdvantage(BaseModel):
    pt_BR: str = Field(default="", alias="pt-BR")
    en: str = Field(default="")

class AiContextSchema(BaseModel):
    target_persona: BilingualPersona = Field(default_factory=BilingualPersona)
    investment_roi_estimated_percent: Optional[float] = Field(default=None)
    local_advantage: BilingualAdvantage = Field(default_factory=BilingualAdvantage)

class CoordinatesSchema(BaseModel):
    lat: float = Field(description="Latitude")
    lng: float = Field(description="Longitude")

class ProjectSchema(BaseModel):
    name: str = Field(description="Nome do empreendimento imobiliário")
    developer: str = Field(description="Nome da construtora responsável")
    status: str = Field(description="Status da obra")
    location: Dict[str, Any] = Field(
        description="Dicionário contendo a chave 'neighborhood' com o bairro",
        json_schema_extra={
            "properties": {
                "neighborhood": {"type": "string"}
            },
            "required": ["neighborhood"]
        }
    )
    coordinates: Optional[CoordinatesSchema] = Field(default=None, description="Coordenadas GPS geocodificadas do projeto")
    manual_hero_image_url: Optional[str] = Field(default=None, description="URL da imagem principal do empreendimento")
    resolution_state: str = Field(default="staged", description="Estado de resolução do projeto")
    ai_context: AiContextSchema = Field(default_factory=AiContextSchema, description="Contexto de AI do projeto")
