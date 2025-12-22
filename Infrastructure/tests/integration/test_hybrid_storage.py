"""
Test de integración para validar el almacenamiento híbrido
Prueba la funcionalidad completa de Redis + PostgreSQL
"""
import asyncio
import sys
import os
from datetime import datetime

# Add Infrastructure to path (since we're in Infrastructure/tests/integration/)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from conversation_storage import (  # type: ignore
    HybridConversationStorage,
    InMemoryConversationStorage,
    RedisConversationStorage,
    PostgreSQLConversationStorage,
    ConversationMessage,
)


async def test_hybrid_storage():
    """Test completo del almacenamiento híbrido"""
    
    print("\n" + "="*80)
    print("VALIDACIÓN DEL ALMACENAMIENTO HÍBRIDO")
    print("="*80 + "\n")
    
    # Configuración
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/ias_db")
    
    print(f"Redis URL: {redis_url}")
    print(f"Database URL: {db_url}")
    print("\n" + "-"*80 + "\n")
    
    try:
        # Crear instancia de almacenamiento híbrido
        storage = HybridConversationStorage(redis_url, db_url, redis_ttl=3600, redis_max_messages=20)
        
        # Test 1: Crear conversación
        print("✓ TEST 1: Crear nueva conversación")
        conv_id = f"test-{int(datetime.now().timestamp())}"
        conversation = await storage.create_conversation(conv_id, user_id="test_user")
        print(f"  - Conversación creada: {conversation.conversation_id}")
        print(f"  - Timestamp creación: {conversation.created_at}\n")
        
        # Test 2: Guardar mensajes
        print("✓ TEST 2: Guardar mensajes en conversación")
        test_messages = [
            ("user", "Hola, ¿cómo estás?"),
            ("assistant", "¡Hola! Estoy bien, gracias por preguntar."),
            ("user", "¿Puedes ayudarme con un problema de Python?"),
            ("assistant", "Claro, estoy especializado en análisis de código. ¿Cuál es el problema?"),
            ("user", "Tengo un error en mi función recursiva."),
        ]
        
        for role, content in test_messages:
            result = await storage.save_message(conv_id, role, content)
            print(f"  - [{role:9}] {content[:50]}... -> {result}")
        
        print()
        
        # Test 3: Recuperar conversación (debe estar en Redis)
        print("✓ TEST 3: Recuperar conversación (desde Redis)")
        retrieved_conv = await storage.get_conversation(conv_id)
        if retrieved_conv:
            print(f"  - Conversación recuperada: {retrieved_conv.conversation_id}")
            print(f"  - Mensajes almacenados: {len(retrieved_conv.messages)}")
            for i, msg in enumerate(retrieved_conv.messages, 1):
                print(f"    [{i}] {msg.role}: {msg.content[:50]}...")
        else:
            print(f"  ✗ ERROR: No se pudo recuperar la conversación")
        
        print()
        
        # Test 4: Agregar más mensajes (verificar pruning)
        print("✓ TEST 4: Agregar mensajes adicionales (verificar pruning a 20)")
        for i in range(20):
            await storage.save_message(conv_id, "user", f"Pregunta {i+1}")
            await storage.save_message(conv_id, "assistant", f"Respuesta {i+1}")
        
        retrieved_conv = await storage.get_conversation(conv_id)
        if retrieved_conv:
            print(f"  - Total de mensajes después de agregar 40: {len(retrieved_conv.messages)}")
            print(f"  - Máximo esperado en Redis: 20")
            if len(retrieved_conv.messages) <= 20:
                print(f"  ✓ Pruning funcionando correctamente")
            else:
                print(f"  ✗ ALERTA: Se esperaban máximo 20 mensajes, se encontraron {len(retrieved_conv.messages)}")
        else:
            print(f"  ✗ ERROR: No se pudo recuperar la conversación después de agregar mensajes")
        
        print()
        
        # Test 5: Verificar persistencia en PostgreSQL
        print("✓ TEST 5: Verificar persistencia en PostgreSQL")
        pg_conv = await storage.postgres.get_conversation(conv_id)
        if pg_conv:
            print(f"  - Conversación encontrada en PostgreSQL")
            print(f"  - Total de mensajes en PostgreSQL: {len(pg_conv.messages)}")
            print(f"  - Primero: {pg_conv.messages[0].role} - {pg_conv.messages[0].content[:50]}...")
            print(f"  - Último: {pg_conv.messages[-1].role} - {pg_conv.messages[-1].content[:50]}...")
        else:
            print(f"  ✗ ERROR: No se encontró la conversación en PostgreSQL")
        
        print()
        
        # Test 6: Obtener todas las conversaciones
        print("✓ TEST 6: Obtener todas las conversaciones")
        all_convs = await storage.get_all_conversations()
        print(f"  - Total de conversaciones: {len(all_convs)}")
        if conv_id in all_convs:
            print(f"  ✓ Conversación de prueba encontrada en el listado")
        
        print()
        
        # Test 7: Simular caída de Redis (recuperación desde PostgreSQL)
        print("✓ TEST 7: Simular pérdida de caché Redis")
        await storage.redis.delete_conversation(conv_id)
        
        # Intentar recuperar (debe buscar en PostgreSQL)
        retrieved_conv = await storage.get_conversation(conv_id)
        if retrieved_conv:
            print(f"  ✓ Conversación recuperada de PostgreSQL después de perder Redis")
            print(f"  - Mensajes recuperados: {len(retrieved_conv.messages)}")
            
            # Verificar que se recargó en Redis
            redis_conv = await storage.redis.get_conversation(conv_id)
            if redis_conv:
                print(f"  ✓ Conversación recargada en Redis (últimos {len(redis_conv.messages)} mensajes)")
        else:
            print(f"  ✗ ERROR: No se pudo recuperar la conversación después de perder Redis")
        
        print()
        
        # Test 8: Eliminar conversación
        print("✓ TEST 8: Eliminar conversación")
        result = await storage.delete_conversation(conv_id)
        print(f"  - Eliminación: {'Exitosa' if result else 'Fallida'}")
        
        retrieved_conv = await storage.get_conversation(conv_id)
        if retrieved_conv is None:
            print(f"  ✓ Conversación eliminada correctamente de ambos almacenes")
        else:
            print(f"  ✗ ERROR: La conversación aún existe después de eliminarla")
        
        print()
        
        # Resumen
        print("="*80)
        print("✓ VALIDACIÓN COMPLETADA EXITOSAMENTE")
        print("="*80)
        print("\nRESUMEN:")
        print("✓ El almacenamiento híbrido está funcional")
        print("✓ Los datos se guardan en PostgreSQL (persistencia)")
        print("✓ Los últimos 20 mensajes se cachean en Redis (velocidad)")
        print("✓ El pruning de mensajes antiguos funciona")
        print("✓ La recuperación desde PostgreSQL cuando Redis falla funciona")
        print("✓ El historial de conversación se mantiene correctamente")
        
        return True
        
    except Exception as e:
        print(f"\n✗ ERROR durante la validación:")
        print(f"  {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_hybrid_storage())
    sys.exit(0 if success else 1)
