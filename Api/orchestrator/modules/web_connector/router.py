from typing import Any, Dict, Optional, cast

from pydantic import HttpUrl

from fastapi import APIRouter, HTTPException, Query

from .schemas import WebFetchRequest, WebFetchResponse, WebSearchResponse
from .service import fetch_url_text, search_stub

router = APIRouter(prefix="/web", tags=["web"])


@router.get("/fetch", response_model=WebFetchResponse)
async def fetch(url: str = Query(..., description="URL absoluta")) -> WebFetchResponse:
    data = await fetch_url_text(url)
    status_raw = data.get("status_code")
    try:
        status_code = int(status_raw) if isinstance(status_raw, (int, float, str)) else 0
    except (TypeError, ValueError):
        status_code = 0

    content_type = cast(Optional[str], data.get("content_type"))
    url_typed = cast(HttpUrl, url)

    return WebFetchResponse(
        url=url_typed,
        status_code=status_code,
        content_type=content_type,
        content_snippet=str(data["content_snippet"]),
        fetched_at=str(data["fetched_at"]),
    )


@router.get("/search", response_model=WebSearchResponse)
async def search(query: str = Query(..., min_length=3)) -> WebSearchResponse:
    # Stub response until a proper search API is wired
    data = await search_stub(query)

    results_raw = data.get("results")
    results_list = results_raw if isinstance(results_raw, list) else []

    return WebSearchResponse(
        query=query,
        results=results_list,
        fetched_at=str(data["fetched_at"]),
    )
