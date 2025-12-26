import json
import logging
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

DATA_DIR = Path("/data/agents") if Path("/data/agents").exists() else Path("data/agents")
DATA_DIR.mkdir(parents=True, exist_ok=True)
ORCHESTRATOR_CONFIG_FILE = DATA_DIR / "orchestrator_config.json"

orchestrator_config: Dict[str, Any] = {
    "model": "llama3.2",
    "prompt": """Eres un orquestador de agentes IA. Tu función es:
1. Analizar y comprender queries complejas
2. Proporcionar respuestas iniciales basadas en tu conocimiento
3. Coordinar agentes especializados cuando sea necesario
4. Sintetizar información de múltiples fuentes
5. Mantener contexto de conversación y evitar repetir respuestas

Responde de manera clara, concisa y profesional. Si el usuario pide un chiste, asegúrate de contar uno diferente cada vez.""",
    "options": {
        "temperature": 0.7,
        "num_predict": 200
    }
}


def load_orchestrator_config() -> None:
    global orchestrator_config
    try:
        if ORCHESTRATOR_CONFIG_FILE.exists():
            with open(ORCHESTRATOR_CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                orchestrator_config.update(loaded)
                logger.info("Orchestrator config loaded from %s", ORCHESTRATOR_CONFIG_FILE)
        else:
            save_orchestrator_config()
            logger.info("Created default orchestrator config file")
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to load orchestrator config: %s", exc)


def save_orchestrator_config() -> None:
    try:
        with open(ORCHESTRATOR_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(orchestrator_config, f, indent=2, ensure_ascii=False)
        logger.info("Orchestrator config saved to %s", ORCHESTRATOR_CONFIG_FILE)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to save orchestrator config: %s", exc)


def update_orchestrator_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    global orchestrator_config

    if "model" in payload:
        orchestrator_config["model"] = payload["model"]
    if "prompt" in payload:
        orchestrator_config["prompt"] = payload["prompt"]
    if "options" in payload and isinstance(payload["options"], dict):
        orchestrator_config["options"] = {**orchestrator_config.get("options", {}), **payload["options"]}

    save_orchestrator_config()
    return orchestrator_config
