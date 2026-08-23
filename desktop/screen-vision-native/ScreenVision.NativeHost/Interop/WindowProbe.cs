using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Interop;

internal static class WindowProbe
{
    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    private static readonly Dictionary<string, TibiaWindowInfo> LastVerifiedGameWindows = new(StringComparer.OrdinalIgnoreCase);

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

    internal static TibiaWindowInfo? GetGameWindowInfo(string? sourceGame, long knownHwnd = 0, int knownProcessId = 0, string? knownTitle = null)
    {
        var game = NormalizeSourceGame(sourceGame);
        if (game == "tibia")
        {
            return GetTibiaWindowInfo();
        }

        // RubinOT's protected DirectX window can be deliberately omitted from
        // EnumWindows. When the player is actively using it, the foreground
        // HWND remains an OS-provided, directly verifiable source. Do not
        // guess or fall back to a screenshot if this proof is unavailable.
        if (game == "rubinot")
        {
            var foregroundInfo = GetWindowInfo(GetForegroundWindow());
            if (foregroundInfo is not null && IsGameCandidate(game, foregroundInfo))
            {
                RememberVerifiedGameWindow(game, foregroundInfo);
                return foregroundInfo;
            }
        }

        TibiaWindowInfo? best = null;
        var bestScore = int.MinValue;
        EnumWindows((hwnd, _) =>
        {
            if (!IsWindowVisible(hwnd))
            {
                return true;
            }

            var info = GetWindowInfo(hwnd);
            if (info is null || !IsGameCandidate(game, info))
            {
                return true;
            }

            var score = (info.IsForeground ? 1_000 : 0)
                + (info.IsMaximized ? 100 : 0)
                + Math.Max(0, info.Bounds.Width * info.Bounds.Height / 100_000);
            if (score > bestScore)
            {
                best = info;
                bestScore = score;
            }

            return true;
        }, IntPtr.Zero);

        if (best is not null)
        {
            RememberVerifiedGameWindow(game, best);
            return best;
        }

        // The main process only supplies this hint after this exact window
        // was verified by this session. This keeps RubinOT usable after a
        // Native Host restart without weakening the strict executable/title
        // proof into a process-name guess.
        var restoredKnownWindow = TryRestoreKnownGameWindow(game, knownHwnd, knownProcessId, knownTitle);
        if (restoredKnownWindow is not null)
        {
            RememberVerifiedGameWindow(game, restoredKnownWindow);
            return restoredKnownWindow;
        }

        // Some protected RubinOT windows intentionally disappear from
        // enumeration once the Toolkit receives focus. A previously verified
        // HWND remains safe to use only while it is still a visible,
        // non-minimized window; it is never guessed from a process name.
        return TryGetLastVerifiedGameWindow(game);
    }

    internal static void ObserveForegroundGameWindow()
    {
        var info = GetWindowInfo(GetForegroundWindow());
        if (info is null)
        {
            return;
        }

        foreach (var game in new[] { "medivia", "rubinot" })
        {
            if (IsGameCandidate(game, info))
            {
                RememberVerifiedGameWindow(game, info);
                return;
            }
        }
    }

    private static void RememberVerifiedGameWindow(string game, TibiaWindowInfo info)
    {
        LastVerifiedGameWindows[game] = info;
    }

    private static TibiaWindowInfo? TryGetLastVerifiedGameWindow(string game)
    {
        if (!LastVerifiedGameWindows.TryGetValue(game, out var known) || known.Hwnd == 0)
        {
            return null;
        }

        var refreshed = GetWindowInfo(new IntPtr(known.Hwnd));
        if (refreshed is null || !refreshed.IsVisible || refreshed.IsMinimized)
        {
            LastVerifiedGameWindows.Remove(game);
            return null;
        }

        if (IsGameCandidate(game, refreshed))
        {
            RememberVerifiedGameWindow(game, refreshed);
            return refreshed;
        }

        // Protected RubinOT can withhold title/process metadata after losing
        // foreground. The HWND itself was already verified against the strict
        // title and executable rule above, so preserve that proof for this
        // host session while the same window remains usable.
        if (game == "rubinot")
        {
            return new TibiaWindowInfo
            {
                Hwnd = refreshed.Hwnd,
                Title = known.Title,
                ProcessName = known.ProcessName,
                IsVisible = refreshed.IsVisible,
                IsForeground = refreshed.IsForeground,
                IsMinimized = refreshed.IsMinimized,
                IsMaximized = refreshed.IsMaximized,
                Bounds = refreshed.Bounds,
                ClientBounds = refreshed.ClientBounds
            };
        }

        LastVerifiedGameWindows.Remove(game);
        return null;
    }

