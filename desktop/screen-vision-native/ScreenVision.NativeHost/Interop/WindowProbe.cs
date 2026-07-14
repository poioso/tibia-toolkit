using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Interop;

internal static class WindowProbe
{
    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    internal struct RectNative
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PointNative
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WindowPlacement
    {
        public int Length;
        public int Flags;
        public int ShowCommand;
        public PointNative MinPosition;
        public PointNative MaxPosition;
        public RectNative NormalPosition;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hwnd, StringBuilder buffer, int maxCount);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hwnd, out RectNative rect);

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hwnd, out RectNative rect);

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hwnd, ref PointNative point);

    [DllImport("user32.dll")]
    private static extern bool ScreenToClient(IntPtr hwnd, ref PointNative point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(PointNative point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr hwnd, uint command);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);

    [DllImport("user32.dll")]
    private static extern bool GetWindowPlacement(IntPtr hwnd, ref WindowPlacement placement);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool IsZoomed(IntPtr hwnd);

    private const int ShowMinimized = 2;
    private const uint GaRoot = 2;
    private const uint GwHwndNext = 2;

    internal static IntPtr FindTibiaWindow()
    {
        var bestHwnd = IntPtr.Zero;
        var bestScore = int.MinValue;

        EnumWindows((hwnd, _) =>
        {
            if (!IsWindowVisible(hwnd))
            {
                return true;
            }

            var title = ReadWindowTitle(hwnd);

            if (!IsTibiaTitle(title))
            {
                return true;
            }

            var score = ScoreTibiaCandidate(hwnd, title);

            if (score > bestScore)
            {
                bestScore = score;
                bestHwnd = hwnd;
            }

            return true;
        }, IntPtr.Zero);

        return bestHwnd;
    }

    internal static TibiaWindowInfo? GetTibiaWindowInfo()
    {
        var hwnd = FindTibiaWindow();

        if (hwnd == IntPtr.Zero)
        {
            return null;
        }

        if (!GetWindowRect(hwnd, out var rect))
        {
            return null;
        }

        var title = ReadWindowTitle(hwnd);
        var isForeground = GetForegroundWindow() == hwnd;
        var isMinimized = false;
        var isMaximized = false;
        var placement = new WindowPlacement { Length = Marshal.SizeOf<WindowPlacement>() };
        var clientBounds = ResolveClientBounds(hwnd);

        if (GetWindowPlacement(hwnd, ref placement))
        {
            isMinimized = placement.ShowCommand == ShowMinimized;
        }

        isMaximized = !isMinimized && IsZoomed(hwnd);

        GetWindowThreadProcessId(hwnd, out var processId);
        var processName = ResolveProcessName(processId);

        return new TibiaWindowInfo
        {
            Hwnd = hwnd.ToInt64(),
            Title = title,
            ProcessName = processName,
            IsVisible = IsWindowVisible(hwnd),
            IsForeground = isForeground,
            IsMinimized = isMinimized,
            IsMaximized = isMaximized,
            Bounds = new RectInfo
            {
                X = rect.Left,
                Y = rect.Top,
                Width = rect.Right - rect.Left,
                Height = rect.Bottom - rect.Top
            },
            ClientBounds = clientBounds
        };
    }

    internal static IntPtr GetTopLevelWindowFromScreenPoint(int x, int y)
    {
        var point = new PointNative
        {
            X = x,
            Y = y
        };

        return NormalizeTopLevelWindow(WindowFromPoint(point));
    }

    internal static bool IsTibiaDirectlyBehindControllers(IEnumerable<long> controllerHwnds, IEnumerable<int>? allowedProcessIds = null)
    {
        var normalizedControllers = controllerHwnds
            .Select((value) => NormalizeTopLevelWindow(new IntPtr(value)))
            .Where((hwnd) => hwnd != IntPtr.Zero)
            .Distinct()
            .ToHashSet();
        var allowedPids = (allowedProcessIds ?? [])
            .Where((pid) => pid > 0)
            .Distinct()
            .ToHashSet();

        if (normalizedControllers.Count == 0)
        {
            return false;
        }

        var tibiaHwnd = NormalizeTopLevelWindow(FindTibiaWindow());

        if (tibiaHwnd == IntPtr.Zero)
        {
            return false;
        }

        var foregroundHwnd = NormalizeTopLevelWindow(GetForegroundWindow());

        if (foregroundHwnd == IntPtr.Zero || !normalizedControllers.Contains(foregroundHwnd))
        {
            return false;
        }

        var sampleBounds = ResolveClientBounds(tibiaHwnd);

        if (sampleBounds.Width <= 0 || sampleBounds.Height <= 0)
        {
            if (!GetWindowRect(tibiaHwnd, out var tibiaRect))
            {
                return false;
            }

            sampleBounds = new RectInfo
            {
                X = tibiaRect.Left,
                Y = tibiaRect.Top,
                Width = Math.Max(0, tibiaRect.Right - tibiaRect.Left),
                Height = Math.Max(0, tibiaRect.Bottom - tibiaRect.Top)
            };
        }

        var hasVisibleTibiaPoint = false;

        foreach (var samplePoint in EnumerateSamplePoints(sampleBounds))
        {
            var topWindow = NormalizeTopLevelWindow(WindowFromPoint(samplePoint));

            if (topWindow == IntPtr.Zero || !IsWindowVisible(topWindow))
            {
                continue;
            }

            if (topWindow == tibiaHwnd)
            {
                hasVisibleTibiaPoint = true;
                continue;
            }

            if (normalizedControllers.Contains(topWindow))
            {
                continue;
            }

            GetWindowThreadProcessId(topWindow, out var topProcessId);

            if (topProcessId > 0 && allowedPids.Contains((int)topProcessId))
            {
                continue;
            }

            return false;
        }

        return hasVisibleTibiaPoint;
    }

    internal static bool IsAnyControllerFocused(IEnumerable<long> controllerHwnds)
    {
        var normalizedControllers = controllerHwnds
            .Select((value) => NormalizeTopLevelWindow(new IntPtr(value)))
            .Where((hwnd) => hwnd != IntPtr.Zero)
            .Distinct()
            .ToHashSet();

        if (normalizedControllers.Count == 0)
        {
            return false;
        }

        var foregroundHwnd = NormalizeTopLevelWindow(GetForegroundWindow());

        if (foregroundHwnd == IntPtr.Zero)
        {
            return false;
        }

        return normalizedControllers.Contains(foregroundHwnd);
    }

    internal static string GetForegroundProcessName()
    {
        var foregroundHwnd = NormalizeTopLevelWindow(GetForegroundWindow());

        if (foregroundHwnd == IntPtr.Zero)
        {
            return "";
        }

        GetWindowThreadProcessId(foregroundHwnd, out var processId);
        return ResolveProcessName(processId);
    }

    private static RectInfo ResolveClientBounds(IntPtr hwnd)
    {
        if (!GetClientRect(hwnd, out var clientRect))
        {
            return new RectInfo();
        }

        var topLeft = new PointNative
        {
            X = clientRect.Left,
            Y = clientRect.Top
        };

        var bottomRight = new PointNative
        {
            X = clientRect.Right,
            Y = clientRect.Bottom
        };

        if (!ClientToScreen(hwnd, ref topLeft) || !ClientToScreen(hwnd, ref bottomRight))
        {
            return new RectInfo();
        }

        return new RectInfo
        {
            X = topLeft.X,
            Y = topLeft.Y,
            Width = Math.Max(0, bottomRight.X - topLeft.X),
            Height = Math.Max(0, bottomRight.Y - topLeft.Y)
        };
    }

    internal static RectInfo? ConvertScreenToClientBounds(IntPtr hwnd, RectInfo bounds)
    {
        if (hwnd == IntPtr.Zero || bounds.Width <= 0 || bounds.Height <= 0)
        {
            return null;
        }

        var topLeft = new PointNative
        {
            X = bounds.X,
            Y = bounds.Y
        };

        var bottomRight = new PointNative
        {
            X = bounds.X + bounds.Width,
            Y = bounds.Y + bounds.Height
        };

        if (!ScreenToClient(hwnd, ref topLeft) || !ScreenToClient(hwnd, ref bottomRight))
        {
            return null;
        }

        return new RectInfo
        {
            X = topLeft.X,
            Y = topLeft.Y,
            Width = Math.Max(0, bottomRight.X - topLeft.X),
            Height = Math.Max(0, bottomRight.Y - topLeft.Y)
        };
    }

    private static string ReadWindowTitle(IntPtr hwnd)
    {
        var buffer = new StringBuilder(256);
        GetWindowText(hwnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static int ScoreTibiaCandidate(IntPtr hwnd, string title)
    {
        var score = 0;
        var placement = new WindowPlacement { Length = Marshal.SizeOf<WindowPlacement>() };
        var isMinimized = false;
        var isMaximized = false;

        if (GetWindowPlacement(hwnd, ref placement))
        {
            isMinimized = placement.ShowCommand == ShowMinimized;
        }

        isMaximized = !isMinimized && IsZoomed(hwnd);

        GetWindowThreadProcessId(hwnd, out var processId);
        var processName = ResolveProcessName(processId);

        if (isMaximized)
        {
            score += 5000;
        }

        if (!isMinimized)
        {
            score += 1000;
        }

        if (string.Equals(processName, "client", StringComparison.OrdinalIgnoreCase))
        {
            score += 3000;
        }
        else if (string.Equals(processName, "Tibia", StringComparison.OrdinalIgnoreCase))
        {
            score += 1000;
        }

        if (GetForegroundWindow() == hwnd)
        {
            score += 750;
        }

        if (GetWindowRect(hwnd, out var rect))
        {
            var width = Math.Max(0, rect.Right - rect.Left);
            var height = Math.Max(0, rect.Bottom - rect.Top);
            score += Math.Min(2000, (width * height) / 25000);
        }

        if (title.Equals("Tibia", StringComparison.OrdinalIgnoreCase))
        {
            score += 250;
        }

        return score;
    }

    private static IEnumerable<PointNative> EnumerateSamplePoints(RectInfo bounds)
    {
        var width = Math.Max(1, bounds.Width);
        var height = Math.Max(1, bounds.Height);
        var columns = Math.Clamp(width / 140, 3, 12);
        var rows = Math.Clamp(height / 140, 3, 8);
        var seen = new HashSet<string>(StringComparer.Ordinal);

        for (var row = 0; row < rows; row += 1)
        {
            for (var column = 0; column < columns; column += 1)
            {
                var x = bounds.X + (int)Math.Round(((column + 0.5d) * width) / columns);
                var y = bounds.Y + (int)Math.Round(((row + 0.5d) * height) / rows);

                x = Math.Clamp(x, bounds.X, bounds.X + width - 1);
                y = Math.Clamp(y, bounds.Y, bounds.Y + height - 1);

                var key = $"{x}:{y}";

                if (!seen.Add(key))
                {
                    continue;
                }

                yield return new PointNative
                {
                    X = x,
                    Y = y
                };
            }
        }
    }

    private static IntPtr NormalizeTopLevelWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return IntPtr.Zero;
        }

        var root = GetAncestor(hwnd, GaRoot);
        return root == IntPtr.Zero ? hwnd : root;
    }

    private static bool IsTibiaTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return false;
        }

        if (!(title.Equals("Tibia", StringComparison.OrdinalIgnoreCase)
              || title.StartsWith("Tibia - ", StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        return !title.Contains("Chrome", StringComparison.OrdinalIgnoreCase)
            && !title.Contains("Firefox", StringComparison.OrdinalIgnoreCase)
            && !title.Contains("Edge", StringComparison.OrdinalIgnoreCase)
            && !title.Contains("www.", StringComparison.OrdinalIgnoreCase)
            && !title.Contains(".com", StringComparison.OrdinalIgnoreCase)
            && !title.Contains("http", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveProcessName(uint processId)
    {
        if (processId == 0)
        {
            return "";
        }

        try
        {
            return Process.GetProcessById((int)processId).ProcessName;
        }
        catch
        {
            return "";
        }
    }
}
