# Changelog - Agent Persistence & Sync Integration

## Resumen
En esta sesión se completó la integración de persistencia de agentes, añadiendo verificación de sincronización y mejorando la experiencia de debugging.

## Cambios Implementados

### Backend (FastAPI)

#### 1. Nuevo Endpoint: POST /agents/sync
- **Archivo**: `Api/orchestrator/modules/agents/router.py:187-226`
- **Propósito**: Verificar estado de sincronización entre memoria y archivo
- **Response**:
  ```json
  {
    "success": true,
    "synced": true,
    "agents_in_memory": 5,
    "agents_in_file": 5,
    "agent_ids": ["agent-001", ...],
    "memory_only": [],
    "file_only": []
  }
  ```
- **Cambio**: Nuevo endpoint, no afecta a código existente

#### 2. Nueva Función: reload_agents_from_file()
- **Archivo**: `Api/orchestrator/modules/agents/service.py:109-112`
- **Propósito**: Forzar recarga desde archivo (útil para testing)
- **Cambio**: Función auxiliar, no afecta al flujo principal

#### 3. Mejoras en Inicialización de Agentes
- **Archivo**: `Api/orchestrator/modules/agents/service.py:42-77`
- **Estado anterior**: agents_db se inicializaba con 3 defaults ANTES de load_agents(), causando acumulación
- **Estado actual**: agents_db inicia vacío, load_agents() lo reemplaza completamente
- **Cambio**: Refactorización de _init_default_agents(), sin cambio en API

### Frontend (VR)

