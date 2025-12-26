# Arquitectura Modular Nest-like - FastAPI Orchestrator

## Resumen de Cambios (Paso 1 y 2)

### Nueva Estructura de Carpetas

```
Api/orchestrator/
├── main.py                          # Bootstrap minimalista, registra routers
├── modules/                         # Módulos al estilo Nest.js
│   ├── agents/                      # Módulo de agentes
│   │   ├── __init__.py
│   │   ├── schemas.py               # Pydantic models (Agent, CreateAgentRequest)
│   │   ├── service.py               # Lógica de negocio (CRUD, load/save JSON)
│   │   └── router.py                # Endpoints FastAPI (/agents/*)
│   └── orchestrator_config/         # Módulo de configuración del orquestador
│       ├── __init__.py
│       ├── service.py               # Lógica de config (load/save/update)
│       └── router.py                # Endpoints FastAPI (/orchestrator/config)
├── (otros archivos sin cambios)
```

### Responsabilidades por Archivo

#### **main.py** (minimalista)
- Crea app FastAPI, configura CORS
- Inicializa storage (`get_storage()`)
- Llama a `load_orchestrator_config()` y `load_agents()` al inicio
- Registra routers modulares: `app.include_router(agents_router)`, `app.include_router(orchestrator_router)`
- Define endpoints NO modulares aún: `/health`, `/test`, `/conversations`, `/query`
- Contiene funciones auxiliares para `/query`: `get_orchestrator_response()`, `query_agents()`, `query_single_agent()`, `synthesize_responses_with_ai()`, `_fallback_synthesis()`, `get_rule_based_response()`

#### **modules/agents/schemas.py**
- `Agent`: Pydantic model con campos `id`, `name`, `model`, `status`, `capabilities`, `endpoint`, `config`
- `CreateAgentRequest`: Pydantic model para crear agentes

#### **modules/agents/service.py**
- Gestiona `agents_db: Dict[str, Agent]` (estado en memoria)
- Funciones:
  - `load_agents()`: carga desde `data/agents/registry.json`
  - `save_agents()`: persiste a JSON
  - `create_agent(request)`: agrega un agente nuevo, persiste
  - `update_agent(agent_id, payload)`: actualiza campos, persiste
  - `toggle_agent_status(agent_id)`: alterna activo/inactivo, persiste
  - `get_agent(agent_id)`: obtiene un agente (lanza KeyError si no existe)
  - `_default_agent_config(model)`: genera config por defecto según modelo

#### **modules/agents/router.py**
- Router con `prefix="/agents"`, `tags=["agents"]`
- Endpoints:
  - `GET /agents` → lista todos
  - `GET /agents/{agent_id}` → detalle de un agente
  - `POST /agents` → crear agente
  - `PATCH /agents/{agent_id}` → actualizar agente
  - `DELETE /agents/{agent_id}` → toggle status (soft delete)
- Convierte `KeyError` del service en `HTTPException(404)`

#### **modules/orchestrator_config/service.py**
- Gestiona `orchestrator_config: Dict[str, Any]` (estado en memoria)
- Funciones:
  - `load_orchestrator_config()`: carga desde `data/agents/orchestrator_config.json`
  - `save_orchestrator_config()`: persiste a JSON
  - `update_orchestrator_config(payload)`: actualiza campos, persiste

#### **modules/orchestrator_config/router.py**
- Router con `prefix="/orchestrator"`, `tags=["orchestrator"]`
- Endpoints:
  - `GET /orchestrator/config` → obtiene config actual
  - `PATCH /orchestrator/config` → actualiza config

### Ventajas de la Nueva Arquitectura

1. **Separación de responsabilidades**: routers delgados, lógica en services, modelos en schemas
2. **Mantenibilidad**: cada módulo es autocontenido, fácil de testear y extender
3. **Escalabilidad**: agregar nuevos módulos (ej. `conversations`, `query`) sin tocar el main
4. **Estilo Nest-like**: módulos con router/service/schemas, inyección manual (sin decoradores pesados)
5. **Inyección de dependencias simple**: services exponen funciones puras, routers importan directamente

### Pendiente (Pasos 3-5)

- **Paso 3**: Crear módulo `conversations` (con router y service, mueve endpoints `/conversations` desde main)
- **Paso 4**: Crear módulo `query` (mueve `/query` y funciones auxiliares a un service especializado)
- **Paso 5**: Limpiar `main.py`, remover `sys.path` hack moviendo `conversation_storage.py` a `Api/orchestrator/core/storage.py` o importable directamente

### Compatibilidad

- Todos los endpoints mantienen las mismas rutas y contratos (sin breaking changes)
- El frontend VR y clientes existentes funcionan sin modificaciones
- La lógica de negocio es idéntica, solo reorganizada

### Testing

```bash
# Backend dev (con auto-reload)
./Scripts/start-orchestrator-dev.ps1

# Probar endpoints modulares:
curl http://localhost:8000/agents
curl http://localhost:8000/orchestrator/config
curl -X POST http://localhost:8000/query -H "Content-Type: application/json" -d '{"query": "hola"}'
```

---

**Nota**: Los módulos `agents` y `orchestrator_config` están completos y funcionando. El flujo `/query` sigue en `main.py` (lo migraremos en Paso 4).
