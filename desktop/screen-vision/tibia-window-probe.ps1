Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class TibiaWindowProbeNative
{
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$process = Get-Process -Name client -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like 'Tibia*' } |
    Select-Object -First 1

if (-not $process) {
    Write-Output "null"
    exit 0
}

$rect = New-Object TibiaWindowProbeNative+RECT
[TibiaWindowProbeNative]::GetWindowRect($process.MainWindowHandle, [ref]$rect) | Out-Null

[pscustomobject]@{
    hwnd = [int64]$process.MainWindowHandle
    processName = $process.ProcessName
    title = $process.MainWindowTitle
    isVisible = [TibiaWindowProbeNative]::IsWindowVisible($process.MainWindowHandle)
    isMaximized = [TibiaWindowProbeNative]::IsZoomed($process.MainWindowHandle)
    bounds = @{
        x = $rect.Left
        y = $rect.Top
        width = $rect.Right - $rect.Left
        height = $rect.Bottom - $rect.Top
    }
} | ConvertTo-Json -Compress
