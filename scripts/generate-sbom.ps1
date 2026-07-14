[CmdletBinding()]
param([string]$OutputPath = 'artifacts\sbom\npm.spdx.json')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$resolvedOutput = Join-Path $projectRoot $OutputPath
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null

npm sbom --package-lock-only --sbom-format=spdx --omit=dev | Set-Content -LiteralPath $resolvedOutput -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o SBOM SPDX das dependencias npm.' }
Write-Host "SBOM SPDX gravado em: $resolvedOutput"
