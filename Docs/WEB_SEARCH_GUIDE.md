# 🌐 Guía de Búsqueda Web en Agentes

## Implementación Completada

La funcionalidad de búsqueda web permite que cualquier agente pueda:
- ✅ Descargar contenido de URLs específicas antes de responder
- ✅ Enriquecer su contexto con información actualizada de internet
- ✅ Respetar whitelists de dominios permitidos por seguridad
- ✅ Integrar datos web en sus respuestas de forma transparente

---

## 🎯 Configuración de un Agente con Internet

### Parámetros Clave

```json
{
  "id": "agent-XXX",
  "internet_access": true,           // ✅ DEBE estar en true
  "allowed_domains": [                // 🔒 Solo estos dominios
    "coindesk.com",
    "cointelegraph.com",
    "blockchain.com"
  ],
  "target_urls": [                    // 🎯 URLs a descargar
    "https://www.coindesk.com/price/bitcoin",
    "https://cointelegraph.com/bitcoin-price"
  ],
  "search_terms": [                   // 🔍 (Futuro) Términos de búsqueda
    "bitcoin",
    "cryptocurrency news"
  ]
}
```

### Flujo de Ejecución

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuario envía query: "¿Precio de Bitcoin?"          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 2. query_single_agent() verifica internet_access       │
│    ✓ agent.internet_access == true                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 3. _fetch_web_context() procesa                        │
│    - Valida dominios con _domain_allowed()             │
│    - Descarga target_urls con fetch_url_text()         │
│    - Limpia HTML a texto plano (max 3000 chars)        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Enriquece el prompt                                  │
│    Query original:                                      │
│      "¿Precio de Bitcoin?"                              │
│                                                         │
│    + Contexto web:                                      │
│      === INFORMACIÓN ACTUALIZADA ===                    │
│      Fuente: coindesk.com                               │
│      Bitcoin: $97,450 (+3.2%)...                        │
│      === FIN ===                                        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Ollama genera respuesta con datos reales            │
│    "Según CoinDesk, Bitcoin está en $97,450..."        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Ejemplo: Agent-008 Configurado

El agente **agent-008** ("Crypto News Researcher") está pre-configurado:

```json
{
  "id": "agent-008",
  "name": "Crypto News Researcher",
  "model": "llama3.2",
  "status": "active",
  "internet_access": true,  // ✅ Activado
  "allowed_domains": [
    "coindesk.com",
    "cointelegraph.com",
    "blockchain.com"
  ],
  "target_urls": [
    "https://www.coindesk.com/price/bitcoin",
    "https://cointelegraph.com/bitcoin-price"
  ]
}
```

### Probar con Script

```powershell
# Ejecutar orquestador en modo dev
.\Scripts\start-orchestrator-dev.ps1

# En otra terminal, probar agente web
.\Scripts\test-web-agent.ps1
```

---

## 🔍 Estrategias de Búsqueda

### A. URLs Fijas (Implementado ✅)

**Cuándo usar:** Monitorear sitios específicos conocidos

```json
"target_urls": [
  "https://www.coindesk.com/markets",
  "https://api.blockchain.com/v3/exchange/tickers/BTC-USD"
]
```

**Ventajas:**
- Control total sobre fuentes
- Sin necesidad de APIs externas
- Resultados consistentes

### B. Búsqueda Dinámica (Futuro 🚧)

**Cuándo usar:** Respuestas flexibles a queries variadas

```json
"search_terms": ["bitcoin", "price", "news"],
"internet_access": true
```

**Requiere:** Integrar Google/Bing/Serper API en `_fetch_web_context()`

---

## 🔒 Seguridad y Límites

### Validación de Dominios

```python
def _domain_allowed(url: str, allowed_domains: List[str]) -> bool:
    """Solo permite dominios en la whitelist del agente"""
    host = extract_host(url)
    return host in allowed_domains  # Bloquea otros dominios
```

### Límites de Tamaño

- **Por snippet:** 4000 caracteres (HTML limpio)
- **Total contexto:** 3000 caracteres combinados
- **Timeout:** 20 segundos por URL

### Variables de Entorno

