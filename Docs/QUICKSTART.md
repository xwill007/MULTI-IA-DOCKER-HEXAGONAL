# 🚀 Guía de Inicio Rápido - Orquestador Multi-IA

## Requisitos Previos

### 1. Ollama (Motor de IA)
Ollama debe estar instalado y corriendo con los modelos descargados.

**Instalar Ollama:**
```powershell
# Descarga desde: https://ollama.ai/download
# O usando winget:
winget install Ollama.Ollama
```

**Descargar modelos:**
```powershell
ollama pull llama3.2    # 2GB - Conversación general
ollama pull codellama   # 3.8GB - Análisis de código  
ollama pull mistral     # 4.1GB - Análisis de datos
```

**Verificar Ollama:**
```powershell
# Debe responder con la versión
ollama --version

# Verificar que los modelos estén instalados
ollama list
```

### 2. Python 3.11+
```powershell
python --version  # Debe ser 3.11 o superior
```

### 3. Node.js (para frontend)
```powershell
node --version   # Ya instalado según tu setup
```

---

## 🎯 Pasos para Iniciar el Sistema Completo

### Opción A: Inicio Automático (Recomendado)

Desde la raíz del proyecto:

```powershell
# Terminal 1 - Iniciar Orquestador Backend
.\Scripts\start-orchestrator-dev.ps1

# Terminal 2 - Iniciar Frontend VR (en otra terminal)
.\Scripts\start-front-dev.ps1
```

### Opción B: Inicio Manual

**Terminal 1 - Backend:**
```powershell
cd Api\orchestrator
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```powershell
cd App\frontend-vr
npm install
npm run dev
```

---

## ✅ Verificación del Sistema

### 1. Verificar Ollama
```powershell
# Debe devolver "Ollama is running"
curl http://localhost:11434
```

### 2. Verificar Orquestador
```powershell
# Debe devolver {"status":"healthy",...}
curl http://localhost:8000/health
```

### 3. Verificar Frontend
Abre http://localhost:3000 en el navegador

---

## 🔧 Configuración del Frontend

En `App/frontend-vr/src/config.js`:

```javascript
export const CONFIG = {
    API_BASE_URL: 'http://localhost:8000',
    
    // Cambiar según disponibilidad del backend:
    MOCK_MODE: false,  // false = usa backend real
                       // true  = usa datos simulados
    // ...
}
```

---

## 🧪 Probar el Sistema

### 1. Desde el Frontend VR

1. Abre http://localhost:3000
2. Espera a que cargue la escena VR
3. Verás:
   - Orquestador dorado en el centro
   - 3 agentes orbitando (azul, morado, naranja)
   
4. **Hacer una pregunta:**
   - Click en el campo de texto
   - Escribe: "como te llamas"
   - Click en "SEND CUSTOM QUERY"
   - Espera ~3-5 segundos
   - Aparecerá un panel con:
     - Respuesta del orquestador
     - Respuestas de los 3 agentes IA
     - Síntesis final

5. **Atajos de teclado:**
   - `Q` - Mostrar/ocultar panel de queries
   - `C` - Mostrar/ocultar creador de agentes
   - `M` - Toggle modo Mock on/off

### 2. Desde la API (Swagger)

Abre http://localhost:8000/docs

**Endpoints disponibles:**

- `GET /health` - Estado del sistema
- `GET /agents` - Listar agentes
- `POST /query` - Enviar query
  ```json
  {
    "query": "como te llamas",
    "use_agents": true
  }
  ```

### 3. Desde PowerShell

```powershell
# Query simple
$body = @{
    query = "como te llamas"
    use_agents = $true
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/query" `
    -ContentType "application/json" `
    -Body $body
```

---

## 📊 Flujo de Procesamiento

```
Usuario → Frontend VR
            ↓
    Query: "como te llamas"
            ↓
    Orquestador (FastAPI)
            ↓
    ┌───────┴────────┐
    ↓                ↓
1. Razonamiento   2. Consulta Agentes (paralelo)
   Propio             ├─ Code Analyzer (codellama)
   (llama3.2)         ├─ Data Analyst (mistral)
                      └─ Conversation Agent (llama3.2)
            ↓
    3. Síntesis de Respuestas
            ↓
    Respuesta Final → Frontend VR
```

---

## 🎮 Modo VR

Click en el botón **"VR MODE"** (esquina inferior izquierda) para entrar en modo inmersivo con visor VR.

---

## 🐛 Troubleshooting

### "Connection refused" en el frontend

**Causa:** Backend no está corriendo o Ollama no está activo

**Solución:**
```powershell
# Verificar Ollama
curl http://localhost:11434

# Si no responde, iniciar Ollama
ollama serve

# Verificar Backend
curl http://localhost:8000/health

# Si no responde, iniciar backend
.\Scripts\start-orchestrator-dev.ps1
```

### "Model not found" en el backend

**Causa:** Modelos de Ollama no descargados

**Solución:**
```powershell
ollama pull llama3.2
ollama pull codellama
ollama pull mistral
```

### Frontend en modo Mock

**Causa:** `MOCK_MODE: true` en config.js

**Solución:**
```javascript
// En App/frontend-vr/src/config.js
MOCK_MODE: false,  // Cambiar a false
```

Recargar navegador con Ctrl+F5

---

## 📝 Ejemplo de Query Completa

**Query:** "Analiza la calidad de este código"

**Respuesta esperada:**

```
Respuesta del Orquestador:
Para analizar calidad de código necesito ver el código específico...

Perspectivas de Agentes Especializados:

• Code Analyzer (codellama): 
  El análisis de calidad incluye métricas de complejidad ciclomática,
  adherencia a principios SOLID, cobertura de tests...

• Data Analyst (mistral):
  Desde la perspectiva de análisis, evaluaría métricas cuantitativas
  como LOC, duplicación, deuda técnica...

• Conversation Agent (llama3.2):
  Para ayudarte mejor, ¿podrías compartir el código que quieres
  analizar?

Síntesis: Se consultaron 3 agentes especializados. Las respuestas
convergen en proporcionar una perspectiva integral de tu consulta.
```

---

## 🎯 Siguiente Paso

Una vez verificado que todo funciona, puedes:

1. ✅ Crear nuevos agentes desde el frontend (botón C)
2. ✅ Hacer queries complejas
3. ✅ Dockerizar el sistema completo
4. ✅ Agregar ChromaDB para memoria vectorial
5. ✅ Implementar WebSockets para respuestas en tiempo real

---

## 📚 Recursos

- **Ollama Docs:** https://ollama.ai/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **A-Frame Docs:** https://aframe.io/docs
- **Proyecto GitHub:** https://github.com/xwill007/MULTI-IA-DOCKER-HEXAGONAL
