# 🏗️ Arquitectura Hexagonal para Orquestador Dinámico de Agentes IA + VR

## 🎯 Objetivos del Sistema

1. **Orquestador Inteligente**: Recibe queries, coordina respuestas de múltiples agentes
2. **Creación Dinámica de Agentes**: El orquestador puede instanciar nuevos agentes según necesidad
3. **Frontend VR**: Interfaz A-Frame para experiencia inmersiva
4. **Arquitectura Hexagonal**: Cada componente independiente y testeable
5. **Principios SOLID**: Código mantenible y extensible

---

## 📁 Estructura del Proyecto (Actualizada)

```
MULTI-IA-DOCKER-HEXAGONAL/
│
├── .env                              # Variables de entorno
├── .gitignore                        # Git ignore
├── docker-compose.yml                # Orquestación de contenedores
├── README.md                         # Documentación principal
│
├── Api/                              # 🔹 Backend - Arquitectura Hexagonal
│   │
│   ├── shared/                       # 🔧 Código compartido entre agentes
│   │   ├── domain/
│   │   │   ├── __init__.py
│   │   │   ├── base_entities.py      # Entity, ValueObject base
│   │   │   └── protocols.py          # Protocols comunes
│   │   │
│   │   ├── ports/
│   │   │   ├── __init__.py
│   │   │   ├── llm_provider.py       # Protocol para LLM
│   │   │   ├── vector_store.py       # Protocol para vectores
│   │   │   └── message_broker.py     # Protocol para mensajería
│   │   │
│   │   └── infrastructure/
│   │       ├── __init__.py
│   │       ├── adapters/
│   │       │   ├── ollama_adapter.py
│   │       │   ├── chroma_adapter.py
│   │       │   └── redis_adapter.py
│   │       └── config.py
│   │
│   ├── orchestrator/                 # 🎯 Orquestador Central (Puerto 8000)
│   │   │
│   │   ├── domain/                   # Lógica de negocio
│   │   │   ├── __init__.py
│   │   │   ├── entities/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── query.py          # Query entity
│   │   │   │   ├── agent.py          # Agent entity
│   │   │   │   ├── response.py       # Response entity
│   │   │   │   └── agent_template.py # AgentTemplate (para crear agentes)
│   │   │   │
│   │   │   ├── value_objects/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── query_type.py     # QueryType enum
│   │   │   │   ├── agent_status.py   # AgentStatus enum
│   │   │   │   └── capability.py     # Capability VO
│   │   │   │
│   │   │   └── services/
│   │   │       ├── __init__.py
│   │   │       ├── orchestration_service.py     # Lógica de orquestación
│   │   │       ├── agent_factory_service.py     # Factory de agentes
│   │   │       └── decision_service.py          # Toma de decisiones
│   │   │
│   │   ├── application/              # Casos de uso
│   │   │   ├── __init__.py
│   │   │   ├── dto/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── query_dto.py
│   │   │   │   ├── agent_dto.py
│   │   │   │   └── response_dto.py
│   │   │   │
│   │   │   └── use_cases/
│   │   │       ├── __init__.py
│   │   │       ├── process_query.py             # Procesar query
│   │   │       ├── create_agent.py              # Crear nuevo agente
│   │   │       ├── list_agents.py               # Listar agentes activos
│   │   │       ├── route_to_agents.py           # Enrutar a agentes
│   │   │       └── aggregate_responses.py       # Agregar respuestas
│   │   │
│   │   ├── infrastructure/           # Implementaciones técnicas
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── adapters/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── docker_agent_adapter.py      # Crear contenedores Docker
│   │   │   │   ├── kubernetes_agent_adapter.py  # (futuro) K8s
│   │   │   │   └── agent_http_client.py         # Cliente HTTP para agentes
│   │   │   │
│   │   │   └── repositories/
│   │   │       ├── __init__.py
│   │   │       ├── agent_repository.py          # Persistencia de agentes
│   │   │       └── query_repository.py          # Historial de queries
│   │   │
│   │   ├── ports/                    # Interfaces/Contratos
│   │   │   ├── __init__.py
│   │   │   ├── agent_manager.py      # Gestión de agentes
│   │   │   ├── agent_factory.py      # Creación de agentes
│   │   │   ├── routing_strategy.py   # Estrategia de enrutamiento
│   │   │   └── repository.py         # Repositorios
│   │   │
│   │   ├── api/                      # FastAPI
│   │   │   ├── __init__.py
│   │   │   ├── main.py               # App principal
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── query.py          # Endpoints de queries
│   │   │   │   ├── agents.py         # Endpoints de agentes
│   │   │   │   └── health.py         # Health checks
│   │   │   │
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── query_schema.py
│   │   │   │   ├── agent_schema.py
│   │   │   │   └── response_schema.py
│   │   │   │
│   │   │   ├── dependencies.py       # Dependency Injection
│   │   │   └── middleware.py         # Middlewares
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   │
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── agent-base/                   # 🧩 Plantilla base para agentes
│   │   │
│   │   ├── domain/
│   │   │   ├── __init__.py
│   │   │   ├── entities.py           # Request, Response
│   │   │   └── services.py           # Base service
│   │   │
│   │   ├── application/
│   │   │   └── use_cases/
│   │   │       ├── __init__.py
│   │   │       └── process_request.py
│   │   │
│   │   ├── infrastructure/
│   │   │   └── adapters/
│   │   │       ├── __init__.py
│   │   │       └── ollama_adapter.py
│   │   │
│   │   ├── ports/
│   │   │   ├── __init__.py
│   │   │   └── llm_provider.py
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   └── routes.py
│   │   │
│   │   ├── Dockerfile.template       # Dockerfile parametrizado
│   │   └── requirements.txt
│   │
│   └── agents/                       # 🤖 Agentes especializados (ejemplos pre-configurados)
│       │
│       ├── code-analyzer/            # Agente 1: Análisis de código
│       │   ├── config.yml            # Configuración específica
│       │   ├── prompt_templates/     # Prompts especializados
│       │   └── custom_logic.py       # Lógica específica (si necesita)
│       │
│       ├── data-analyst/             # Agente 2: Análisis de datos
│       │   ├── config.yml
│       │   ├── prompt_templates/
│       │   └── custom_logic.py
│       │
│       └── conversation/             # Agente 3: Conversación general
│           ├── config.yml
│           ├── prompt_templates/
│           └── custom_logic.py
│
├── App/                              # 🔹 Frontend VR
│   │
│   └── frontend-vr/                  # Frontend A-Frame
│       │
│       ├── public/
│       │   ├── index.html            # Página principal con A-Frame
│       │   ├── assets/
│       │   │   ├── textures/         # Texturas VR
│       │   │   ├── models/           # Modelos 3D (GLTF/GLB)
│       │   │   ├── sounds/           # Audio espacial
│       │   │   └── environments/     # HDRIs, skyboxes
│       │   └── favicon.ico
│       │
│       ├── src/
│       │   ├── components/           # Componentes A-Frame
│       │   │   ├── agent-sphere.js   # Representación visual de agentes
│       │   │   ├── query-panel.js    # Panel de input de queries
│       │   │   ├── response-bubble.js # Burbujas de respuestas
│       │   │   ├── agent-creator.js  # UI para crear agentes
│       │   │   └── network-graph.js  # Grafo de conexiones
│       │   │
│       │   ├── systems/              # Sistemas A-Frame
│       │   │   ├── interaction.js    # Sistema de interacción
│       │   │   ├── animation.js      # Animaciones
│       │   │   └── networking.js     # Comunicación con backend
│       │   │
│       │   ├── services/             # Servicios JavaScript
│       │   │   ├── api-client.js     # Cliente HTTP para orchestrator
│       │   │   ├── websocket.js      # WebSocket para real-time
│       │   │   └── state-manager.js  # Gestión de estado
│       │   │
│       │   ├── scenes/               # Escenas VR
│       │   │   ├── main-hub.html     # Hub principal
│       │   │   ├── agent-room.html   # Sala de agentes
│       │   │   └── analytics.html    # Visualización de datos
│       │   │
│       │   ├── utils/
│       │   │   ├── helpers.js
│       │   │   └── constants.js
│       │   │
│       │   ├── app.js                # Inicialización
│       │   └── config.js             # Configuración
│       │
│       ├── package.json
│       ├── vite.config.js            # Build tool (opcional)
│       ├── Dockerfile
│       └── nginx.conf                # Servidor web
│
├── Docs/                             # 🔹 Documentación
│   ├── QUICKREF.md
│   ├── BUILD_CHECKLIST.md
│   ├── ESTRUCTURA_ANALISIS.md
│   ├── ARQUITECTURA_DINAMICA.md      # Este archivo
│   ├── VR_DESIGN.md                  # Diseño de experiencia VR
│   ├── AGENT_CREATION.md             # Cómo crear agentes dinámicamente
│   └── API_REFERENCE.md              # Referencia completa de API
│
├── Scripts/                          # 🔹 Scripts de automatización
│   ├── fix_structure.ps1
│   ├── setup.ps1
│   ├── start.ps1
│   ├── stop.ps1
│   ├── download_models.ps1
│   ├── create_agent.ps1              # Script para crear nuevo agente
│   └── test_orchestration.ps1        # Test de orquestación
│
└── data/                             # 🔹 Datos persistentes
    ├── models/                       # Modelos IA (Ollama)
    ├── chromadb/                     # Vectores
    ├── redis/                        # Cache y mensajería
    ├── agents/                       # Metadata de agentes creados
    │   └── registry.json             # Registro de agentes
    └── logs/                         # Logs
        ├── orchestrator/
        └── agents/
```

