# Test Cases - Agent Persistence

## Requisitos Previos

- Backend corriendo en `http://localhost:8000`
- Frontend corriendo en `http://localhost:3000`
- `/data/agents/registry.json` accessible
- curl o Postman instalado

## Test Suite 1: Persistencia Básica

### TC1.1: Crear agente y verificar en memoria
**Objetivo**: Verificar que POST /agents crea agente en agents_db

**Pasos**:
1. Enviar: `POST http://localhost:8000/agents`
   ```json
   {
     "name": "Test Agent 1",
     "model": "mistral",
     "capabilities": ["testing"],
     "internet_access": false
   }
   ```
2. Esperar respuesta 200 con agent object

**Validación**:
- [ ] status_code == 200
- [ ] response.id existe (ej: "agent-XXX")
- [ ] response.name == "Test Agent 1"
- [ ] response.status == "active"

**Esperado**: ✅ PASS

---

### TC1.2: Verificar agente en archivo
**Objetivo**: Verificar que save_agents() escribió a registry.json

**Pasos**:
1. Leer: `cat data/agents/registry.json`
2. Buscar agente por ID (del TC1.1)

**Validación**:
- [ ] registry.json es válido JSON
- [ ] Contiene clave con agent_id
- [ ] agent_id["name"] == "Test Agent 1"
- [ ] agent_id["status"] == "active"

**Esperado**: ✅ PASS

---

### TC1.3: Listar agentes y verificar nuevo agente
**Objetivo**: Verificar que GET /agents retorna el nuevo agente

**Pasos**:
1. Enviar: `GET http://localhost:8000/agents`
2. Buscar agente en lista

**Validación**:
- [ ] status_code == 200
- [ ] response es array
- [ ] Algún elemento tiene id == agent_id_de_TC1.1

**Esperado**: ✅ PASS

---

## Test Suite 2: Sincronización

### TC2.1: Verificar sincronización después de crear
**Objetivo**: POST /agents/sync debe retornar synced=true

**Pasos**:
1. Crear agente (TC1.1)
2. Enviar: `POST http://localhost:8000/agents/sync`
3. Inspeccionar respuesta

**Validación**:
- [ ] status_code == 200
- [ ] response.success == true
- [ ] response.synced == true
- [ ] response.agents_in_memory > 0
- [ ] response.agents_in_memory == response.agents_in_file
- [ ] response.memory_only == []
- [ ] response.file_only == []

**Esperado**: ✅ PASS

---

### TC2.2: Verificar persistencia individual
**Objetivo**: GET /agents/verify/{id} debe confirmar sincronización

**Pasos**:
1. Usar agent_id de TC1.1
2. Enviar: `GET http://localhost:8000/agents/verify/{agent_id}`

**Validación**:
- [ ] status_code == 200
- [ ] response.in_memory == true
- [ ] response.in_file == true
- [ ] response.synced == true

**Esperado**: ✅ PASS

---

## Test Suite 3: Operaciones de Actualización

### TC3.1: Actualizar agente y verificar persistencia
**Objetivo**: PATCH /agents debe guardar cambios en archivo

**Pasos**:
1. Usar agent_id de TC1.1
2. Enviar: `PATCH http://localhost:8000/agents/{agent_id}`
   ```json
   {
     "name": "Updated Test Agent 1",
     "capabilities": ["testing", "validation"]
   }
   ```
3. Verificar respuesta
4. Leer registry.json

**Validación**:
- [ ] status_code == 200
- [ ] response.name == "Updated Test Agent 1"
- [ ] registry.json contiene nuevo name

**Esperado**: ✅ PASS

---

### TC3.2: Importar agentes en bulk
**Objetivo**: POST /agents/bulk-update debe actualizar múltiples agentes

**Pasos**:
1. Preparar JSON export actual:
   ```bash
   curl -s http://localhost:8000/agents/export | jq '.agents'
   ```
2. Modificar un agente en el JSON (cambiar nombre)
3. Enviar: `POST http://localhost:8000/agents/bulk-update`
   ```json
   {
     "agents": {
       "agent-001": {
         "name": "New Code Analyzer",
         ...
       }
     }
   }
   ```
4. Verificar respuesta

**Validación**:
- [ ] status_code == 200
- [ ] response.updated_count > 0
- [ ] response.errors == []
- [ ] POST /agents/sync retorna synced=true

**Esperado**: ✅ PASS

---

## Test Suite 4: Recuperación de Errores

### TC4.1: Desincronización forzada (simulación)
**Objetivo**: POST /agents/sync debe detectar mismatch

