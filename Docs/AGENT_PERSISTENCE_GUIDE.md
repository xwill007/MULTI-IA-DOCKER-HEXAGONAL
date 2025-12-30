# Guía de Persistencia de Agentes

## Resumen Rápido

Los agentes en el sistema se **persisten automáticamente en `registry.json`** cuando se crean, actualizan o se importan desde el frontend. El flujo es:

```
User Action → Backend Endpoint → agents_db (Memory) → save_agents() → registry.json
```

## Flujo de Creación de Agentes

### 1. Frontend: Usuario hace clic en "CREAR AGENTE"
- Se abre el panel `agent-creator-panel` en A-Frame
- Usuario ingresa nombre, modelo, capacidades, opciones de internet access
- Envía `POST /agents` con `CreateAgentRequest`

### 2. Backend: Recepción en POST /agents
- **Archivo**: `Api/orchestrator/modules/agents/router.py:35`
- Llama a `create_agent(request)` del servicio

### 3. Backend: Servicio crea y persiste
- **Archivo**: `Api/orchestrator/modules/agents/service.py:121-135`
- Generar ID: `agent-{len(agents_db) + 1:03d}`
- Crear objeto `Agent` con valores del request
- Agregar a `agents_db` (dict en memoria)
- Llamar `save_agents()` → **escribe a `registry.json`**
- Log: `"Agent created: {agent_id}"`
- Retornar nuevo agente al frontend

### 4. Frontend: Recibe respuesta
- Actualiza lista local de agentes
- Dispara evento `agents-updated`
- Llama a `stateManager.loadAgents()` automáticamente (escucha en `app.js`)
- Redibuja visualización de agentes en A-Frame

## Archivos de Persistencia

### registry.json
- **Ubicación**: `/data/agents/registry.json`
- **Contenido**: JSON con estructura `{agent_id: agent_object, ...}`
- **Actualización**: Automática cada vez que se llama `save_agents()`
- **Ejemplo**:
```json
{
  "agent-001": {
    "id": "agent-001",
    "name": "Code Analyzer",
    "model": "codellama",
    "status": "active",
    "capabilities": ["code_analysis", "quality_check"],
    "endpoint": "http://ollama:11434",
    "config": {...},
    "internet_access": false,
    "allowed_domains": ["localhost", "127.0.0.1"],
    "target_urls": [],
    "search_terms": []
  },
  "agent-prueba": {
    "id": "agent-prueba",
    "name": "prueba",
    ...
  }
}
```

## Endpoints de Sincronización

### POST /agents
**Crea un nuevo agente y lo persiste**
- Request: `CreateAgentRequest` (name, model, capabilities, internet_access, etc.)
- Response: Agent object
- Efecto: 
  - Agrega a `agents_db`
  - Guarda en `registry.json`
  - Dispara evento `agents-updated` en frontend

### POST /agents/bulk-update
**Importa múltiples agentes desde JSON**
- Request: `{"agents": {agent_id: agent_data, ...}}`
- Response: Número de agentes actualizados + errores
- Efecto:
  - Actualiza cada agente existente con nuevos datos
  - Guarda cambios en `registry.json`
  - Usado por frontend al importar archivo JSON

### POST /agents/reload
**Recarga todos los agentes desde registry.json (descarta cambios en memoria)**
- Request: ninguno
- Response: Cuenta anterior/posterior, lista de agent IDs
- Efecto:
  - Lee `registry.json`
  - Reemplaza completamente `agents_db`
  - Útil si hay desincronización

### POST /agents/sync
**Verifica estado de sincronización (nuevo)**
- Request: ninguno
- Response: 
  ```json
  {
    "success": true,
    "synced": true,
    "agents_in_memory": 5,
    "agents_in_file": 5,
    "agent_ids": ["agent-001", "agent-002", ...],
    "memory_only": [],
    "file_only": []
  }
  ```
- Efecto: NO modifica nada, solo reporta
- Llamado por botón "SYNC STATUS" en VR

