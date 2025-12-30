from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Agent(BaseModel):
    id: str
    name: str
    model: str
    status: str = "idle"
    capabilities: List[str] = Field(default_factory=list)
    endpoint: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    internet_access: bool = False
    allowed_domains: List[str] = Field(default_factory=list)
    target_urls: List[str] = Field(default_factory=list)
    search_terms: List[str] = Field(default_factory=list)


class CreateAgentRequest(BaseModel):
    name: str
    model: str
    capabilities: List[str] = Field(default_factory=list)
    internet_access: bool = False
    allowed_domains: List[str] = Field(default_factory=list)
    target_urls: List[str] = Field(default_factory=list)
    search_terms: List[str] = Field(default_factory=list)
