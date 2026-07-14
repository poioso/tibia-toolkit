[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $AllowDirty) {
    $changes = git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel verificar o estado do Git.' }
    if ($changes) { throw 'O repositorio possui alteracoes. Revise e confirme-as antes de gerar uma release.' }
}

if (-not $SkipInstall) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci falhou.' }
}

npm run check
if ($LASTEXITCODE -ne 0) { throw 'A verificacao da fonte publica falhou.' }

npm run build:installer
if ($LASTEXITCODE -ne 0) { throw 'A compilacao do instalador falhou.' }

& "$PSScriptRoot\verify-release.ps1" -AllowUnsigned
& "$PSScriptRoot\generate-checksums.ps1" -InputPath (Join-Path $projectRoot 'dist\tibia-toolkit-release')

Write-Host 'Release local concluida como artefato nao assinado para verificacao.'