### GET /agents/verify/{agent_id}
**Verifica persistencia de agente específico**
- Response:
  ```json
  {
    "agent_id": "agent-prueba",
    "in_memory": true,
    "in_file": true,
    "synced": true,
    "file_path": "/data/agents/registry.json",
    "agent": { ... }
  }
  ```

## Botones en VR Dashboard

### REFRESH AGENTS (Púrpura)
- Llama a `stateManager.loadAgents()`
- Consulta `GET /agents` al backend
- Redibuja esferas de agentes
- **Hotkey**: R

### SYNC STATUS (Azul)
- Llama a `POST /agents/sync`
- Muestra: "✓ Synced: 5 agents" o "⚠ Mismatch: Mem=5 File=4"
- Verde si está sincronizado, naranja si hay desajuste

### CREAR AGENTE (Naranja)
- Abre diálogo para crear agente
- Envía `POST /agents`
- Dispara refresh automático

## Flujos Comunes

### Crear un agente y que persista
1. Click "CREAR AGENTE" → ingresa datos
2. Backend: `POST /agents` → `create_agent()` → `save_agents()` → `registry.json`
3. Frontend: evento `agents-updated` → redibuja
4. Verificar: Botón "SYNC STATUS" → debe mostrar "✓ Synced"

### Importar agentes desde JSON
1. Botón "IMPORT AGENTS" en agents-manager.js
2. Selecciona archivo JSON con estructura `{agents: {agent_id: {...}, ...}}`
3. Backend: `POST /agents/bulk-update` → actualiza cada agente → `save_agents()`
4. Frontend: evento `agents-updated` → redibuja

### Verificar si un agente persiste tras reinicio
1. Ver en `registry.json` manualmente:
   ```powershell
   Get-Content data/agents/registry.json | ConvertFrom-Json
   ```
2. O llamar a `GET /agents/verify/agent-prueba` → debe tener `"synced": true`

## Debugging

### Problema: Agente visible en VR pero "SYNC STATUS" muestra desajuste
**Solución**:
1. Click "REFRESH AGENTS" para recargar desde server
2. Click "SYNC STATUS" para verificar estado
3. Si sigue desajustado, llamar `POST /agents/reload` para sincronizar desde archivo

### Problema: Agente no persiste tras crear
**Verificación**:
1. Check logs del backend: debe mostrar `"Agent created: agent-XXX"`
2. Verificar `registry.json` manualmente (debe contener agent-XXX)
3. Llamar `GET /agents/verify/agent-XXX` → si `"synced": false`, hay problema

### Problema: registry.json corrompido
**Solución**:
1. Borrar `/data/agents/registry.json`
2. Reiniciar backend
3. Sistema restaurará agentes por defecto

## Código Relevante

| Componente | Archivo | Función |
|-----------|---------|---------|
| Crear agente | `service.py:121-135` | `create_agent(request)` |
| Guardar a archivo | `service.py:110-117` | `save_agents()` |
| Cargar desde archivo | `service.py:81-104` | `load_agents()` |
| Endpoint POST /agents | `router.py:35-37` | `create_agent_endpoint()` |
| Endpoint POST /agents/sync | `router.py:189-226` | `sync_agents_status()` |
| Botón SYNC STATUS | `query-panel.js:38-42` | `checkSyncStatus()` |
| Evento agents-updated | `app.js` | Listener registrado en `init()` |

## Variables de Entorno

- `DATA_DIR`: Donde se guarda `registry.json` (defecto: `/data/agents` o `data/agents`)
- `AGENTS_FILE`: Ruta completa a `registry.json` (generada automáticamente)

## Notas Importantes

1. **No hay BD Postgres para agentes**: Los agentes usan `registry.json` (archivo JSON), no tablas de base de datos
2. **Sincronización automática**: `save_agents()` se llama en: `create_agent()`, `update_agent()`, `toggle_agent_status()`, `bulk_update_agents()`
3. **Pérdida de datos**: Si `/data/agents/registry.json` se borra, se pierden agentes personalizados (se restauran solo los 3 por defecto)
4. **Carga al iniciar**: `load_agents()` se ejecuta cuando el backend inicia, restaurando agentes desde el archivo
