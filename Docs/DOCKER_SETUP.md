# 🐳 Multi-IA Orchestrator - Docker Setup

## 🚀 Inicio Rápido con Docker

### Requisitos Previos
- ✅ Docker Desktop instalado
- ✅ ~15GB de espacio libre (modelos IA)
- ✅ 8GB RAM mínimo recomendado

### Iniciar el Sistema Completo

```powershell
# 1. Construir las imágenes (primera vez)
.\Scripts\start-docker.ps1 -Build

# 2. Iniciar servicios
.\Scripts\start-docker.ps1

# 3. Descargar modelos de IA (~10GB, toma tiempo)
.\Scripts\start-docker.ps1 -Pull

# Espera ~10-15 minutos para descarga de modelos
```

### Acceder al Sistema

Una vez iniciado, abre en tu navegador:
- **Frontend VR:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

---

## 📋 Comandos Disponibles

```powershell
# Iniciar servicios básicos
.\Scripts\start-docker.ps1

# Iniciar con ChromaDB + Redis
.\Scripts\start-docker.ps1 -Full

# Reconstruir imágenes (después de cambios)
.\Scripts\start-docker.ps1 -Build

# Descargar modelos de IA
.\Scripts\start-docker.ps1 -Pull

# Ver logs en tiempo real
.\Scripts\start-docker.ps1 -Logs

# Detener todo
.\Scripts\start-docker.ps1 -Down

# Ver ayuda
.\Scripts\start-docker.ps1 -Help
```

---

## 🏗️ Arquitectura de Contenedores

```
┌─────────────────────────────────────────────┐
│          Frontend VR (Port 3000)            │
│         Vite + A-Frame + WebXR              │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│       Orchestrator API (Port 8000)          │
│         FastAPI + Python 3.11               │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│         Ollama (Port 11434)                 │
│    llama3.2 + codellama + mistral           │
│         Local AI Inference                  │
└─────────────────────────────────────────────┘
```

---

## 🔍 Verificar Estado

```powershell
# Ver contenedores corriendo
docker compose ps

# Ver logs del orquestador
docker compose logs orchestrator

# Ver logs de Ollama
docker compose logs ollama

# Ver logs del frontend
docker compose logs frontend-vr

# Entrar a un contenedor
docker exec -it multi-ia-orchestrator bash
docker exec -it multi-ia-ollama bash
```

---

## 🧪 Probar el Sistema

### 1. Verificar Health Check
```powershell
curl http://localhost:8000/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-02T...",
  "agents_count": 3,
  "version": "1.0.0"
}
```

### 2. Listar Agentes
```powershell
curl http://localhost:8000/agents
```

### 3. Enviar Query desde PowerShell
```powershell
$body = @{
    query = "como te llamas"
    use_agents = $true
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/query" `
    -ContentType "application/json" `
    -Body $body | ConvertTo-Json -Depth 10
```

### 4. Verificar Modelos en Ollama
```powershell
docker exec multi-ia-ollama ollama list
```

Deberías ver:
```
NAME            ID              SIZE
llama3.2        ...             2.0 GB
codellama       ...             3.8 GB
mistral         ...             4.1 GB
```

---

## 📊 Flujo de Datos

```
Usuario (Navegador)
    ↓
Frontend VR Container (localhost:3000)
    ↓ HTTP Request
Orchestrator Container (localhost:8000)
    ↓
    ├─→ Ollama Container (llama3.2) - Razonamiento propio
    ├─→ Ollama Container (codellama) - Análisis de código
    └─→ Ollama Container (mistral) - Análisis de datos
    ↓
Síntesis de respuestas
    ↓
Frontend VR (Panel de respuesta)
```

---

## 🐛 Troubleshooting

### Problema: "Cannot connect to Docker daemon"
**Solución:** Inicia Docker Desktop

```powershell
# Verificar que Docker esté corriendo
docker ps
```

### Problema: "Port already in use"
**Solución:** Detener servicios que usen los puertos 3000, 8000, 11434

```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :8000

# Cambiar puerto en docker-compose.yml si es necesario
```

### Problema: Modelos no descargados
**Solución:**
```powershell
.\Scripts\start-docker.ps1 -Pull
```

### Problema: Contenedor se reinicia constantemente
**Solución:** Ver logs para identificar error
```powershell
docker compose logs <nombre-servicio>
```

### Problema: "Out of memory"
**Solución:** Aumentar memoria de Docker Desktop
- Docker Desktop → Settings → Resources → Memory
- Mínimo 8GB recomendado, 12GB ideal

---

## 🔧 Configuración Avanzada

### Cambiar Puerto del Frontend
Edita `docker-compose.yml`:
```yaml
frontend-vr:
  ports:
    - "3001:3000"  # Cambia 3001 por el puerto deseado
```

### Modo Full (con ChromaDB y Redis)
```powershell
.\Scripts\start-docker.ps1 -Full
```

Servicios adicionales:
- ChromaDB: http://localhost:8100
- Redis: localhost:6379

### Persistencia de Datos
Los datos se guardan en:
```
data/
  ├── models/     - Modelos de Ollama (10GB)
  ├── chromadb/   - Base vectorial
  └── redis/      - Cache
```

Para limpiar todo:
```powershell
.\Scripts\start-docker.ps1 -Down
Remove-Item -Recurse -Force .\data
```

---

## 📝 Desarrollo con Docker

### Hot Reload Habilitado
Los cambios en código se reflejan automáticamente:
- **Orchestrator:** FastAPI auto-reload
- **Frontend:** Vite HMR

### Editar Código en VSCode
Edita archivos localmente, los cambios se sincronizan al contenedor via volumes:
```yaml
volumes:
  - ./Api/orchestrator:/app      # Orchestrator
  - ./App/frontend-vr:/app       # Frontend
```

### Reconstruir después de cambios en Dockerfile
```powershell
.\Scripts\start-docker.ps1 -Build -Down
.\Scripts\start-docker.ps1
```

---

## 🎯 Próximos Pasos

1. ✅ Iniciar sistema con Docker
2. ✅ Descargar modelos de IA
3. ✅ Probar queries desde el frontend
4. 🔄 Agregar más agentes desde la UI
5. 🔄 Implementar ChromaDB para memoria
6. 🔄 Agregar WebSockets para streaming

---

## 📚 Referencias

- **Docker Compose:** https://docs.docker.com/compose/
- **Ollama Docker:** https://hub.docker.com/r/ollama/ollama
- **FastAPI Docker:** https://fastapi.tiangolo.com/deployment/docker/
- **Vite Docker:** https://vitejs.dev/guide/

---

## 🆘 Soporte

Si encuentras problemas:
1. Revisa los logs: `.\Scripts\start-docker.ps1 -Logs`
2. Verifica Docker Desktop está corriendo
3. Asegúrate de tener espacio suficiente
4. Revisa el archivo `Docs/QUICKSTART.md` para más detalles
