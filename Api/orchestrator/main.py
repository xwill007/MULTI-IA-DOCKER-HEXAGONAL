"""
Orquestador Multi-IA - FastAPI Main Entry Point
Coordina múltiples agentes IA para procesar queries
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import asyncio
from datetime import datetime
import logging
import os
import uuid
import sys

# Ensure orchestrator and external Infrastructure paths are on sys.path for imports
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INFRA_PATH = os.getenv("INFRA_PATH", "/ext/Infrastructure")
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, INFRA_PATH)

from conversation_storage import (  # type: ignore # Docker mount at /ext/Infrastructure
    ConversationStoragePort,
    InMemoryConversationStorage,
    RedisConversationStorage,
    PostgreSQLConversationStorage,
    HybridConversationStorage
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_rule_based_response(query: str) -> str:
    """Tiny rule-based fallback when LLM is unavailable."""
    q_lower = query.lower()
    if "chiste" in q_lower or "joke" in q_lower:
        return "Claro, aquí va uno rápido: ¿Por qué la computadora fue al médico? Porque tenía un virus."  # short, safe joke
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
        "http://localhost:3001",  # Fallback when 3000 is in use
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://localhost:8080"  # Otros puertos comunes
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Agent(BaseModel):
    id: str
    name: str
    model: str
    status: str = "idle"
    capabilities: List[str] = []
    endpoint: Optional[str] = None
    # Configuración editable por agente (prompt y opciones del modelo)
    config: Dict[str, Any] = {}

class QueryRequest(BaseModel):
    query: str
    use_agents: bool = True
    conversation_id: Optional[str] = None

class QueryResponse(BaseModel):
    query: str
    orchestrator_response: str
    agents_responses: List[Dict[str, Any]]
    final_response: str
    reasoning: str
    timestamp: str
    processing_time: float
    conversation_id: str

class CreateAgentRequest(BaseModel):
    name: str
    model: str
    capabilities: List[str] = []

# Ollama endpoint - usar variable de entorno o default a contenedor Docker
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# Configuración del orquestador (editable)
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

# In-memory storage (temporal)
def _default_agent_config(model: str) -> Dict[str, Any]:
    system_prompts = {
        "codellama": "Eres un experto en Trading de Criptomonedas. Proporciona predicciones de compra y venta basandote en calculos matematicos estadisticos, solicita lo que te falte para una prediccion mas acertada.",
        #"Eres un experto en análisis de código. Proporciona respuestas técnicas y precisas sobre programación, arquitectura y calidad de código.",
        "mistral": "Eres un analista de datos Historicos especializado. Enfócate en análisis de tendencias repetitivas en los valores de criptomonedas que permita predecir valores futuros o desiciones de compra y venta.",
        #"Eres un analista de datos especializado. Enfócate en análisis, estadísticas y visualización de información.",
        "llama3.2": "Eres un investigador de noticias para identificar cambios de precios en Criptomonedas. Proporciona sugerencias de compra y venta basandote en hechos actuales."
        #"Eres un agente conversacional general. Proporciona respuestas útiles y contextualmente relevantes."
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

# Conversation history storage (in-memory)
# Format: {conversation_id: [{"role": "user/assistant", "content": "...", "timestamp": "..."}]}
# conversations_db: Dict[str, List[Dict[str, str]]] = {}  # Replaced by storage layer

# Initialize storage based on environment
def get_storage() -> ConversationStoragePort:
    """Factory para crear storage según configuración"""
    storage_type = os.getenv("STORAGE_TYPE", "memory").lower()
    
    logger.info(f"Initializing storage type: {storage_type}")
    
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

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "agents_count": len(agents_db),
        "version": "1.0.0"
    }

# Test endpoint
@app.get("/test")
async def test_endpoint():
    """Simple test endpoint"""
    return {
        "message": "Backend is working",
        "cors": "enabled"
    }

# Get all agents
@app.get("/agents", response_model=List[Agent])
async def get_agents():
    """Get all registered agents"""
    logger.info(f"Getting {len(agents_db)} agents")
    return list(agents_db.values())

# Get all conversations (for debugging)
@app.get("/conversations")
async def get_conversations():
    """Get all stored conversations (debugging endpoint)"""
    conversations = await storage.get_all_conversations()
    logger.info(f"Retrieved {len(conversations)} conversations")
    return {
        "total_conversations": len(conversations),
        "conversations": {
            conv_id: conv.to_dict()
            for conv_id, conv in conversations.items()
        }
    }

# Get specific conversation
@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a specific conversation by ID"""
    conversation = await storage.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation.to_dict()

