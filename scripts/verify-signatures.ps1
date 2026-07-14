[CmdletBinding()]
param(
    [string]$ReleaseDirectory,
    [string]$ExpectedPublisher
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ReleaseDirectory) { $ReleaseDirectory = Join-Path $projectRoot 'dist\tibia-toolkit-release' }
$version = (Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version

$targets = @(
    (Join-Path $ReleaseDirectory "Tibia Toolkit Setup $version.exe"),
    (Join-Path $ReleaseDirectory 'win-unpacked\Tibia Toolkit.exe'),
    (Join-Path $ReleaseDirectory 'win-unpacked\resources\app\desktop\screen-vision-native\publish\win-x64\ScreenVision.NativeHost.exe')
)

foreach ($target in $targets) {
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Arquivo de assinatura ausente: $target" }
    $signature = Get-AuthenticodeSignature -LiteralPath $target
    if ($signature.Status -ne 'Valid') { throw "Assinatura invalida: $target ($($signature.Status))" }
    $subject = [string]$signature.SignerCertificate.Subject
    if ($ExpectedPublisher -and $subject -notlike "*$ExpectedPublisher*") {
        throw "Publicador inesperado em ${target}: $subject"
    }
    Write-Host ("Assinatura valida: {0} | {1}" -f (Split-Path -Leaf $target), $subject)
}
