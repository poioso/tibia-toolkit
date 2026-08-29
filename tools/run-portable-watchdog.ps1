param(
  [string]$PortableRoot = "C:\Users\monte\Desktop\Tibia Toolkit Portable",
  [int]$DurationSeconds = 20
)

$ErrorActionPreference = "Stop"
$exePath = [System.IO.Path]::GetFullPath((Join-Path $PortableRoot "Tibia Toolkit Portable.exe"))
if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
  throw "Executavel portatil ausente: $exePath"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $projectRoot ".local\diagnostics"
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "portable-watchdog-$stamp.csv"
"timestamp,pid,role,cpu_percent,private_mb,action" | Set-Content -LiteralPath $logPath -Encoding UTF8

function Get-PortableProcesses {
  $all = Get-CimInstance Win32_Process
  $roots = @($all | Where-Object { $_.ExecutablePath -and ([System.IO.Path]::GetFullPath($_.ExecutablePath) -eq $exePath) })
  if (-not $roots) { return @() }
  $ids = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($root in $roots) { [void]$ids.Add([int]$root.ProcessId) }
  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($process in $all) {
      if ($ids.Contains([int]$process.ParentProcessId) -and $ids.Add([int]$process.ProcessId)) { $changed = $true }
    }
  }
  return @($all | Where-Object { $ids.Contains([int]$_.ProcessId) })
}

function Stop-PortableProcesses([string]$reason) {
  foreach ($process in (Get-PortableProcesses | Sort-Object ProcessId -Descending)) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  "$(Get-Date -Format o),0,watchdog,0,0,$reason" | Add-Content -LiteralPath $logPath -Encoding UTF8
}

$started = Start-Process -FilePath $exePath -WorkingDirectory $PortableRoot -PassThru
$previousCpu = @{}
$overLimitSamples = 0
$startedAt = Get-Date

try {
  while (((Get-Date) - $startedAt).TotalSeconds -lt $DurationSeconds) {
    Start-Sleep -Milliseconds 500
    $portable = @(Get-PortableProcesses)
    if (-not $portable) { break }
    $totalCpu = 0.0
    $totalPrivateMb = 0.0
    $mainElectronCpu = 0.0
    foreach ($processInfo in $portable) {
      $process = Get-Process -Id $processInfo.ProcessId -ErrorAction SilentlyContinue
      if (-not $process) { continue }
      $cpuNow = [double]($process.CPU ?? 0)
      $cpuBefore = [double]($previousCpu[$process.Id] ?? $cpuNow)
      $cpuPercent = [math]::Max(0, (($cpuNow - $cpuBefore) / 0.5) * 100)
      $previousCpu[$process.Id] = $cpuNow
      $privateMb = [math]::Round($process.PrivateMemorySize64 / 1MB, 1)
      $role = if ($processInfo.CommandLine -match '--type=([^\s\"]+)') { $Matches[1] } else { "main" }
      $totalCpu += $cpuPercent
      $totalPrivateMb += $privateMb
      if ($role -eq "main" -and $processInfo.ExecutablePath -and ([System.IO.Path]::GetFullPath($processInfo.ExecutablePath) -eq $exePath)) {
        $mainElectronCpu = [math]::Max($mainElectronCpu, $cpuPercent)
      }
      "$(Get-Date -Format o),$($process.Id),$role,$([math]::Round($cpuPercent,1)),$privateMb,sample" | Add-Content -LiteralPath $logPath -Encoding UTF8
    }
    if ($mainElectronCpu -gt 80 -or $totalCpu -gt 180 -or $totalPrivateMb -gt 1536) { $overLimitSamples += 1 } else { $overLimitSamples = 0 }
    if ($overLimitSamples -ge 3) {
      Stop-PortableProcesses "terminated-heavy"
      throw "Watchdog encerrou o portatil: CPU ou memoria permaneceu acima do limite. Log: $logPath"
    }
  }
} finally {
  Stop-PortableProcesses "test-complete"
}

Write-Output $logPath
