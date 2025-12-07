"""
Capa de almacenamiento de conversaciones - Arquitectura Hexagonal
Define puertos (interfaces) para diferentes estrategias de almacenamiento
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
import json

@dataclass
class ConversationMessage:
    """Entidad de mensaje en conversación"""
    role: str  # "user" | "assistant"
    content: str
    timestamp: str

@dataclass
class Conversation:
    """Entidad de conversación completa"""
    conversation_id: str
    messages: List[ConversationMessage]
    created_at: str
    updated_at: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "messages": [asdict(m) for m in self.messages],
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

class ConversationStoragePort(ABC):
    """
    Puerto (interfaz) para almacenamiento de conversaciones.
    Permite múltiples implementaciones: Redis, PostgreSQL, SQLite, etc.
    """
    
    @abstractmethod
    async def save_message(
        self, 
        conversation_id: str, 
        role: str, 
        content: str
    ) -> bool:
        """Guardar un mensaje en una conversación"""
        pass
    
    @abstractmethod
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """Obtener una conversación completa por ID"""
        pass
    
    @abstractmethod
    async def get_all_conversations(self) -> Dict[str, Conversation]:
        """Obtener todas las conversaciones"""
        pass
    
    @abstractmethod
    async def create_conversation(self, conversation_id: str) -> Conversation:
        """Crear una nueva conversación"""
        pass
    
    @abstractmethod
    async def delete_conversation(self, conversation_id: str) -> bool:
        """Eliminar una conversación"""
        pass
    
    @abstractmethod
    async def prune_old_messages(self, conversation_id: str, keep_last: int = 20) -> bool:
        """Eliminar mensajes antiguos, mantener solo los últimos N"""
        pass


class InMemoryConversationStorage(ConversationStoragePort):
    """
    Implementación en memoria (actual) - Rápida pero sin persistencia
    """
    
    def __init__(self):
        self.storage: Dict[str, Conversation] = {}
    
    async def save_message(
        self, 
        conversation_id: str, 
        role: str, 
        content: str
    ) -> bool:
        if conversation_id not in self.storage:
            await self.create_conversation(conversation_id)
        
        msg = ConversationMessage(
            role=role,
            content=content,
            timestamp=datetime.now().isoformat()
        )
        self.storage[conversation_id].messages.append(msg)
        self.storage[conversation_id].updated_at = datetime.now().isoformat()
        
        # Mantener solo últimos 20 mensajes
        await self.prune_old_messages(conversation_id, keep_last=20)
        return True
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        return self.storage.get(conversation_id)
    
    async def get_all_conversations(self) -> Dict[str, Conversation]:
        return self.storage
    
    async def create_conversation(self, conversation_id: str) -> Conversation:
        now = datetime.now().isoformat()
        conv = Conversation(
            conversation_id=conversation_id,
            messages=[],
            created_at=now,
            updated_at=now
        )
        self.storage[conversation_id] = conv
        return conv
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        if conversation_id in self.storage:
            del self.storage[conversation_id]
            return True
        return False
    
    async def prune_old_messages(self, conversation_id: str, keep_last: int = 20) -> bool:
        if conversation_id in self.storage:
            messages = self.storage[conversation_id].messages
            if len(messages) > keep_last:
                self.storage[conversation_id].messages = messages[-keep_last:]
            return True
        return False


class RedisConversationStorage(ConversationStoragePort):
    """
    Implementación con Redis - Caché rápido para conversaciones activas
    Almacena solo últimos N mensajes con TTL
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379", ttl_seconds: int = 3600):
        import redis.asyncio as aioredis
        self.redis = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        self.ttl = ttl_seconds
    
    async def save_message(self, conversation_id: str, role: str, content: str) -> bool:
        try:
            key = f"conv:{conversation_id}"
            message = json.dumps({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat()
            })
            
            # Agregar mensaje a lista Redis
            await self.redis.rpush(key, message)
            
            # Renovar TTL
            await self.redis.expire(key, self.ttl)
            
            return True
        except Exception as e:
            print(f"Redis save_message error: {e}")
            return False
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        try:
            key = f"conv:{conversation_id}"
            messages_raw = await self.redis.lrange(key, 0, -1)
            
            if not messages_raw:
                return None
            
            messages = [
                ConversationMessage(**json.loads(msg))
                for msg in messages_raw
            ]
            
            # Obtener metadata
            created_at = await self.redis.get(f"{key}:created") or datetime.now().isoformat()
            
            return Conversation(
                conversation_id=conversation_id,
                messages=messages,
                created_at=created_at,
                updated_at=datetime.now().isoformat()
            )
        except Exception as e:
            print(f"Redis get_conversation error: {e}")
            return None
    
    async def get_all_conversations(self) -> Dict[str, Conversation]:
        try:
            # Obtener todas las keys de conversaciones
            keys = await self.redis.keys("conv:*")
            conversations = {}
            
            for key in keys:
                if ":created" in key:
                    continue
                conv_id = key.replace("conv:", "")
                conv = await self.get_conversation(conv_id)
                if conv:
                    conversations[conv_id] = conv
            
            return conversations
        except Exception as e:
            print(f"Redis get_all_conversations error: {e}")
            return {}
    
    async def create_conversation(self, conversation_id: str) -> Conversation:
        key = f"conv:{conversation_id}"
        now = datetime.now().isoformat()
        
        # Guardar timestamp de creación
        await self.redis.set(f"{key}:created", now, ex=self.ttl)
        
        return Conversation(
            conversation_id=conversation_id,
            messages=[],
            created_at=now,
            updated_at=now
        )
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        try:
            key = f"conv:{conversation_id}"
            await self.redis.delete(key, f"{key}:created")
            return True
        except Exception as e:
            print(f"Redis delete_conversation error: {e}")
            return False
    
    async def prune_old_messages(self, conversation_id: str, keep_last: int = 20) -> bool:
        try:
            key = f"conv:{conversation_id}"
            length = await self.redis.llen(key)
            
            if length > keep_last:
                # Eliminar mensajes antiguos (mantener solo últimos keep_last)
                await self.redis.ltrim(key, -keep_last, -1)
            
            return True
        except Exception as e:
            print(f"Redis prune_old_messages error: {e}")
            return False


