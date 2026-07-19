[CmdletBinding()]
param(
    [string]$ReleaseDirectory,
    [string]$ExpectedVersion,
    [switch]$AllowUnsigned
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ReleaseDirectory) { $ReleaseDirectory = Join-Path $projectRoot 'dist\tibia-toolkit-release' }
if (-not $ExpectedVersion) { $ExpectedVersion = (Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version }

if (-not (Test-Path -LiteralPath $ReleaseDirectory -PathType Container)) { throw "Diretorio de release nao encontrado: $ReleaseDirectory" }
if ($ExpectedVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') { throw "Versao SemVer invalida: $ExpectedVersion" }

$targets = @(
    (Join-Path $ReleaseDirectory "Tibia Toolkit Setup $ExpectedVersion.exe"),
    (Join-Path $ReleaseDirectory 'win-unpacked\Tibia Toolkit.exe'),
    (Join-Path $ReleaseDirectory 'win-unpacked\resources\app\desktop\screen-vision-native\publish\win-x64\ScreenVision.NativeHost.exe'),
    (Join-Path $ReleaseDirectory 'latest.yml')
)

foreach ($target in $targets) {
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Arquivo obrigatorio ausente: $target" }
}

$installerPath = $targets[0]
$manifestPath = $targets[3]
$manifest = Get-Content -Raw -LiteralPath $manifestPath
$manifestHash = [regex]::Match($manifest, '(?m)^sha512:\s*(?<value>\S+)$').Groups['value'].Value
$manifestSize = [regex]::Match($manifest, '(?m)^\s+size:\s*(?<value>\d+)\s*$').Groups['value'].Value
$installerHash = [Convert]::ToBase64String([System.Security.Cryptography.SHA512]::Create().ComputeHash([System.IO.File]::ReadAllBytes($installerPath)))
$installerSize = (Get-Item -LiteralPath $installerPath).Length
if (-not $manifestHash -or $manifestHash -ne $installerHash) { throw 'latest.yml nao corresponde ao SHA-512 do instalador.' }
if (-not $manifestSize -or [Int64]$manifestSize -ne $installerSize) { throw 'latest.yml nao corresponde ao tamanho do instalador.' }

if ($manifest -notmatch '(?m)^releaseNotesByLocale:\s*$') {
    throw 'latest.yml nao possui releaseNotesByLocale.'
}
foreach ($locale in @('pt-BR', 'en', 'de')) {
    $localePattern = '(?m)^\s{2}["'']?' + [regex]::Escape($locale) + '["'']?:\s*\|-\s*$'
    if ($manifest -notmatch $localePattern) {
        throw "latest.yml nao possui notas localizadas para $locale."
    }
}

foreach ($target in $targets | Where-Object { $_ -like '*.exe' }) {
    $signature = Get-AuthenticodeSignature -LiteralPath $target
    Write-Host ("{0}: {1}" -f (Split-Path -Leaf $target), $signature.Status)
    if ($signature.Status -ne 'Valid' -and -not $AllowUnsigned) {
        throw "Assinatura Authenticode invalida ou ausente: $target"
    }
}

Write-Host "Estrutura de release validada: $ReleaseDirectory"
