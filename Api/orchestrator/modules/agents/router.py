from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from .schemas import Agent, CreateAgentRequest
from .service import (
    create_agent,
    get_agent,
    toggle_agent_status,
    update_agent,
    list_agents as service_list_agents,
    AGENTS_FILE,
    load_agents,
)
import json

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=List[Agent])
async def list_agents() -> List[Agent]:
    # Always read from service to avoid stale imported dict references
    return service_list_agents()


@router.get("/{agent_id}", response_model=Agent)
async def retrieve_agent(agent_id: str) -> Agent:
    try:
        return get_agent(agent_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("", response_model=Agent)
async def create_agent_endpoint(request: CreateAgentRequest) -> Agent:
    return create_agent(request)


@router.patch("/{agent_id}", response_model=Agent)
async def update_agent_endpoint(agent_id: str, payload: Dict[str, Any]) -> Agent:
    try:
        return update_agent(agent_id, payload)
    except KeyError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.delete("/{agent_id}")
async def toggle_agent_endpoint(agent_id: str) -> Dict[str, str]:
    try:
        agent = toggle_agent_status(agent_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {
        "message": f"Agent {agent_id} status changed to {agent.status}",
        "agent_id": agent_id,
        "new_status": agent.status,
    }


@router.get("/verify/{agent_id}", response_model=Dict[str, Any])
async def verify_agent_persistence(agent_id: str) -> Dict[str, Any]:
    """
    Verificar que un agente existe en memoria Y en archivo registry.json
    Útil para debugging de persistencia
    """
    try:
        # Verificar en memoria
        agent = get_agent(agent_id)
        
        # Verificar en archivo
        in_file = False
        file_content = None
        if AGENTS_FILE.exists():
            try:
                with open(AGENTS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    in_file = agent_id in data
                    if in_file:
                        file_content = data[agent_id]
            except Exception as e:
                file_content = f"Error reading file: {str(e)}"
        
        return {
            "agent_id": agent_id,
            "in_memory": True,
            "in_file": in_file,
            "synced": in_file,
            "file_path": str(AGENTS_FILE),
            "file_exists": AGENTS_FILE.exists(),
            "agent": agent.dict(),
            "file_content": file_content
        }
    except KeyError:
        raise HTTPException(status_code=404, detail="Agent not found in memory")


@router.post("/reload", response_model=Dict[str, Any])
async def reload_agents_from_file() -> Dict[str, Any]:
    """
    Recargar agentes desde registry.json sin reiniciar el servidor
    Útil cuando el archivo se modifica externamente o hay desincronización
    """
    try:
        # Use service accessors rather than referencing module-level dict
        agents_before = len(service_list_agents())
        load_agents()
        agents_after = len(service_list_agents())

        # Build agents list from current service snapshot
        current_agents = [a.id for a in service_list_agents()]

        return {
            "success": True,
            "message": "Agents reloaded from file",
            "agents_before": agents_before,
            "agents_after": agents_after,
            "file_path": str(AGENTS_FILE),
            "agents": current_agents,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload agents: {str(e)}")
