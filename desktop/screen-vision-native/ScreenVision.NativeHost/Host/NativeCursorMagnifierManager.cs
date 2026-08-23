using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Threading;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;
using ScreenVision.NativeHost.Views;

namespace ScreenVision.NativeHost.Host;

/// <summary>
/// Owns the temporary cursor magnifier. It never creates or persists a mirror;
/// it only presents a DWM thumbnail of the selected game client beneath the cursor.
/// </summary>
internal sealed class NativeCursorMagnifierManager : IDisposable
{
    private const int SourceSize = 64;
    private readonly DispatcherTimer _timer;
    private CropMagnifierWindow? _window;
    private bool _enabled;
    private string _sourceGame = "tibia";
    private long _knownHwnd;
    private int _knownProcessId;
    private string? _knownTitle;

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint
    {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);

    internal NativeCursorMagnifierManager()
    {
        _timer = new DispatcherTimer(DispatcherPriority.Render)
        {
            Interval = TimeSpan.FromMilliseconds(16)
        };
        _timer.Tick += OnTick;
    }

    internal async Task<bool> SetEnabledAsync(
        bool enabled,
        string sourceGame = "tibia",
        long knownHwnd = 0,
        int knownProcessId = 0,
        string? knownTitle = null)
    {
        return await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var nextSourceGame = NormalizeSourceGame(sourceGame);
            var sourceChanged = !string.Equals(_sourceGame, nextSourceGame, StringComparison.Ordinal);
            _sourceGame = nextSourceGame;
            _knownHwnd = knownHwnd;
            _knownProcessId = knownProcessId;
            _knownTitle = knownTitle;
            _enabled = enabled;

            if (sourceChanged)
            {
                CloseWindow();
            }

            if (_enabled)
            {
                _timer.Start();
                UpdatePreview();
            }
            else
            {
                _timer.Stop();
                CloseWindow();
            }

            return _enabled;
        });
    }

    internal async Task<bool> GetEnabledAsync()
    {
        return await Application.Current.Dispatcher.InvokeAsync(() => _enabled);
    }

    private void OnTick(object? sender, EventArgs e)
    {
        UpdatePreview();
    }

    private void UpdatePreview()
    {
        if (!_enabled || !GetCursorPos(out var cursor))
        {
            return;
        }

        var sourceInfo = ResolveCursorSource(
            cursor.X,
            cursor.Y,
            _sourceGame,
            _knownHwnd,
            _knownProcessId,
            _knownTitle
        );

        if (sourceInfo is null)
        {
            HideWindow();
            return;
        }

        var sourceBounds = sourceInfo.ClientBounds.Width > 0 && sourceInfo.ClientBounds.Height > 0
            ? sourceInfo.ClientBounds
            : sourceInfo.Bounds;

        if (!Contains(sourceBounds, cursor.X, cursor.Y))
        {
            HideWindow();
            return;
        }

        var width = Math.Min(SourceSize, sourceBounds.Width);
        var height = Math.Min(SourceSize, sourceBounds.Height);
        var left = Math.Clamp(cursor.X - (width / 2), sourceBounds.X, sourceBounds.X + sourceBounds.Width - width);
        var top = Math.Clamp(cursor.Y - (height / 2), sourceBounds.Y, sourceBounds.Y + sourceBounds.Height - height);
        var sourceHwnd = new IntPtr(sourceInfo.Hwnd);

        if (_window is null || _window.SourceHwnd != sourceHwnd)
        {
            CloseWindow();
            _window = new CropMagnifierWindow(sourceHwnd);
        }

        _window.ShowRegionPreview(
            new RectInfo
            {
                X = left,
                Y = top,
                Width = width,
                Height = height
            },
            new Point(cursor.X, cursor.Y));
    }

    private static TibiaWindowInfo? ResolveCursorSource(
        int x,
        int y,
        string sourceGame,
        long knownHwnd,
        int knownProcessId,
        string? knownTitle)
    {
        var tibiaInfo = WindowProbe.GetGameWindowInfo(sourceGame, knownHwnd, knownProcessId, knownTitle);
        var tibiaBounds = tibiaInfo?.ClientBounds.Width > 0 && tibiaInfo.ClientBounds.Height > 0
            ? tibiaInfo.ClientBounds
            : tibiaInfo?.Bounds;

        if (tibiaInfo is not null && tibiaBounds is not null && Contains(tibiaBounds, x, y))
        {
            return tibiaInfo;
        }

        return WindowProbe.GetObsWindowInfos()
            .Where((entry) => !entry.IsMinimized)
            .Select((entry) => new
            {
                Info = entry,
                Bounds = entry.ClientBounds.Width > 0 && entry.ClientBounds.Height > 0
                    ? entry.ClientBounds
                    : entry.Bounds
            })
            .Where((entry) => Contains(entry.Bounds, x, y))
            .OrderByDescending((entry) => entry.Info.IsForeground)
            .ThenBy((entry) => entry.Bounds.Width * entry.Bounds.Height)
            .Select((entry) => entry.Info)
            .FirstOrDefault();
    }

    private static string NormalizeSourceGame(string? sourceGame)
    {
        var game = sourceGame?.Trim().ToLowerInvariant();
        return game is "rubinot" or "medivia" ? game : "tibia";
    }

    private static bool Contains(RectInfo bounds, int x, int y)
    {
        return x >= bounds.X
            && y >= bounds.Y
            && x < bounds.X + bounds.Width
            && y < bounds.Y + bounds.Height;
    }

    private void HideWindow()
    {
        try
        {
            _window?.HidePreview();
        }
        catch
        {
        }
    }

    private void CloseWindow()
    {
        try
        {
            _window?.Close();
        }
        catch
        {
        }

        _window = null;
    }

    public void Dispose()
    {
        _enabled = false;
        _timer.Stop();
        _timer.Tick -= OnTick;
        CloseWindow();
    }
}