# Create new agent
@app.post("/agents", response_model=Agent)
async def create_agent(request: CreateAgentRequest):
    """Create a new agent"""
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
    logger.info(f"Created agent: {agent_id} - {request.name}")
    
    return new_agent

# Get single agent
@app.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    agent = agents_db.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

# Update agent configuration or metadata
@app.patch("/agents/{agent_id}", response_model=Agent)
async def update_agent(agent_id: str, payload: Dict[str, Any]):
    agent = agents_db.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Update editable fields
    if "name" in payload:
        agent.name = payload["name"]
    if "status" in payload:
        agent.status = payload["status"]
    if "capabilities" in payload and isinstance(payload["capabilities"], list):
        agent.capabilities = payload["capabilities"]
    if "config" in payload and isinstance(payload["config"], dict):
        # Merge config shallowly
        new_conf = {**agent.config, **payload["config"]}
        agent.config = new_conf
    
    agents_db[agent_id] = agent
    logger.info(f"Updated agent {agent_id}")
    return agent

# Get orchestrator configuration
@app.get("/orchestrator/config")
async def get_orchestrator_config():
    """Get current orchestrator configuration"""
    return orchestrator_config

# Update orchestrator configuration
@app.patch("/orchestrator/config")
async def update_orchestrator_config(payload: Dict[str, Any]):
    """Update orchestrator configuration (prompt, model, options)"""
    global orchestrator_config
    
    if "model" in payload:
        orchestrator_config["model"] = payload["model"]
    if "prompt" in payload:
        orchestrator_config["prompt"] = payload["prompt"]
    if "options" in payload and isinstance(payload["options"], dict):
        orchestrator_config["options"] = {**orchestrator_config["options"], **payload["options"]}
    
    logger.info(f"Orchestrator config updated")
    return orchestrator_config

