<#
Script: start-all-dev.ps1
Objetivo: levantar stack de desarrollo local
 - Infra Docker: ollama, redis, postgres
 - Backend local con uvicorn --reload
 - Frontend local con Vite (hot reload)
#>

param(
    [switch]$Help,
    [switch]$SkipDeps
)

if ($Help) {
    Write-Host "=== MULTI-IA - DESARROLLO COMPLETO ===" -ForegroundColor Yellow
    Write-Host "Uso: .\start-all-dev.ps1 [-SkipDeps]" -ForegroundColor White
    Write-Host "Servicios:" -ForegroundColor White
    Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Backend:   http://localhost:8000" -ForegroundColor Cyan
    Write-Host "  Swagger:   http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "  Ollama:    http://localhost:11434" -ForegroundColor Gray
    Write-Host "  Postgres:  localhost:5432" -ForegroundColor Gray
    Write-Host "  Redis:     localhost:6379" -ForegroundColor Gray
    exit 0
}

$ErrorActionPreference = "Stop"

# Paths
$repoRoot = Split-Path $PSScriptRoot -Parent
$orchestratorPath = Join-Path $repoRoot "Api\orchestrator"
$frontendPath = Join-Path $repoRoot "App\frontend-vr"
$infraPath = Join-Path $repoRoot "Infrastructure"

# 1) Docker infra (sin frontend/orchestrator en contenedor)
try { docker compose stop frontend-vr orchestrator | Out-Null } catch { }
docker compose up -d ollama redis postgres
Start-Sleep -Seconds 3

# 2) Backend prep
if (-not (Test-Path $orchestratorPath)) { throw "No se encontró Api/orchestrator" }
Push-Location $orchestratorPath
if (-not (Test-Path "venv")) { python -m venv venv }
& "venv\Scripts\Activate.ps1"
if (-not $SkipDeps) {
    python -m pip install --upgrade pip --quiet
    python -m pip install -r requirements.txt --quiet
}
Pop-Location

# 3) Frontend prep
if (-not (Test-Path $frontendPath)) { throw "No se encontró App/frontend-vr" }
Push-Location $frontendPath
if (-not (Test-Path "node_modules") -and -not $SkipDeps) { npm install }
Pop-Location

# 4) Entorno backend
$env:STORAGE_TYPE = "hybrid"
$env:OLLAMA_BASE_URL = "http://localhost:11434"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/ias_db"
$env:REDIS_TTL_SECONDS = "3600"
$env:REDIS_MAX_MESSAGES = "20"
$env:PYTHONPATH = "$orchestratorPath;$infraPath"
$env:INFRA_PATH = $infraPath

# 5) Lanzar backend en job
$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    & "venv\Scripts\Activate.ps1"
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $orchestratorPath
Write-Host "[Backend] Job $($backendJob.Id) iniciado" -ForegroundColor Cyan

Start-Sleep -Seconds 2

# 6) Lanzar frontend en job
$frontendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run dev
} -ArgumentList $frontendPath
Write-Host "[Frontend] Job $($frontendJob.Id) iniciado" -ForegroundColor Magenta

Write-Host "Stack dev listo: http://localhost:3000 (front), http://localhost:8000 (back)" -ForegroundColor Green
Write-Host "Ctrl+C para detener jobs locales. Infra Docker sigue corriendo." -ForegroundColor Yellow

# Monitoreo simple
try {
    while ($true) {
        Receive-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
        Receive-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
} finally {
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "Jobs locales detenidos. Usa .\\Scripts\\start-docker.ps1 -Down para bajar Docker" -ForegroundColor Gray
}
