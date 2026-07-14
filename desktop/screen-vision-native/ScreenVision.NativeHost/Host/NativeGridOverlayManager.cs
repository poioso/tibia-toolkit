using System.Windows;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;
using ScreenVision.NativeHost.Views;

namespace ScreenVision.NativeHost.Host;

internal sealed class NativeGridOverlayManager : IDisposable
{
    private GridOverlayWindow? _gridOverlayWindow;
    private bool _enabled;
    private int _gridSize = 32;
    private bool _visible = true;

    internal async Task SetAsync(bool enabled, int gridSize, bool visible)
    {
        _enabled = enabled;
        _gridSize = gridSize;
        _visible = visible;

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (!_enabled)
            {
                CloseWindow();
                return;
            }

            var tibiaInfo = WindowProbe.GetTibiaWindowInfo();

            if (tibiaInfo is null)
            {
                CloseWindow();
                return;
            }

            var bounds = ResolveBounds(tibiaInfo);

            if (_gridOverlayWindow is null || !_gridOverlayWindow.IsLoaded)
            {
                if (!_visible)
                {
                    return;
                }

                _gridOverlayWindow = new GridOverlayWindow(bounds, gridSize);
                _gridOverlayWindow.Closed += (_, _) => _gridOverlayWindow = null;
                _gridOverlayWindow.Show();
            }
            else
            {
                _gridOverlayWindow.ApplyBounds(bounds, gridSize);

                if (_visible && !_gridOverlayWindow.IsVisible)
                {
                    _gridOverlayWindow.Show();
                }
                else if (!_visible && _gridOverlayWindow.IsVisible)
                {
                    _gridOverlayWindow.Hide();
                }
            }
        });
    }

    private static RectInfo ResolveBounds(TibiaWindowInfo tibiaInfo)
    {
        if (tibiaInfo.ClientBounds.Width > 0 && tibiaInfo.ClientBounds.Height > 0)
        {
            return tibiaInfo.ClientBounds;
        }

        return tibiaInfo.Bounds;
    }

    private void CloseWindow()
    {
        if (_gridOverlayWindow is null)
        {
            return;
        }

        try
        {
            _gridOverlayWindow.Close();
        }
        catch
        {
        }

        _gridOverlayWindow = null;
    }

    public void Dispose()
    {
        CloseWindow();
    }
}