#### 1. Nuevo Botón: SYNC STATUS
- **Archivo**: `App/frontend-vr/src/components/query-panel.js:36-42`
- **Color**: Azul (#2196F3)
- **Posición**: y=1.0 (entre REFRESH AGENTS y CREAR AGENTE)
- **Función**: Verifica POST /agents/sync y muestra estado

#### 2. Nuevo Método: checkSyncStatus()
- **Archivo**: `App/frontend-vr/src/components/query-panel.js:455-489`
- **Lógica**:
  - Llamada a POST /agents/sync
  - Si synced=true → "✓ Synced: N agents" (verde)
  - Si synced=false → "⚠ Mismatch: Mem=X File=Y" (naranja)
  - Error → "✗ Sync check failed" (rojo)
- **Timeout**: Mensaje se limpia después de 3 segundos

#### 3. Mejoras de Logging
- **Estado**: Ya estaba implementado globalmente en sesión anterior
- **ShowLogs**: Ya está true en files principales

### Documentación

#### 1. Nuevo Documento: AGENT_PERSISTENCE_GUIDE.md
- **Archivo**: `Docs/AGENT_PERSISTENCE_GUIDE.md`
- **Contenido**:
  - Resumen del flujo de persistencia
  - Descripción de todos los endpoints
  - Botones en VR y sus funciones
  - Guía de debugging
  - Tabla de componentes relevantes
  - Variables de entorno

#### 2. Actualización de README.md
- **Cambios**: 
  - Agregada referencia a AGENT_PERSISTENCE_GUIDE.md
  - Actualizada sección de características para incluir `/agents/sync` y botón "SYNC STATUS"

#### 3. Nuevo Script: test-agent-persistence.ps1
- **Archivo**: `Scripts/test-agent-persistence.ps1`
- **Funcionalidad**: Script de prueba que:
  1. Crea un agente de prueba vía POST /agents
  2. Verifica que está en registry.json
  3. Verifica que está en GET /agents
  4. Verifica sincronización con POST /agents/sync
  5. Verifica persistencia individual con GET /agents/verify/{id}
  6. Opcionalmente limpia el agente (flag -SkipCleanup)

## Flujo de Persistencia (Confirmado)

```
User: Click "CREAR AGENTE"
  ↓
Frontend: POST /agents con CreateAgentRequest
  ↓
Backend create_agent():
  - Genera ID: agent-{num:03d}
  - Crea objeto Agent
  - Agrega a agents_db (memoria)
  - Llama save_agents() → escribe registry.json
  - Log: "Agent created: agent-id"
  ↓
Frontend: evento agents-updated
  - Dispara stateManager.loadAgents()
  - Redibuja esferas en A-Frame
  ↓
User: Click "SYNC STATUS"
  - POST /agents/sync
  - Verifica agents_in_memory == agents_in_file
  - Muestra resultado: "✓ Synced: 5 agents"
```

## Testing

### Verificar Persistencia Manual
```powershell
# Ver agentes en registry.json
Get-Content data/agents/registry.json | ConvertFrom-Json

# Ejecutar script de prueba
.\Scripts\test-agent-persistence.ps1 -ApiBase http://localhost:8000
```

### Verificar Sincronización via API
```bash
# Crear agente
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"test","model":"mistral","capabilities":["testing"]}'

# Verificar sincronización
curl -X POST http://localhost:8000/agents/sync

# Debería responder con: "synced": true
```

## Cambios que NO Rompieron Nada
- POST /agents mantiene la misma interfaz (entrada/salida)
- GET /agents mantiene la misma interfaz
- load_agents() sigue siendo llamado al startup automáticamente
- registry.json usa el mismo formato JSON

## Cambios Internos
- agents_db ahora se inicia vacío en lugar de con defaults (no visible en API)
- _init_default_agents() es una función separada (no visible en API)

## Próximas Mejoras Sugeridas

1. **Persistencia en BD**: Crear tabla `agents` en Postgres e integrar con conversation_storage
2. **Auto-sync en actualizaciones**: Llamar POST /agents/sync automáticamente después de cambios
3. **Indicador visual de sync**: Mostrar estado de sincronización permanente en VR
4. **Historial de agentes**: Guardar versiones anteriores en BD
5. **Backup automático**: Exportar registry.json a archivo dated backup

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| Api/orchestrator/modules/agents/router.py | +37 líneas (nuevo endpoint /sync) |
| Api/orchestrator/modules/agents/service.py | +3 líneas (nuevo función reload_agents_from_file) |
| App/frontend-vr/src/components/query-panel.js | +35 líneas (botón SYNC STATUS + método checkSyncStatus) |
| README.md | +1 línea ref docs, +4 líneas características |
| Docs/AGENT_PERSISTENCE_GUIDE.md | NUEVO (210 líneas) |
| Scripts/test-agent-persistence.ps1 | NUEVO (script de prueba) |

## Estados de Sincronización Posibles

| Estado | Significado | Color | Acción Recomendada |
|--------|------------|-------|-------------------|
| ✓ Synced: N agents | Todo OK | Verde | Continuar usando |
| ⚠ Mismatch | Desajuste | Naranja | Click "REFRESH AGENTS" o "RELOAD" |
| ✗ API error | Error de conexión | Rojo | Verificar que backend está running |
| ✗ No sync endpoint | Versión vieja | Rojo | Actualizar código backend |

## Validación Realizada

✅ Endpoint POST /agents/sync implementado y testeado
✅ Botón SYNC STATUS agregado y funcional en VR
✅ Método checkSyncStatus() parsea y muestra respuesta correctamente
✅ Documentación completa en AGENT_PERSISTENCE_GUIDE.md
✅ Script de prueba creado y listo para usar
✅ README actualizado con referencias
✅ No hay breaking changes en APIs existentes

## Notas Importantes

1. **No hay tabla de agents en Postgres**: Los agentes se persisten en `registry.json` (file-based), no en BD
2. **Auto-persistencia**: `save_agents()` se llama automáticamente en create/update/toggle/import
3. **Sin API de BD para agents**: La persistencia es solo archivo, no hay migration a BD en roadmap inmediato
4. **Sincronización manual**: El botón "SYNC STATUS" es verificación, no sincronización forzada (ver "RELOAD" para eso)
