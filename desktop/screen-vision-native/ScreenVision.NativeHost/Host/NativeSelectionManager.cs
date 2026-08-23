using System.Windows;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;
using ScreenVision.NativeHost.Views;

namespace ScreenVision.NativeHost.Host;

internal sealed class NativeSelectionManager
{
    internal async Task<RegionSelectionResult?> SelectRegionAsync(
        RectInfo? initialCaptureBounds = null,
        string mode = "standard",
        int? fixedSize = null,
        string sourceGame = "tibia")
    {
        return await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var tibiaInfo = WindowProbe.GetGameWindowInfo(sourceGame);

            if (tibiaInfo is null)
            {
                return null;
            }

            var overlayBounds = ResolveOverlayBounds(tibiaInfo);

            if (overlayBounds.Width < 1 || overlayBounds.Height < 1)
            {
                return null;
            }

            var isFixedIconCrop = string.Equals(mode, "fixed-icon-crop", StringComparison.OrdinalIgnoreCase);
            var iconCropSize = isFixedIconCrop
                ? Math.Max(1, fixedSize ?? 32)
                : (int?)null;
            var window = new RegionSelectorWindow(
                overlayBounds,
                initialCaptureBounds,
                iconCropSize,
                sourceHwnd: new IntPtr(tibiaInfo.Hwnd),
                // Both quick 32x32 crops and manual mirror selections use the
                // same non-invasive DWM preview. Manual selections add a
                // center marker so the cursor's exact source point is clear.
                showMagnifier: true,
                showCenterMarker: !isFixedIconCrop,
                allowFixedSizeWheel: false,
                confirmFixedSelectionOnClick: false);
            var dialogResult = window.ShowDialog();

            if (dialogResult != true || window.SelectedCaptureBounds is null)
            {
                return null;
            }

            return new RegionSelectionResult
            {
                CaptureBounds = window.SelectedCaptureBounds,
                SourceGame = sourceGame,
                SourceHwnd = tibiaInfo.Hwnd,
                SourceWindowTitle = tibiaInfo.Title,
                SourceProcessName = tibiaInfo.ProcessName,
                SourceBounds = overlayBounds
            };
        });
    }

    internal async Task<RegionSelectionResult?> SelectObsRegionAsync()
    {
        return await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var picker = new WindowSelectorWindow();
            if (picker.ShowDialog() != true || picker.SelectedWindow is null)
            {
                return null;
            }

            var source = picker.SelectedWindow;
            var overlayBounds = ResolveOverlayBounds(source);
            if (overlayBounds.Width < 1 || overlayBounds.Height < 1)
            {
                return null;
            }

            var selector = new RegionSelectorWindow(
                overlayBounds,
                sourceHwnd: new IntPtr(source.Hwnd),
                showMagnifier: true,
                showCenterMarker: true,
                allowFixedSizeWheel: false,
                confirmFixedSelectionOnClick: false);
            if (selector.ShowDialog() != true || selector.SelectedCaptureBounds is null)
            {
                return null;
            }

            return new RegionSelectionResult
            {
                CaptureBounds = selector.SelectedCaptureBounds,
                SourceType = "obs-window",
                SourceHwnd = source.Hwnd,
                SourceWindowTitle = source.Title,
                SourceProcessName = source.ProcessName,
                SourceBounds = overlayBounds
            };
        });
    }

    private static RectInfo ResolveOverlayBounds(TibiaWindowInfo tibiaInfo)
    {
        if (tibiaInfo.ClientBounds.Width > 0 && tibiaInfo.ClientBounds.Height > 0)
        {
            return tibiaInfo.ClientBounds;
        }

        return tibiaInfo.Bounds;
    }
}
