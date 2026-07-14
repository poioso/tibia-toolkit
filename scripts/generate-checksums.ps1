[CmdletBinding()]
param(
    [string]$InputPath,
    [string]$OutputPath,
    [switch]$IncludeAll
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $InputPath) { $InputPath = Join-Path $projectRoot 'dist\tibia-toolkit-release' }
if (-not (Test-Path -LiteralPath $InputPath -PathType Container)) { throw "Diretorio inexistente: $InputPath" }
if (-not $OutputPath) { $OutputPath = Join-Path $InputPath 'SHA256SUMS.txt' }

$allFiles = Get-ChildItem -LiteralPath $InputPath -Recurse -File |
    Where-Object { $_.FullName -ne (Resolve-Path -LiteralPath $OutputPath -ErrorAction SilentlyContinue) }
$files = if ($IncludeAll) {
    $allFiles
} else {
    $allFiles | Where-Object {
        $_.DirectoryName -eq (Resolve-Path -LiteralPath $InputPath).Path -and
        $_.Name -ne 'builder-debug.yml' -and
        $_.Extension -in @('.exe', '.blockmap', '.yml')
    }
}
$files = $files | Sort-Object FullName

if ($files.Count -eq 0) { throw 'Nenhum arquivo de release encontrado para hash.' }

$lines = foreach ($file in $files) {
    $relative = $file.FullName.Substring((Resolve-Path -LiteralPath $InputPath).Path.Length).TrimStart('\')
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash *$relative"
}

Set-Content -LiteralPath $OutputPath -Value $lines -Encoding utf8
Write-Host "Checksums gravados em: $OutputPath"
