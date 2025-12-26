from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from .schemas import Agent, CreateAgentRequest
from .service import agents_db, create_agent, get_agent, toggle_agent_status, update_agent

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=List[Agent])
async def list_agents() -> List[Agent]:
    return list(agents_db.values())


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
