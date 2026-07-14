using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shapes;
using ScreenVision.NativeHost.Interop;

namespace ScreenVision.NativeHost.Views;

internal sealed class CountdownBarWindow : Window
{
    private const int GwlExStyle = -20;
    private const int WsExTransparent = 0x20;
    private const int WsExLayered = 0x80000;
    private const int WsExToolWindow = 0x80;
    private readonly Border _frame;
    private readonly Rectangle _fill;
    private readonly ScaleTransform _fillScale;
    private string _side = "Above";
    private string _direction = "LeftToRight";
    private double _lastProgress = 1.0;
    private bool _isGradient = true;

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hwnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hwnd, int nIndex, int dwNewLong);

    internal CountdownBarWindow()
    {
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowActivated = false;
        ShowInTaskbar = false;
        ResizeMode = ResizeMode.NoResize;
        SizeToContent = SizeToContent.Manual;
        Width = 200;
        Height = 22;
        SnapsToDevicePixels = true;
        UseLayoutRounding = true;

        _frame = new Border
        {
            BorderBrush = Brushes.White,
            BorderThickness = new Thickness(1.5),
            CornerRadius = new CornerRadius(3),
            Background = Brushes.Transparent,
            SnapsToDevicePixels = true
        };

        _fillScale = new ScaleTransform(1, 1);

        _fill = new Rectangle
        {
            Fill = new SolidColorBrush(Color.FromArgb(160, 255, 127, 0)),
            Margin = new Thickness(1.5),
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Stretch,
            RadiusX = 2,
            RadiusY = 2,
            SnapsToDevicePixels = true,
            RenderTransform = _fillScale,
            RenderTransformOrigin = new Point(0, 0.5)
        };

        Content = new Grid
        {
            SnapsToDevicePixels = true,
            UseLayoutRounding = true,
            Children =
            {
                _fill,
                _frame
            }
        };

        Loaded += (_, _) => MakeClickThrough();
        SizeChanged += (_, _) => ApplyProgress(_lastProgress, true);
    }

    internal void SetAlwaysOnTop(bool enabled)
    {
        Topmost = enabled;

        var handle = new WindowInteropHelper(this).Handle;
        if (handle != IntPtr.Zero)
        {
            WindowStyleInterop.SetWindowAlwaysOnTop(handle, enabled);
        }
    }

    internal void PlaceAboveSource(IntPtr sourceHwnd)
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero || sourceHwnd == IntPtr.Zero)
        {
            return;
        }

        Topmost = false;
        WindowStyleInterop.SetWindowAlwaysOnTop(handle, false);
        WindowStyleInterop.PlaceWindowAbove(handle, sourceHwnd);
    }

    internal void Configure(string side, string direction, int borderWidth, int borderRadius, string borderColor)
    {
        _side = string.IsNullOrWhiteSpace(side) ? "Above" : side;
        _direction = string.IsNullOrWhiteSpace(direction) ? "LeftToRight" : direction;
        ApplyBorderStyle(borderWidth, borderRadius, borderColor);
        var isVertical = IsVerticalDirection();

        if (isVertical)
        {
            _fill.RenderTransformOrigin = _direction == "BottomToTop"
                ? new Point(0.5, 0)
                : new Point(0.5, 1);
        }
        else
        {
            _fill.RenderTransformOrigin = _direction == "LeftToRight"
                ? new Point(1, 0.5)
                : new Point(0, 0.5);
        }

        ApplyProgress(_lastProgress, true);
    }

    internal void UpdateProgress(double progress)
    {
        _lastProgress = progress;

        if (Dispatcher.CheckAccess())
        {
            ApplyProgress(progress, false);
            return;
        }

        Dispatcher.Invoke(() => ApplyProgress(progress, false));
    }

    internal void SetColor(string colorValue)
    {
        Dispatcher.InvokeAsync(() =>
        {
            if (string.Equals(colorValue, "gradient", StringComparison.OrdinalIgnoreCase))
            {
                _isGradient = true;
                ApplyProgress(_lastProgress, false);
                return;
            }

            _isGradient = false;

            try
            {
                var color = (Color)ColorConverter.ConvertFromString(colorValue);
                color.A = 160;
                _fill.Fill = new SolidColorBrush(color);
            }
            catch
            {
                _isGradient = true;
                ApplyProgress(_lastProgress, false);
            }
        });
    }

    private void MakeClickThrough()
    {
        var handle = new WindowInteropHelper(this).Handle;
        var existingStyle = GetWindowLong(handle, GwlExStyle);
        SetWindowLong(handle, GwlExStyle, existingStyle | WsExTransparent | WsExLayered | WsExToolWindow);
    }

    private void ApplyProgress(double progress, bool snap)
    {
        var nextProgress = Math.Clamp(progress, 0.0, 1.0);
        var isVertical = IsVerticalDirection();

        if (isVertical)
        {
            _fillScale.ScaleX = 1.0;
            _fillScale.ScaleY = nextProgress;
        }
        else
        {
            _fillScale.ScaleX = nextProgress;
            _fillScale.ScaleY = 1.0;
        }

        if (_isGradient)
        {
            _fill.Fill = new SolidColorBrush(GetGradientColor(nextProgress));
        }
    }

    private void ApplyBorderStyle(int borderWidth, int borderRadius, string borderColor)
    {
        var safeBorderWidth = Math.Clamp(borderWidth, 0, 64);
        var safeBorderRadius = Math.Clamp(borderRadius, 0, 200);
        var brush = Brushes.White;

        try
        {
            if (!string.IsNullOrWhiteSpace(borderColor)
                && !string.Equals(borderColor, "gradient", StringComparison.OrdinalIgnoreCase))
            {
                brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(borderColor));
            }
        }
        catch
        {
        }

        _frame.BorderBrush = brush;
        _frame.BorderThickness = new Thickness(safeBorderWidth);
        _frame.CornerRadius = new CornerRadius(safeBorderRadius);
        _fill.Margin = new Thickness(safeBorderWidth);
        _fill.RadiusX = Math.Max(0, safeBorderRadius - safeBorderWidth);
        _fill.RadiusY = Math.Max(0, safeBorderRadius - safeBorderWidth);
    }

    internal bool UsesVerticalDirection()
    {
        return IsVerticalDirection();
    }

    private bool IsVerticalDirection()
    {
        return string.Equals(_direction, "TopToBottom", StringComparison.OrdinalIgnoreCase)
            || string.Equals(_direction, "BottomToTop", StringComparison.OrdinalIgnoreCase);
    }

    private static Color GetGradientColor(double progress)
    {
        var hue = progress * 120.0;
        var value = 1.0;
        var chroma = value;
        var second = chroma * (1.0 - Math.Abs(hue / 60.0 % 2.0 - 1.0));
        var match = value - chroma;
        double red;
        double green;

        if (hue < 60.0)
        {
            red = chroma;
            green = second;
        }
        else
        {
            red = second;
            green = chroma;
        }

        return Color.FromArgb(
            160,
            (byte)((red + match) * 255.0),
            (byte)((green + match) * 255.0),
            0);
    }
}
