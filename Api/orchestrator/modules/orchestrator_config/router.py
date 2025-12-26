from typing import Any, Dict

from fastapi import APIRouter

from .service import orchestrator_config, update_orchestrator_config

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])


@router.get("/config")
async def get_orchestrator_config() -> Dict[str, Any]:
    return orchestrator_config


@router.patch("/config")
async def patch_orchestrator_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    return update_orchestrator_config(payload)
