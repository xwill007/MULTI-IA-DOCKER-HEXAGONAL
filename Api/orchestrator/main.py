"""
Orquestador Multi-IA - FastAPI Main Entry Point
Coordina múltiples agentes IA para procesar queries
"""
import asyncio
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables from .env file in project root
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = Path(BASE_DIR).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
    logging.info(f"Loaded environment variables from {ENV_FILE}")
else:
    logging.warning(f".env file not found at {ENV_FILE}, using system environment variables")

# Ensure orchestrator and external Infrastructure paths are on sys.path for imports
INFRA_PATH = os.getenv("INFRA_PATH", "/ext/Infrastructure")
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, INFRA_PATH)

from conversation_storage import (  # type: ignore # Docker mount at /ext/Infrastructure
    ConversationStoragePort,
    HybridConversationStorage,
    InMemoryConversationStorage,
    PostgreSQLConversationStorage,
    RedisConversationStorage,
)

from modules.agents.schemas import Agent
from modules.agents.service import _default_agent_config, agents_db, load_agents
from modules.agents.router import router as agents_router
from modules.orchestrator_config.service import load_orchestrator_config, orchestrator_config
from modules.orchestrator_config.router import router as orchestrator_router
from modules.web_connector.router import router as web_router
from modules.web_connector.service import fetch_url_text

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ollama endpoint
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")


def get_rule_based_response(query: str) -> str:
    """Tiny rule-based fallback when LLM is unavailable."""
    q_lower = query.lower()
    if "chiste" in q_lower or "joke" in q_lower:
        return "Claro, aquí va uno rápido: ¿Por qué la computadora fue al médico? Porque tenía un virus."
    if "hola" in q_lower or "saludo" in q_lower:
        return "¡Hola! Soy el orquestador. Estoy listo para ayudarte con tus consultas."
    if "resumen" in q_lower:
        return "Puedo resumir el contenido solicitado. En modo degradado, necesito un texto o tema concreto para resumirlo correctamente."
    return "Estoy en modo offline. Puedo darte una respuesta breve basada en reglas: el sistema coordina agentes para darte análisis, pero ahora uso respuestas locales."


app = FastAPI(
    title="Multi-IA Orchestrator",
    description="Sistema de orquestación de agentes IA especializados",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://localhost:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class QueryRequest(BaseModel):
    query: str
    use_agents: bool = True
    conversation_id: str | None = None


class QueryResponse(BaseModel):
    query: str
    orchestrator_response: str
    agents_responses: List[Dict[str, Any]]
    final_response: str
    reasoning: str
    timestamp: str
    processing_time: float
    conversation_id: str


# Initialize storage based on environment
def get_storage() -> ConversationStoragePort:
    storage_type = os.getenv("STORAGE_TYPE", "memory").lower()
    logger.info("Initializing storage type: %s", storage_type)

    if storage_type == "redis":
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        redis_ttl = int(os.getenv("REDIS_TTL_SECONDS", "3600"))
        return RedisConversationStorage(redis_url, redis_ttl)

    elif storage_type == "postgresql":
        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@postgres:5432/ias_db")
        return PostgreSQLConversationStorage(db_url)

    elif storage_type == "hybrid":
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@postgres:5432/ias_db")
        redis_ttl = int(os.getenv("REDIS_TTL_SECONDS", "3600"))
        redis_max_messages = int(os.getenv("REDIS_MAX_MESSAGES", "20"))
        return HybridConversationStorage(redis_url, db_url, redis_ttl, redis_max_messages)

    else:  # memory (default)
        return InMemoryConversationStorage()


# Global storage instance
storage: ConversationStoragePort = get_storage()

# Load configs
load_orchestrator_config()
load_agents()

# Register modular routers
app.include_router(agents_router)
app.include_router(orchestrator_router)
app.include_router(web_router)


# Health check
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "agents_count": len(agents_db),
        "version": "1.0.0"
    }


# Test endpoint
@app.get("/test")
async def test_endpoint() -> Dict[str, str]:
    return {"message": "Backend is working", "cors": "enabled"}


