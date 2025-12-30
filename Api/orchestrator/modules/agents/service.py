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
DEFAULT_ALLOWED_DOMAINS = os.getenv("DOMAINS_WHITELIST", "localhost,127.0.0.1").split(",")


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


# Initialize with empty dict; will be populated by load_agents()
agents_db: Dict[str, Agent] = {}


def _init_default_agents() -> Dict[str, Agent]:
    """Create default agents (only used if registry.json is empty/missing)."""
    return {
        "agent-001": Agent(
            id="agent-001",
            name="Code Analyzer",
            model="codellama",
            status="active",
            capabilities=["code_analysis", "quality_check", "refactoring"],
            endpoint=OLLAMA_BASE_URL,
            config=_default_agent_config("codellama"),
            internet_access=False,
            allowed_domains=DEFAULT_ALLOWED_DOMAINS,
            target_urls=[],
            search_terms=[],
        ),
        "agent-002": Agent(
            id="agent-002",
            name="Data Analyst",
            model="mistral",
            status="active",
            capabilities=["data_analysis", "statistics", "visualization"],
            endpoint=OLLAMA_BASE_URL,
            config=_default_agent_config("mistral"),
            internet_access=False,
            allowed_domains=DEFAULT_ALLOWED_DOMAINS,
            target_urls=[],
            search_terms=[],
        ),
        "agent-003": Agent(
            id="agent-003",
            name="Conversation Agent",
            model="llama3.2",
            status="active",
            capabilities=["conversation", "general_knowledge", "coordination"],
            endpoint=OLLAMA_BASE_URL,
            config=_default_agent_config("llama3.2"),
            internet_access=True,
            allowed_domains=DEFAULT_ALLOWED_DOMAINS,
            target_urls=[],
            search_terms=[],
        )
    }


def load_agents() -> None:
    """Load agents from registry.json into the in-memory store.
    IMPORTANT: mutate the existing agents_db dict in-place to preserve references
    held by other modules (e.g., main.py) that imported agents_db.
    """
    try:
        if AGENTS_FILE.exists():
            if AGENTS_FILE.stat().st_size == 0:
                logger.warning("Agents registry empty; restoring defaults and saving")
                defaults = _init_default_agents()
                agents_db.clear()
                agents_db.update(defaults)
                save_agents()
                logger.info("Initialized defaults (count=%s)", len(agents_db))
                return

            with open(AGENTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                parsed = {agent_id: Agent(**agent_data) for agent_id, agent_data in data.items()}
                agents_db.clear()
                agents_db.update(parsed)
                logger.info("Loaded %s agents from %s", len(agents_db), AGENTS_FILE)
        else:
            logger.info("Registry file not found; creating defaults")
            defaults = _init_default_agents()
            agents_db.clear()
            agents_db.update(defaults)
            save_agents()
            logger.info("Created default agents file (count=%s)", len(agents_db))
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to load agents: %s", exc)
        logger.warning("Falling back to in-memory defaults and rewriting registry")
        defaults = _init_default_agents()
        agents_db.clear()
        agents_db.update(defaults)
        save_agents()


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
        config=_default_agent_config(request.model),
        internet_access=request.internet_access,
        allowed_domains=request.allowed_domains or DEFAULT_ALLOWED_DOMAINS,
        target_urls=request.target_urls,
        search_terms=request.search_terms,
    )
    agents_db[agent_id] = new_agent
    save_agents()
    logger.info("Agent created: %s", agent_id)
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
    if "internet_access" in payload:
        agent.internet_access = bool(payload["internet_access"])
    if "allowed_domains" in payload and isinstance(payload["allowed_domains"], list):
        agent.allowed_domains = payload["allowed_domains"]
    if "target_urls" in payload and isinstance(payload["target_urls"], list):
        agent.target_urls = payload["target_urls"]
    if "search_terms" in payload and isinstance(payload["search_terms"], list):
        agent.search_terms = payload["search_terms"]

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


def reload_agents_from_file() -> None:
    """Fuerza la recarga desde el archivo, descartando cambios en memoria no guardados."""
    global agents_db
    load_agents()
