from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

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
    manual_hero_image_url: Optional[str] = Field(default=None, description="URL da imagem principal do empreendimento")
    resolution_state: str = Field(default="staged", description="Estado de resolução do projeto")
    ai_context: Dict[str, Any] = Field(
        default={
            "target_persona": {"pt-BR": [], "en": []},
            "investment_roi_estimated_percent": None,
            "local_advantage": {"pt-BR": "", "en": ""}
        },
        description="Contexto de AI do projeto",
        json_schema_extra={
            "properties": {
                "target_persona": {
                    "type": "object",
                    "properties": {
                        "pt-BR": {"type": "array", "items": {"type": "string"}},
                        "en": {"type": "array", "items": {"type": "string"}}
                    },
                    "required": ["pt-BR", "en"]
                },
                "investment_roi_estimated_percent": {"type": ["number", "null"]},
                "local_advantage": {
                    "type": "object",
                    "properties": {
                        "pt-BR": {"type": "string"},
                        "en": {"type": "string"}
                    },
                    "required": ["pt-BR", "en"]
                }
            },
            "required": ["target_persona", "local_advantage"]
        }
    )
