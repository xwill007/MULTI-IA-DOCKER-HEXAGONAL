#!/usr/bin/env pwsh
<#
.SYNOPSIS
Script para probar persistencia de agentes
.DESCRIPTION
Crea un agente de prueba, verifica que se guardó en registry.json, 
verifica sincronización, y luego lo limpia
#>

param(
    [string]$ApiBase = "http://localhost:8000",
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

Write-Host "`n=== Agent Persistence Test ===" -ForegroundColor Cyan

# 1. Create test agent
Write-Host "`n[1/5] Creating test agent..." -ForegroundColor Yellow
$createPayload = @{
    name = "test-$(Get-Random)"
    model = "mistral"
    capabilities = @("testing", "validation")
    internet_access = $false
} | ConvertTo-Json

try {
    $createResponse = Invoke-WebRequest -Uri "$ApiBase/agents" `
        -Method POST `
        -ContentType "application/json" `
        -Body $createPayload `
        -TimeoutSec 10 `
        -SkipHttpErrorCheck
    
    if ($createResponse.StatusCode -eq 200) {
        $agent = $createResponse.Content | ConvertFrom-Json
        $agentId = $agent.id
        Write-Host "✓ Agent created: $agentId" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create agent (HTTP $($createResponse.StatusCode))" -ForegroundColor Red
        Write-Host $createResponse.Content
        exit 1
    }
} catch {
    Write-Host "✗ Error creating agent: $_" -ForegroundColor Red
    exit 1
}

# 2. Verify in registry.json
Write-Host "`n[2/5] Checking registry.json..." -ForegroundColor Yellow
try {
    $registryPath = "data/agents/registry.json"
    if (Test-Path $registryPath) {
        $registry = Get-Content $registryPath | ConvertFrom-Json
        if ($registry.PSObject.Properties.Name -contains $agentId) {
            Write-Host "✓ Agent found in registry.json" -ForegroundColor Green
        } else {
            Write-Host "✗ Agent NOT in registry.json (IDs: $($registry.PSObject.Properties.Name -join ', '))" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✗ registry.json not found at $registryPath" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error reading registry: $_" -ForegroundColor Red
    exit 1
}

# 3. Verify via GET /agents
Write-Host "`n[3/5] Querying GET /agents..." -ForegroundColor Yellow
try {
    $listResponse = Invoke-WebRequest -Uri "$ApiBase/agents" `
        -Method GET `
        -TimeoutSec 10 `
        -SkipHttpErrorCheck
    
    if ($listResponse.StatusCode -eq 200) {
        $agents = $listResponse.Content | ConvertFrom-Json
        $found = $agents | Where-Object { $_.id -eq $agentId }
        if ($found) {
            Write-Host "✓ Agent in GET /agents response" -ForegroundColor Green
        } else {
            Write-Host "✗ Agent NOT in GET /agents response" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✗ Failed to list agents (HTTP $($listResponse.StatusCode))" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error listing agents: $_" -ForegroundColor Red
    exit 1
}

# 4. Check sync status
Write-Host "`n[4/5] Checking POST /agents/sync..." -ForegroundColor Yellow
try {
    $syncResponse = Invoke-WebRequest -Uri "$ApiBase/agents/sync" `
        -Method POST `
        -TimeoutSec 10 `
        -SkipHttpErrorCheck
    
    if ($syncResponse.StatusCode -eq 200) {
        $syncStatus = $syncResponse.Content | ConvertFrom-Json
        if ($syncStatus.synced) {
            Write-Host "✓ Agents synced (Memory: $($syncStatus.agents_in_memory), File: $($syncStatus.agents_in_file))" -ForegroundColor Green
        } else {
            Write-Host "⚠ Agents NOT synced! (Memory: $($syncStatus.agents_in_memory), File: $($syncStatus.agents_in_file))" -ForegroundColor Yellow
            Write-Host "   Memory-only: $($syncStatus.memory_only -join ', ')" -ForegroundColor Gray
            Write-Host "   File-only: $($syncStatus.file_only -join ', ')" -ForegroundColor Gray
        }
    } else {
        Write-Host "✗ Failed to check sync (HTTP $($syncResponse.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error checking sync: $_" -ForegroundColor Red
}

# 5. Verify persistence endpoint
Write-Host "`n[5/5] Verifying via GET /agents/verify/{id}..." -ForegroundColor Yellow
try {
    $verifyResponse = Invoke-WebRequest -Uri "$ApiBase/agents/verify/$agentId" `
        -Method GET `
        -TimeoutSec 10 `
        -SkipHttpErrorCheck
    
    if ($verifyResponse.StatusCode -eq 200) {
        $verifyStatus = $verifyResponse.Content | ConvertFrom-Json
        Write-Host "✓ Agent persistence check:" -ForegroundColor Green
        Write-Host "  - In memory: $($verifyStatus.in_memory)" -ForegroundColor Gray
        Write-Host "  - In file: $($verifyStatus.in_file)" -ForegroundColor Gray
        Write-Host "  - Synced: $($verifyStatus.synced)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Verify failed (HTTP $($verifyResponse.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error verifying: $_" -ForegroundColor Red
}

# Cleanup
if (-not $SkipCleanup) {
    Write-Host "`n[Cleanup] Removing test agent from registry.json..." -ForegroundColor Yellow
    try {
        if (Test-Path $registryPath) {
            $registry = Get-Content $registryPath | ConvertFrom-Json
            if ($registry.PSObject.Properties.Name -contains $agentId) {
                $registry.PSObject.Properties.Remove($agentId)
                $registry | ConvertTo-Json | Set-Content $registryPath
                Write-Host "✓ Test agent removed" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "⚠ Could not clean up: $_" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
