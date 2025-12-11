# Script para iniciar TODO el stack en modo desarrollo
# Backend local + Frontend hot reload + Infraestructura Docker (Ollama, Redis, Postgres)
# Autor: Multi-IA Project
# Fecha: 2025-12-11

param(
    [switch]$Help,
    [switch]$SkipDeps
)

if ($Help) {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host "  MULTI-IA - MODO DESARROLLO COMPLETO" -ForegroundColor Yellow
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso:" -ForegroundColor White
    Write-Host "  .\start-all-dev.ps1           Iniciar stack completo" -ForegroundColor Green
    Write-Host "  .\start-all-dev.ps1 -SkipDeps Saltar instalación dependencias" -ForegroundColor Green
    Write-Host ""
    Write-Host "Este script inicia:" -ForegroundColor White
    Write-Host "  1. Infraestructura Docker (Ollama, Redis, PostgreSQL)" -ForegroundColor Gray
    Write-Host "  2. Orchestrator FastAPI (local con hot reload)" -ForegroundColor Gray
    Write-Host "  3. Frontend VR Vite (local con hot reload)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Servicios resultantes:" -ForegroundColor White
    Write-Host "  - Frontend VR:  http://localhost:3000 (hot reload)" -ForegroundColor Cyan
    Write-Host "  - Orchestrator: http://localhost:8000 (hot reload)" -ForegroundColor Cyan
    Write-Host "  - Swagger API:  http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "  - Ollama:       http://localhost:11434 (Docker)" -ForegroundColor Gray
    Write-Host "  - PostgreSQL:   localhost:5432 (Docker)" -ForegroundColor Gray
    Write-Host "  - Redis:        localhost:6379 (Docker)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Presiona Ctrl+C para detener todo" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  MULTI-IA - MODO DESARROLLO COMPLETO" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# PASO 1: Verificar Docker
# ============================================================================
Write-Host "[1/6] Verificando Docker..." -ForegroundColor White

try {
    $dockerVersion = docker --version
    Write-Host "  [OK] $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Docker no está instalado" -ForegroundColor Red
    exit 1
}

try {
    $composeVersion = docker compose version
    Write-Host "  [OK] $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Docker Compose no disponible" -ForegroundColor Red
    exit 1
}

# ============================================================================
# PASO 2: Verificar Python
# ============================================================================
Write-Host ""
Write-Host "[2/6] Verificando Python..." -ForegroundColor White

try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.(\d+)\.") {
        $minorVersion = [int]$matches[1]
        if ($minorVersion -lt 11) {
            Write-Host "  [WARN] Python 3.11+ recomendado (actual: $pythonVersion)" -ForegroundColor Yellow
        } else {
            Write-Host "  [OK] $pythonVersion" -ForegroundColor Green
        }
    } else {
        Write-Host "  [OK] $pythonVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERROR] Python no encontrado" -ForegroundColor Red
    Write-Host "  Instala Python 3.11+ desde: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# PASO 3: Verificar Node.js
# ============================================================================
Write-Host ""
Write-Host "[3/6] Verificando Node.js..." -ForegroundColor White

try {
    $nodeVersion = node --version 2>&1
    Write-Host "  [OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Node.js no encontrado" -ForegroundColor Red
    Write-Host "  Instala Node.js desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

try {
    $npmVersion = npm --version 2>&1
    Write-Host "  [OK] npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] npm no encontrado" -ForegroundColor Red
    exit 1
}

# ============================================================================
# PASO 4: Iniciar Infraestructura Docker (solo servicios base)
# ============================================================================
Write-Host ""
Write-Host "[4/6] Iniciando infraestructura Docker..." -ForegroundColor White
Write-Host "  (Ollama, Redis, PostgreSQL)" -ForegroundColor Gray

# Detener frontend-vr y orchestrator containers si están corriendo
docker compose stop frontend-vr orchestrator 2>$null

# Iniciar solo servicios de infraestructura
docker compose up -d ollama redis postgres

Write-Host "  Esperando servicios de infraestructura..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar salud
$services = docker compose ps --format json | ConvertFrom-Json
$healthy = $true
foreach ($service in $services) {
    if ($service.Service -in @("ollama", "redis", "postgres")) {
        if ($service.Health -eq "healthy" -or $service.State -eq "running") {
            Write-Host "  [OK] $($service.Service) - $($service.State)" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] $($service.Service) - $($service.State)" -ForegroundColor Yellow
        }
    }
}

# ============================================================================
# PASO 5: Preparar Backend (Orchestrator)
# ============================================================================
Write-Host ""
Write-Host "[5/6] Preparando Backend (Orchestrator)..." -ForegroundColor White

$orchestratorPath = Join-Path $PSScriptRoot "..\Api\orchestrator"
if (-not (Test-Path $orchestratorPath)) {
    Write-Host "  [ERROR] Directorio orchestrator no encontrado" -ForegroundColor Red
    exit 1
}

Push-Location $orchestratorPath

# Crear entorno virtual si no existe
$venvPath = "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "  Creando entorno virtual..." -ForegroundColor Yellow
    python -m venv $venvPath
    Write-Host "  [OK] Entorno virtual creado" -ForegroundColor Green
} else {
    Write-Host "  [OK] Entorno virtual existe" -ForegroundColor Green
}

