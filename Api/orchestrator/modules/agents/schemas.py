from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class Agent(BaseModel):
    id: str
    name: str
    model: str
    status: str = "idle"
    capabilities: List[str] = []
    endpoint: Optional[str] = None
    config: Dict[str, Any] = {}


class CreateAgentRequest(BaseModel):
    name: str
    model: str
    capabilities: List[str] = []
