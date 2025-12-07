# Sistema Híbrido de Almacenamiento: Redis + PostgreSQL

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Orchestrator                      │
│                  (Lógica de Negocio)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ ConversationStoragePort (Interface)
                       │
        ┌──────────────▼──────────────┐
        │  HybridConversationStorage  │
        │  (Orchestrates Both)        │
        └──────────┬─────────┬────────┘
                   │         │
         ┌─────────▼───┐   ┌─▼──────────┐
         │    Redis    │   │ PostgreSQL │
         │   (Caché)   │   │ (Historial)│
         └─────────────┘   └────────────┘
```

## Flujo de Datos

### 1. Guardar Mensaje (`save_message`)
```
Usuario envía mensaje
    │
    ├──> PostgreSQL: Guarda en tabla `messages` (permanente)
    │
    └──> Redis: Guarda en lista `conv:{id}` (últimos 20 mensajes)
         └──> Expira automáticamente en 1 hora (TTL)
```

### 2. Recuperar Conversación (`get_conversation`)
```
Request conversación ID
    │
    ├──> ¿Existe en Redis?
    │    ├──> SÍ: Retornar inmediatamente (< 1ms) ✅
    │    │
    │    └──> NO: Buscar en PostgreSQL (~50ms)
    │         └──> Cargar últimos 20 mensajes a Redis
    │              └──> Retornar conversación
```

### 3. Reinicio de Contenedores
```
Docker restart
    │
    ├──> Redis: ❌ Pierde caché (datos volátiles)
    │
    └──> PostgreSQL: ✅ Mantiene todo el historial
         │
         └──> Primera consulta: Recupera de PG y carga a Redis
              └──> Siguientes consultas: Rápidas desde Redis
```

## Configuración

### Variables de Entorno (`.env`)

```bash
# Usar sistema híbrido
STORAGE_TYPE=hybrid

# Redis - Conversaciones activas (últimos N mensajes)
REDIS_URL=redis://redis:6379/0
REDIS_TTL_SECONDS=3600              # Expira en 1 hora
REDIS_MAX_MESSAGES=20               # Solo últimos 20 mensajes

# PostgreSQL - Historial completo permanente
DATABASE_URL=postgresql://postgres:password@postgres:5432/ias_db
```

### Alternativas de Configuración

#### Solo Memoria (Desarrollo)
```bash
STORAGE_TYPE=memory
```

#### Solo Redis (Rápido, sin persistencia)
```bash
STORAGE_TYPE=redis
REDIS_URL=redis://redis:6379/0
REDIS_TTL_SECONDS=7200
```

#### Solo PostgreSQL (Lento, máxima persistencia)
```bash
STORAGE_TYPE=postgresql
DATABASE_URL=postgresql://postgres:password@postgres:5432/ias_db
```

## Esquema PostgreSQL

```sql
CREATE TABLE conversations (
    conversation_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    role VARCHAR(50),                    -- 'user' | 'assistant'
    content TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_messages_conv_id ON messages(conversation_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
```

## Estructura Redis

```
Key: conv:{conversation_id}
Type: LIST
Value: [
  '{"role": "user", "content": "Hola", "timestamp": "2025-12-06T10:00:00"}',
  '{"role": "assistant", "content": "¡Hola!", "timestamp": "2025-12-06T10:00:05"}'
]
TTL: 3600 segundos (configurable)

Key: conv:{conversation_id}:created
Type: STRING  
Value: "2025-12-06T10:00:00"
TTL: 3600 segundos
```

## Ventajas del Sistema Híbrido

| Aspecto | Solo Redis | Solo PostgreSQL | **Híbrido** |
|---------|-----------|----------------|-------------|
| **Velocidad** | ⚡⚡⚡ < 1ms | ⚡ ~50ms | ⚡⚡⚡ < 1ms (caché hit) |
| **Persistencia** | ❌ Reinicio pierde datos | ✅ Permanente | ✅ Permanente |
| **Escalabilidad** | ⚠️ Limitado por RAM | ✅ Ilimitado | ✅ Ilimitado |
| **Costos** | 💰 RAM cara | 💰 Disco barato | 💰💰 Ambos |
| **Recuperación** | ❌ Pérdida total | ✅ Backups | ✅ Redis se reconstruye automático |
| **Consultas complejas** | ❌ No soporta | ✅ SQL completo | ✅ SQL en PostgreSQL |

## Casos de Uso

### Conversación Activa (Usuario chateando)
1. Usuario envía 10 mensajes en 5 minutos
2. Todos guardados en PostgreSQL ✅
3. Redis mantiene últimos 20 mensajes en caché ✅
4. Respuestas instantáneas (< 1ms) ✅

### Después de 2 horas (TTL expiró)
1. Redis eliminó la conversación (TTL)
2. PostgreSQL mantiene historial completo ✅
3. Usuario regresa y consulta conversación
4. Sistema recupera de PostgreSQL (~50ms)
5. Carga últimos 20 mensajes a Redis ✅
6. Siguientes consultas rápidas nuevamente ✅

### Búsqueda por Usuario
```python
# Obtener todas las conversaciones de un usuario
conversations = await storage.get_conversations_by_user("user_123")
```
- ✅ Solo disponible en modo `hybrid` o `postgresql`
- ❌ No soportado en modo `memory` o `redis`

## Monitoreo

### Ver estado de Redis
```bash
docker exec -it multi-ia-redis redis-cli

# Listar todas las conversaciones
KEYS conv:*

# Ver mensajes de una conversación
LRANGE conv:abc123 0 -1

# Ver TTL restante
TTL conv:abc123
```

### Ver estado de PostgreSQL
```bash
docker exec -it multi-ia-postgres psql -U postgres -d ias_db

# Contar conversaciones
SELECT COUNT(*) FROM conversations;

# Ver últimas 10 conversaciones
SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 10;

# Contar mensajes por conversación
SELECT conversation_id, COUNT(*) 
FROM messages 
GROUP BY conversation_id;
```

## Levantar el Sistema

```bash
# Levantar Redis + PostgreSQL + Orquestador
docker compose up -d redis postgres orchestrator

# Ver logs
docker compose logs -f orchestrator

# Verificar conexiones
docker compose exec orchestrator python -c "
import asyncio
from Infrastructure.conversation_storage import HybridConversationStorage

async def test():
    storage = HybridConversationStorage(
        redis_url='redis://redis:6379/0',
        db_url='postgresql://postgres:password@postgres:5432/ias_db'
    )
    await storage.create_conversation('test-123')
    print('✅ Conexión exitosa')

asyncio.run(test())
"
```

## Próximos Pasos

1. ✅ Implementar `HybridConversationStorage`
2. ⏳ Integrar en `main.py` (reemplazar `conversations_db`)
3. ⏳ Agregar endpoint `/conversations/{user_id}` para buscar por usuario
4. ⏳ Agregar métricas de caché (hit rate Redis vs PostgreSQL)
5. ⏳ Implementar limpieza automática de conversaciones antiguas en PostgreSQL
