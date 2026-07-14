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
        int? fixedSize = null)
    {
        return await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var tibiaInfo = WindowProbe.GetTibiaWindowInfo();

            if (tibiaInfo is null)
            {
                return null;
            }

            var overlayBounds = ResolveOverlayBounds(tibiaInfo);

            if (overlayBounds.Width < 1 || overlayBounds.Height < 1)
            {
                return null;
            }

            var iconCropSize = string.Equals(mode, "fixed-icon-crop", StringComparison.OrdinalIgnoreCase)
                ? Math.Max(1, fixedSize ?? 32)
                : (int?)null;
            var window = new RegionSelectorWindow(overlayBounds, initialCaptureBounds, iconCropSize);
            var dialogResult = window.ShowDialog();

            if (dialogResult != true || window.SelectedCaptureBounds is null)
            {
                return null;
            }

            return new RegionSelectionResult
            {
                CaptureBounds = window.SelectedCaptureBounds
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
