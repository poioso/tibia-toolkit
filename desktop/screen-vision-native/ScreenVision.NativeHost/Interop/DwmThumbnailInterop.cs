using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;

namespace ScreenVision.NativeHost.Interop;

internal static class DwmThumbnailInterop
{
    [StructLayout(LayoutKind.Sequential)]
    internal struct RectNative
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct ThumbnailProperties
    {
        public uint Flags;
        public RectNative Destination;
        public RectNative Source;
        public byte Opacity;

        [MarshalAs(UnmanagedType.Bool)]
        public bool Visible;

        [MarshalAs(UnmanagedType.Bool)]
        public bool SourceClientAreaOnly;
    }

    internal const uint ThumbnailRectDestination = 0x1;
    internal const uint ThumbnailRectSource = 0x2;
    internal const uint ThumbnailOpacity = 0x4;
    internal const uint ThumbnailVisible = 0x8;
    internal const uint ThumbnailSourceClientAreaOnly = 0x10;

    [DllImport("dwmapi.dll")]
    internal static extern int DwmRegisterThumbnail(IntPtr destinationWindow, IntPtr sourceWindow, out IntPtr thumbnailHandle);

    [DllImport("dwmapi.dll")]
    internal static extern int DwmUnregisterThumbnail(IntPtr thumbnailHandle);

    [DllImport("dwmapi.dll")]
    internal static extern int DwmUpdateThumbnailProperties(IntPtr thumbnailHandle, ref ThumbnailProperties properties);

    [DllImport("user32.dll", EntryPoint = "GetDpiForWindow")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);

    internal static RectNative ToDeviceRect(Rect rect, Visual? visual = null, IntPtr targetWindow = default)
    {
        var scaleX = 1.0;
        var scaleY = 1.0;

        if (visual is not null)
        {
            var source = PresentationSource.FromVisual(visual);
            var transform = source?.CompositionTarget?.TransformToDevice;

            if (transform.HasValue)
            {
                scaleX = transform.Value.M11;
                scaleY = transform.Value.M22;
            }
        }

        if (Math.Abs(scaleX - 1.0) < 0.0001 && Math.Abs(scaleY - 1.0) < 0.0001 && targetWindow != IntPtr.Zero)
        {
            try
            {
                var dpiScale = GetDpiForWindow(targetWindow) / 96.0;
                scaleX = dpiScale;
                scaleY = dpiScale;
            }
            catch
            {
            }
        }

        return new RectNative
        {
            Left = (int)Math.Round(rect.Left * scaleX),
            Top = (int)Math.Round(rect.Top * scaleY),
            Right = (int)Math.Round((rect.Left + rect.Width) * scaleX),
            Bottom = (int)Math.Round((rect.Top + rect.Height) * scaleY)
        };
    }
}
