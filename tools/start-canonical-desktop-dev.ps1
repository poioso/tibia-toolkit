<#
Starts only the canonical development Electron runtime for local homologation.
It never targets an installed release or a production endpoint.
#>
param(
  [ValidateRange(0, 65535)]
  [int]$RemoteDebuggingPort = 0
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$node = "C:\Users\monte\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (!(Test-Path -LiteralPath $node)) { throw "Canonical Node runtime was not found." }

# The migration can leave the regular Electron junction without its downloaded
# binary. Select the first local CLI that can actually resolve Electron.
$electronCli = $null
$electronCandidates = @(
  (Join-Path $root "node_modules\electron\cli.js"),
  (Join-Path $root "node_modules\.ignored\electron\cli.js")
)
foreach ($candidate in $electronCandidates) {
  if (!(Test-Path -LiteralPath $candidate)) { continue }
  try {
    & $node $candidate --version *> $null
    if ($LASTEXITCODE -eq 0) {
      $electronCli = $candidate
      break
    }
  } catch {
    # Try the next local installation.
  }
}
if (!$electronCli) { throw "A working Electron installation was not found in the development workspace." }

$arguments = @('"' + $electronCli + '"')
if ($RemoteDebuggingPort -gt 0) {
  $arguments += "--remote-debugging-port=$RemoteDebuggingPort"
}
$arguments += "."

Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden
