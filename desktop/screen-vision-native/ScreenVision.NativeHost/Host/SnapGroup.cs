using System.Windows;
using ScreenVision.NativeHost.Views;

namespace ScreenVision.NativeHost.Host;

internal sealed class SnapGroup : IDisposable
{
    private readonly List<RegionMirrorWindow> _windows = [];
    private readonly Dictionary<RegionMirrorWindow, Point> _groupMoveStartPositions = [];
    private SnapGroupBorderWindow? _unifiedBorderWindow;

    internal bool IsDragging { get; private set; }

    internal IReadOnlyList<RegionMirrorWindow> Windows => _windows.AsReadOnly();

    internal void AddWindow(RegionMirrorWindow window)
    {
        if (_windows.Contains(window))
        {
            return;
        }

        _windows.Add(window);
        if (!ReferenceEquals(window.GetSnapGroup(), this))
        {
            window.SetSnapGroup(this);
        }

        UpdateBorderDisplay();
        window.UpdateSnapGroupBorders();
    }

    internal void RemoveWindow(RegionMirrorWindow window)
    {
        if (!_windows.Remove(window))
        {
            return;
        }

        window.SetSnapGroup(null);

        if (_windows.Count <= 1)
        {
            foreach (var remaining in _windows.ToList())
            {
                remaining.SetSnapGroup(null);
                remaining.UpdateSnapGroupBorders();
            }

            _windows.Clear();
            HideUnifiedBorder();
            return;
        }

        UpdateBorderDisplay();
    }

    internal void PrepareGroupMove()
    {
        IsDragging = true;
        _groupMoveStartPositions.Clear();

        foreach (var window in _windows)
        {
            _groupMoveStartPositions[window] = new Point(window.Left, window.Top);
        }
    }

    internal void MoveGroup(Vector offset)
    {
        foreach (var window in _windows)
        {
            window.Left += offset.X;
            window.Top += offset.Y;
        }

        UpdateUnifiedBorderPosition();
    }

    internal void FinishGroupMove()
    {
        IsDragging = false;
        _groupMoveStartPositions.Clear();
    }

    internal void UpdateBorderDisplay()
    {
        var visibleWindows = _windows.Where((window) => window.IsOverlayVisible).ToList();

        if (visibleWindows.Count < 2)
        {
            HideUnifiedBorder();
            return;
        }

        if (visibleWindows.Any((window) => !window.IsLocked))
        {
            ShowUnifiedBorder();
        }
        else
        {
            HideUnifiedBorder();
        }
    }

    internal void UpdateUnifiedBorderPosition()
    {
        if (_unifiedBorderWindow is null || _windows.Count < 2)
        {
            return;
        }

        _unifiedBorderWindow.UpdateForGroup(GetGroupBounds());
    }

    internal Rect GetGroupBounds()
    {
        if (_windows.Count == 0)
        {
            return Rect.Empty;
        }

        var minLeft = _windows.Min((window) => window.Left);
        var minTop = _windows.Min((window) => window.Top);
        var maxRight = _windows.Max((window) => window.Left + window.Width);
        var maxBottom = _windows.Max((window) => window.Top + window.Height);
        return new Rect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
    }

    internal void SyncTopmostFromWindows()
    {
        if (_unifiedBorderWindow is null)
        {
            return;
        }

        var enabled = _windows.Any((window) => window.IsAlwaysOnTop);
        var sourceHwnd = _windows
            .Select((window) => window.SourceHwnd)
            .FirstOrDefault((hwnd) => hwnd != IntPtr.Zero);

        if (enabled || sourceHwnd == IntPtr.Zero)
        {
            _unifiedBorderWindow.SetAlwaysOnTop(enabled);
            return;
        }

        _unifiedBorderWindow.PlaceAboveSource(sourceHwnd);
    }

    private void ShowUnifiedBorder()
    {
        _unifiedBorderWindow ??= new SnapGroupBorderWindow();
        SyncTopmostFromWindows();
        _unifiedBorderWindow.UpdateForGroup(GetGroupBounds());

        if (!_unifiedBorderWindow.IsVisible)
        {
            _unifiedBorderWindow.Show();
        }
    }

    private void HideUnifiedBorder()
    {
        if (_unifiedBorderWindow is null)
        {
            return;
        }

        try
        {
            _unifiedBorderWindow.Close();
        }
        catch
        {
        }

        _unifiedBorderWindow = null;
    }

    public void Dispose()
    {
        HideUnifiedBorder();
        _windows.Clear();
        _groupMoveStartPositions.Clear();
    }
}
