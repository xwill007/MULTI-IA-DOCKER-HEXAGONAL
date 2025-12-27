# Test del flujo completo de creación de agentes
# Ejecutar este script para probar la creación y persistencia

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST: Creación de Agentes - Persistencia" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:8000"

# Verificar que el backend esté corriendo
Write-Host "1. Verificando conexión con backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Backend conectado" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Backend NO está corriendo" -ForegroundColor Red
    Write-Host "   Ejecuta: .\Scripts\start-orchestrator-dev.ps1" -ForegroundColor Yellow
    exit 1
}

# Listar agentes existentes
Write-Host "`n2. Agentes existentes:" -ForegroundColor Yellow
try {
    $agents = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Get
    Write-Host "   Total: $($agents.Count) agentes" -ForegroundColor Gray
    foreach ($agent in $agents) {
        Write-Host "   - $($agent.id): $($agent.name) ($($agent.model))" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error al obtener agentes: $_" -ForegroundColor Red
    exit 1
}

# Crear nuevo agente de prueba
Write-Host "`n3. Creando nuevo agente 'Investigador'..." -ForegroundColor Yellow
$newAgent = @{
    name = "Investigador"
    model = "llama3.2"
    capabilities = @("research", "news_analysis", "trend_detection")
} | ConvertTo-Json

try {
    $created = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Post -Body $newAgent -ContentType "application/json"
    Write-Host "   ✅ Agente creado exitosamente" -ForegroundColor Green
    Write-Host "   ID: $($created.id)" -ForegroundColor Gray
    Write-Host "   Nombre: $($created.name)" -ForegroundColor Gray
    Write-Host "   Modelo: $($created.model)" -ForegroundColor Gray
    $agentId = $created.id
} catch {
    Write-Host "   ❌ Error al crear agente: $_" -ForegroundColor Red
    Write-Host "   Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

# Esperar un momento para asegurar escritura
Start-Sleep -Seconds 2

# Verificar persistencia usando el nuevo endpoint
Write-Host "`n4. Verificando persistencia..." -ForegroundColor Yellow
try {
    $verify = Invoke-RestMethod -Uri "$baseUrl/agents/verify/$agentId" -Method Get
    
    if ($verify.in_memory) {
        Write-Host "   ✅ Agente existe en memoria" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Agente NO existe en memoria" -ForegroundColor Red
    }
    
    if ($verify.in_file) {
        Write-Host "   ✅ Agente guardado en registry.json" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Agente NO está en registry.json" -ForegroundColor Red
    }
    
    if ($verify.synced) {
        Write-Host "   ✅ Memoria y archivo sincronizados" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  PROBLEMA: Memoria y archivo NO están sincronizados" -ForegroundColor Yellow
    }
    
    Write-Host "   Archivo: $($verify.file_path)" -ForegroundColor Gray
    Write-Host "   Existe: $($verify.file_exists)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ⚠️  Endpoint /verify no disponible (versión antigua del backend)" -ForegroundColor Yellow
}

# Verificar archivo directamente
Write-Host "`n5. Verificando archivo registry.json directamente..." -ForegroundColor Yellow
$registryPath = ".\Api\orchestrator\data\agents\registry.json"
if (Test-Path $registryPath) {
    Write-Host "   ✅ Archivo existe: $registryPath" -ForegroundColor Green
    
    try {
        $content = Get-Content $registryPath -Raw | ConvertFrom-Json
        $agentIds = $content.PSObject.Properties.Name
        Write-Host "   Total de agentes en archivo: $($agentIds.Count)" -ForegroundColor Gray
        
        if ($agentId -and ($agentIds -contains $agentId)) {
            Write-Host "   ✅ Agente '$agentId' encontrado en archivo" -ForegroundColor Green
        } elseif ($agentId) {
            Write-Host "   ❌ Agente '$agentId' NO está en archivo" -ForegroundColor Red
            Write-Host "   IDs en archivo: $($agentIds -join ', ')" -ForegroundColor Gray
        }
        
        # Mostrar el último agente creado
        $lastAgent = $content.PSObject.Properties | Select-Object -Last 1
        Write-Host "   Último agente en archivo: $($lastAgent.Name) - $($lastAgent.Value.name)" -ForegroundColor Gray
        
    } catch {
        Write-Host "   ❌ Error al leer archivo: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Archivo NO existe: $registryPath" -ForegroundColor Red
}

# Listar agentes después de crear
Write-Host "`n6. Agentes después de crear:" -ForegroundColor Yellow
try {
    $agentsAfter = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Get
    Write-Host "   Total: $($agentsAfter.Count) agentes" -ForegroundColor Gray
    
    $found = $false
    foreach ($agent in $agentsAfter) {
        if ($agent.name -eq "Investigador") {
            Write-Host "   ✅ 'Investigador' encontrado en lista GET /agents" -ForegroundColor Green
            Write-Host "      ID: $($agent.id), Modelo: $($agent.model), Status: $($agent.status)" -ForegroundColor Gray
            $found = $true
        }
    }
    
    if (-not $found) {
        Write-Host "   ❌ 'Investigador' NO aparece en lista GET /agents" -ForegroundColor Red
    }
    
} catch {
    Write-Host "   ❌ Error al listar agentes: $_" -ForegroundColor Red
}

# Resumen
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DEL TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nSi todos los checks están en ✅:" -ForegroundColor White
Write-Host "  - El agente se creó correctamente" -ForegroundColor Gray
Write-Host "  - Se guardó en registry.json" -ForegroundColor Gray
Write-Host "  - Al recargar el frontend, debería aparecer" -ForegroundColor Gray

Write-Host "`nSi hay ❌:" -ForegroundColor White
Write-Host "  - Revisar logs del backend en la terminal" -ForegroundColor Gray
Write-Host "  - Verificar permisos de escritura en ./Api/orchestrator/data/agents/" -ForegroundColor Gray
Write-Host "  - Verificar que STORAGE_TYPE no esté causando conflictos" -ForegroundColor Gray

Write-Host "`nPara probar en frontend:" -ForegroundColor White
Write-Host "  1. Abre http://localhost:5173" -ForegroundColor Gray
Write-Host "  2. Crea agente 'Investigador'" -ForegroundColor Gray
Write-Host "  3. Abre DevTools (F12) > Console" -ForegroundColor Gray
Write-Host "  4. Ejecuta: localStorage.getItem('api_debug_logs')" -ForegroundColor Gray
Write-Host "  5. Recarga la página (F5)" -ForegroundColor Gray
Write-Host "  6. Verifica si 'Investigador' aparece" -ForegroundColor Gray

Write-Host "`n" -ForegroundColor White