```env
# .env del proyecto
DOMAINS_WHITELIST=localhost,127.0.0.1,coindesk.com,cointelegraph.com
WEB_CONNECTOR_TIMEOUT=20
WEB_CACHE_TTL=300  # 5 minutos de cache
```

---

## 📊 Logs y Debugging

### Logs Clave

```log
INFO - Querying agent: Crypto News Researcher (llama3.2) - internet_access: True
INFO - Fetching web context for agent Crypto News Researcher
INFO - Fetching URL: https://www.coindesk.com/price/bitcoin
INFO - Web context retrieved: 2847 characters
```

### Si No Funciona

1. **Verifica `internet_access: true`**
   ```bash
   curl http://localhost:8000/agents | jq '.[] | select(.id=="agent-008") | .internet_access'
   # Debe retornar: true
   ```

2. **Revisa dominios permitidos**
   ```python
   # En logs, busca:
   WARNING - URL https://example.com not in allowed_domains for agent...
   ```

3. **Prueba descarga directa**
   ```bash
   curl "http://localhost:8000/web/fetch?url=https://www.coindesk.com"
   ```

4. **Verifica Ollama**
   ```bash
   curl http://localhost:11434/api/tags
   # Debe listar "llama3.2"
   ```

---

## 🚀 Crear Nuevos Agentes Web

### Endpoint: POST /agents

```bash
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ethereum Analyst",
    "model": "mistral",
    "capabilities": ["web_research", "eth_analysis"],
    "internet_access": true,
    "allowed_domains": ["ethereum.org", "etherscan.io"],
    "target_urls": ["https://ethereum.org/en/"],
    "search_terms": ["ethereum", "eth"]
  }'
```

### Frontend VR

En la UI de creación de agentes:
1. ✅ Marcar checkbox "Internet Access"
2. 📝 Agregar dominios en "Allowed Domains" (separados por comas)
3. 🔗 Agregar URLs en "Target URLs" (una por línea)

---

## 📁 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| [`main.py`](../Api/orchestrator/main.py) | + `_domain_allowed()`, `_fetch_web_context()`, modificado `query_single_agent()` |
| [`registry.json`](../Api/orchestrator/data/agents/registry.json) | Configurado `agent-008` con `internet_access: true` |
| [`test-web-agent.ps1`](test-web-agent.ps1) | Script de pruebas end-to-end |

---

## 🎓 Ejemplos de Uso

### Query Financiera
```json
POST /query
{
  "query": "¿Debo comprar Bitcoin ahora?",
  "use_agents": true
}
```

**Respuesta esperada:**
```
Según los datos de CoinDesk actualizados hace 5 minutos, Bitcoin está 
en $97,450 con un incremento del 3.2% en las últimas 24 horas. 
CoinTelegraph reporta sentimiento alcista debido a...

RECOMENDACIÓN: COMPRAR
RAZÓN: Tendencia alcista confirmada + bajo volumen de ventas
```

### Query Técnica
```json
{
  "query": "Últimas vulnerabilidades en smart contracts de Ethereum",
  "use_agents": true
}
```

**El agente descargará:** ethereum.org → limpiará HTML → incluirá en contexto

---

## ✅ Checklist de Implementación

- [x] Función `_domain_allowed()` valida whitelists
- [x] Función `_fetch_web_context()` descarga URLs
- [x] `query_single_agent()` enriquece prompts automáticamente
- [x] Agent-008 configurado con `internet_access: true`
- [x] Target URLs de CoinDesk y CoinTelegraph
- [x] Script de prueba `test-web-agent.ps1`
- [ ] Integrar API de búsqueda (Google/Serper) para `search_terms`
- [ ] Rate limiting por agente
- [ ] Cache persistente (Redis) para URLs frecuentes

---

## 🔜 Próximas Mejoras

1. **Búsqueda Semántica:** Integrar Serper/Google Custom Search
2. **Scraping Avanzado:** BeautifulSoup para parseo específico (tablas, precios)
3. **Caché Distribuido:** Redis para compartir entre instancias
4. **Rate Limits:** Throttling por dominio/agente
5. **WebSockets:** Actualización en tiempo real de precios

---

**Fecha:** 30 Diciembre 2025  
**Estado:** ✅ Funcional - Listo para producción  
**Autor:** Sistema Multi-IA Orchestrator
