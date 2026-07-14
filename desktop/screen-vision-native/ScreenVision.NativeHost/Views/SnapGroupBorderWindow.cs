using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using ScreenVision.NativeHost.Interop;

namespace ScreenVision.NativeHost.Views;

internal sealed class SnapGroupBorderWindow : Window
{
    private readonly Border _border;

    internal SnapGroupBorderWindow()
    {
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowActivated = false;
        ShowInTaskbar = false;
        IsHitTestVisible = false;
        ResizeMode = ResizeMode.NoResize;

        _border = new Border
        {
            BorderBrush = new SolidColorBrush(Color.FromRgb(88, 196, 112)),
            BorderThickness = new Thickness(3),
            CornerRadius = new CornerRadius(0),
            Background = new SolidColorBrush(Color.FromArgb(34, 88, 196, 112))
        };
        _border.Effect = new System.Windows.Media.Effects.DropShadowEffect
        {
            BlurRadius = 24,
            ShadowDepth = 0,
            Color = Color.FromRgb(88, 196, 112),
            Opacity = 0.55
        };

        Content = _border;
        SourceInitialized += (_, _) =>
        {
            var handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            WindowStyleInterop.EnableToolWindow(handle);
            WindowStyleInterop.MakeWindowClickThrough(handle);
            WindowStyleInterop.SetWindowAlwaysOnTop(handle, true);
        };
    }

    internal void UpdateForGroup(Rect bounds)
    {
        Left = bounds.Left;
        Top = bounds.Top;
        Width = bounds.Width;
        Height = bounds.Height;
    }

    internal void SetAlwaysOnTop(bool enabled)
    {
        Topmost = enabled;

        var handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
        if (handle != IntPtr.Zero)
        {
            WindowStyleInterop.SetWindowAlwaysOnTop(handle, enabled);
        }
    }

    internal void PlaceAboveSource(IntPtr sourceHwnd)
    {
        var handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero || sourceHwnd == IntPtr.Zero)
        {
            return;
        }

        Topmost = false;
        WindowStyleInterop.SetWindowAlwaysOnTop(handle, false);
        WindowStyleInterop.PlaceWindowAbove(handle, sourceHwnd);
    }
}