# Get all conversations (for debugging)
@app.get("/conversations")
async def get_conversations() -> Dict[str, Any]:
    conversations = await storage.get_all_conversations()
    logger.info("Retrieved %s conversations", len(conversations))
    return {
        "total_conversations": len(conversations),
        "conversations": {conv_id: conv.to_dict() for conv_id, conv in conversations.items()}
    }


# Get specific conversation
@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str) -> Dict[str, Any]:
    conversation = await storage.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation.to_dict()


# Query endpoint - MAIN LOGIC
@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest) -> QueryResponse:
    """
    Procesa una query usando el orquestador y sus agentes

    Flujo:
    1. Orquestador genera su propia respuesta
    2. Si use_agents=True, consulta a agentes especializados
    3. Compara y sintetiza todas las respuestas
    4. Retorna respuesta final con razonamiento
    """
    start_time = asyncio.get_event_loop().time()

    conversation_id = request.conversation_id or str(uuid.uuid4())

    conversation = await storage.get_conversation(conversation_id)
    if not conversation:
        conversation = await storage.create_conversation(conversation_id)
        logger.info("New conversation started: %s", conversation_id)
    else:
        logger.info("Continuing conversation: %s (history: %s messages)", conversation_id, len(conversation.messages))

    conversation_history = [
        {"role": msg.role, "content": msg.content, "timestamp": msg.timestamp}
        for msg in conversation.messages
    ]

    logger.info("Processing query: %s", request.query)

    try:
        # 1. Respuesta del orquestador (con enriquecimiento web opcional)
        logger.info("Step 1: Getting orchestrator response with conversation context...")
        enriched_query = request.query
        q_lower = request.query.lower()
        if ("http://" in q_lower or "https://" in q_lower) or any(k in q_lower for k in ["noticia", "hoy", "último", "precio", "web"]):
            try:
                url = None
                for token in request.query.split():
                    if token.startswith("http://") or token.startswith("https://"):
                        url = token
                        break
                if url:
                    web_data = await fetch_url_text(url)
                    status_raw = web_data.get("status_code")
                    try:
                        status_code = int(status_raw) if isinstance(status_raw, (int, float, str)) else 0
                    except (TypeError, ValueError):
                        status_code = 0

                    if status_code < 400:
                        snippet = str(web_data.get("content_snippet") or "")[:1500]
                        enriched_query = f"Contexto web:\n{snippet}\n\nPregunta:\n{request.query}"
            except Exception as exc:
                logger.warning("Web context enrichment failed: %s", exc)

        orchestrator_response = await get_orchestrator_response(enriched_query, conversation_history)
        logger.info("Orchestrator response received: %s...", orchestrator_response[:100] if orchestrator_response else "EMPTY")

        # 2. Consultar agentes si está habilitado
        agents_responses: List[Dict[str, Any]] = []
        if request.use_agents and len(agents_db) > 0:
            logger.info("Step 2: Querying agents...")
            agents_responses = await query_agents(request.query)
            logger.info("Agents responses: %s responses received", len(agents_responses))
        else:
            logger.info("Step 2: Skipping agents (use_agents=False or no agents)")

        # 3. Sintetizar respuestas con IA
        logger.info("Step 3: AI-powered synthesis - orchestrator validating responses...")
        final_response, reasoning = await synthesize_responses_with_ai(
            request.query,
            orchestrator_response,
            agents_responses
        )
        logger.info("Synthesis complete. Final response length: %s", len(final_response))

        # Store conversation messages
        await storage.save_message(conversation_id, "user", request.query)
        await storage.save_message(conversation_id, "assistant", final_response)

        processing_time = asyncio.get_event_loop().time() - start_time

        response_obj = QueryResponse(
            query=request.query,
            orchestrator_response=orchestrator_response,
            agents_responses=agents_responses,
            final_response=final_response,
            reasoning=reasoning,
            timestamp=datetime.now().isoformat(),
            processing_time=round(processing_time, 3),
            conversation_id=conversation_id
        )

        logger.info("Query processed successfully in %.3fs (conversation: %s)", processing_time, conversation_id)
        return response_obj

    except Exception as exc:
        logger.error("Error processing query: %s: %s", type(exc).__name__, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


async def get_orchestrator_response(query: str, conversation_history: Optional[List[Dict[str, Any]]] = None) -> str:
    """Genera respuesta del orquestador usando su propio modelo con contexto de conversación."""
    logger.info("Getting orchestrator response...")

    system_prompt = orchestrator_config.get("prompt", "Eres un asistente útil.")
    model = orchestrator_config.get("model", "llama3.2")
    options = orchestrator_config.get("options", {"temperature": 0.7, "num_predict": 200})

    context = system_prompt
    if conversation_history:
        context += "\n\nHistorial de conversación:"
        for msg in conversation_history[-6:]:  # Last 3 exchanges
            role = "Usuario" if msg.get("role") == "user" else "Asistente"
            content = msg.get("content", "")
            context += f"\n{role}: {content}"

    try:
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": f"{context}\n\nUsuario: {query}\n\nOrquestador:",
                    "stream": False,
                    "options": options
                }
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("response", "").strip()
            else:
                logger.warning("Ollama returned status %s: %s", response.status_code, response.text)
                return f"[Orquestador] Basándome en mi análisis de '{query}', puedo coordinar agentes especializados para una respuesta completa."

    except Exception as exc:
        logger.error("Error calling Ollama at %s: %s: %s", OLLAMA_BASE_URL, type(exc).__name__, exc)
        return f"[Orquestador] Análisis inicial de '{query}' - consultando agentes especializados..."


