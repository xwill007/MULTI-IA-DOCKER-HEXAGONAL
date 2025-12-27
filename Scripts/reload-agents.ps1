# Script simple para recargar agentes desde registry.json
Write-Host "`n=== FIX: Recarga de Agentes ===" -ForegroundColor Cyan

$baseUrl = "http://localhost:8000"

# Contar agentes en archivo
$registryPath = ".\Api\orchestrator\data\agents\registry.json"
$fileAgents = Get-Content $registryPath | ConvertFrom-Json
$fileCount = ($fileAgents.PSObject.Properties | Measure-Object).Count

# Contar agentes en memoria
$memoryAgents = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Get
$memoryCount = $memoryAgents.Count

Write-Host "Agentes en archivo: $fileCount" -ForegroundColor Yellow
Write-Host "Agentes en memoria: $memoryCount" -ForegroundColor Yellow

if ($fileCount -eq $memoryCount) {
    Write-Host "`nYa estan sincronizados!" -ForegroundColor Green
    exit 0
}

Write-Host "`nDesincronizados! Intentando recargar..." -ForegroundColor Red

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/agents/reload" -Method Post
    Write-Host "`nRecarga exitosa!" -ForegroundColor Green
    Write-Host "Antes: $($result.agents_before) | Despues: $($result.agents_after)" -ForegroundColor Gray
} catch {
    Write-Host "`nEndpoint /reload no disponible" -ForegroundColor Red
    Write-Host "REINICIA EL BACKEND MANUALMENTE" -ForegroundColor Yellow
    Write-Host ".\Scripts\start-orchestrator-dev.ps1" -ForegroundColor White
}