---

## 🎨 Flujo de Creación Dinámica de Agentes

### 1. Usuario Solicita Crear Agente (VR o API)

```
Frontend VR → API Orchestrator → AgentFactoryService → DockerAgentAdapter → Nuevo Contenedor
```

### 2. Componentes Clave

#### A. AgentTemplate (Domain Entity)
```python
# Api/orchestrator/domain/entities/agent_template.py

from dataclasses import dataclass
from typing import Dict, List

@dataclass
class AgentTemplate:
    """Plantilla para crear nuevos agentes"""
    name: str
    model: str              # llama3.2, codellama, mistral, etc.
    temperature: float
    capabilities: List[str]  # ["code", "analysis", "chat"]
    system_prompt: str
    port: int
    environment_vars: Dict[str, str]
```

#### B. AgentFactoryService (Domain Service)
```python
# Api/orchestrator/domain/services/agent_factory_service.py

from typing import Protocol
from ..entities.agent_template import AgentTemplate

class AgentFactory(Protocol):
    """Port para crear agentes"""
    async def create_agent(self, template: AgentTemplate) -> str:
        """Retorna agent_id del nuevo agente"""
        ...

class AgentFactoryService:
    """Servicio de dominio para creación de agentes"""
    
    def __init__(self, factory: AgentFactory):
        self.factory = factory
    
    async def create_specialized_agent(
        self, 
        specialty: str,
        model: str
    ) -> str:
        template = self._build_template(specialty, model)
        return await self.factory.create_agent(template)
    
    def _build_template(self, specialty: str, model: str) -> AgentTemplate:
        # Lógica para construir plantilla según especialidad
        pass
```

