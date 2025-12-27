import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

from .schemas import Agent, CreateAgentRequest

logger = logging.getLogger(__name__)

DATA_DIR = Path("/data/agents") if Path("/data/agents").exists() else Path("data/agents")
DATA_DIR.mkdir(parents=True, exist_ok=True)
AGENTS_FILE = DATA_DIR / "registry.json"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")


def _default_agent_config(model: str) -> Dict[str, Any]:
    system_prompts = {
        "codellama": "Eres un experto en Trading de Criptomonedas. Proporciona predicciones de compra y venta basandote en calculos matematicos estadisticos, solicita lo que te falte para una prediccion mas acertada.",
        "mistral": "Eres un analista de datos Historicos especializado. Enfócate en análisis de tendencias repetitivas en los valores de criptomonedas que permita predecir valores futuros o desiciones de compra y venta.",
        "llama3.2": "Eres un investigador de noticias para identificar cambios de precios en Criptomonedas. Proporciona sugerencias de compra y venta basandote en hechos actuales."
    }

    return {
        "prompt": system_prompts.get(model, "Eres un asistente especializado."),
        "options": {
            "temperature": 0.5 if model == "codellama" else 0.7,
            "num_predict": 150
        }
    }


agents_db: Dict[str, Agent] = {
    "agent-001": Agent(
        id="agent-001",
        name="Code Analyzer",
        model="codellama",
        status="active",
        capabilities=["code_analysis", "quality_check", "refactoring"],
        endpoint=OLLAMA_BASE_URL,
        config=_default_agent_config("codellama")
    ),
    "agent-002": Agent(
        id="agent-002",
        name="Data Analyst",
        model="mistral",
        status="active",
        capabilities=["data_analysis", "statistics", "visualization"],
        endpoint=OLLAMA_BASE_URL,
        config=_default_agent_config("mistral")
    ),
    "agent-003": Agent(
        id="agent-003",
        name="Conversation Agent",
        model="llama3.2",
        status="active",
        capabilities=["conversation", "general_knowledge", "coordination"],
        endpoint=OLLAMA_BASE_URL,
        config=_default_agent_config("llama3.2")
    )
}


def load_agents() -> None:
    global agents_db
    try:
        if AGENTS_FILE.exists():
            with open(AGENTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                agents_db = {agent_id: Agent(**agent_data) for agent_id, agent_data in data.items()}
                logger.info("Loaded %s agents from %s", len(agents_db), AGENTS_FILE)
        else:
            save_agents()
            logger.info("Created default agents file")
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to load agents: %s", exc)


def list_agents() -> List[Agent]:
    """Return the current list of agents from the in-memory store.
    This ensures callers always read the up-to-date dictionary managed here.
    """
    return list(agents_db.values())


def save_agents() -> None:
    try:
        data = {agent_id: agent.dict() for agent_id, agent in agents_db.items()}
        with open(AGENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info("Saved %s agents to %s", len(agents_db), AGENTS_FILE)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to save agents: %s", exc)


def create_agent(request: CreateAgentRequest) -> Agent:
    agent_id = f"agent-{len(agents_db) + 1:03d}"
    new_agent = Agent(
        id=agent_id,
        name=request.name,
        model=request.model,
        status="active",
        capabilities=request.capabilities,
        endpoint=OLLAMA_BASE_URL,
        config=_default_agent_config(request.model)
    )
    agents_db[agent_id] = new_agent
    save_agents()
    return new_agent


def update_agent(agent_id: str, payload: Dict[str, Any]) -> Agent:
    agent = agents_db.get(agent_id)
    if not agent:
        raise KeyError("Agent not found")

    if "name" in payload:
        agent.name = payload["name"]
    if "status" in payload:
        agent.status = payload["status"]
    if "capabilities" in payload and isinstance(payload["capabilities"], list):
        agent.capabilities = payload["capabilities"]
    if "config" in payload and isinstance(payload["config"], dict):
        agent.config = {**agent.config, **payload["config"]}

    agents_db[agent_id] = agent
    save_agents()
    return agent


def toggle_agent_status(agent_id: str) -> Agent:
    agent = agents_db.get(agent_id)
    if not agent:
        raise KeyError("Agent not found")

    agent.status = "inactive" if agent.status == "active" else "active"
    agents_db[agent_id] = agent
    save_agents()
    return agent


def get_agent(agent_id: str) -> Agent:
    agent = agents_db.get(agent_id)
    if not agent:
        raise KeyError("Agent not found")
    return agent