async def query_agents(query: str) -> List[Dict[str, Any]]:
    """Consulta a todos los agentes activos en paralelo."""
    active_agents = [agent for agent in agents_db.values() if agent.status == "active"]

    logger.info("Querying %s active agents (total agents in db: %s)...", len(active_agents), len(agents_db))

    tasks = []
    for agent in active_agents:
        tasks.append(query_single_agent(agent, query))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    agents_responses = []
    for agent, result in zip(active_agents, results):
        if isinstance(result, Exception):
            logger.error("Agent %s failed: %s", agent.name, result)
            agents_responses.append({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "model": agent.model,
                "response": f"[Error: {str(result)}]",
                "status": "error"
            })
        else:
            agents_responses.append(result)

    return agents_responses


def _domain_allowed(url: str, allowed_domains: List[str]) -> bool:
    """Verifica si el dominio de la URL está en la lista de permitidos."""
    try:
        # Extraer host de la URL
        host = url.split("//", 1)[1].split("/", 1)[0]
        # Verificar si el host coincide con algún dominio permitido
        return any(host.endswith(domain.strip()) or host == domain.strip() 
                   for domain in allowed_domains if domain.strip())
    except (IndexError, AttributeError):
        logger.warning("Invalid URL format: %s", url)
        return False


async def _fetch_web_context(agent: Agent, query: str) -> str:
    """Enriquece el contexto del agente con información de internet.
    
    Descarga contenido de target_urls si están configuradas,
    respetando la whitelist de allowed_domains.
    """
    web_snippets = []
    
    if not agent.internet_access:
        return ""
    
    logger.info("Fetching web context for agent %s", agent.name)
    
    # Estrategia 1: URLs específicas configuradas
    if agent.target_urls:
        for url in agent.target_urls:
            # Verificar si el dominio está permitido
            if not _domain_allowed(url, agent.allowed_domains):
                logger.warning("URL %s not in allowed_domains for agent %s", url, agent.name)
                continue
            
            try:
                logger.info("Fetching URL: %s", url)
                data = await fetch_url_text(url, agent.allowed_domains)
                
                if data.get("status_code") == 200:
                    snippet = data.get("content_snippet", "")
                    if snippet:
                        web_snippets.append(f"Fuente: {url}\n{snippet}")
                else:
                    logger.warning("Failed to fetch %s: status %s", url, data.get("status_code"))
            
            except Exception as exc:
                logger.error("Error fetching %s: %s", url, exc)
                continue
    
    # Estrategia 2: Búsqueda con search_terms (futuro: integrar API de búsqueda)
    # elif agent.search_terms:
    #     search_query = f"{query} {' '.join(agent.search_terms)}"
    #     # TODO: Integrar Google/Bing/DuckDuckGo API
    
    # Combinar snippets limitando tamaño total
    if web_snippets:
        combined = "\n\n---\n\n".join(web_snippets)
        # Limitar a ~3000 caracteres para no saturar el contexto del LLM
        return combined[:3000]
    
    return ""