    private static TibiaWindowInfo? TryRestoreKnownGameWindow(string game, long knownHwnd, int knownProcessId, string? knownTitle)
    {
        if (game != "rubinot" || knownHwnd == 0 || knownProcessId <= 0
            || String.IsNullOrWhiteSpace(knownTitle)
            || !(knownTitle.Equals("RubinOT Client", StringComparison.OrdinalIgnoreCase)
                || knownTitle.StartsWith("RubinOT Client - ", StringComparison.OrdinalIgnoreCase)))
        {
            return null;
        }

        var refreshed = GetWindowInfo(new IntPtr(knownHwnd));
        if (refreshed is null || !refreshed.IsVisible || refreshed.IsMinimized)
        {
            return null;
        }

        GetWindowThreadProcessId(new IntPtr(knownHwnd), out var processId);
        if (processId != knownProcessId)
        {
            return null;
        }

        return new TibiaWindowInfo
        {
            Hwnd = refreshed.Hwnd,
            ProcessId = (int)processId,
            Title = knownTitle ?? "",
            ProcessName = "rubinot_dx",
            IsVisible = refreshed.IsVisible,
            IsForeground = refreshed.IsForeground,
            IsMinimized = refreshed.IsMinimized,
            IsMaximized = refreshed.IsMaximized,
            Bounds = refreshed.Bounds,
            ClientBounds = refreshed.ClientBounds
        };
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

        return BuildWindowInfo(hwnd, title, processName, rect, clientBounds, isForeground, isMinimized, isMaximized);
    }

    internal static IReadOnlyList<TibiaWindowInfo> GetObsWindowInfos()
    {
        var windows = new List<TibiaWindowInfo>();

        EnumWindows((hwnd, _) =>
        {
            if (!IsWindowVisible(hwnd))
            {
                return true;
            }

            var title = ReadWindowTitle(hwnd);
            if (!IsObsCandidate(hwnd, title))
            {
                return true;
            }

            var info = GetWindowInfo(hwnd);
            if (info is not null)
            {
                windows.Add(info);
            }

            return true;
        }, IntPtr.Zero);

        return windows
            .OrderByDescending((entry) => entry.IsForeground)
            .ThenByDescending((entry) => entry.IsMaximized)
            .ThenBy((entry) => entry.Title, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    internal static TibiaWindowInfo? ResolveSourceWindow(long hwndValue, string title, string processName)
    {
        var preferred = hwndValue == 0 ? IntPtr.Zero : new IntPtr(hwndValue);
        if (preferred != IntPtr.Zero && IsWindowVisible(preferred))
        {
            var current = GetWindowInfo(preferred);
            if (current is not null && MatchesExactSource(current, title, processName))
            {
                return current;
            }
        }

        var candidates = new List<TibiaWindowInfo>();
        EnumWindows((candidate, _) =>
        {
            if (!IsWindowVisible(candidate))
            {
                return true;
            }

            var info = GetWindowInfo(candidate);
            if (info is not null && IsObsCandidate(candidate, info.Title))
            {
                candidates.Add(info);
            }

            return true;
        }, IntPtr.Zero);

        // OBS, its preview and its projectors all run inside the same process.
        // Prefer the exact persisted title before using the process as a last
        // resort, otherwise a restarted mirror may attach to the wrong OBS
        // window merely because it was enumerated first.
        var titleMatch = candidates.FirstOrDefault((candidate) =>
            !string.IsNullOrWhiteSpace(title)
            && string.Equals(candidate.Title, title, StringComparison.OrdinalIgnoreCase));
        if (titleMatch is not null)
        {
            return titleMatch;
        }

        return candidates.FirstOrDefault((candidate) =>
            !string.IsNullOrWhiteSpace(processName)
            && string.Equals(candidate.ProcessName, processName, StringComparison.OrdinalIgnoreCase));
    }

    private static TibiaWindowInfo? GetWindowInfo(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out var rect))
        {
            return null;
        }

        var placement = new WindowPlacement { Length = Marshal.SizeOf<WindowPlacement>() };
        var isMinimized = GetWindowPlacement(hwnd, ref placement) && placement.ShowCommand == ShowMinimized;
        var isMaximized = !isMinimized && IsZoomed(hwnd);
        GetWindowThreadProcessId(hwnd, out var processId);
        return BuildWindowInfo(
            hwnd,
            ReadWindowTitle(hwnd),
            ResolveProcessName(processId),
            rect,
            ResolveClientBounds(hwnd),
            GetForegroundWindow() == hwnd,
            isMinimized,
            isMaximized);
    }

