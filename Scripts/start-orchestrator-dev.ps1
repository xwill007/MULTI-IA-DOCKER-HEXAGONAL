# Script para iniciar el Orquestador en modo desarrollo
# Autor: Multi-IA Project
# Fecha: 2025-12-02

param(
    [switch]$Help
)

if ($Help) {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host "  ORCHESTRATOR - MODO DESARROLLO" -ForegroundColor Yellow
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso: .\start-orchestrator-dev.ps1" -ForegroundColor Green
    Write-Host ""
    Write-Host "Este script:" -ForegroundColor White
    Write-Host "  1. Verifica Python 3.11+" -ForegroundColor Gray
    Write-Host "  2. Crea entorno virtual si no existe" -ForegroundColor Gray
    Write-Host "  3. Instala dependencias" -ForegroundColor Gray
    Write-Host "  4. Inicia FastAPI en http://localhost:8000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Endpoints disponibles:" -ForegroundColor White
    Write-Host "  - GET  /health        Health check" -ForegroundColor Gray
    Write-Host "  - GET  /agents        Listar agentes" -ForegroundColor Gray
    Write-Host "  - POST /agents        Crear agente" -ForegroundColor Gray
    Write-Host "  - POST /query         Procesar query" -ForegroundColor Gray
    Write-Host "  - GET  /docs          Swagger UI" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  ORCHESTRATOR - MODO DESARROLLO" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Python
Write-Host "[1/5] Verificando Python..." -ForegroundColor White

try {
    $pythonVersion = python --version 2>&1
    Write-Host "  [OK] $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Python no encontrado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instala Python 3.11+ desde: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Navegar a directorio del orquestador
$orchestratorPath = Join-Path $PSScriptRoot "..\Api\orchestrator"
if (-not (Test-Path $orchestratorPath)) {
    Write-Host "  [ERROR] Directorio orchestrator no encontrado" -ForegroundColor Red
    exit 1
}

Set-Location $orchestratorPath
Write-Host "  [OK] Directorio: $orchestratorPath" -ForegroundColor Green

# Crear entorno virtual
Write-Host ""
Write-Host "[2/5] Verificando entorno virtual..." -ForegroundColor White

$venvPath = "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "  Creando entorno virtual..." -ForegroundColor Yellow
    python -m venv $venvPath
    Write-Host "  [OK] Entorno virtual creado" -ForegroundColor Green
} else {
    Write-Host "  [OK] Entorno virtual existe" -ForegroundColor Green
}

# Activar entorno virtual
Write-Host ""
Write-Host "[3/5] Activando entorno virtual..." -ForegroundColor White

$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    & $activateScript
    Write-Host "  [OK] Entorno activado" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Script de activacion no encontrado" -ForegroundColor Red
    exit 1
}

# Instalar dependencias
Write-Host ""
Write-Host "[4/5] Instalando dependencias..." -ForegroundColor White

if (Test-Path "requirements.txt") {
    python -m pip install --upgrade pip --quiet
    python -m pip install -r requirements.txt --quiet
    Write-Host "  [OK] Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] requirements.txt no encontrado" -ForegroundColor Red
    exit 1
}

# Iniciar servidor
Write-Host ""
Write-Host "[5/5] Iniciando servidor FastAPI..." -ForegroundColor White
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  ORCHESTRATOR LISTO" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URL Base:    http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Swagger UI:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  ReDoc:       http://localhost:8000/redoc" -ForegroundColor Yellow
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Gray
Write-Host ""

# Iniciar uvicorn
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