async def query_single_agent(agent: Agent, query: str) -> Dict[str, Any]:
    """Consulta a un agente individual usando Ollama.
    
    Si el agente tiene internet_access habilitado, enriquece el prompt
    con contenido descargado de sus target_urls configuradas.
    """
    start_time = asyncio.get_event_loop().time()
    logger.info("Querying agent: %s (%s) - internet_access: %s", 
                agent.name, agent.model, agent.internet_access)

    conf = agent.config or {}
    system_prompt = conf.get("prompt") or _default_agent_config(agent.model)["prompt"]
    options = conf.get("options") or _default_agent_config(agent.model)["options"]

    # 🌐 Enriquecer con contexto web si está habilitado
    enriched_query = query
    if agent.internet_access:
        try:
            web_context = await _fetch_web_context(agent, query)
            if web_context:
                logger.info("Web context retrieved: %d characters", len(web_context))
                enriched_query = f"{query}\n\n=== INFORMACIÓN ACTUALIZADA DE INTERNET ===\n{web_context}\n=== FIN DE INFORMACIÓN WEB ==="
            else:
                logger.warning("No web content retrieved for agent %s", agent.name)
        except Exception as exc:
            logger.error("Failed to fetch web context: %s", exc)
            # Continuar sin contexto web en caso de error

    try:
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{agent.endpoint}/api/generate",
                json={
                    "model": agent.model,
                    "prompt": f"{system_prompt}\n\nQuery: {enriched_query}\n\nRespuesta:",
                    "stream": False,
                    "options": options
                }
            )

            if response.status_code == 200:
                data = response.json()
                agent_response = data.get("response", "").strip()
            else:
                logger.warning("Agent %s returned status %s: %s", agent.name, response.status_code, response.text[:200])
                agent_response = f"[{agent.name}] No disponible (HTTP {response.status_code})"

            response_time = asyncio.get_event_loop().time() - start_time

            return {
                "agent_id": agent.id,
                "agent_name": agent.name,
                "model": agent.model,
                "response": agent_response,
                "status": "success" if response.status_code == 200 else "error",
                "capabilities": agent.capabilities,
                "response_time": round(response_time, 2)
            }

    except Exception as exc:
        response_time = asyncio.get_event_loop().time() - start_time
        logger.error("Error querying %s at %s: %s: %s", agent.name, agent.endpoint, type(exc).__name__, exc)

        fallback_responses = {
            "codellama": "El análisis de código indica que se requiere revisión de estructura, patrones de diseño y mejores prácticas. Se recomienda implementar linting automático y pruebas unitarias.",
            "mistral": "Basado en los datos disponibles, se sugiere realizar análisis de tendencias, validación de integridad de datos y documentación de hallazgos clave.",
            "llama3.2": "Para abordar esta consulta de manera integral, consideramos múltiples perspectivas: el enfoque técnico, el contexto del usuario y las mejores prácticas aplicables."
        }

        rule_based = get_rule_based_response(query)
        fallback_response = rule_based or fallback_responses.get(agent.model, rule_based)

        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "model": agent.model,
            "response": fallback_response,
            "status": "degraded",
            "capabilities": agent.capabilities,
            "response_time": round(response_time, 2)
        }