**Pasos**:
1. Crear agente vía API (TC1.1)
2. Eliminar agente manualmente de registry.json (ej: en VS Code)
3. Enviar: `POST http://localhost:8000/agents/sync`

**Validación**:
- [ ] response.synced == false
- [ ] response.agents_in_memory > response.agents_in_file
- [ ] response.memory_only contiene agent_id eliminado

**Esperado**: ✅ PASS (ALERT)

---

### TC4.2: Recuperación con RELOAD
**Objetivo**: POST /agents/reload debe sincronizar desde archivo

**Pasos**:
1. Ejecutar TC4.1 (forzar desincronización)
2. Enviar: `POST http://localhost:8000/agents/reload`
3. Enviar: `POST http://localhost:8000/agents/sync`

**Validación**:
- [ ] POST /reload status_code == 200
- [ ] POST /reload response.agents_after < response.agents_before (agente eliminado)
- [ ] POST /sync retorna synced=true (recuperado)

**Esperado**: ✅ PASS

---

## Test Suite 5: Frontend VR Integration

### TC5.1: Crear agente desde VR
**Objetivo**: Click "CREAR AGENTE" → agente persiste

**Pasos**:
1. Abrir Frontend en http://localhost:3000
2. Click "CREAR AGENTE" (Orange button, y=0.8)
3. Ingresar: name="VR Test Agent", model="codellama"
4. Click "CREAR"
5. Verificar que aparece esfera en VR

**Validación**:
- [ ] Dialog se cierra
- [ ] Nueva esfera visible en VR
- [ ] Console muestra "Agent created"
- [ ] Leer registry.json → contiene nuevo agente

**Esperado**: ✅ PASS

---

### TC5.2: Verificar sincronización desde VR
**Objetivo**: Click "SYNC STATUS" → muestra estado

**Pasos**:
1. Frontend abierto
2. Click "SYNC STATUS" (Blue button, y=1.0)
3. Observar mensaje de estado

**Validación**:
- [ ] Mensaje aparece (1-3 segundos)
- [ ] Si synced: "✓ Synced: N agents" (verde)
- [ ] Si no: "⚠ Mismatch: Mem=X File=Y" (naranja)
- [ ] Color correcto según estado

**Esperado**: ✅ PASS (SYNCED = GREEN)

---

### TC5.3: Refrescar agentes desde VR
**Objetivo**: Click "REFRESH AGENTS" → redibuja todas esferas

**Pasos**:
1. Frontend abierto
2. Click "REFRESH AGENTS" (Purple button, y=1.2)
3. Observar que esferas se redibujan

**Validación**:
- [ ] Mensaje: "Refreshing agents..."
- [ ] Luego: "✓ Agents refreshed"
- [ ] Esferas se redibujan
- [ ] Consola: GET /agents llamada

**Esperado**: ✅ PASS

---

## Test Suite 6: Persistencia Permanente

### TC6.1: Persistencia tras reinicio
**Objetivo**: Crear agente → reiniciar backend → agente aún existe

**Pasos**:
1. Crear agente vía POST /agents
2. Verificar en GET /agents
3. Reiniciar backend:
   ```bash
   docker compose restart orchestrator
   ```
4. Esperar 5 segundos
5. Llamar GET /agents nuevamente

**Validación**:
- [ ] Agente existe antes de reinicio
- [ ] Agente SIGUE EXISTIENDO después de reinicio
- [ ] ID y datos idénticos

**Esperado**: ✅ PASS (Critical!)

---

### TC6.2: Persistencia entre aplicaciones
**Objetivo**: registry.json es fuente de verdad compartida

**Pasos**:
1. Crear agente: `curl -X POST http://localhost:8000/agents ...`
2. Editar registry.json manualmente (cambiar nombre)
3. Llamar: `POST http://localhost:8000/agents/reload`
4. Llamar: `GET http://localhost:8000/agents`

**Validación**:
- [ ] POST /reload lee cambios de archivo
- [ ] GET /agents retorna name actualizado
- [ ] agents_db refleja cambios de archivo

**Esperado**: ✅ PASS

---

## Test Suite 7: Edge Cases

### TC7.1: Crear muchos agentes
**Objetivo**: Sistema puede manejar múltiples agentes

**Pasos**:
1. Crear 10 agentes en loop:
   ```bash
   for i in {1..10}; do
     curl -X POST http://localhost:8000/agents \
       -H "Content-Type: application/json" \
       -d "{\"name\":\"Stress$i\",\"model\":\"mistral\",\"capabilities\":[]}"
   done
   ```
2. Verificar todos existen: `GET /agents`
3. Verificar sincronización: `POST /agents/sync`

