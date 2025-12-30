# Agent Persistence - Cheat Sheet

## Endpoints Rápidos

### Crear agente
```bash
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Mi Agente",
    "model":"mistral",
    "capabilities":["testing"],
    "internet_access":false
  }'
```
**Respuesta**: Agent object con ID generado
**Archivo**: Guardado automáticamente en `/data/agents/registry.json`

---

### Listar agentes
```bash
curl http://localhost:8000/agents
```
**Respuesta**: Array de Agent objects

---

### Verificar sincronización
```bash
curl -X POST http://localhost:8000/agents/sync
```
**Respuesta**: 
```json
{
  "success": true,
  "synced": true,
  "agents_in_memory": 5,
  "agents_in_file": 5
}
```
- `"synced": true` = OK ✅
- `"synced": false` = Desajuste ⚠️

---

### Recargar desde archivo
```bash
curl -X POST http://localhost:8000/agents/reload
```
**Efecto**: Descarta memoria, lee registry.json (recovery)

---

### Verificar agente específico
```bash
curl http://localhost:8000/agents/verify/{agent_id}
```
**Respuesta**: 
```json
{
  "in_memory": true,
  "in_file": true,
  "synced": true
}
```

---

### Actualizar agente
```bash
curl -X PATCH http://localhost:8000/agents/{agent_id} \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Nuevo Nombre",
    "capabilities":["new_cap"]
  }'
```

---

### Importar múltiples agentes
```bash
curl -X POST http://localhost:8000/agents/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "agents": {
      "agent-001": {"name":"Updated Name", ...},
      "agent-002": {...}
    }
  }'
```

---

### Exportar todos los agentes
```bash
curl http://localhost:8000/agents/export > agentes_backup.json
```

---

## VR Buttons

| Botón | Color | Hotkey | Acción |
|-------|-------|--------|--------|
| REFRESH AGENTS | Púrpura | R | Recarga GET /agents y redibuja |
| SYNC STATUS | Azul | - | POST /agents/sync y muestra estado |
| CREAR AGENTE | Naranja | - | Abre dialog para crear (POST /agents) |

---

## Verificación Manual

### Ver registry.json
```bash
# Linux/Mac
cat data/agents/registry.json | jq

# Windows PowerShell
Get-Content data/agents/registry.json | ConvertFrom-Json
```

### Leer un agente específico
```bash
cat data/agents/registry.json | jq '.["agent-001"]'
```

### Contar agentes
```bash
cat data/agents/registry.json | jq 'keys | length'
```

---

## Flujo Típico de Uso

### 1. Crear agente nueva
```
VR: Click "CREAR AGENTE" → ingresa datos → Click "CREAR"
  ↓
Backend: POST /agents → crea → guarda registry.json
  ↓
Frontend: redibuja esfera → visible en VR
  ↓
Verificar: Click "SYNC STATUS" → muestra "✓ Synced"
```

### 2. Importar agentes desde archivo
```
VR: agents-manager → Click "IMPORT AGENTS" → selecciona JSON
  ↓
Backend: POST /agents/bulk-update → actualiza → guarda
  ↓
Frontend: evento agents-updated → redibuja todas
```

### 3. Recuperar de desincronización
```
VR: Click "SYNC STATUS" → muestra "⚠ Mismatch"
  ↓
Usuario: Click "REFRESH AGENTS" o "RELOAD"
  ↓
Backend: GET /agents o POST /agents/reload
  ↓
Frontend: redibuja desde server → sincronizado
```

---

## Problemas Comunes

| Problema | Síntoma | Solución |
|----------|---------|----------|
| Agente no persiste | POST /agents OK, pero GET /agents no lo muestra | Check registry.json manualmente, ejecutar POST /sync |
| Mismatch | SYNC STATUS muestra "⚠ Mismatch" | Click REFRESH AGENTS o POST /agents/reload |
| Esfera no aparece | Agente existe en backend pero no en VR | Click REFRESH AGENTS (R) |
| registry.json corrompido | GET /agents falla con JSON error | Borrar archivo, reiniciar (restaurará defaults) |
| Backend no responde | Todos los endpoints timing out | Check `docker compose ps`, reinicia orchestrator |

