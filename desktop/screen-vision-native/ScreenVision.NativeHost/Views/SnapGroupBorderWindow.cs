using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using ScreenVision.NativeHost.Interop;

namespace ScreenVision.NativeHost.Views;

internal sealed class SnapGroupBorderWindow : Window
{
    private readonly Border _border;

    internal SnapGroupBorderWindow(bool isObsGroup = false)
    {
        var accentColor = isObsGroup
            ? Color.FromRgb(49, 95, 199)
            : Color.FromRgb(88, 196, 112);

        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = false;
        ShowActivated = false;
        ShowInTaskbar = false;
        IsHitTestVisible = false;
        ResizeMode = ResizeMode.NoResize;

        _border = new Border
        {
            BorderBrush = new SolidColorBrush(accentColor),
            BorderThickness = new Thickness(3),
            CornerRadius = new CornerRadius(0),
            Background = new SolidColorBrush(Color.FromArgb(34, accentColor.R, accentColor.G, accentColor.B))
        };
        _border.Effect = new System.Windows.Media.Effects.DropShadowEffect
        {
            BlurRadius = 24,
            ShadowDepth = 0,
            Color = accentColor,
            Opacity = 0.55
        };

        Content = _border;
        SourceInitialized += (_, _) =>
        {
            var handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            WindowStyleInterop.EnableToolWindow(handle);
            WindowStyleInterop.MakeWindowClickThrough(handle);
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