    private static TibiaWindowInfo BuildWindowInfo(IntPtr hwnd, string title, string processName, RectNative rect, RectInfo clientBounds, bool isForeground, bool isMinimized, bool isMaximized)
    {
        GetWindowThreadProcessId(hwnd, out var processId);
        return new TibiaWindowInfo
        {
            Hwnd = hwnd.ToInt64(),
            ProcessId = (int)processId,
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

    private static bool MatchesExactSource(TibiaWindowInfo info, string title, string processName)
    {
        var titleMatches = !string.IsNullOrWhiteSpace(title)
            && string.Equals(info.Title, title, StringComparison.OrdinalIgnoreCase);
        var processMatches = !string.IsNullOrWhiteSpace(processName)
            && string.Equals(info.ProcessName, processName, StringComparison.OrdinalIgnoreCase);
        return titleMatches || (string.IsNullOrWhiteSpace(title)
            && processMatches
            && IsObsCandidate(new IntPtr(info.Hwnd), info.Title));
    }

    private static bool IsObsCandidate(IntPtr hwnd, string title)
    {
        if (string.IsNullOrWhiteSpace(title)
            || title.Contains("TibiaToolkit Mirror", StringComparison.OrdinalIgnoreCase)
            || IsTibiaTitle(title))
        {
            return false;
        }

        GetWindowThreadProcessId(hwnd, out var processId);
        var processName = ResolveProcessName(processId);
        if (!string.Equals(processName, "obs64", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(processName, "obs", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        var text = $"{title} {processName}";
        return text.Contains("obs", StringComparison.OrdinalIgnoreCase)
            || text.Contains("projector", StringComparison.OrdinalIgnoreCase)
            || text.Contains("preview", StringComparison.OrdinalIgnoreCase)
            || text.Contains("program", StringComparison.OrdinalIgnoreCase);
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
        return IsGameDirectlyBehindControllers("tibia", controllerHwnds, allowedProcessIds);
    }

    internal static bool IsGameDirectlyBehindControllers(string? sourceGame, IEnumerable<long> controllerHwnds, IEnumerable<int>? allowedProcessIds = null)
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

        var gameInfo = GetGameWindowInfo(sourceGame);
        var tibiaHwnd = NormalizeTopLevelWindow(new IntPtr(gameInfo?.Hwnd ?? 0));

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

    private static string NormalizeSourceGame(string? sourceGame)
    {
        var game = sourceGame?.Trim().ToLowerInvariant();
        return game is "rubinot" or "medivia" ? game : "tibia";
    }

    private static bool IsGameCandidate(string game, TibiaWindowInfo info)
    {
        if (game == "medivia")
        {
            return string.Equals(info.ProcessName, "Medivia", StringComparison.OrdinalIgnoreCase)
                && info.Title.StartsWith("Medivia - ", StringComparison.OrdinalIgnoreCase);
        }

        if (game == "rubinot")
        {
            // RubinOT's protected DirectX child can deny process metadata, so
            // retain an exact process proof while it is foreground even when
            // the protected window withholds its title. Once verified, the
            // same HWND is cached for use after focus returns to the Toolkit.
            var exactProcess = string.Equals(info.ProcessName, "rubinot_dx", StringComparison.OrdinalIgnoreCase)
                || string.Equals(info.ProcessName, "RubinOT", StringComparison.OrdinalIgnoreCase);
            var exactTitle = info.Title.Equals("RubinOT Client", StringComparison.OrdinalIgnoreCase)
                || info.Title.StartsWith("RubinOT Client - ", StringComparison.OrdinalIgnoreCase);
            return (exactTitle && (string.IsNullOrWhiteSpace(info.ProcessName) || exactProcess))
                || (info.IsForeground && exactProcess && info.Bounds.Width > 0 && info.Bounds.Height > 0);
        }

        return IsTibiaTitle(info.Title);
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