---

## Estado esperado

```
✅ POST /agents → 200
✅ GET /agents → lista contiene nuevo agente
✅ registry.json → contiene agente con mismo ID
✅ POST /agents/sync → synced=true
✅ POST /agents/reload → agents_after correct
✅ VR → esfera visible y clickeable
```

---

## Debugging Rápido

```bash
# 1. Backend corriendo?
curl http://localhost:8000/health

# 2. Agentes cargados?
curl http://localhost:8000/agents | jq 'length'

# 3. Sincronizado?
curl -X POST http://localhost:8000/agents/sync | jq '.synced'

# 4. Archivo existe?
ls -la data/agents/registry.json

# 5. Frontend conecta?
# Check browser console: Network tab → /agents requests
```

---

## Variables de Entorno Relevantes

```bash
DATA_DIR=/data/agents              # Donde está registry.json
AGENTS_FILE=/data/agents/registry.json
OLLAMA_BASE_URL=http://ollama:11434
DOMAINS_WHITELIST=localhost,127.0.0.1
```

---

## Estructura JSON de Agente

```json
{
  "agent-001": {
    "id": "agent-001",
    "name": "Mi Agente",
    "model": "mistral",
    "status": "active",
    "capabilities": ["data_analysis", "testing"],
    "endpoint": "http://ollama:11434",
    "config": {
      "prompt": "...",
      "options": {"temperature": 0.7, "num_predict": 150}
    },
    "internet_access": false,
    "allowed_domains": ["localhost", "127.0.0.1"],
    "target_urls": [],
    "search_terms": []
  }
}
```

---

## Logs Relevantes

```bash
# Backend (Docker)
docker compose logs orchestrator | grep "Agent created\|save_agents\|sync_agents"

# Frontend (Browser Console)
console.log(localStorage.getItem('api_debug_logs'))
```

---

## Casos de Uso Rápidos

### "Quiero crear un agente permanente"
1. POST /agents con datos
2. Verificar POST /agents/sync → synced=true
3. Listo! Persiste en registry.json

### "Quiero exportar todos los agentes para backup"
1. GET /agents/export
2. Guardar JSON a archivo
3. Usar POST /agents/bulk-update para restaurar

### "Mi agente desapareció de VR pero existe en API"
1. POST /agents/sync (verifica estado)
2. Si synced=true → backend tiene el agente, frontend no lo renderizó
3. Solución: Click REFRESH AGENTS en VR

### "Necesito sincronizar agentes entre instancias"
1. Exportar desde instancia 1: GET /agents/export
2. Importar en instancia 2: POST /agents/bulk-update
3. Ambas instancias ahora tienen los mismos agentes

---

## Referencia de Códigos HTTP

| Código | Significado |
|--------|-------------|
| 200 | ✅ OK - Operación exitosa |
| 201 | ✅ CREATED - Nuevo recurso creado |
| 400 | ❌ BAD REQUEST - Datos inválidos |
| 404 | ❌ NOT FOUND - Agente/endpoint no existe |
| 422 | ❌ VALIDATION ERROR - Datos no validan |
| 500 | ❌ SERVER ERROR - Error interno |

---

## Testing Rápido con Script

```powershell
.\Scripts\test-agent-persistence.ps1 -ApiBase http://localhost:8000
```

Corre todas las verificaciones básicas:
1. CREATE → POST /agents
2. FILE → registry.json
3. LIST → GET /agents
4. SYNC → POST /agents/sync
5. VERIFY → GET /agents/verify/{id}

---

## Documentación Completa

- **AGENT_PERSISTENCE_GUIDE.md** - Guía detallada
- **FLOWCHART_AGENT_PERSISTENCE.md** - Diagramas ASCII
- **TEST_CASES_PERSISTENCE.md** - Test suite completa
- **CHANGELOG_AGENT_PERSISTENCE.md** - Cambios realizados
