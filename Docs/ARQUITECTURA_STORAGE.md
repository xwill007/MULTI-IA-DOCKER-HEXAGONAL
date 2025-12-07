# Arquitectura Hexagonal: Almacenamiento de Conversaciones

## Problema: Dependencia Fuerte

Sin arquitectura hexagonal, el código FastAPI estaría acoplado a una implementación específica:

```python
# ❌ MAL - Acoplado directamente a Redis
import redis
@app.post("/query")
async def process_query(request: QueryRequest):
    redis_client.set(f"conv:{conversation_id}", data)  # Difícil de cambiar
```

Si quisieras cambiar a PostgreSQL, tendrías que modificar todo el endpoint.

## Solución: Puertos y Adaptadores

Con arquitectura hexagonal, la lógica de negocio NO conoce detalles de almacenamiento:

```
┌─────────────────────────────────────────────────────┐
│                   LÓGICA DE NEGOCIO                 │
│              (process_query en main.py)              │
│  "Necesito guardar un mensaje en la conversación"   │
└─────────────────────────────┬───────────────────────┘
                              │
                    Puerto (Interfaz)
                  ConversationStoragePort
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼───┐            ┌────▼────┐          ┌────▼────┐
    │ Redis │            │PostgreSQL│         │ SQLite  │
    │Adapter│            │ Adapter  │         │ Adapter │
    └───────┘            └──────────┘         └─────────┘
```

## Implementación: Cómo usarlo en main.py

```python
# Infrastructure
from Infrastructure.conversation_storage import (
    ConversationStoragePort,
    InMemoryConversationStorage,
    RedisConversationStorage,
    PostgreSQLConversationStorage
)

# Seleccionar implementación por variable de entorno
def get_storage() -> ConversationStoragePort:
    storage_type = os.getenv("STORAGE_TYPE", "memory")
    
    if storage_type == "redis":
        return RedisConversationStorage(
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379")
        )
    elif storage_type == "postgresql":
        return PostgreSQLConversationStorage(
            db_url=os.getenv("DATABASE_URL", "postgresql://...")
        )
    else:
        return InMemoryConversationStorage()

# Inyectar dependencia
storage: ConversationStoragePort = get_storage()

# En main.py, cambiar esto:
# conversations_db[conversation_id].append({...})

# A esto:
await storage.save_message(conversation_id, "user", request.query)
await storage.save_message(conversation_id, "assistant", final_response)
```

## Ventajas

| Aspecto | Sin Hexagonal | Con Hexagonal |
|--------|---------------|---------------|
| **Cambiar BD** | Modificar código en 5+ lugares | Cambiar 1 variable de entorno |
| **Testear** | Difícil mockear BD real | Fácil mockear con dummy |
| **Escalar** | Reescribir lógica | Solo cambiar adaptador |
| **Independencia** | Acoplado a Redis/PG | Independiente del storage |

## Configuración por Entorno

### Desarrollo (memoria)
```bash
STORAGE_TYPE=memory
```

### Staging (Redis)
```bash
STORAGE_TYPE=redis
REDIS_URL=redis://redis:6379/0
```

### Producción (PostgreSQL)
```bash
STORAGE_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@db.host/ias_db
```

## Roadmap: Implementaciones a completar

1. **✅ InMemoryConversationStorage** - Ya funciona
2. **Redis** - Próximo (caché de sesiones activas)
3. **PostgreSQL** - Producción (historial completo)
4. **SQLite** - Testing (archivo único)

## Ventajas por tipo de almacenamiento

### Redis
- ✅ Conversaciones activas en sesiones cortas
- ✅ Caché de respuestas frecuentes
- ✅ TTL automático (auto-limpieza)
- ❌ Sin persistencia por defecto

### PostgreSQL  
- ✅ Historial ilimitado
- ✅ Búsquedas complejas (por usuario, fecha, etc)
- ✅ Transacciones ACID
- ✅ Backups automáticos
- ⚠️ Más lento que Redis

### SQLite
- ✅ Fácil de deployar (archivo)
- ✅ Ideal para desarrollo
- ✅ No requiere servidor
- ❌ Lento con >1GB datos
- ❌ Limitada concurrencia

## Próximo paso

Implementar `RedisConversationStorage` para conversaciones activas + Redis.
Mantener PostgreSQL para historial persistente.
