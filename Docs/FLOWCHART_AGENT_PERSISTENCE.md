# Diagrama de Flujo - Persistencia de Agentes

## 1. Creación de Agente

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER IN VR                                      │
│                                                                     │
│  ┌──────────────────────────────┐                                  │
│  │   Click "CREAR AGENTE"       │                                  │
│  │   (Orange Button, y=0.8)     │                                  │
│  └──────────┬───────────────────┘                                  │
│             │                                                       │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 FRONTEND (VR/A-Frame)                               │
│                                                                     │
│  agent-creator-panel.js opens dialog:                              │
│  - Input: name (text)                                              │
│  - Input: model (select: codellama/mistral/llama3.2)              │
│  - Input: capabilities (multi-select)                              │
│  - Input: internet_access (checkbox)                               │
│  - Button: "CREAR"                                                 │
│                                                                     │
│  CreateAgentRequest = {                                            │
│    name: "My Agent",                                               │
│    model: "mistral",                                               │
│    capabilities: ["data_analysis"],                                │
│    internet_access: false                                          │
│  }                                                                  │
│                                                                     │
│  ┌──────────────────────────────┐                                  │
│  │  fetch('POST /agents',       │                                  │
│  │         CreateAgentRequest)  │                                  │
│  └──────────┬───────────────────┘                                  │
│             │                                                       │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 API LAYER (FastAPI)                                 │
│                                                                     │
│  POST /agents                                                      │
│  ├─ router.py:35 create_agent_endpoint()                          │
│  └─ Calls: create_agent(request)                                  │
│                                                                     │
└──────────────┬────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BUSINESS LOGIC (service.py)                             │
│                                                                     │
│  create_agent(request):                                            │
│  ├─ agent_id = "agent-{len(agents_db)+1:03d}"                    │
│  │  (Example: if 4 agents exist → "agent-005")                    │
│  │                                                                 │
│  ├─ new_agent = Agent(                                            │
│  │   id=agent_id,                                                 │
│  │   name=request.name,                                           │
│  │   model=request.model,                                         │
│  │   status="active",                                             │
│  │   capabilities=request.capabilities,                           │
│  │   ...                                                          │
│  │ )                                                              │
│  │                                                                 │
│  ├─ agents_db[agent_id] = new_agent  ◄─── MEMORY                  │
│  │  (In-memory dict now contains new agent)                      │
│  │                                                                 │
│  ├─ save_agents()  ◄─────────────────────────────────────┐       │
│  │                                                        │       │
│  │  └─ data = {agent_id: agent.dict() for ...}          │       │
│  │  └─ json.dump(data) → /data/agents/registry.json  ◄── FILE   │
│  │                       (Persistent storage)            │       │
│  │                                                        │       │
│  └─ logger.info("Agent created: " + agent_id)            │       │
│  └─ return new_agent  ◄─────────────────────────────────┘       │
│                                                                     │
│  Result:                                                            │
│  ✓ agents_db has new agent in memory                              │
│  ✓ registry.json file updated on disk                             │
│                                                                     │
└──────────────┬────────────────────────────────────────────────────────┘
               │
               ▼ {agent_id, name, model, status, ...}
┌─────────────────────────────────────────────────────────────────────┐
│                 FRONTEND (VR/A-Frame)                               │
│                                                                     │
│  Response received:                                                │
│  ├─ Close agent-creator-panel                                     │
│  ├─ stateManager.loadAgents()  ◄─ AUTO (events listener)          │
│  │                                                                 │
│  │  GET /agents                                                   │
│  │  ├─ Fetch updated list from backend                           │
│  │  ├─ Store in local state                                      │
│  │  └─ Return all agents                                         │
│  │                                                                 │
│  ├─ updateAgentsVisualization()                                   │
│  │  ├─ Clear existing agent spheres                              │
│  │  └─ Create new spheres for ALL agents                         │
│  │     (including the newly created one)                         │
│  │                                                                 │
│  └─ Display: "Agent created successfully" (green message)         │
│                                                                     │
│  User now sees:                                                     │
│  ┌─ New sphere in orbit with agent name/status                    │
│  └─ Agent visible in the VR scene                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Verificación de Sincronización

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER IN VR                                      │
│                                                                     │
│  ┌──────────────────────────────┐                                  │
│  │   Click "SYNC STATUS"        │                                  │
│  │   (Blue Button, y=1.0)       │                                  │
│  └──────────┬───────────────────┘                                  │
│             │                                                       │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 FRONTEND (VR/A-Frame)                               │
│                                                                     │
│  query-panel.js checkSyncStatus():                                 │
│  │                                                                 │
│  │  ┌──────────────────────────────┐                              │
│  │  │ fetch('POST /agents/sync')   │                              │
│  │  └──────────┬───────────────────┘                              │
│  │             │                                                   │
│  │             ▼                                                   │
│  │  updateStatus("Checking sync...", blue)                        │
│  │  (Show loading message)                                         │
│  │                                                                 │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 API LAYER (FastAPI)                                 │
│                                                                     │
│  POST /agents/sync                                                 │
│  └─ router.py:187 sync_agents_status()                            │
│                                                                     │
│    1. agents = service_list_agents()                               │
│       └─ Get all agents from agents_db                            │
│                                                                     │
│    2. Read registry.json file:                                     │
│       data = json.load(AGENTS_FILE)                                │
│       file_ids = data.keys()                                       │
│                                                                     │
│    3. Compare:                                                      │
│       memory_ids = {a.id for a in agents}                         │
│       memory_only = memory_ids - file_ids                         │
│       file_only = file_ids - memory_ids                           │
│       synced = (memory_ids == file_ids)                           │
│                                                                     │
│    4. Return JSON:                                                  │
│       {                                                             │
│         "success": true,                                           │
│         "synced": true or false,                                   │
│         "agents_in_memory": 5,                                     │
│         "agents_in_file": 5,                                       │
│         "synced": true,                                            │
│         "agent_ids": ["agent-001", ...],                          │
│         "memory_only": [],                                         │
│         "file_only": []                                            │
│       }                                                             │
│                                                                     │
└──────────────┬────────────────────────────────────────────────────────┘
               │
               ▼ {success, synced, agents_in_memory, agents_in_file, ...}