class PostgreSQLConversationStorage(ConversationStoragePort):
    """
    Implementación con PostgreSQL - Historial permanente con búsqueda por usuario
    """
    
    def __init__(self, db_url: str = "postgresql://user:password@localhost/ias_db"):
        import asyncpg
        self.db_url = db_url
        self.pool = None
    
    async def _ensure_pool(self):
        """Crear pool de conexiones si no existe"""
        if not self.pool:
            import asyncpg
            self.pool = await asyncpg.create_pool(self.db_url)
            # Crear tablas si no existen
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS conversations (
                        conversation_id VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS messages (
                        id SERIAL PRIMARY KEY,
                        conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
                        role VARCHAR(50),
                        content TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_messages_conv_id 
                    ON messages(conversation_id)
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_conversations_user 
                    ON conversations(user_id)
                """)
    
    async def save_message(self, conversation_id: str, role: str, content: str, user_id: str = None) -> bool:
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                # Insertar mensaje
                await conn.execute("""
                    INSERT INTO messages (conversation_id, role, content, timestamp)
                    VALUES ($1, $2, $3, $4)
                """, conversation_id, role, content, datetime.now())
                
                # Actualizar timestamp de conversación
                await conn.execute("""
                    UPDATE conversations 
                    SET updated_at = $1 
                    WHERE conversation_id = $2
                """, datetime.now(), conversation_id)
                
                return True
        except Exception as e:
            print(f"PostgreSQL save_message error: {e}")
            return False
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                # Obtener conversación
                conv_row = await conn.fetchrow("""
                    SELECT conversation_id, created_at, updated_at
                    FROM conversations
                    WHERE conversation_id = $1
                """, conversation_id)
                
                if not conv_row:
                    return None
                
                # Obtener mensajes
                msg_rows = await conn.fetch("""
                    SELECT role, content, timestamp
                    FROM messages
                    WHERE conversation_id = $1
                    ORDER BY timestamp ASC
                """, conversation_id)
                
                messages = [
                    ConversationMessage(
                        role=row['role'],
                        content=row['content'],
                        timestamp=row['timestamp'].isoformat()
                    )
                    for row in msg_rows
                ]
                
                return Conversation(
                    conversation_id=conv_row['conversation_id'],
                    messages=messages,
                    created_at=conv_row['created_at'].isoformat(),
                    updated_at=conv_row['updated_at'].isoformat()
                )
        except Exception as e:
            print(f"PostgreSQL get_conversation error: {e}")
            return None
    
    async def get_all_conversations(self) -> Dict[str, Conversation]:
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("SELECT conversation_id FROM conversations")
                conversations = {}
                
                for row in rows:
                    conv = await self.get_conversation(row['conversation_id'])
                    if conv:
                        conversations[row['conversation_id']] = conv
                
                return conversations
        except Exception as e:
            print(f"PostgreSQL get_all_conversations error: {e}")
            return {}
    
    async def create_conversation(self, conversation_id: str, user_id: str = None) -> Conversation:
        await self._ensure_pool()
        async with self.pool.acquire() as conn:
            now = datetime.now()
            await conn.execute("""
                INSERT INTO conversations (conversation_id, user_id, created_at, updated_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (conversation_id) DO NOTHING
            """, conversation_id, user_id, now, now)
        
        return Conversation(
            conversation_id=conversation_id,
            messages=[],
            created_at=now.isoformat(),
            updated_at=now.isoformat()
        )
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                await conn.execute("DELETE FROM messages WHERE conversation_id = $1", conversation_id)
                await conn.execute("DELETE FROM conversations WHERE conversation_id = $1", conversation_id)
                return True
        except Exception as e:
            print(f"PostgreSQL delete_conversation error: {e}")
            return False
    
    async def prune_old_messages(self, conversation_id: str, keep_last: int = 20) -> bool:
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                # Eliminar mensajes antiguos manteniendo solo últimos N
                await conn.execute("""
                    DELETE FROM messages 
                    WHERE conversation_id = $1 
                    AND id NOT IN (
                        SELECT id FROM messages 
                        WHERE conversation_id = $1 
                        ORDER BY timestamp DESC 
                        LIMIT $2
                    )
                """, conversation_id, keep_last)
                return True
        except Exception as e:
            print(f"PostgreSQL prune_old_messages error: {e}")
            return False
    
    async def get_conversations_by_user(self, user_id: str) -> List[Conversation]:
        """Obtener todas las conversaciones de un usuario"""
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT conversation_id 
                    FROM conversations 
                    WHERE user_id = $1 
                    ORDER BY updated_at DESC
                """, user_id)
                
                conversations = []
                for row in rows:
                    conv = await self.get_conversation(row['conversation_id'])
                    if conv:
                        conversations.append(conv)
                
                return conversations
        except Exception as e:
            print(f"PostgreSQL get_conversations_by_user error: {e}")
            return []


# Placeholder para SQLite (implementar después)
class SQLiteConversationStorage(ConversationStoragePort):
    """
    Implementación con SQLite - Ideal para desarrollo/testing
    Requiere: pip install aiosqlite
    """
    
    def __init__(self, db_path: str = "conversations.db"):
        # TODO: Implementar con aiosqlite
        self.db_path = db_path
    
    async def save_message(self, conversation_id: str, role: str, content: str) -> bool:
        # TODO: INSERT en SQLite
        pass
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        # TODO: SELECT de SQLite
        pass
    
    async def get_all_conversations(self) -> Dict[str, Conversation]:
        # TODO: SELECT ALL de SQLite
        pass
    
    async def create_conversation(self, conversation_id: str) -> Conversation:
        # TODO: INSERT en SQLite
        pass
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        # TODO: DELETE de SQLite
        pass
    
    async def prune_old_messages(self, conversation_id: str, keep_last: int = 20) -> bool:
        # TODO: DELETE con LIMIT
        pass


class HybridConversationStorage(ConversationStoragePort):
    """
    Estrategia híbrida: Redis (caché rápido) + PostgreSQL (historial permanente)
    
    Flujo:
    1. Siempre guarda en PostgreSQL (historial completo)
    2. Guarda últimos N mensajes en Redis (caché rápido)
    3. Al recuperar, intenta primero Redis, si no existe busca en PostgreSQL
    4. Si recupera de PostgreSQL, carga a Redis para siguientes consultas
    """
    
    def __init__(
        self, 
        redis_url: str, 
        db_url: str, 
        redis_ttl: int = 3600,
        redis_max_messages: int = 20
    ):
        self.redis = RedisConversationStorage(redis_url, redis_ttl)
        self.postgres = PostgreSQLConversationStorage(db_url)
        self.max_messages_in_redis = redis_max_messages
    
    async def save_message(self, conversation_id: str, role: str, content: str, user_id: str = None) -> bool:
        # Guardar en PostgreSQL (permanente)
        pg_success = await self.postgres.save_message(conversation_id, role, content, user_id)
        
        # Guardar en Redis (caché)
        redis_success = await self.redis.save_message(conversation_id, role, content)
        
        # Mantener solo últimos N en Redis
        await self.redis.prune_old_messages(conversation_id, self.max_messages_in_redis)
        
        return pg_success and redis_success
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        # Intentar obtener de Redis (rápido)
        conv = await self.redis.get_conversation(conversation_id)
        
        if conv:
            return conv
        
        # Si no está en Redis, buscar en PostgreSQL
        conv = await self.postgres.get_conversation(conversation_id)
        
        if conv:
            # Cargar últimos mensajes a Redis para siguientes consultas
            for msg in conv.messages[-self.max_messages_in_redis:]:
                await self.redis.save_message(
                    conversation_id, 
                    msg.role, 
                    msg.content
                )
        
        return conv
    
    async def get_all_conversations(self) -> Dict[str, Conversation]:
        # Obtener de PostgreSQL (fuente completa)
        return await self.postgres.get_all_conversations()
    
    async def create_conversation(self, conversation_id: str, user_id: str = None) -> Conversation:
        # Crear en ambos
        pg_conv = await self.postgres.create_conversation(conversation_id, user_id)
        await self.redis.create_conversation(conversation_id)
        return pg_conv
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        # Eliminar de ambos
        redis_success = await self.redis.delete_conversation(conversation_id)
        pg_success = await self.postgres.delete_conversation(conversation_id)
        return redis_success and pg_success
    
    async def prune_old_messages(self, conversation_id: str, keep_last: int = 20) -> bool:
        # Solo eliminar de PostgreSQL si se necesita (Redis ya está limitado)
        return await self.postgres.prune_old_messages(conversation_id, keep_last)
    
    async def get_conversations_by_user(self, user_id: str) -> List[Conversation]:
        """Obtener todas las conversaciones de un usuario (solo PostgreSQL)"""
        return await self.postgres.get_conversations_by_user(user_id)