# Activar entorno virtual
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
if (-not (Test-Path $activateScript)) {
    Write-Host "  [ERROR] Script de activación no encontrado" -ForegroundColor Red
    Pop-Location
    exit 1
}

& $activateScript

# Instalar dependencias si no se salteó
if (-not $SkipDeps) {
    Write-Host "  Instalando/actualizando dependencias..." -ForegroundColor Yellow
    python -m pip install --upgrade pip --quiet
    python -m pip install -r requirements.txt --quiet
    Write-Host "  [OK] Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] Dependencias (usar -SkipDeps)" -ForegroundColor Gray
}

Pop-Location

# ============================================================================
# PASO 6: Preparar Frontend
# ============================================================================
Write-Host ""
Write-Host "[6/6] Preparando Frontend VR..." -ForegroundColor White

$frontendPath = Join-Path $PSScriptRoot "..\App\frontend-vr"
if (-not (Test-Path $frontendPath)) {
    Write-Host "  [ERROR] Directorio frontend-vr no encontrado" -ForegroundColor Red
    exit 1
}

Push-Location $frontendPath

# Instalar dependencias si no existe node_modules
if (-not (Test-Path "node_modules") -and -not $SkipDeps) {
    Write-Host "  Instalando dependencias..." -ForegroundColor Yellow
    npm install
    Write-Host "  [OK] Dependencias instaladas" -ForegroundColor Green
} elseif (-not $SkipDeps) {
    Write-Host "  [OK] Dependencias ya instaladas" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] Dependencias (usar -SkipDeps)" -ForegroundColor Gray
}

Pop-Location

# ============================================================================
# RESUMEN Y ARRANQUE
# ============================================================================
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  INICIANDO SERVICIOS DE DESARROLLO" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Infraestructura Docker:" -ForegroundColor White
Write-Host "  ✓ Ollama (http://localhost:11434)" -ForegroundColor Green
Write-Host "  ✓ PostgreSQL (localhost:5432)" -ForegroundColor Green
Write-Host "  ✓ Redis (localhost:6379)" -ForegroundColor Green
Write-Host ""
Write-Host "Servicios locales (hot reload):" -ForegroundColor White
Write-Host "  → Backend iniciando en http://localhost:8000" -ForegroundColor Yellow
Write-Host "  → Frontend iniciando en http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Variables de entorno:" -ForegroundColor White
Write-Host "  STORAGE_TYPE=hybrid" -ForegroundColor Gray
Write-Host "  OLLAMA_BASE_URL=http://localhost:11434" -ForegroundColor Gray
Write-Host "  REDIS_URL=redis://localhost:6379/0" -ForegroundColor Gray
Write-Host "  DATABASE_URL=postgresql://postgres:password@localhost:5432/ias_db" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona Ctrl+C para detener TODO" -ForegroundColor Yellow
Write-Host ""

# Configurar variables de entorno para desarrollo local
$env:STORAGE_TYPE = "hybrid"
$env:OLLAMA_BASE_URL = "http://localhost:11434"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/ias_db"
$env:REDIS_TTL_SECONDS = "3600"
$env:REDIS_MAX_MESSAGES = "20"
$env:PYTHONPATH = "$orchestratorPath;$PSScriptRoot\..\Infrastructure"
$env:INFRA_PATH = "$PSScriptRoot\..\Infrastructure"