┌─────────────────────────────────────────────────────────────────────┐
│                 FRONTEND (VR/A-Frame)                               │
│                                                                     │
│  query-panel.js handles response:                                  │
│                                                                     │
│  if (data.synced) {                                                │
│    msg = "✓ Synced: 5 agents"                                      │
│    color = GREEN (#4CAF50)                                         │
│  } else {                                                           │
│    msg = "⚠ Mismatch: Mem=5 File=4"                               │
│    color = ORANGE (#FF9800)                                        │
│  }                                                                  │
│                                                                     │
│  updateStatus(msg, color)                                          │
│  setTimeout(clear, 3000 ms)  ◄─ Auto-clear after 3 seconds       │
│                                                                     │
│  User sees:                                                         │
│  ┌─ Green "✓ Synced: 5 agents" → Everything OK                    │
│  └─ Orange "⚠ Mismatch" → Need to fix (click REFRESH AGENTS)     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Recarga desde Archivo (Recovery)

```
If user sees: "⚠ Mismatch: Mem=5 File=4"

┌──────────────────────────────────────────────────────────────────┐
│  User Action 1: REFRESH AGENTS (Purple)                          │
│  └─ GET /agents from backend                                     │
│  └─ Redraw agent spheres from fresh backend state                │
│                                                                  │
│  OR                                                              │
│                                                                  │
│  User Action 2: Click RELOAD in agents-manager.js panel          │
│  └─ POST /agents/reload                                          │
│  └─ Discard memory, read registry.json completely               │
│  └─ Safe recovery from any desync                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 4. File Structure

```
/data/agents/
├── registry.json              ◄─── Persistent agent storage
│   {
│     "agent-001": {
│       "id": "agent-001",
│       "name": "Code Analyzer",
│       "model": "codellama",
│       "status": "active",
│       "capabilities": ["code_analysis"],
│       "internet_access": false,
│       "allowed_domains": ["localhost"],
│       "endpoint": "http://ollama:11434",
│       "config": { ... },
│       "target_urls": [],
│       "search_terms": []
│     },
│     "agent-002": { ... },
│     ...
│     "agent-prueba": { ... }  ◄─── New agent after creation
│   }
└── (other files)
```

## 5. State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY (agents_db)               │  FILE (registry.json)      │
├───────────────────────────────────┼────────────────────────────┤
│                                   │                            │
│  Create agent:                    │                            │
│  agents_db[id] = agent  ────────────────→ save_agents()        │
│                                   │         json.dump()        │
│                                   │                            │
│  Update agent:                    │                            │
│  agents_db[id].field = val  ─────────────→ save_agents()       │
│                                   │         json.dump()        │
│                                   │                            │
│  Toggle agent status:             │                            │
│  agents_db[id].status = new  ────────────→ save_agents()       │
│                                   │         json.dump()        │
│                                   │                            │
│  Reload (Emergency):              │                            │
│  Clear agents_db ◄─────────────── load_agents()               │
│  Load from file                   │ json.load()               │
│                                   │                            │
│  Import agents:                   │                            │
│  Update each agent ─────────────────→ save_agents()            │
│                                   │     json.dump()            │
│                                   │                            │
│  Startup (always):                │                            │
│  ∅ ◄───────────────────────────── load_agents()               │
│  (agents_db replaced from file)   │ json.load()               │
│                                   │                            │
└─────────────────────────────────────────────────────────────────┘
```

## Key Points

| Operación | Guarda a Archivo | Automático | Afecta BD |
|-----------|------------------|-----------|----------|
| POST /agents | ✅ save_agents() | ✅ | ❌ (no hay tabla) |
| PATCH /agents/{id} | ✅ save_agents() | ✅ | ❌ |
| DELETE /agents/{id} | ✅ save_agents() | ✅ | ❌ |
| POST /agents/bulk-update | ✅ save_agents() | ✅ | ❌ |
| POST /agents/reload | N/A (read-only) | ✅ | ❌ |
| POST /agents/sync | N/A (check only) | ❌ | ❌ |
| GET /agents | N/A (read-only) | ❌ | ❌ |

## Debugging Checklist

- [ ] Backend is running (`docker compose ps`)
- [ ] `/data/agents/registry.json` exists
- [ ] Can read registry.json: `cat data/agents/registry.json | jq`
- [ ] POST /agents returns 200 with agent object
- [ ] Agent ID in response matches registry.json key
- [ ] POST /agents/sync returns `"synced": true`
- [ ] Frontend shows green "✓ Synced" message
- [ ] Agent sphere visible in VR scene
- [ ] Restart backend → agent still visible (persistence check)
