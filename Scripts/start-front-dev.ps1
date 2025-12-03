# Script para desarrollo local del frontend VR
# Hot reload automático sin Docker

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  FRONTEND VR - MODO DESARROLLO" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$frontendPath = "$PSScriptRoot\..\App\frontend-vr"

# Verificar si existe node_modules
if (-not (Test-Path "$frontendPath\node_modules")) {
    Write-Host "[1/2] Instalando dependencias..." -ForegroundColor White
    Push-Location $frontendPath
    npm install
    Pop-Location
    Write-Host "  [OK] Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "[1/2] Dependencias ya instaladas" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/2] Iniciando servidor de desarrollo..." -ForegroundColor White
Write-Host "  Hot reload ACTIVO - Los cambios se verán automáticamente" -ForegroundColor Yellow
Write-Host ""
Write-Host "URLs disponibles:" -ForegroundColor White
Write-Host "  Frontend VR:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Orchestrator: http://localhost:8000 (Docker)" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
Write-Host ""

# Cambiar al directorio del frontend
Push-Location $frontendPath

# Iniciar Vite en modo desarrollo
npm run dev

Pop-Location