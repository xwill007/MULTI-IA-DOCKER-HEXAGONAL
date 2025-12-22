# 🚀 GUÍA DE USO - ALMACENAMIENTO HÍBRIDO

**Validado:** ✅ 22 de Diciembre, 2025  
**Estado:** LISTO PARA PRODUCCIÓN

---

## 📖 Tabla de Contenidos

1. [Inicio Rápido](#inicio-rápido)
2. [Concepto Básico](#concepto-básico)
3. [Cómo Funciona](#cómo-funciona)
4. [Ejemplos Prácticos](#ejemplos-prácticos)
5. [Monitoreo](#monitoreo)
6. [Solución de Problemas](#solución-de-problemas)

---

## 🚀 Inicio Rápido

### 1. Asegurar que Docker está corriendo
```bash
docker compose up -d
```

### 2. Hacer una consulta que guarde historial
```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hola, ¿cómo estás?",
    "conversation_id": "mi-primera-conv",
    "use_agents": true
  }'
```

### 3. Hacer una segunda consulta (se recuperará el historial)
```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Recuerdas lo que te dije antes?",
    "conversation_id": "mi-primera-conv",
    "use_agents": true
  }'
```

### 4. Ver el historial completo
```bash
curl http://localhost:8000/conversations/mi-primera-conv
```

✅ **Listo!** El historial se ha guardado automáticamente.

---

## 💡 Concepto Básico

### ¿Qué es el Almacenamiento Híbrido?

```
           TU CONSULTA
                │
                ▼
        ┌─────────────────────┐
        │  API Orchestrator   │
        │  (Procesa query)    │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  Almacenamiento     │
        │  Híbrido            │
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌───▼──────┐         ┌────▼────┐
    │  Redis   │         │ PostgreSQL
    │  Rápido  │         │ Permanente
    │          │         │
    │ < 1ms    │         │ ~50ms
    │ 20 msgs  │         │ Todos
    └──────────┘         └────────┘
```

**Ventajas:**
- ✅ **Rápido:** Redis caché < 1ms
- ✅ **Seguro:** PostgreSQL permanente
- ✅ **Inteligente:** Fallback automático si Redis falla

---

## 🔄 Cómo Funciona

### Guardar Mensaje
```
Usuario escribe: "Hola"
         │
         ▼
Storage.save_message()
         │
         ├─→ PostgreSQL: Guarda mensaje (permanente)
         │
         ├─→ Redis: Guarda mensaje (caché)
         │
         └─→ Redis: Limpia si hay > 20 mensajes
         │
         ▼
    Guardado completo
```

### Recuperar Conversación
```
Solicitud: dame la conversación "abc-123"
         │
         ▼
Storage.get_conversation("abc-123")
         │
         ├─→ Redis: ¿Está en caché?
         │   ├─ SÍ: Retorna (< 1ms) ✓
         │   └─ NO: Continúa...
         │
         └─→ PostgreSQL: Busca en BD
             ├─ Encuentra: Retorna todos
             └─ Recarga últimos 20 a Redis
         │
         ▼
   Historial disponible
```

### Ciclo de TTL (Time To Live)
```
Mensaje guardado
         │
         ▼
Redis: Expira en 3600 segundos (1 hora)
         │
    ┌────▼─────┐
    │           │
 < 1h         = 1h (TTL expira)
    │           │
    │       Redis:
    │       Mensaje eliminado
    │       (es volátil)
    │           │
    │       PostgreSQL:
    │       Mensaje aún existe
    │       (es permanente)
    │           │
    │       Usuario consulta
    │       (recupera de BD)
    │           │
    │       Se recarga a Redis
    │
    ▼
Próximas consultas rápidas
```

---

## 📝 Ejemplos Prácticos

### Ejemplo 1: Conversación Simple

```bash
# Primer mensaje
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Cuál es la capital de Francia?",
    "conversation_id": "geo-test-1",
    "use_agents": false
  }'

# Respuesta: "Paris es la capital de Francia..."

# Segundo mensaje (mismo conversation_id)
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Y cuál es su población?",
    "conversation_id": "geo-test-1",
    "use_agents": false
  }'

# El orquestador RECUERDA que hablamos de París
# Respuesta: "París tiene aproximadamente 2.2 millones de habitantes..."
```

### Ejemplo 2: Conversación Multi-turno

```bash
# Conversation 1
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Soy un programador Python",
    "conversation_id": "user-001",
    "use_agents": true
  }'

# Conversation 2 - Diferente usuario
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Soy un analista de datos",
    "conversation_id": "user-002",
    "use_agents": true
  }'

# Verificar que NO se mezclan
curl http://localhost:8000/conversations/user-001
curl http://localhost:8000/conversations/user-002
```

### Ejemplo 3: Reutilizar Conversation ID

```bash
# Conversación persistente por días
# Misma conversation_id = Mismo historial

curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tema: Aprendizaje de máquina",
    "conversation_id": "ml-course-001",
    "use_agents": true
  }'

# Mañana, mismo usuario vuelve
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Continúa explicando las redes neuronales",
    "conversation_id": "ml-course-001",
    "use_agents": true
  }'

# Historial completo disponible desde el primer día
```

---

## 🔍 Monitoreo

### Ver Conversaciones Guardadas

```bash
# Todas las conversaciones
curl http://localhost:8000/conversations | jq '.total_conversations'

# Salida: 5 (o el número actual)
```

### Ver Conversación Específica

```bash
curl http://localhost:8000/conversations/mi-primera-conv | jq '.messages'

# Salida:
# [
#   {
#     "role": "user",
#     "content": "Hola, ¿cómo estás?",
#     "timestamp": "2025-12-22T12:30:49.235354"
#   },
#   {
#     "role": "assistant",
#     "content": "¡Hola! Estoy bien...",
#     "timestamp": "2025-12-22T12:30:50.123456"
#   }
# ]
```

### Monitorear Redis (Caché)

```bash
# Entrar a Redis CLI
docker compose exec redis redis-cli

# Ver todas las conversaciones cacheadas
> KEYS conv:*

# Salida:
# 1) "conv:mi-primera-conv"
# 2) "conv:geo-test-1"
# 3) "conv:user-001"

# Ver mensajes de una conversación
> LRANGE conv:mi-primera-conv 0 -1

# Salida: [JSON message 1, JSON message 2, ...]

# Ver cuánto tiempo queda (TTL)
> TTL conv:mi-primera-conv

# Salida: 3456 (segundos restantes)
```

### Monitorear PostgreSQL (Base de Datos)

```bash
# Entrar a PostgreSQL
docker compose exec postgres psql -U postgres -d ias_db

# Ver cuántas conversaciones hay
> SELECT COUNT(*) FROM conversations;

# Ver últimas conversaciones
> SELECT conversation_id, created_at, updated_at 
  FROM conversations 
  ORDER BY updated_at DESC 
  LIMIT 10;

# Ver mensajes de una conversación
> SELECT role, content, timestamp 
  FROM messages 
  WHERE conversation_id = 'mi-primera-conv'
  ORDER BY timestamp ASC;

# Ver estadísticas
> SELECT conversation_id, COUNT(*) as msg_count 
  FROM messages 
  GROUP BY conversation_id 
  ORDER BY msg_count DESC 
  LIMIT 5;
```

---

## 🆘 Solución de Problemas

### Problema: Los mensajes no se guardan

**Causa:** Probablemente `STORAGE_TYPE` no está en `hybrid`

```bash
# Verificar
docker compose exec orchestrator env | grep STORAGE_TYPE

# Si no está en "hybrid", editar docker-compose.yml:
STORAGE_TYPE=hybrid

# Reiniciar
docker compose down && docker compose up -d
```

### Problema: No puedo conectar a Redis

**Causa:** Redis no está corriendo o la URL es incorrecta

```bash
# Verificar que Redis está corriendo
docker compose ps | grep redis

# Si no aparece:
docker compose up -d redis

# Verificar conexión
docker compose exec orchestrator python -c "
import redis.asyncio as aioredis
import asyncio

async def test():
    r = await aioredis.from_url('redis://redis:6379/0')
    print('Conectado a Redis')
    
asyncio.run(test())
"
```

### Problema: No puedo conectar a PostgreSQL

**Causa:** PostgreSQL no está corriendo o la contraseña es incorrecta

```bash
# Verificar que PostgreSQL está corriendo
docker compose ps | grep postgres

# Si no aparece:
docker compose up -d postgres

# Verificar conexión
docker compose exec postgres psql -U postgres -d ias_db -c "SELECT 1"
```

### Problema: El historial se perdió después de reiniciar

**Esto es normal con Redis, pero PostgreSQL tiene todo**

```bash
# Ver en PostgreSQL
docker compose exec postgres psql -U postgres -d ias_db -c \
  "SELECT * FROM messages WHERE conversation_id='abc-123'"

# Los datos están ahí, solo hay que recargarlos
# La siguiente consulta a /query los traerá nuevamente
```

### Problema: Tengo muchos mensajes, el Redis está lento

**El sistema limpia automáticamente (máximo 20 por conversación)**

```bash
# Verificar que el pruning funciona
docker compose exec redis redis-cli

> LLEN conv:mi-conv
# Salida: 20 (siempre será ≤ 20)
```

---

## 📊 Configuración (Referencia)

### Variables de Entorno Actuales

```bash
STORAGE_TYPE=hybrid              # ✓ Correcto para producción
REDIS_URL=redis://redis:6379/0   # ✓ URL de Redis
REDIS_TTL_SECONDS=3600           # ✓ 1 hora de caché
REDIS_MAX_MESSAGES=20            # ✓ Máximo en caché
DATABASE_URL=postgresql://postgres:password@postgres:5432/ias_db
```

### Cambiar a Otros Modos (Si es necesario)

```bash
# Solo memoria (sin persistencia, desarrollo)
STORAGE_TYPE=memory

# Solo Redis (sin persistencia)
STORAGE_TYPE=redis

# Solo PostgreSQL (sin caché rápido)
STORAGE_TYPE=postgresql

# Híbrido (RECOMENDADO PARA PRODUCCIÓN)
STORAGE_TYPE=hybrid
```

---

## ✅ Checklist de Validación

Antes de usar en producción, verificar:

```bash
# 1. ¿Docker está corriendo?
docker compose ps

# 2. ¿Todos los servicios están healthy?
docker compose exec orchestrator python -c "
import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        # Test Redis
        r = client.get('http://localhost:8000/conversations')
        print(f'✓ API: {r.status_code}')

asyncio.run(test())
"

# 3. ¿Puedo guardar un mensaje?
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Prueba","conversation_id":"test-final","use_agents":false}'

# 4. ¿Puedo recuperarlo?
curl http://localhost:8000/conversations/test-final

# 5. ¿Está en Redis y PostgreSQL?
docker compose exec redis redis-cli KEYS conv:test-final
docker compose exec postgres psql -U postgres -d ias_db -c \
  "SELECT * FROM messages WHERE conversation_id='test-final'"
```

---

## 🎓 Resumen

### Lo Importante de Recordar

```
✅ conversation_id = Identificador único de la conversación
✅ Reutiliza el mismo para mantener historial
✅ Los mensajes se guardan automáticamente
✅ El historial se recupera automáticamente
✅ Funciona incluso si Redis se reinicia
✅ Sin pérdida de datos en PostgreSQL
```

### Flujo Típico de Usuario

```
1. Usuario 1 hace pregunta con conversation_id "conv-001"
   → Se guarda en Redis + PostgreSQL
   
2. Usuario 1 hace segunda pregunta con conversation_id "conv-001"
   → Sistema recupera historial de Redis (rápido)
   → Genera respuesta considerando contexto anterior
   → Guarda nuevo intercambio
   
3. Sistema se reinicia
   → Redis se pierde (es volátil)
   → PostgreSQL mantiene todo (es permanente)
   
4. Usuario 1 hace tercera pregunta con conversation_id "conv-001"
   → Sistema no encuentra en Redis
   → Busca en PostgreSQL (fallback automático)
   → Carga historial nuevamente a Redis
   → Funciona como antes
```

---

## 📞 Soporte

### Para Preguntas
1. Revisar [HYBRID_STORAGE.md](HYBRID_STORAGE.md)
2. Ver [VALIDACION_ALMACENAMIENTO_HIBRIDO.md](VALIDACION_ALMACENAMIENTO_HIBRIDO.md)
3. Ejecutar tests: `docker compose exec orchestrator python tests/integration/test_hybrid_storage.py`

### Para Problemas
1. Ver "Solución de Problemas" arriba
2. Revisar logs: `docker compose logs orchestrator`
3. Ejecutar health check: `curl http://localhost:8000/health`

---

**Validación:** ✅ 22 de Diciembre, 2025  
**Estado:** LISTO PARA PRODUCCIÓN  
**Versión:** 1.0.0