# Función para cleanup al salir
$cleanup = {
    Write-Host ""
    Write-Host "Deteniendo servicios..." -ForegroundColor Yellow
    
    # Matar procesos hijos
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    
    Write-Host "Servicios detenidos. Infraestructura Docker sigue corriendo." -ForegroundColor Green
    Write-Host "Para detener Docker: .\Scripts\start-docker.ps1 -Down" -ForegroundColor Gray
}

Register-EngineEvent PowerShell.Exiting -Action $cleanup

# ============================================================================
# INICIAR BACKEND EN JOB
# ============================================================================
$backendJob = Start-Job -ScriptBlock {
    param($orchestratorPath, $envVars)
    
    Set-Location $orchestratorPath
    
    # Configurar variables de entorno
    foreach ($key in $envVars.Keys) {
        Set-Item -Path "env:$key" -Value $envVars[$key]
    }
    
    # Activar venv
    & ".\venv\Scripts\Activate.ps1"
    
    # Iniciar uvicorn
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $orchestratorPath, @{
    STORAGE_TYPE = $env:STORAGE_TYPE
    OLLAMA_BASE_URL = $env:OLLAMA_BASE_URL
    REDIS_URL = $env:REDIS_URL
    DATABASE_URL = $env:DATABASE_URL
    REDIS_TTL_SECONDS = $env:REDIS_TTL_SECONDS
    REDIS_MAX_MESSAGES = $env:REDIS_MAX_MESSAGES
    PYTHONPATH = $env:PYTHONPATH
    INFRA_PATH = $env:INFRA_PATH
}

Write-Host "[Backend] Job iniciado (ID: $($backendJob.Id))" -ForegroundColor Cyan

# Esperar un poco para que el backend arranque
Start-Sleep -Seconds 3

# ============================================================================
# INICIAR FRONTEND EN JOB
# ============================================================================
$frontendJob = Start-Job -ScriptBlock {
    param($frontendPath)
    Set-Location $frontendPath
    npm run dev
} -ArgumentList $frontendPath

Write-Host "[Frontend] Job iniciado (ID: $($frontendJob.Id))" -ForegroundColor Cyan

# ============================================================================
# MONITOREO DE LOGS
# ============================================================================
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  LOGS EN TIEMPO REAL" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Mostrar logs intercalados
$lastBackendOutput = ""
$lastFrontendOutput = ""

try {
    while ($true) {
        # Backend logs
        $backendOutput = Receive-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
        if ($backendOutput -and $backendOutput -ne $lastBackendOutput) {
            Write-Host "[BACKEND] " -ForegroundColor Cyan -NoNewline
            Write-Host $backendOutput
            $lastBackendOutput = $backendOutput
        }
        
        # Frontend logs
        $frontendOutput = Receive-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
        if ($frontendOutput -and $frontendOutput -ne $lastFrontendOutput) {
            Write-Host "[FRONTEND] " -ForegroundColor Magenta -NoNewline
            Write-Host $frontendOutput
            $lastFrontendOutput = $frontendOutput
        }
        
        # Verificar si los jobs siguen vivos
        $backendState = (Get-Job -Id $backendJob.Id).State
        $frontendState = (Get-Job -Id $frontendJob.Id).State
        
        if ($backendState -eq "Failed" -or $backendState -eq "Stopped") {
            Write-Host ""
            Write-Host "[ERROR] Backend job falló o se detuvo" -ForegroundColor Red
            break
        }
        
        if ($frontendState -eq "Failed" -or $frontendState -eq "Stopped") {
            Write-Host ""
            Write-Host "[ERROR] Frontend job falló o se detuvo" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Milliseconds 500
    }
} finally {
    # Cleanup
    Write-Host ""
    Write-Host "Limpiando..." -ForegroundColor Yellow
    
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host "  SERVICIOS DETENIDOS" -ForegroundColor Yellow
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Infraestructura Docker sigue corriendo." -ForegroundColor Green
    Write-Host "Para detenerla: .\Scripts\start-docker.ps1 -Down" -ForegroundColor Gray
    Write-Host ""
}
