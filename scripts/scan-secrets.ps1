[CmdletBinding()]
param([string]$Path)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Path)) {
    $Path = Split-Path -Parent $PSScriptRoot
}

$Path = (Resolve-Path -LiteralPath $Path).Path
$ignoredDirectories = @('.git', 'node_modules', 'dist', 'artifacts', 'release', 'coverage', '.cache')
$patterns = @(
    '(?i)-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----',
    '\bgh[pousr]_[A-Za-z0-9_]{20,}\b',
    '\bgithub_pat_[A-Za-z0-9_]{20,}\b',
    '\bAKIA[0-9A-Z]{16}\b',
    '\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b',
    '(?i)(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["''][^"'']{12,}["'']'
)

$files = Get-ChildItem -LiteralPath $Path -Recurse -File | Where-Object {
    $parts = $_.FullName.Substring((Resolve-Path -LiteralPath $Path).Path.Length).TrimStart('\').Split('\')
    -not ($parts | Where-Object { $ignoredDirectories -contains $_ }) -and $_.Length -lt 10MB
}

$matches = foreach ($file in $files) {
    foreach ($pattern in $patterns) {
        Select-String -LiteralPath $file.FullName -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | ForEach-Object {
            [PSCustomObject]@{ Path = $_.Path; Line = $_.LineNumber; Pattern = $pattern }
        }
    }
}

if ($matches) {
    $matches | Format-Table -AutoSize | Out-String | Write-Host
    throw 'Possiveis segredos encontrados. Revise antes de publicar.'
}

Write-Host 'Scan basico concluido sem correspondencias. O Gitleaks do CI continua obrigatorio.'
