param(
    [Parameter(Mandatory = $true)]
    [Int64]$Hwnd
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ToolkitWindowBoundsNative
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$handle = [IntPtr]$Hwnd
$windowRect = New-Object ToolkitWindowBoundsNative+RECT
$clientRect = New-Object ToolkitWindowBoundsNative+RECT

if (-not [ToolkitWindowBoundsNative]::GetWindowRect($handle, [ref]$windowRect)) {
    Write-Output "null"
    exit 0
}

$topLeft = New-Object ToolkitWindowBoundsNative+POINT
$bottomRight = New-Object ToolkitWindowBoundsNative+POINT
$hasClient = [ToolkitWindowBoundsNative]::GetClientRect($handle, [ref]$clientRect)

if ($hasClient) {
    $topLeft.X = $clientRect.Left
    $topLeft.Y = $clientRect.Top
    $bottomRight.X = $clientRect.Right
    $bottomRight.Y = $clientRect.Bottom
    $hasClient = [ToolkitWindowBoundsNative]::ClientToScreen($handle, [ref]$topLeft) -and
        [ToolkitWindowBoundsNative]::ClientToScreen($handle, [ref]$bottomRight)
}

$titleBuilder = New-Object System.Text.StringBuilder 512
[ToolkitWindowBoundsNative]::GetWindowText($handle, $titleBuilder, $titleBuilder.Capacity) | Out-Null
$processId = [uint32]0
[ToolkitWindowBoundsNative]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
$processName = ""

try {
    $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName
} catch {
}

[pscustomobject]@{
    hwnd = $Hwnd
    title = $titleBuilder.ToString()
    processName = $processName
    isVisible = [ToolkitWindowBoundsNative]::IsWindowVisible($handle)
    bounds = @{
        x = $windowRect.Left
        y = $windowRect.Top
        width = $windowRect.Right - $windowRect.Left
        height = $windowRect.Bottom - $windowRect.Top
    }
    clientBounds = if ($hasClient) {
        @{
            x = $topLeft.X
            y = $topLeft.Y
            width = $bottomRight.X - $topLeft.X
            height = $bottomRight.Y - $topLeft.Y
        }
    } else {
        $null
    }
} | ConvertTo-Json -Compress -Depth 4