#### C. DockerAgentAdapter (Infrastructure)
```python
# Api/orchestrator/infrastructure/adapters/docker_agent_adapter.py

import docker
from ...ports.agent_factory import AgentFactory
from ...domain.entities.agent_template import AgentTemplate

class DockerAgentAdapter(AgentFactory):
    """Adapter para crear agentes como contenedores Docker"""
    
    def __init__(self):
        self.client = docker.from_env()
    
    async def create_agent(self, template: AgentTemplate) -> str:
        # 1. Copiar agent-base a nuevo directorio
        # 2. Generar Dockerfile con variables
        # 3. Build imagen
        # 4. Crear contenedor con config específica
        # 5. Conectar a red multi-ia-network
        # 6. Iniciar contenedor
        # 7. Registrar en registry
        
        container = self.client.containers.run(
            image=f"agent-{template.name}:latest",
            name=f"agent-{template.name}",
            environment={
                "MODEL": template.model,
                "TEMPERATURE": template.temperature,
                "SYSTEM_PROMPT": template.system_prompt,
                **template.environment_vars
            },
            ports={f"{template.port}/tcp": template.port},
            network="multi-ia-network",
            detach=True
        )
        
        return container.id
```

#### D. CreateAgent Use Case
```python
# Api/orchestrator/application/use_cases/create_agent.py

from dataclasses import dataclass
from ...domain.services.agent_factory_service import AgentFactoryService

@dataclass
class CreateAgentCommand:
    name: str
    specialty: str
    model: str
    temperature: float = 0.5

class CreateAgentUseCase:
    def __init__(self, factory_service: AgentFactoryService):
        self.factory_service = factory_service
    
    async def execute(self, command: CreateAgentCommand) -> str:
        agent_id = await self.factory_service.create_specialized_agent(
            specialty=command.specialty,
            model=command.model
        )
        
        # Guardar en registro
        # Notificar a otros servicios
        # Log de creación
        
        return agent_id
```

