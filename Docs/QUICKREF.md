# Guía Rápida de Arquitectura

## 📋 Documento Base
**Consultar siempre**: [`docs/requirements/REQUIREMENTS.md`](./REQUIREMENTS.md)

Este es el documento de referencia que contiene:
- ✅ Arquitectura hexagonal completa
- ✅ Principios SOLID aplicados
- ✅ Especialización de agentes
- ✅ Patrones de diseño
- ✅ Buenas prácticas
- ✅ Checklist de implementación

---

## 🎯 Especialización de Agentes

| Agente | Modelo | Temperatura | Especialidad |
|--------|--------|-------------|--------------|
| **Orchestrator** | `llama3.2` | 0.7 | Coordinación y enrutamiento |
| **Agent-1** | `codellama` | 0.2 | Código y desarrollo |
| **Agent-2** | `mistral` | 0.5 | Análisis y razonamiento |
| **Agent-3** | `llama3.2` | 0.8 | Conversación general |

---

## 🏗️ Arquitectura Hexagonal

```
┌─────────────────────────────────────────┐
│          API (FastAPI)                  │ 

└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    APPLICATION (Use Cases)              │  ← Lógica de aplicación
│  - process_query.py                     │
│  - learn_feedback.py                    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    DOMAIN (Entities + Services)         │  ← Lógica de negocio
│  - entities.py                          │
│  - services.py                          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    PORTS (Interfaces/Protocols)         │  ← Contratos
│  - llm_provider.py                      │
│  - vector_store.py                      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    INFRASTRUCTURE (Adapters)            │  ← Implementaciones
│  - ollama_adapter.py                    │
│  - chroma_adapter.py                    │
└─────────────────────────────────────────┘
```

---

## 📁 Estructura de un Agente

```
agents/agent-1/
├── domain/              # 🧠 Lógica de negocio pura
│   ├── entities.py      # Modelos de dominio
│   ├── value_objects.py # Objetos de valor
│   └── services.py      # Servicios de dominio
│
├── application/         # 📋 Casos de uso
│   ├── use_cases/
│   │   ├── process_query.py
│   │   └── learn_feedback.py
│   └── dto.py           # Data Transfer Objects
│
├── infrastructure/      # 🔧 Implementaciones técnicas
│   ├── adapters/
│   │   ├── ollama_adapter.py
│   │   └── chroma_adapter.py
│   └── config.py
│
├── ports/              # 🔌 Interfaces/Contratos
│   ├── llm_provider.py
│   └── vector_store.py
│
└── api/                # 🌐 Capa de presentación
    ├── main.py         # FastAPI app
    ├── routes.py       # Endpoints
    ├── schemas.py      # Pydantic models
    └── dependencies.py # Dependency injection
```

---

## 🔧 Principios SOLID en Práctica

### 1. Single Responsibility
```python
# ✅ Cada clase tiene una responsabilidad
class OllamaClient:        # Solo comunicación con Ollama
class VectorStore:         # Solo gestión de vectores
class FeedbackLoop:        # Solo procesamiento de feedback
```

### 2. Open/Closed
```python
# ✅ Extender sin modificar
class LLMProvider(Protocol):
    async def generate(self, prompt: str) -> str: ...

# Agregar nuevos providers sin tocar código existente
class OllamaProvider(LLMProvider): ...
class OpenAIProvider(LLMProvider): ...
```

### 3. Liskov Substitution
```python
# ✅ Sustituibles entre sí
store: VectorStore = ChromaStore()  # o QdrantStore()
```

### 4. Interface Segregation
```python
# ✅ Interfaces específicas
class Readable(Protocol):
    async def read(self) -> str: ...

class Writable(Protocol):
    async def write(self, data: str): ...
```

### 5. Dependency Inversion
```python
# ✅ Inyección de dependencias
class AgentService:
    def __init__(
        self,
        llm: LLMProvider,      # Abstracción
        store: VectorStore     # Abstracción
    ):
        self.llm = llm
        self.store = store
```

---

## 📝 Patrones de Diseño Aplicados

### Repository Pattern
```python
class ConversationRepository(Protocol):
    async def save(self, conv: Conversation) -> None: ...
    async def find_by_id(self, id: str) -> Optional[Conversation]: ...
```

### Factory Pattern
```python
class LLMFactory:
    @staticmethod
    def create(model_name: str) -> LLMProvider:
        if model_name.startswith("ollama:"):
            return OllamaAdapter(...)
```

### Strategy Pattern
```python
class RoutingStrategy(Protocol):
    def select_agent(self, query: str) -> str: ...
```

### Dependency Injection
```python
# api/dependencies.py
def get_llm_client() -> LLMProvider:
    return OllamaAdapter(...)

# Uso en routes
@router.post("/query")
async def query(llm: Annotated[LLMProvider, Depends(get_llm_client)]):
    ...
```

---

## 🚀 Quick Start

```powershell
# 1. Levantar servicios
docker compose up -d

# 2. Descargar modelos
.\scripts\download_models.ps1

# 3. Verificar
curl http://localhost:8000/docs
```

---

## 📚 Documentos Relacionados

- [`REQUIREMENTS.md`](./REQUIREMENTS.md) - Documento base completo
- [`docs/developer/SETUP.md`](../developer/SETUP.md) - Guía de instalación
- [`docs/developer/DEPENDENCIES.md`](../developer/DEPENDENCIES.md) - Dependencias
- [`README.md`](../../README.md) - Visión general del proyecto

---

## ✅ Checklist Antes de Implementar

- [ ] Leer REQUIREMENTS.md completo
- [ ] Entender arquitectura hexagonal
- [ ] Revisar principios SOLID
- [ ] Conocer especialización de agentes
- [ ] Verificar estructura de directorios
- [ ] Entender patrones aplicados

---

**Regla de Oro**: Consultar `REQUIREMENTS.md` ante cualquier duda sobre arquitectura, estructura o buenas prácticas.