**Validación**:
- [ ] Todos 10 agentes creados (sin errores)
- [ ] GET /agents retorna 10+ agentes
- [ ] POST /sync retorna synced=true
- [ ] registry.json contiene todos

**Esperado**: ✅ PASS

---

### TC7.2: Agente sin internet_access
**Objetivo**: Campo internet_access=false por defecto

**Pasos**:
1. Crear agente SIN especificar internet_access:
   ```json
   {
     "name": "No Internet",
     "model": "llama3.2",
     "capabilities": []
   }
   ```
2. Verificar respuesta
3. Leer registry.json

**Validación**:
- [ ] response.internet_access == false (defecto)
- [ ] registry.json agente tiene internet_access=false

**Esperado**: ✅ PASS

---

### TC7.3: Actualizar solo algunos campos
**Objetivo**: PATCH /agents preserva otros campos

**Pasos**:
1. Crear agente completo (con todas las opciones)
2. PATCH solo nombre:
   ```json
   {
     "name": "New Name Only"
   }
   ```
3. Verificar GET /agents/{id}

**Validación**:
- [ ] name actualizado
- [ ] model sin cambios
- [ ] capabilities sin cambios
- [ ] status sin cambios
- [ ] internet_access sin cambios

**Esperado**: ✅ PASS

---

## Test Suite 8: Validación de Datos

### TC8.1: Crear con datos inválidos
**Objetivo**: Backend rechaza datos malformados

**Pasos**:
1. Intentar: `POST /agents` con body vacío
2. Intentar: `POST /agents` sin "name"
3. Intentar: `POST /agents` con model="unknown"

**Validación**:
- [ ] status_code == 422 (validation error)
- [ ] response contiene error detail
- [ ] registry.json NO actualizado

**Esperado**: ✅ PASS (REJECT)

---

### TC8.2: Actualizar agente no existente
**Objetivo**: PATCH /agents/{id} inexistente retorna 404

**Pasos**:
1. PATCH /agents/agent-9999 (no existe)

**Validación**:
- [ ] status_code == 404
- [ ] response.detail contiene "not found"

**Esperado**: ✅ PASS (REJECT)

---

## Test Suite 9: Performance

### TC9.1: GET /agents rápido
**Objetivo**: GET /agents < 100ms incluso con muchos agentes

**Pasos**:
1. Crear 20 agentes
2. Ejecutar: `curl -w "\nTime: %{time_total}s\n" -X GET http://localhost:8000/agents`
3. Medir tiempo

**Validación**:
- [ ] time_total < 0.1 segundos

**Esperado**: ✅ PASS

---

### TC9.2: POST /agents/sync rápido
**Objetivo**: POST /agents/sync < 50ms (simple comparison)

**Pasos**:
1. Ejecutar: `curl -w "\nTime: %{time_total}s\n" -X POST http://localhost:8000/agents/sync`

**Validación**:
- [ ] time_total < 0.05 segundos

**Esperado**: ✅ PASS

---

## Script Automatizado

```powershell
# test-all-persistence.ps1
& .\Scripts\test-agent-persistence.ps1 -ApiBase http://localhost:8000
# Corre: TC1.1, TC1.2, TC1.3, TC2.1, TC2.2
```

---

## Matriz de Resultados

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1.1 | ⏳ | Create basic agent |
| TC1.2 | ⏳ | File persistence |
| TC1.3 | ⏳ | List includes new agent |
| TC2.1 | ⏳ | Sync status after create |
| TC2.2 | ⏳ | Individual persistence check |
| TC3.1 | ⏳ | Update persists |
| TC3.2 | ⏳ | Bulk update |
| TC4.1 | ⏳ | Detect mismatch |
| TC4.2 | ⏳ | Recover with reload |
| TC5.1 | ⏳ | VR create agent |
| TC5.2 | ⏳ | VR sync status |
| TC5.3 | ⏳ | VR refresh agents |
| TC6.1 | ⏳ | Persist after restart |
| TC6.2 | ⏳ | File is source of truth |
| TC7.1 | ⏳ | Handle many agents |
| TC7.2 | ⏳ | Default internet_access |
| TC7.3 | ⏳ | Partial update |
| TC8.1 | ⏳ | Reject invalid data |
| TC8.2 | ⏳ | 404 on missing agent |
| TC9.1 | ⏳ | GET fast |
| TC9.2 | ⏳ | POST /sync fast |

## Notas

- Reemplazar ⏳ con ✅ (PASS) o ❌ (FAIL)
- Incluir tiempo de ejecución y observaciones
- Guardar evidencia de failures (logs, screenshots)