---

## 🌐 Frontend VR con A-Frame

### Estructura de Escena Principal

```html
<!-- App/frontend-vr/public/index.html -->

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Multi-IA Orchestrator VR</title>
    <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
    <script src="https://unpkg.com/aframe-environment-component"></script>
    <script src="/src/components/agent-sphere.js"></script>
    <script src="/src/components/query-panel.js"></script>
    <script src="/src/components/agent-creator.js"></script>
</head>
<body>
    <a-scene>
        <!-- Entorno -->
        <a-entity environment="preset: starry"></a-entity>
        
        <!-- Orquestador Central (esfera dorada grande) -->
        <a-entity 
            id="orchestrator"
            geometry="primitive: sphere; radius: 2"
            material="color: #FFD700; metalness: 0.8; roughness: 0.2"
            position="0 1.6 -5"
            animation="property: rotation; to: 0 360 0; loop: true; dur: 20000">
            
            <!-- Partículas alrededor -->
            <a-entity particle-system="preset: default; color: #FFD700"></a-entity>
        </a-entity>
        
        <!-- Agentes (esferas orbitando) -->
        <a-entity id="agents-container">
            <!-- Agentes se generan dinámicamente -->
        </a-entity>
        
        <!-- Panel de Query (interactivo) -->
        <a-entity 
            id="query-panel"
            query-panel
            position="0 2 -3"
            rotation="0 0 0">
        </a-entity>
        
        <!-- Panel Creador de Agentes -->
        <a-entity 
            id="agent-creator"
            agent-creator
            position="3 2 -3"
            visible="false">
        </a-entity>
        
        <!-- Visualización de Respuestas (burbujas flotantes) -->
        <a-entity id="responses-container"></a-entity>
        
        <!-- Grafo de Conexiones -->
        <a-entity id="network-graph"></a-entity>
        
        <!-- Cámara + Controles VR -->
        <a-entity camera look-controls wasd-controls position="0 1.6 0">
            <a-entity 
                cursor="fuse: true; fuseTimeout: 500"
                position="0 0 -1"
                geometry="primitive: ring; radiusInner: 0.02; radiusOuter: 0.03"
                material="color: white; shader: flat">
            </a-entity>
        </a-entity>
        
        <!-- Luces -->
        <a-light type="ambient" intensity="0.5"></a-light>
        <a-light type="directional" position="1 2 1" intensity="0.8"></a-light>
    </a-scene>
    
    <script src="/src/services/api-client.js"></script>
    <script src="/src/app.js"></script>
</body>
</html>
```

### Componente A-Frame: Agent Sphere

```javascript
// App/frontend-vr/src/components/agent-sphere.js

AFRAME.registerComponent('agent-sphere', {
    schema: {
        agentId: {type: 'string', default: ''},
        agentName: {type: 'string', default: 'Agent'},
        model: {type: 'string', default: 'llama3.2'},
        status: {type: 'string', default: 'idle'}, // idle, processing, error
        orbitRadius: {type: 'number', default: 5},
        orbitSpeed: {type: 'number', default: 1}
    },
    
    init: function() {
        const data = this.data;
        const el = this.el;
        
        // Color según modelo
        const colors = {
            'llama3.2': '#4A90E2',
            'codellama': '#E24A4A',
            'mistral': '#9B59B6'
        };
        
        // Crear esfera
        el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5
        });
        
        el.setAttribute('material', {
            color: colors[data.model] || '#FFFFFF',
            metalness: 0.6,
            roughness: 0.3
        });
        
        // Texto con nombre
        const label = document.createElement('a-text');
        label.setAttribute('value', data.agentName);
        label.setAttribute('align', 'center');
        label.setAttribute('position', '0 0.8 0');
        label.setAttribute('scale', '2 2 2');
        el.appendChild(label);
        
        // Animación de órbita
        this.angle = Math.random() * Math.PI * 2;
        this.time = 0;
    },
    
    tick: function(time, deltaTime) {
        const data = this.data;
        this.time += deltaTime * 0.001 * data.orbitSpeed;
        
        // Orbitar alrededor del orquestador
        const x = Math.cos(this.time) * data.orbitRadius;
        const z = Math.sin(this.time) * data.orbitRadius - 5;
        const y = 1.6 + Math.sin(this.time * 2) * 0.3;
        
        this.el.setAttribute('position', {x, y, z});
        
        // Rotación
        this.el.setAttribute('rotation', {
            x: 0,
            y: this.time * 50,
            z: 0
        });
        
        // Pulso según estado
        if (data.status === 'processing') {
            const scale = 1 + Math.sin(time * 0.01) * 0.2;
            this.el.setAttribute('scale', `${scale} ${scale} ${scale}`);
        }
    },
    
    // Eventos
    events: {
        click: function() {
            // Mostrar detalles del agente
            console.log('Agent clicked:', this.data.agentId);
            this.el.emit('agent-selected', {agentId: this.data.agentId});
        }
    }
});
```

