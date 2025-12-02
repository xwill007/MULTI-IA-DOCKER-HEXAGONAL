# Script para iniciar todo el sistema con Docker
# Autor: Multi-IA Project
# Fecha: 2025-12-02

param(
    [switch]$Build,
    [switch]$Pull,
    [switch]$Full,
    [switch]$Down,
    [switch]$Logs,
    [switch]$Help
)

if ($Help) {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host "  MULTI-IA ORCHESTRATOR - DOCKER" -ForegroundColor Yellow
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso:" -ForegroundColor White
    Write-Host "  .\start-docker.ps1              Iniciar servicios básicos" -ForegroundColor Green
    Write-Host "  .\start-docker.ps1 -Build       Reconstruir imágenes" -ForegroundColor Green
    Write-Host "  .\start-docker.ps1 -Pull        Descargar modelos IA" -ForegroundColor Green
    Write-Host "  .\start-docker.ps1 -Full        Iniciar con ChromaDB + Redis" -ForegroundColor Green
    Write-Host "  .\start-docker.ps1 -Down        Detener todos los servicios" -ForegroundColor Green
    Write-Host "  .\start-docker.ps1 -Logs        Ver logs en tiempo real" -ForegroundColor Green
    Write-Host ""
    Write-Host "Servicios:" -ForegroundColor White
    Write-Host "  - Ollama:       http://localhost:11434" -ForegroundColor Gray
    Write-Host "  - Orchestrator: http://localhost:8000" -ForegroundColor Gray
    Write-Host "  - Frontend VR:  http://localhost:3000" -ForegroundColor Gray
    Write-Host "  - ChromaDB:     http://localhost:8100 (con -Full)" -ForegroundColor Gray
    Write-Host "  - Redis:        localhost:6379 (con -Full)" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  MULTI-IA ORCHESTRATOR - DOCKER" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Docker
Write-Host "[1/4] Verificando Docker..." -ForegroundColor White

try {
    $dockerVersion = docker --version
    Write-Host "  [OK] $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Docker no está instalado o no está corriendo" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instala Docker Desktop desde: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Verificar Docker Compose
try {
    $composeVersion = docker compose version
    Write-Host "  [OK] $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Docker Compose no disponible" -ForegroundColor Red
    exit 1
}

# Detener servicios si se solicita
if ($Down) {
    Write-Host ""
    Write-Host "[STOP] Deteniendo servicios..." -ForegroundColor Yellow
    docker compose down
    Write-Host "  [OK] Servicios detenidos" -ForegroundColor Green
    exit 0
}

# Ver logs si se solicita
if ($Logs) {
    Write-Host ""
    Write-Host "[LOGS] Mostrando logs (Ctrl+C para salir)..." -ForegroundColor Yellow
    Write-Host ""
    docker compose logs -f
    exit 0
}

# Crear directorios necesarios
Write-Host ""
Write-Host "[2/4] Creando directorios..." -ForegroundColor White

$directories = @(
    "data\models",
    "data\chromadb",
    "data\redis"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  [OK] Creado: $dir" -ForegroundColor Green
    }
}

# Construir imágenes si se solicita
if ($Build) {
    Write-Host ""
    Write-Host "[3/4] Construyendo imágenes Docker..." -ForegroundColor White
    Write-Host "  Esto puede tomar varios minutos..." -ForegroundColor Yellow
    
    if ($Full) {
        docker compose --profile full build
    } else {
        docker compose build
    }
    
    Write-Host "  [OK] Imágenes construidas" -ForegroundColor Green
}

# Iniciar servicios
Write-Host ""
Write-Host "[4/4] Iniciando servicios..." -ForegroundColor White

if ($Full) {
    Write-Host "  Iniciando modo FULL (con ChromaDB y Redis)..." -ForegroundColor Yellow
    docker compose --profile full up -d
} else {
    Write-Host "  Iniciando servicios básicos..." -ForegroundColor Yellow
    docker compose up -d
}

# Esperar a que los servicios estén listos
Write-Host ""
Write-Host "Esperando a que los servicios estén listos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar estado
Write-Host ""
Write-Host "Estado de los servicios:" -ForegroundColor White
docker compose ps

# Descargar modelos de IA si se solicita
if ($Pull) {
    Write-Host ""
    Write-Host "[OLLAMA] Descargando modelos de IA..." -ForegroundColor Yellow
    Write-Host "  Esto descargará ~10GB, puede tomar tiempo..." -ForegroundColor Gray
    Write-Host ""
    
    $models = @("llama3.2", "codellama", "mistral")
    
    foreach ($model in $models) {
        Write-Host "  Descargando $model..." -ForegroundColor Cyan
        docker exec multi-ia-ollama ollama pull $model
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] $model descargado" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Falló descarga de $model" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Modelos instalados:" -ForegroundColor White
    docker exec multi-ia-ollama ollama list
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  SISTEMA LISTO" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLs disponibles:" -ForegroundColor White
Write-Host "  Frontend VR:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Orchestrator: http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Swagger API:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  Ollama:       http://localhost:11434" -ForegroundColor Yellow

if ($Full) {
    Write-Host "  ChromaDB:     http://localhost:8100" -ForegroundColor Yellow
    Write-Host "  Redis:        localhost:6379" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor White
Write-Host "  Ver logs:     .\Scripts\start-docker.ps1 -Logs" -ForegroundColor Gray
Write-Host "  Detener:      .\Scripts\start-docker.ps1 -Down" -ForegroundColor Gray
Write-Host "  Reconstruir:  .\Scripts\start-docker.ps1 -Build" -ForegroundColor Gray
Write-Host ""

if (-not $Pull) {
    Write-Host "[IMPORTANTE]" -ForegroundColor Red
    Write-Host "  No olvides descargar los modelos de IA:" -ForegroundColor Yellow
    Write-Host "  .\Scripts\start-docker.ps1 -Pull" -ForegroundColor Cyan
    Write-Host ""
}
