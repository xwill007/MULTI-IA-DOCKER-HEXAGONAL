# Test Web-Enabled Agent (agent-008)
# Este script prueba la funcionalidad de busqueda web del agente configurado

$baseUrl = "http://localhost:8000"
$agentId = "agent-008"

Write-Host "=== Test de Agente con Acceso a Internet ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar salud del servicio
Write-Host "[1/4] Verificando health del orquestador..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "[OK] Servicio activo" -ForegroundColor Green
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Orquestador no disponible en $baseUrl" -ForegroundColor Red
    Write-Host "  Ejecuta: .\Scripts\start-orchestrator-dev.ps1" -ForegroundColor Yellow
    exit 1
}

# 2. Verificar configuracion del agente
Write-Host ""
Write-Host "[2/4] Verificando configuracion de agent-008..." -ForegroundColor Yellow
try {
    $agents = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Get
    $agent008 = $agents | Where-Object { $_.id -eq $agentId }
    
    if ($agent008) {
        Write-Host "[OK] Agent-008 encontrado" -ForegroundColor Green
        Write-Host "  Nombre: $($agent008.name)" -ForegroundColor Gray
        Write-Host "  Modelo: $($agent008.model)" -ForegroundColor Gray
        Write-Host "  Internet Access: $($agent008.internet_access)" -ForegroundColor $(if ($agent008.internet_access) { "Green" } else { "Red" })
        Write-Host "  Dominios permitidos: $($agent008.allowed_domains -join ', ')" -ForegroundColor Gray
        Write-Host "  URLs objetivo: $($agent008.target_urls.Count) configuradas" -ForegroundColor Gray
        
        if (-not $agent008.internet_access) {
            Write-Host "[WARN] internet_access esta en false!" -ForegroundColor Red
            Write-Host "  El agente no descargara contenido web." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[ERROR] Agent-008 no encontrado en el registro" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Error al obtener lista de agentes: $_" -ForegroundColor Red
    exit 1
}

# 3. Probar endpoint de web fetch manualmente
Write-Host ""
Write-Host "[3/4] Probando descarga web directa..." -ForegroundColor Yellow
try {
    $testUrl = "https://www.coindesk.com"
    Write-Host "  Intentando: $testUrl" -ForegroundColor Gray
    
    $webResult = Invoke-RestMethod -Uri "$baseUrl/web/fetch?url=$testUrl" -Method Get -TimeoutSec 30
    
    if ($webResult.status_code -eq 200) {
        Write-Host "[OK] Descarga exitosa" -ForegroundColor Green
        Write-Host "  Content-Type: $($webResult.content_type)" -ForegroundColor Gray
        $snippetPreview = $webResult.content_snippet.Substring(0, [Math]::Min(100, $webResult.content_snippet.Length))
        Write-Host "  Snippet: $snippetPreview..." -ForegroundColor Gray
    } else {
        Write-Host "[ERROR] Descarga fallo: HTTP $($webResult.status_code)" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERROR] Error en descarga web: $_" -ForegroundColor Red
    Write-Host "  Verifica conectividad y que DOMAINS_WHITELIST incluya 'coindesk.com'" -ForegroundColor Yellow
}

# 4. Consulta real al agente con busqueda web
Write-Host ""
Write-Host "[4/4] Enviando query al agente con busqueda web..." -ForegroundColor Yellow
Write-Host ""

$queries = @(
    "Cual es el precio actual de Bitcoin?",
    "Debo comprar o vender Ethereum hoy?",
    "Analisis de tendencias de criptomonedas"
)

foreach ($query in $queries) {
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host "Query: $query" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $body = @{
            query = $query
            use_agents = $true
        } | ConvertTo-Json
        
        $result = Invoke-RestMethod -Uri "$baseUrl/query" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
        
        Write-Host "Conversation ID: $($result.conversation_id)" -ForegroundColor Gray
        Write-Host ""
        
        # Buscar respuesta de agent-008
        $agent008Response = $result.agents_responses | Where-Object { $_.agent_id -eq $agentId }
        
        if ($agent008Response) {
            Write-Host "Respuesta de $($agent008Response.agent_name):" -ForegroundColor Green
            Write-Host $agent008Response.response -ForegroundColor White
            Write-Host ""
            Write-Host "Status: $($agent008Response.status) | Tiempo: $($agent008Response.response_time)s" -ForegroundColor Gray
        } else {
            Write-Host "[WARN] No se recibio respuesta de agent-008" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Respuesta Final Sintetizada:" -ForegroundColor Green
        Write-Host $result.response -ForegroundColor White
        Write-Host ""
        
    } catch {
        Write-Host "[ERROR] Error en query: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=== Test Completado ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Revisa los logs del orquestador para ver:" -ForegroundColor Yellow
Write-Host "  - 'Fetching web context for agent...' (indica inicio de descarga)" -ForegroundColor Gray
Write-Host "  - 'Fetching URL: https://...' (URLs consultadas)" -ForegroundColor Gray
Write-Host "  - 'Web context retrieved: N characters' (contenido descargado)" -ForegroundColor Gray