### Componente: Query Panel

```javascript
// App/frontend-vr/src/components/query-panel.js

AFRAME.registerComponent('query-panel', {
    init: function() {
        const el = this.el;
        
        // Panel base
        el.setAttribute('geometry', {
            primitive: 'plane',
            width: 4,
            height: 2
        });
        
        el.setAttribute('material', {
            color: '#1A1A1A',
            opacity: 0.9,
            transparent: true
        });
        
        // Input de texto (simulado con botones)
        this.createButton('Send Query', {x: 0, y: -0.5, z: 0.1});
        this.createButton('Create Agent', {x: 0, y: -0.9, z: 0.1});
        
        // Título
        const title = document.createElement('a-text');
        title.setAttribute('value', 'ORCHESTRATOR CONTROL');
        title.setAttribute('align', 'center');
        title.setAttribute('position', '0 0.7 0.1');
        title.setAttribute('color', '#FFD700');
        el.appendChild(title);
    },
    
    createButton: function(text, position) {
        const button = document.createElement('a-entity');
        button.setAttribute('geometry', {
            primitive: 'plane',
            width: 2,
            height: 0.4
        });
        button.setAttribute('material', {
            color: '#4A90E2'
        });
        button.setAttribute('position', position);
        
        const label = document.createElement('a-text');
        label.setAttribute('value', text);
        label.setAttribute('align', 'center');
        label.setAttribute('position', '0 0 0.01');
        label.setAttribute('color', '#FFFFFF');
        button.appendChild(label);
        
        // Interacción
        button.addEventListener('click', () => {
            this.handleButtonClick(text);
        });
        
        this.el.appendChild(button);
    },
    
    handleButtonClick: function(buttonText) {
        if (buttonText === 'Send Query') {
            this.sendQuery();
        } else if (buttonText === 'Create Agent') {
            this.showAgentCreator();
        }
    },
    
    sendQuery: async function() {
        // Obtener input (por ahora hardcodeado)
        const query = "Analyze this code and suggest improvements";
        
        // Llamar a API
        const response = await fetch('http://localhost:8000/api/v1/query', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query})
        });
        
        const data = await response.json();
        
        // Visualizar respuestas
        this.el.emit('query-response', {data});
    },
    
    showAgentCreator: function() {
        document.querySelector('#agent-creator').setAttribute('visible', true);
    }
});
```

---

## 🐳 Docker Compose para Orquestación Dinámica

```yaml
# docker-compose.yml

version: '3.8'

services:
  # Ollama - Servidor de modelos
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    volumes:
      - ./data/models:/root/.ollama
    ports:
      - "11434:11434"
    networks:
      - multi-ia-network
    restart: unless-stopped

  # ChromaDB - Base de datos vectorial
  chromadb:
    image: chromadb/chroma:latest
    container_name: chromadb
    volumes:
      - ./data/chromadb:/chroma/chroma
    ports:
      - "8100:8000"
    networks:
      - multi-ia-network
    restart: unless-stopped

  # Redis - Cache y mensajería
  redis:
    image: redis:7-alpine
    container_name: redis
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
    networks:
      - multi-ia-network
    restart: unless-stopped

  # Orchestrator - Coordinador central
  orchestrator:
    build:
      context: ./Api/orchestrator
      dockerfile: Dockerfile
    container_name: orchestrator
    environment:
      - OLLAMA_HOST=http://ollama:11434
      - CHROMA_HOST=http://chromadb:8000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Para crear contenedores
      - ./Api/orchestrator:/app
      - ./data/logs/orchestrator:/app/logs
      - ./data/agents:/app/agents  # Registro de agentes
    ports:
      - "8000:8000"
    networks:
      - multi-ia-network
    depends_on:
      - ollama
      - chromadb
      - redis
    restart: unless-stopped

  # Frontend VR
  frontend-vr:
    build:
      context: ./App/frontend-vr
      dockerfile: Dockerfile
    container_name: frontend-vr
    ports:
      - "3000:80"
    networks:
      - multi-ia-network
    restart: unless-stopped

  # Los agentes se crean dinámicamente por el orchestrator
  # No están pre-definidos en docker-compose

networks:
  multi-ia-network:
    driver: bridge

volumes:
  ollama_data:
  chroma_data:
  redis_data:
```

