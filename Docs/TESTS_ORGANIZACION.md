# 📁 Organización de Tests - Decisión Arquitectural

**Fecha:** 22 de Diciembre, 2025  
**Tema:** Ubicación correcta de tests según arquitectura hexagonal

---

## 🎯 Problema Identificado

El test `test_hybrid_storage.py` estaba ubicado en:
```
❌ Api/orchestrator/tests/integration/test_hybrid_storage.py
```

Pero probaba código de:
```
Infrastructure/conversation_storage.py
```

Esto viola los principios de arquitectura hexagonal y separación de responsabilidades.

---

## ✅ Solución Implementada

### Nueva Ubicación
```
✅ Infrastructure/tests/integration/test_hybrid_storage.py
```

### Razones

1. **Principio de Cohesión**
   - Los tests deben estar cerca del código que prueban
   - `conversation_storage.py` está en `Infrastructure/`
   - Sus tests también deben estar en `Infrastructure/tests/`

2. **Arquitectura Hexagonal**
   ```
   Infrastructure/
   ├── conversation_storage.py      ← Implementación
   ├── __init__.py
   └── tests/
       ├── __init__.py
       ├── unit/                     ← Tests unitarios
       │   └── test_storage_unit.py
       └── integration/              ← Tests de integración
           └── test_hybrid_storage.py ← Aquí
   ```

3. **Reutilización**
   - `Infrastructure/` es una capa compartida entre servicios
   - Si `Api/agents/` o `Api/another-service/` usan `conversation_storage`, también pueden acceder a sus tests
   - Los tests en `Api/orchestrator/` solo son accesibles para el orquestrador

4. **Separación de Responsabilidades**
   - `Api/orchestrator/tests/` → Tests del orquestador (lógica de negocio, endpoints, casos de uso)
   - `Infrastructure/tests/` → Tests de componentes compartidos (storage, adapters, ports)

---

## 📊 Estructura de Tests Correcta

```
MULTI-IA-DOCKER-HEXAGONAL/
│
├── Infrastructure/                     # Capa compartida
│   ├── conversation_storage.py        # Componente a probar
│   ├── __init__.py
│   └── tests/                         # ✅ Tests de Infrastructure
│       ├── __init__.py
│       ├── unit/                      # Tests unitarios (mocks)
│       │   ├── __init__.py
│       │   └── test_storage_unit.py
│       │
│       └── integration/               # Tests de integración (Redis + PostgreSQL reales)
│           ├── __init__.py
│           └── test_hybrid_storage.py # ← Correcto
│
├── Api/
│   └── orchestrator/
│       ├── main.py
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── tests/                     # Tests del orquestador
│           ├── unit/                  # Lógica de negocio
│           │   ├── test_orchestration_service.py
│           │   └── test_decision_service.py
│           │
│           ├── integration/           # Integración entre capas
│           │   ├── test_query_endpoint.py
│           │   ├── test_storage_integration.py  # ← Cómo el orquestador USA storage
│           │   └── test_agent_coordination.py
│           │
│           └── e2e/                   # End-to-end
│               └── test_full_query_flow.py
│
└── tests/                             # Tests de sistema completo
    ├── integration/                   # Integración multi-servicio
    │   └── test_orchestrator_agents.py
    │
    └── e2e/                           # End-to-end de toda la aplicación
        └── test_vr_to_backend_flow.py
```

---

## 🔄 Tipos de Tests por Ubicación

### 1. `Infrastructure/tests/`
**Qué probar:**
- ✅ `HybridConversationStorage` funciona (actual test)
- ✅ `RedisConversationStorage` guarda/recupera
- ✅ `PostgreSQLConversationStorage` persiste
- ✅ Failover Redis → PostgreSQL
- ✅ Pruning automático

**Características:**
- Tests de componentes individuales de infraestructura
- Usa Redis y PostgreSQL reales (o mocks para unit tests)
- No involucra lógica de negocio del orquestador

### 2. `Api/orchestrator/tests/integration/`
**Qué probar:**
- ✅ `/query` endpoint guarda conversación correctamente
- ✅ El orquestador carga historial al procesar queries
- ✅ Coordinación entre agentes y storage
- ✅ DTOs se convierten correctamente

**Ejemplo:**
```python
# Api/orchestrator/tests/integration/test_storage_integration.py

async def test_query_saves_to_storage():
    """Verificar que /query guarda en storage"""
    # POST /query con conversation_id
    response = await client.post("/query", json={
        "query": "Hola",
        "conversation_id": "test-123"
    })
    
    # Verificar que se guardó en storage
    conv = await storage.get_conversation("test-123")
    assert len(conv.messages) == 2  # user + assistant
```

### 3. `tests/` (raíz del proyecto)
**Qué probar:**
- ✅ Flujo completo: Frontend VR → Orchestrator → Agents
- ✅ Múltiples servicios interactuando
- ✅ Casos de uso de sistema completo

---

## 🚀 Cómo Ejecutar los Tests

### Tests de Infrastructure
```bash
# Desde Docker
docker compose exec orchestrator python Infrastructure/tests/integration/test_hybrid_storage.py

# Localmente (si tienes Python + Redis + PostgreSQL)
python Infrastructure/tests/integration/test_hybrid_storage.py
```

### Tests del Orchestrator
```bash
# Todos los tests del orquestador
docker compose exec orchestrator pytest Api/orchestrator/tests/

# Solo integración
docker compose exec orchestrator pytest Api/orchestrator/tests/integration/

# Solo unitarios
docker compose exec orchestrator pytest Api/orchestrator/tests/unit/
```

### Tests de Sistema Completo
```bash
# End-to-end
pytest tests/e2e/
```

---

## 📝 Cambios Realizados

1. ✅ Creado `Infrastructure/tests/integration/`
2. ✅ Movido `test_hybrid_storage.py` a ubicación correcta
3. ✅ Actualizado imports (ahora usa `../..` en lugar de `../../../../`)
4. ✅ Mantenido archivo antiguo en `Api/orchestrator/tests/integration/` (para referencia, se puede eliminar)

---

## 🎓 Mejores Prácticas

### ✅ Hacer
- Colocar tests cerca del código que prueban
- Usar `unit/` para tests con mocks
- Usar `integration/` para tests con dependencias reales
- Usar `e2e/` para flujos completos

### ❌ Evitar
- Poner tests de `Infrastructure/` dentro de `Api/orchestrator/`
- Mezclar tests unitarios con tests de integración
- Tests de integración sin aislamiento (usar transaction rollbacks)

---

## 🔗 Referencias

- [ARQUITECTURA_DINAMICA.md](ARQUITECTURA_DINAMICA.md) - Arquitectura general
- [HYBRID_STORAGE.md](HYBRID_STORAGE.md) - Almacenamiento híbrido
- [VALIDACION_ALMACENAMIENTO_HIBRIDO.md](VALIDACION_ALMACENAMIENTO_HIBRIDO.md) - Resultados de validación

---

**Conclusión:** La nueva ubicación en `Infrastructure/tests/integration/` es correcta arquitecturalmente y facilita la reutilización de tests entre servicios.