async def synthesize_responses_with_ai(
    query: str,
    orchestrator_response: str,
    agents_responses: List[Dict[str, Any]]
) -> tuple[str, str]:
    """El orquestador analiza y valida las respuestas de los agentes usando IA."""
    logger.info("AI-powered synthesis starting...")
    logger.info("Agents responses count: %s", len(agents_responses) if agents_responses else 0)

    if not agents_responses:
        logger.info("No agent responses, using only orchestrator")
        return orchestrator_response, "Solo respuesta del orquestador (agentes no disponibles)"

    successful_responses = [
        r for r in agents_responses
        if (r.get("status") in ["success", "degraded"] and
            r.get("response") and
            not r["response"].startswith("[Error"))
    ]

    logger.info("Successful responses: %s (including %s degraded)", len(successful_responses), sum(1 for r in successful_responses if r.get("status") == "degraded"))

    if not successful_responses:
        logger.warning("No successful agent responses")

        analysis_prompt = f"""Query del usuario: {query}

Mi análisis inicial como orquestador: {orchestrator_response}

Analiza esta respuesta más profundamente y proporciona:
1. Un resumen claro de lo que el usuario preguntó
2. Tu análisis detallado de la respuesta inicial
3. Puntos clave a considerar
4. Una respuesta final mejorada y más completa

Respuesta mejorada:"""

        try:
            timeout = httpx.Timeout(120.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": "llama3.2",
                        "prompt": analysis_prompt,
                        "stream": False,
                        "options": {"temperature": 0.5, "num_predict": 300}
                    }
                )
                if response.status_code == 200:
                    result = response.json()
                    improved_response = result.get("response", orchestrator_response)
                    logger.info("Orchestrator improved response: %s...", improved_response[:100])
                    return improved_response, "Respuesta mejorada por el orquestador (análisis profundo sin agentes)"
        except Exception as exc:
            logger.warning("Could not improve response with AI: %s", exc)

        rule_based = get_rule_based_response(query)
        return rule_based, "Respuesta generada en modo degradado (sin agentes ni LLM)"

    analysis_context = f"""Query del usuario: {query}

Mi análisis inicial: {orchestrator_response}

Respuestas de agentes especializados:
"""

    for i, agent_resp in enumerate(successful_responses, 1):
        agent_name = agent_resp.get('agent_name', 'Unknown')
        agent_model = agent_resp.get('model', 'unknown')
        agent_response = agent_resp.get('response', '')
        analysis_context += f"\n{i}. {agent_name} ({agent_model}):\n{agent_response}\n"

    synthesis_prompt = f"""{analysis_context}

Como orquestador, tu tarea es:
1. ANALIZAR cada respuesta de los agentes
2. VALIDAR cuál o cuáles respuestas son más relevantes y precisas
3. IDENTIFICAR contradicciones o complementos entre respuestas
4. GENERAR una respuesta final que integre lo mejor de cada agente

Proporciona una respuesta final coherente, validada y de alta calidad que responda directamente a: "{query}"

Respuesta final validada:"""

    try:
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": synthesis_prompt,
                    "stream": False,
                    "options": {"temperature": 0.6, "num_predict": 300}
                }
            )

            if response.status_code == 200:
                data = response.json()
                final_response = data.get("response", "").strip()

                reasoning = f"""Proceso de validación del orquestador:
1. Query recibida: {query}
2. Agentes consultados: {len(successful_responses)}
3. Respuestas analizadas y validadas por el orquestador
4. Respuesta final sintetizada usando inteligencia artificial"""

                logger.info("AI synthesis complete. Final response length: %s", len(final_response))
                return final_response, reasoning
            else:
                logger.warning("Synthesis AI call failed: %s", response.status_code)
                return _fallback_synthesis(query, orchestrator_response, successful_responses)

    except Exception as exc:
        logger.error("Error in AI synthesis: %s", exc)
        return _fallback_synthesis(query, orchestrator_response, successful_responses)


def _fallback_synthesis(query: str, orchestrator_response: str, successful_responses: List[Dict]) -> tuple[str, str]:
    """Fallback si la síntesis IA falla."""
    final_response = f"**Respuesta del Orquestador:**\n{orchestrator_response}\n\n"
    final_response += "**Respuestas de Agentes:**\n"

    for agent_resp in successful_responses:
        agent_name = agent_resp.get('agent_name', 'Unknown Agent')
        agent_response = agent_resp.get('response', '[Sin respuesta]')
        final_response += f"\n• **{agent_name}**: {agent_response}"

    reasoning = "Síntesis básica (modo fallback)"
    return final_response, reasoning


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