---

## 🔑 Patrones de Diseño Aplicados

### 1. Factory Pattern (Creación de Agentes)
```python
class AgentFactory:
    """Crea agentes según tipo"""
    def create_agent(self, agent_type: str) -> Agent:
        if agent_type == "code":
            return CodeAgent()
        elif agent_type == "data":
            return DataAgent()
```

### 2. Strategy Pattern (Enrutamiento)
```python
class RoutingStrategy(Protocol):
    def select_agents(self, query: Query) -> List[Agent]:
        ...

class KeywordRoutingStrategy(RoutingStrategy):
    """Enruta basado en keywords"""
    pass

class MLRoutingStrategy(RoutingStrategy):
    """Enruta usando embeddings"""
    pass
```

### 3. Observer Pattern (Notificaciones)
```python
class AgentObserver(Protocol):
    def on_agent_created(self, agent: Agent):
        ...

class OrchestrationService:
    def __init__(self):
        self.observers: List[AgentObserver] = []
    
    def notify_agent_created(self, agent: Agent):
        for observer in self.observers:
            observer.on_agent_created(agent)
```

### 4. Builder Pattern (Construcción de Agentes)
```python
class AgentBuilder:
    def __init__(self):
        self._agent = AgentTemplate()
    
    def with_model(self, model: str) -> 'AgentBuilder':
        self._agent.model = model
        return self
    
    def with_temperature(self, temp: float) -> 'AgentBuilder':
        self._agent.temperature = temp
        return self
    
    def build(self) -> AgentTemplate:
        return self._agent

# Uso
agent = (AgentBuilder()
    .with_model("codellama")
    .with_temperature(0.2)
    .build())
```

### 5. Repository Pattern (Persistencia)
```python
class AgentRepository(Protocol):
    async def save(self, agent: Agent) -> None:
        ...
    
    async def find_by_id(self, id: str) -> Optional[Agent]:
        ...
    
    async def list_active(self) -> List[Agent]:
        ...
```

---

## 📊 Flujo Completo de Operación

```
1. Usuario en VR ve hub central (orchestrator)
   ↓
2. Usuario clica "Create Agent" → panel UI
   ↓
3. Selecciona: modelo, especialidad, parámetros
   ↓
4. Frontend → POST /api/v1/agents/create
   ↓
5. Orchestrator → CreateAgentUseCase
   ↓
6. AgentFactoryService construye template
   ↓
7. DockerAgentAdapter:
   - Copia agent-base
   - Genera Dockerfile
   - docker build
   - docker run
   ↓
8. Nuevo agente aparece orbitando en VR
   ↓
9. Usuario envía query
   ↓
10. Orchestrator analiza y enruta a agentes (incluido el nuevo)
    ↓
11. Agentes procesan en paralelo
    ↓
12. Respuestas se agregan
    ↓
13. Resultado se visualiza como burbujas flotantes en VR
```

---

## 🎯 Ventajas de esta Arquitectura

### ✅ Arquitectura Hexagonal
- Cada agente es independiente
- Fácil testear (mock de adapters)
- Cambiar Ollama por OpenAI sin tocar dominio

### ✅ Principios SOLID
- **S**: Cada clase tiene una responsabilidad
- **O**: Extender sin modificar (nuevos adapters)
- **L**: Sustitución de implementaciones
- **I**: Interfaces segregadas (ports específicos)
- **D**: Inyección de dependencias

### ✅ Creación Dinámica
- Agentes se crean on-demand
- No necesitas reiniciar el sistema
- Escalabilidad horizontal

### ✅ Frontend VR Inmersivo
- Visualización 3D de arquitectura
- Interacción intuitiva
- Feedback visual en tiempo real

---

**Próximo paso**: ¿Quieres que implemente alguna parte específica (orchestrator, agent-base, componente VR)?