# Query endpoint - MAIN LOGIC
@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """
    Procesa una query usando el orquestador y sus agentes
    
    Flujo:
    1. Orquestador genera su propia respuesta
    2. Si use_agents=True, consulta a agentes especializados
    3. Compara y sintetiza todas las respuestas
    4. Retorna respuesta final con razonamiento
    """
    start_time = asyncio.get_event_loop().time()
    
    # Generate or reuse conversation_id
    conversation_id = request.conversation_id or str(uuid.uuid4())
    
    # Get or create conversation
    conversation = await storage.get_conversation(conversation_id)
    if not conversation:
        conversation = await storage.create_conversation(conversation_id)
        logger.info(f"New conversation started: {conversation_id}")
    else:
        logger.info(f"Continuing conversation: {conversation_id} (history: {len(conversation.messages)} messages)")
    
    # Convert to dict format for compatibility with existing code
    conversation_history = [
        {"role": msg.role, "content": msg.content, "timestamp": msg.timestamp}
        for msg in conversation.messages
    ]
    
    logger.info(f"Processing query: {request.query}")
    
    try:
        # 1. Respuesta del orquestador (razonamiento propio) with conversation context
        logger.info("Step 1: Getting orchestrator response with conversation context...")
        orchestrator_response = await get_orchestrator_response(request.query, conversation_history)
        logger.info(f"Orchestrator response received: {orchestrator_response[:100] if orchestrator_response else 'EMPTY'}...")
        
        # 2. Consultar agentes si está habilitado
        agents_responses = []
        if request.use_agents and len(agents_db) > 0:
            logger.info("Step 2: Querying agents...")
            agents_responses = await query_agents(request.query)
            logger.info(f"Agents responses: {len(agents_responses)} responses received")
        else:
            logger.info("Step 2: Skipping agents (use_agents=False or no agents)")
        
        # 3. Sintetizar respuestas con IA (el orquestador valida y analiza)
        logger.info("Step 3: AI-powered synthesis - orchestrator validating responses...")
        final_response, reasoning = await synthesize_responses_with_ai(
            request.query,
            orchestrator_response,
            agents_responses
        )
        logger.info(f"Synthesis complete. Final response length: {len(final_response)}")
        
        # Store conversation messages using storage layer
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
        
        logger.info(f"Query processed successfully in {processing_time:.3f}s (conversation: {conversation_id})")
        return response_obj
        
    except Exception as e:
        logger.error(f"Error processing query: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def get_orchestrator_response(query: str, conversation_history: list = []) -> str:
    """
    Genera respuesta del orquestador usando su propio modelo con contexto de conversación
    Usa la configuración editable global orchestrator_config
    """
    logger.info("Getting orchestrator response...")
    
    # Usar prompt de la configuración editable
    system_prompt = orchestrator_config.get("prompt", "Eres un asistente útil.")
    model = orchestrator_config.get("model", "llama3.2")
    options = orchestrator_config.get("options", {"temperature": 0.7, "num_predict": 200})
    
    # Build conversation context
    context = system_prompt
    if conversation_history and len(conversation_history) > 0:
        context += "\n\nHistorial de conversación:"
        for msg in conversation_history[-6:]:  # Last 3 exchanges
            role = "Usuario" if msg.get("role") == "user" else "Asistente"
            content = msg.get("content", "")
            context += f"\n{role}: {content}"
    
    try:
        # Timeout más largo para la primera carga del modelo
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
                logger.warning(f"Ollama returned status {response.status_code}: {response.text}")
                return f"[Orquestador] Basándome en mi análisis de '{query}', puedo coordinar agentes especializados para una respuesta completa."
                
    except Exception as e:
        logger.error(f"Error calling Ollama at {OLLAMA_BASE_URL}: {type(e).__name__}: {e}")
        return f"[Orquestador] Análisis inicial de '{query}' - consultando agentes especializados..."

async def query_agents(query: str) -> List[Dict[str, Any]]:
    """
    Consulta a todos los agentes activos en paralelo
    """
    logger.info(f"Querying {len(agents_db)} agents...")
    
    tasks = []
    for agent in agents_db.values():
        if agent.status == "active":
            tasks.append(query_single_agent(agent, query))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    agents_responses = []
    for agent, result in zip(agents_db.values(), results):
        if isinstance(result, Exception):
            logger.error(f"Agent {agent.name} failed: {result}")
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

async def query_single_agent(agent: Agent, query: str) -> Dict[str, Any]:
    """
    Consulta a un agente individual usando Ollama
    """
    start_time = asyncio.get_event_loop().time()
    logger.info(f"Querying agent: {agent.name} ({agent.model})")
    
    # Prompt y opciones provenientes de la configuración editable
    conf = agent.config or {}
    system_prompt = conf.get("prompt") or _default_agent_config(agent.model)["prompt"]
    options = conf.get("options") or _default_agent_config(agent.model)["options"]
    
    try:
        # Timeout más largo para permitir carga inicial del modelo
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{agent.endpoint}/api/generate",
                json={
                    "model": agent.model,
                    "prompt": f"{system_prompt}\n\nQuery: {query}\n\nRespuesta:",
                    "stream": False,
                    "options": options
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                agent_response = data.get("response", "").strip()
            else:
                logger.warning(f"Agent {agent.name} returned status {response.status_code}: {response.text[:200]}")
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
            
    except Exception as e:
        response_time = asyncio.get_event_loop().time() - start_time
        logger.error(f"Error querying {agent.name} at {agent.endpoint}: {type(e).__name__}: {e}")
        
        # Provide intelligent fallback responses instead of error messages
        fallback_responses = {
            "codellama": "El análisis de código indica que se requiere revisión de estructura, patrones de diseño y mejores prácticas. Se recomienda implementar linting automático y pruebas unitarias.",
            "mistral": "Basado en los datos disponibles, se sugiere realizar análisis de tendencias, validación de integridad de datos y documentación de hallazgos clave.",
            "llama3.2": "Para abordar esta consulta de manera integral, consideramos múltiples perspectivas: el enfoque técnico, el contexto del usuario y las mejores prácticas aplicables."
        }
        
        # If we have a rule-based response for the query, prefer it
        rule_based = get_rule_based_response(query)
        # If we have a rule-based (context-aware) message, prefer it; otherwise use model-specific fallback
        fallback_response = rule_based or fallback_responses.get(agent.model, rule_based)
        
        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "model": agent.model,
            "response": fallback_response,
            "status": "degraded",  # Mark as degraded, not error
            "capabilities": agent.capabilities,
            "response_time": round(response_time, 2)
        }

async def synthesize_responses_with_ai(
    query: str,
    orchestrator_response: str,
    agents_responses: List[Dict[str, Any]]
) -> tuple[str, str]:
    """
    El orquestador analiza y valida las respuestas de los agentes usando IA
    para generar una respuesta final inteligente
    
    Returns:
        (final_response, reasoning)
    """
    logger.info("AI-powered synthesis starting...")
    logger.info(f"Agents responses count: {len(agents_responses) if agents_responses else 0}")
    
    # Si no hay respuestas de agentes, usar solo orquestador
    if not agents_responses:
        logger.info("No agent responses, using only orchestrator")
        return orchestrator_response, "Solo respuesta del orquestador (agentes no disponibles)"
    
    # Filtrar respuestas exitosas (incluyendo degradadas)
    successful_responses = [
        r for r in agents_responses 
        if (r.get("status") in ["success", "degraded"] and 
            r.get("response") and 
            not r["response"].startswith("[Error"))
    ]
    
    logger.info(f"Successful responses: {len(successful_responses)} (including {sum(1 for r in successful_responses if r.get('status') == 'degraded')} degraded)")
    
    # Si no hay respuestas exitosas de agentes
    if not successful_responses:
        logger.warning("No successful agent responses")
        
        # Even without agent responses, create a more structured synthesis
        # by analyzing the query further with the orchestrator
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
                        "options": {
                            "temperature": 0.5,
                            "num_predict": 300
                        }
                    }
                )
                if response.status_code == 200:
                    result = response.json()
                    improved_response = result.get("response", orchestrator_response)
                    logger.info(f"Orchestrator improved response: {improved_response[:100]}...")
                    return improved_response, "Respuesta mejorada por el orquestador (análisis profundo sin agentes)"
        except Exception as e:
            logger.warning(f"Could not improve response with AI: {e}")
        
        # Fallback rule-based response to keep the answer on-topic
        rule_based = get_rule_based_response(query)
        return rule_based, "Respuesta generada en modo degradado (sin agentes ni LLM)"
    
    # Construir el contexto para que el orquestador analice
    analysis_context = f"""Query del usuario: {query}

Mi análisis inicial: {orchestrator_response}

Respuestas de agentes especializados:
"""
    
    for i, agent_resp in enumerate(successful_responses, 1):
        agent_name = agent_resp.get('agent_name', 'Unknown')
        agent_model = agent_resp.get('model', 'unknown')
        agent_response = agent_resp.get('response', '')
        analysis_context += f"\n{i}. {agent_name} ({agent_model}):\n{agent_response}\n"
    
    # Prompt para el orquestador que analiza y valida
    synthesis_prompt = f"""{analysis_context}

Como orquestador, tu tarea es:
1. ANALIZAR cada respuesta de los agentes
2. VALIDAR cuál o cuáles respuestas son más relevantes y precisas
3. IDENTIFICAR contradicciones o complementos entre respuestas
4. GENERAR una respuesta final que integre lo mejor de cada agente

Proporciona una respuesta final coherente, validada y de alta calidad que responda directamente a: "{query}"

Respuesta final validada:"""
    
    try:
        # El orquestador analiza las respuestas con IA
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": synthesis_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.6,  # Más controlado para síntesis
                        "num_predict": 300
                    }
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                final_response = data.get("response", "").strip()
                
                # Reasoning detallado
                reasoning = f"""Proceso de validación del orquestador:
1. Query recibida: {query}
2. Agentes consultados: {len(successful_responses)}
3. Respuestas analizadas y validadas por el orquestador
4. Respuesta final sintetizada usando inteligencia artificial"""
                
                logger.info(f"AI synthesis complete. Final response length: {len(final_response)}")
                return final_response, reasoning
            else:
                logger.warning(f"Synthesis AI call failed: {response.status_code}")
                # Fallback a concatenación simple
                return _fallback_synthesis(query, orchestrator_response, successful_responses)
                
    except Exception as e:
        logger.error(f"Error in AI synthesis: {e}")
        # Fallback a concatenación simple
        return _fallback_synthesis(query, orchestrator_response, successful_responses)

def _fallback_synthesis(query: str, orchestrator_response: str, successful_responses: List[Dict]) -> tuple[str, str]:
    """Fallback si la síntesis IA falla"""
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
