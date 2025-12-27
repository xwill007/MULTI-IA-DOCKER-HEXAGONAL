from pydantic import BaseModel, HttpUrl
from typing import Optional, List

class WebFetchRequest(BaseModel):
    url: HttpUrl

class WebFetchResponse(BaseModel):
    url: HttpUrl
    status_code: int
    content_type: Optional[str]
    content_snippet: str
    fetched_at: str

class WebSearchResponse(BaseModel):
    query: str
    results: List[str]
    fetched_at: str
