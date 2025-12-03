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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Multi-IA Orchestrator",
    description="Sistema de orquestación de agentes IA especializados",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

class QueryRequest(BaseModel):
    query: str
    use_agents: bool = True

class QueryResponse(BaseModel):
    query: str
    orchestrator_response: str
    agents_responses: List[Dict[str, Any]]
    final_response: str
    reasoning: str
    timestamp: str
    processing_time: float

class CreateAgentRequest(BaseModel):
    name: str
    model: str
    capabilities: List[str] = []

# Ollama endpoint - usar variable de entorno o default a contenedor Docker
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# In-memory storage (temporal)
agents_db: Dict[str, Agent] = {
    "agent-001": Agent(
        id="agent-001",
        name="Code Analyzer",
        model="codellama",
        status="active",
        capabilities=["code_analysis", "quality_check", "refactoring"],
        endpoint=OLLAMA_BASE_URL
    ),
    "agent-002": Agent(
        id="agent-002",
        name="Data Analyst",
        model="mistral",
        status="active",
        capabilities=["data_analysis", "statistics", "visualization"],
        endpoint=OLLAMA_BASE_URL
    ),
    "agent-003": Agent(
        id="agent-003",
        name="Conversation Agent",
        model="llama3.2",
        status="active",
        capabilities=["conversation", "general_knowledge", "coordination"],
        endpoint=OLLAMA_BASE_URL
    )
}

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

# Get all agents
@app.get("/agents", response_model=List[Agent])
async def get_agents():
    """Get all registered agents"""
    logger.info(f"Getting {len(agents_db)} agents")
    return list(agents_db.values())

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
        endpoint=OLLAMA_BASE_URL
    )
    
    agents_db[agent_id] = new_agent
    logger.info(f"Created agent: {agent_id} - {request.name}")
    
    return new_agent

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
    
    logger.info(f"Processing query: {request.query}")
    
    try:
        # 1. Respuesta del orquestador (razonamiento propio)
        orchestrator_response = await get_orchestrator_response(request.query)
        
        # 2. Consultar agentes si está habilitado
        agents_responses = []
        if request.use_agents and len(agents_db) > 0:
            agents_responses = await query_agents(request.query)
        
        # 3. Sintetizar respuestas
        final_response, reasoning = synthesize_responses(
            request.query,
            orchestrator_response,
            agents_responses
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return QueryResponse(
            query=request.query,
            orchestrator_response=orchestrator_response,
            agents_responses=agents_responses,
            final_response=final_response,
            reasoning=reasoning,
            timestamp=datetime.now().isoformat(),
            processing_time=round(processing_time, 3)
        )
        
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_orchestrator_response(query: str) -> str:
    """
    Genera respuesta del orquestador usando su propio modelo (llama3.2)
    """
    logger.info("Getting orchestrator response...")
    
    system_prompt = """Eres un orquestador de agentes IA. Tu función es:
1. Analizar y comprender queries complejas
2. Proporcionar respuestas iniciales basadas en tu conocimiento
3. Coordinar agentes especializados cuando sea necesario
4. Sintetizar información de múltiples fuentes

Responde de manera clara, concisa y profesional."""
    
    try:
        # Timeout más largo para la primera carga del modelo
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": f"{system_prompt}\n\nUsuario: {query}\n\nOrquestador:",
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 200
                    }
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
    
    # System prompt específico por tipo de agente
    system_prompts = {
        "codellama": "Eres un experto en análisis de código. Proporciona respuestas técnicas y precisas sobre programación, arquitectura y calidad de código.",
        "mistral": "Eres un analista de datos especializado. Enfócate en análisis, estadísticas y visualización de información.",
        "llama3.2": "Eres un agente conversacional general. Proporciona respuestas útiles y contextualmente relevantes."
    }
    
    system_prompt = system_prompts.get(agent.model, "Eres un asistente especializado.")
    
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
                    "options": {
                        "temperature": 0.5 if agent.model == "codellama" else 0.7,
                        "num_predict": 150
                    }
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
        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "model": agent.model,
            "response": f"[Error: {type(e).__name__}]",
            "status": "error",
            "response_time": round(response_time, 2)
        }

def synthesize_responses(
    query: str,
    orchestrator_response: str,
    agents_responses: List[Dict[str, Any]]
) -> tuple[str, str]:
    """
    Sintetiza la respuesta del orquestador con las de los agentes
    
    Returns:
        (final_response, reasoning)
    """
    logger.info("Synthesizing responses...")
    
    # Si no hay respuestas de agentes, usar solo orquestador
    if not agents_responses:
        return orchestrator_response, "Solo respuesta del orquestador (agentes no disponibles)"
    
    # Filtrar respuestas exitosas
    successful_responses = [
        r for r in agents_responses 
        if r.get("status") == "success" and r.get("response") and not r["response"].startswith("[Error")
    ]
    
    # Si no hay respuestas exitosas de agentes
    if not successful_responses:
        return orchestrator_response, "Solo respuesta del orquestador (agentes no respondieron)"
    
    # Construir respuesta final
    reasoning_parts = []
    reasoning_parts.append(f"Análisis del orquestador: {orchestrator_response[:100]}...")
    
    # Agregar perspectivas de agentes
    for agent_resp in successful_responses:
        reasoning_parts.append(
            f"- {agent_resp['agent_name']}: {agent_resp['response'][:80]}..."
        )
    
    reasoning = "\n".join(reasoning_parts)
    
    # Respuesta final sintetizada
    final_response = f"""**Respuesta del Orquestador:**
{orchestrator_response}

**Perspectivas de Agentes Especializados:**
"""
    
    for agent_resp in successful_responses:
        final_response += f"\n• **{agent_resp['agent_name']}** ({agent_resp['model']}): {agent_resp['response']}\n"
    
    final_response += f"\n**Síntesis:** Se consultaron {len(successful_responses)} agentes especializados. "
    
    if len(successful_responses) > 1:
        final_response += "Las respuestas convergen en proporcionar una perspectiva integral de tu consulta."
    else:
        final_response += "La respuesta del agente complementa el análisis del orquestador."
    
    return final_response, reasoning

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
