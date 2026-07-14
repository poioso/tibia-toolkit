using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

internal sealed class CursorGlowWindow : Window
{
    [StructLayout(LayoutKind.Sequential)]
    private struct PointInfo
    {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out PointInfo point);

    private readonly Border _glowOuter;
    private readonly Border _glowMid;
    private readonly Border _glowInner;
    private readonly double[] _glowMargins = [0.0, 1.5, 3.0];
    private readonly double[] _glowThicknesses = [3.0, 2.0, 2.0];
    private readonly byte[] _glowAlphas = [255, 255, 255];
    private IntPtr _windowHandle;
    private int _topmostRefreshTick;
    private DispatcherTimer? _trackingTimer;
    private VisualCustomizationSpec _spec;

    internal CursorGlowWindow(VisualCustomizationSpec spec)
    {
        _spec = spec;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowActivated = false;
        ShowInTaskbar = false;
        UseLayoutRounding = true;
        Title = "CursorGlowDisplay";

        var root = new Grid();
        _glowOuter = new Border { CornerRadius = new CornerRadius(999), IsHitTestVisible = false };
        _glowMid = new Border { CornerRadius = new CornerRadius(999), IsHitTestVisible = false };
        _glowInner = new Border { CornerRadius = new CornerRadius(999), IsHitTestVisible = false };
        root.Children.Add(_glowOuter);
        root.Children.Add(_glowMid);
        root.Children.Add(_glowInner);
        Content = root;

        Loaded += (_, _) =>
        {
            ApplySpec(spec);
            StartTracking();
        };
        SourceInitialized += (_, _) =>
        {
            _windowHandle = new WindowInteropHelper(this).Handle;
            Interop.WindowStyleInterop.EnableToolWindow(_windowHandle);
            Interop.WindowStyleInterop.MakeWindowClickThrough(_windowHandle);
            Interop.WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, true);
        };
    }

    internal void ApplySpec(VisualCustomizationSpec spec)
    {
        _spec = spec;
        var size = Math.Clamp(_spec.CursorGlowSize, 20, 160);
        Width = size + 20;
        Height = size + 20;
        var borders = new[] { _glowOuter, _glowMid, _glowInner };

        for (var i = 0; i < borders.Length; i++)
        {
            var inset = 10 + _glowMargins[i];
            borders[i].Margin = new Thickness(inset);
            borders[i].BorderThickness = new Thickness(_glowThicknesses[i]);
            borders[i].CornerRadius = new CornerRadius(size);
            borders[i].Visibility = Visibility.Visible;
        }

        var color = ParseColor(_spec.CursorGlowColor, Color.FromRgb(88, 196, 112));

        for (var i = 0; i < borders.Length; i++)
        {
            borders[i].BorderBrush = new SolidColorBrush(Color.FromArgb(_glowAlphas[i], color.R, color.G, color.B));
        }
    }

    private void StartTracking()
    {
        _trackingTimer?.Stop();
        _trackingTimer = new DispatcherTimer(DispatcherPriority.Render)
        {
            Interval = TimeSpan.FromMilliseconds(16)
        };
        _trackingTimer.Tick += (_, _) =>
        {
            if (GetCursorPos(out var point))
            {
                Left = point.X - (Width / 2.0);
                Top = point.Y - (Height / 2.0);
            }

            if (_windowHandle != IntPtr.Zero && ++_topmostRefreshTick >= 15)
            {
                _topmostRefreshTick = 0;
                Interop.WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, true);
            }
        };
        _trackingTimer.Start();
    }

    protected override void OnClosed(EventArgs e)
    {
        _trackingTimer?.Stop();
        _trackingTimer = null;
        base.OnClosed(e);
    }

    private static Color ParseColor(string? value, Color fallback)
    {
        try
        {
            return (Color)ColorConverter.ConvertFromString(value ?? string.Empty);
        }
        catch
        {
            return fallback;
        }
    }
}
