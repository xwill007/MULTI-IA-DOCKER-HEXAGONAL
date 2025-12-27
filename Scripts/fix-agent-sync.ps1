# Script para solucionar desincronización de agentes
# Cuando GET /agents no muestra agentes que están en registry.json

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  FIX: Desincronización de Agentes" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:8000"

# 1. Verificar backend
Write-Host "1. Verificando backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Backend conectado" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend NO responde" -ForegroundColor Red
    Write-Host "   Iniciando backend..." -ForegroundColor Yellow
    
    # Arrancar backend
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\Scripts\start-orchestrator-dev.ps1"
    Write-Host "   ⏳ Esperando 10 segundos a que arranque..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# 2. Verificar estado actual
Write-Host "`n2. Estado actual:" -ForegroundColor Yellow

# Agentes en archivo
$registryPath = ".\Api\orchestrator\data\agents\registry.json"
$fileAgents = Get-Content $registryPath | ConvertFrom-Json
$fileCount = ($fileAgents.PSObject.Properties | Measure-Object).Count
Write-Host "   Agentes en registry.json: $fileCount" -ForegroundColor Gray

# Agentes en memoria (GET /agents)
try {
    $memoryAgents = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Get
    $memoryCount = $memoryAgents.Count
    Write-Host "   Agentes en GET /agents: $memoryCount" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error al obtener agentes de API" -ForegroundColor Red
    exit 1
}

# 3. Detectar desincronización
if ($fileCount -ne $memoryCount) {
    Write-Host "`n   ⚠️  DESINCRONIZACIÓN DETECTADA" -ForegroundColor Yellow
    Write-Host "   Archivo: $fileCount agentes" -ForegroundColor Yellow
    Write-Host "   Memoria: $memoryCount agentes" -ForegroundColor Yellow
    Write-Host "   Diferencia: $($fileCount - $memoryCount) agentes faltantes`n" -ForegroundColor Yellow
    
    # Mostrar agentes faltantes
    $fileIds = $fileAgents.PSObject.Properties.Name
    $memoryIds = $memoryAgents | ForEach-Object { $_.id }
    $missing = $fileIds | Where-Object { $_ -notin $memoryIds }
    
    if ($missing) {
        Write-Host "   Agentes en archivo pero NO en memoria:" -ForegroundColor Red
        foreach ($agentId in $missing) {
            $agentData = $fileAgents.$agentId
            Write-Host "   - ${agentId}: $($agentData.name) ($($agentData.model))" -ForegroundColor Red
        }
    }
} else {
    Write-Host ""
    Write-Host "   ✅ Memoria y archivo sincronizados" -ForegroundColor Green
    Write-Host "   Total: $fileCount agentes" -ForegroundColor Gray
    exit 0
}

# 4. Intentar recargar con endpoint /reload
Write-Host "`n3. Intentando recargar agentes..." -ForegroundColor Yellow
try {
    $reload = Invoke-RestMethod -Uri "$baseUrl/agents/reload" -Method Post
    Write-Host "   ✅ Recarga exitosa" -ForegroundColor Green
    Write-Host "   Agentes antes: $($reload.agents_before)" -ForegroundColor Gray
    Write-Host "   Agentes después: $($reload.agents_after)" -ForegroundColor Gray
    Write-Host "   Cargados: $($reload.agents -join ', ')" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Endpoint /reload no disponible" -ForegroundColor Yellow
    Write-Host "   Necesitas reiniciar el backend manualmente" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   PASOS MANUALES:" -ForegroundColor Cyan
    Write-Host '   1. Detener backend actual (Ctrl+C)' -ForegroundColor White
    Write-Host '   2. Ejecutar start-orchestrator-dev.ps1' -ForegroundColor White
    Write-Host '   3. Ejecutar POST /agents/reload' -ForegroundColor White
    Write-Host ""
    exit 1
}

# 5. Verificar sincronización
Write-Host "`n4. Verificando sincronización después de recargar..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$memoryAgentsAfter = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Get
$memoryCountAfter = $memoryAgentsAfter.Count

if ($fileCount -eq $memoryCountAfter) {
    Write-Host "   ✅ SINCRONIZACIÓN EXITOSA" -ForegroundColor Green
    Write-Host "   Archivo: $fileCount agentes" -ForegroundColor Gray
    Write-Host "   Memoria: $memoryCountAfter agentes" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Aún hay desincronización" -ForegroundColor Red
    Write-Host "   Archivo: $fileCount" -ForegroundColor Red
    Write-Host "   Memoria: $memoryCountAfter" -ForegroundColor Red
    Write-Host "`n   Reinicia el backend manualmente" -ForegroundColor Yellow
}

# 6. Listar todos los agentes
Write-Host "`n5. Agentes disponibles ahora:" -ForegroundColor Yellow
foreach ($agent in $memoryAgentsAfter) {
    Write-Host "   - $($agent.id): $($agent.name) ($($agent.model))" -ForegroundColor Gray
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  PROCESO COMPLETADO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
