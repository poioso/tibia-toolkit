using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

internal sealed class GridOverlayWindow : Window
{
    private readonly Canvas _gridCanvas;
    private int _gridSize;

    internal GridOverlayWindow(RectInfo bounds, int gridSize = 32)
    {
        _gridSize = Math.Clamp(gridSize, 8, 256);
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        ResizeMode = ResizeMode.NoResize;
        IsHitTestVisible = false;
        Left = bounds.X;
        Top = bounds.Y;
        Width = bounds.Width;
        Height = bounds.Height;
        Title = "Screen Vision Grid Overlay";

        _gridCanvas = new Canvas
        {
            IsHitTestVisible = false
        };

        Content = _gridCanvas;
        SourceInitialized += (_, _) =>
        {
            var handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            WindowStyleInterop.EnableToolWindow(handle);
            WindowStyleInterop.MakeWindowClickThrough(handle);
            WindowStyleInterop.SetWindowAlwaysOnTop(handle, true);
        };
        Loaded += (_, _) => DrawGrid();
        SizeChanged += (_, _) => DrawGrid();
    }

    internal void ApplyBounds(RectInfo bounds, int gridSize)
    {
        _gridSize = Math.Clamp(gridSize, 8, 256);
        Left = bounds.X;
        Top = bounds.Y;
        Width = Math.Max(1, bounds.Width);
        Height = Math.Max(1, bounds.Height);
        DrawGrid();
    }

    private void DrawGrid()
    {
        _gridCanvas.Children.Clear();
        var width = Math.Max(1, Width);
        var height = Math.Max(1, Height);

        for (var x = 0; x < width; x += _gridSize)
        {
            _gridCanvas.Children.Add(new Line
            {
                X1 = x,
                Y1 = 0,
                X2 = x,
                Y2 = height,
                Stroke = Brushes.White,
                StrokeThickness = 1,
                Opacity = 0.3,
                IsHitTestVisible = false,
                SnapsToDevicePixels = true
            });
        }

        for (var y = 0; y < height; y += _gridSize)
        {
            _gridCanvas.Children.Add(new Line
            {
                X1 = 0,
                Y1 = y,
                X2 = width,
                Y2 = y,
                Stroke = Brushes.White,
                StrokeThickness = 1,
                Opacity = 0.3,
                IsHitTestVisible = false,
                SnapsToDevicePixels = true
            });
        }
    }
}
