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


@router.get("/export", response_model=Dict[str, Any])
async def export_agents() -> Dict[str, Any]:
    """
    Exportar todos los agentes como JSON descargable.
    Útil para edición local y sincronización.
    """
    try:
        agents = service_list_agents()
        agents_dict = {a.id: a.dict() for a in agents}
        return {
            "timestamp": str(json.dumps({"count": len(agents), "version": "1.0"})),
            "agents": agents_dict
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export agents: {str(e)}")


@router.post("/bulk-update", response_model=Dict[str, Any])
async def bulk_update_agents(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Importar y sincronizar agentes desde JSON.
    Recibe dict con estructura: {"agents": {agent_id: agent_data, ...}}
    Actualiza memoria, archivo y BD.
    """
    try:
        agents_data = payload.get("agents", {})
        if not isinstance(agents_data, dict):
            raise ValueError("agents must be a dict")

        updated_count = 0
        errors = []

        for agent_id, agent_data in agents_data.items():
            try:
                # Get existing agent to avoid replacing entirely
                existing = get_agent(agent_id)
                
                # Extract updateable fields from the incoming data
                update_payload = {
                    k: v for k, v in agent_data.items()
                    if k in ["name", "status", "capabilities", "config", "internet_access", "allowed_domains", "target_urls", "search_terms"]
                }

                if update_payload:
                    update_agent(agent_id, update_payload)
                    updated_count += 1
            except KeyError:
                errors.append(f"Agent {agent_id} not found")
            except Exception as e:
                errors.append(f"Error updating {agent_id}: {str(e)}")

        return {
            "success": len(errors) == 0,
            "message": f"Updated {updated_count} agents",
            "updated_count": updated_count,
            "errors": errors,
            "file_path": str(AGENTS_FILE),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk update agents: {str(e)}")


@router.post("/sync", response_model=Dict[str, Any])
async def sync_agents_status() -> Dict[str, Any]:
    """
    Verificar y reportar estado de sincronización de agentes.
    Confirma que agents_db está sincronizado con registry.json
    """
    try:
        agents = service_list_agents()
        
        # Verify file persistence
        file_exists = AGENTS_FILE.exists()
        file_agents = []
        if file_exists:
            try:
                with open(AGENTS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    file_agents = list(data.keys())
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Error reading agents file: {str(e)}",
                    "agents_in_memory": len(agents),
                    "file_exists": False,
                    "synced": False
                }
        
        memory_ids = {a.id for a in agents}
        file_ids = set(file_agents)
        
        return {
            "success": True,
            "message": "Agents synchronized",
            "agents_in_memory": len(agents),
            "agents_in_file": len(file_ids),
            "file_exists": file_exists,
            "file_path": str(AGENTS_FILE),
            "synced": memory_ids == file_ids,
            "memory_only": list(memory_ids - file_ids),
            "file_only": list(file_ids - memory_ids),
            "agent_ids": sorted([a.id for a in agents]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check sync status: {str(e)}")
