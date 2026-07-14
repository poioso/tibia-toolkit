using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

internal sealed class CharacterLocationWindow : Window
{
    private readonly Border _glowOuter;
    private readonly Border _glowMid;
    private readonly Border _glowInner;
    private readonly Canvas _arrowCanvas;
    private readonly Border _selectionBorder;
    private readonly double[] _glowMargins = [0.0, 1.5, 3.0];
    private readonly double[] _glowThicknesses = [3.0, 2.0, 2.0];
    private readonly byte[] _glowAlphas = [255, 255, 255];
    private IntPtr _windowHandle;
    private VisualCustomizationSpec _spec;
    private bool _isDragging;
    private bool _positionInitialized;
    private Point _dragStartPoint;
    private Storyboard? _pulseStoryboard;

    internal event EventHandler<RectInfo>? PositionChanged;

    internal CharacterLocationWindow(VisualCustomizationSpec spec)
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
        Title = "CharacterLocationDisplay";

        var root = new Grid();
        _glowOuter = new Border { Background = Brushes.Transparent, Visibility = Visibility.Collapsed, IsHitTestVisible = false };
        _glowMid = new Border { Background = Brushes.Transparent, Visibility = Visibility.Collapsed, IsHitTestVisible = false };
        _glowInner = new Border { Background = Brushes.Transparent, Visibility = Visibility.Collapsed, IsHitTestVisible = false };
        _arrowCanvas = new Canvas { Visibility = Visibility.Collapsed, IsHitTestVisible = false };
        _selectionBorder = new Border
        {
            BorderBrush = new SolidColorBrush(Color.FromRgb(88, 196, 112)),
            BorderThickness = new Thickness(3),
            CornerRadius = new CornerRadius(0),
            Background = Brushes.Transparent,
            Visibility = Visibility.Collapsed
        };
        _selectionBorder.Effect = new System.Windows.Media.Effects.DropShadowEffect
        {
            BlurRadius = 20,
            ShadowDepth = 0,
            Color = Color.FromRgb(88, 196, 112),
            Opacity = 0.62
        };

        root.Children.Add(_glowOuter);
        root.Children.Add(_glowMid);
        root.Children.Add(_glowInner);
        root.Children.Add(_arrowCanvas);
        root.Children.Add(_selectionBorder);
        Content = root;

        Loaded += (_, _) => ApplySpec(spec);
        SourceInitialized += OnSourceInitialized;
        MouseLeftButtonDown += OnMouseLeftButtonDown;
        MouseMove += OnMouseMove;
        MouseLeftButtonUp += OnMouseLeftButtonUp;
    }

    internal void ApplySpec(VisualCustomizationSpec spec)
    {
        _spec = spec;
        ApplyShape();
        ApplyLockState();
        ApplyPulse();

        if (!_positionInitialized)
        {
            if (spec.CharLocX > 0 || spec.CharLocY > 0)
            {
                Left = spec.CharLocX;
                Top = spec.CharLocY;
            }
            else
            {
                WindowStartupLocation = WindowStartupLocation.CenterScreen;
            }

            _positionInitialized = true;
        }
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        _windowHandle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
        WindowStyleInterop.EnableToolWindow(_windowHandle);
        WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, true);
        ApplyLockState();
    }

    private void ApplyShape()
    {
        _glowOuter.Visibility = Visibility.Collapsed;
        _glowMid.Visibility = Visibility.Collapsed;
        _glowInner.Visibility = Visibility.Collapsed;
        _arrowCanvas.Visibility = Visibility.Collapsed;
        _arrowCanvas.Children.Clear();

        var size = Math.Clamp(_spec.CharLocSize, 20, 160);
        var layers = GetLayerCount(_spec.CharLocIntensity);

        if (string.Equals(_spec.CharLocShape, "Arrow", StringComparison.OrdinalIgnoreCase))
        {
            ShowArrowLayers(size, layers);
        }
        else if (string.Equals(_spec.CharLocShape, "Square", StringComparison.OrdinalIgnoreCase))
        {
            ShowSquareLayer(size);
        }
        else
        {
            ShowCircleLayers(size, layers);
        }

        UpdateGlowColor();
    }

    private int GetLayerCount(double intensity)
    {
        if (intensity <= 6) return 1;
        if (intensity <= 14) return 2;
        if (intensity <= 25) return 3;
        return 4;
    }

    private void ShowCircleLayers(double size, int layers)
    {
        const double spacing = 6;
        var extra = 20 + ((layers - 1) * spacing);
        Width = size + extra;
        Height = size + extra;
        var borders = new[] { _glowOuter, _glowMid, _glowInner };

        for (var i = 0; i < borders.Length; i++)
        {
            var inset = ((layers - 1) * spacing / 2.0) + 10 + _glowMargins[i];
            borders[i].Visibility = Visibility.Visible;
            borders[i].Margin = new Thickness(inset);
            borders[i].BorderThickness = new Thickness(_glowThicknesses[i]);
            borders[i].CornerRadius = new CornerRadius(size);
        }

        if (layers < 2)
        {
            return;
        }

        _arrowCanvas.Visibility = Visibility.Visible;
        var totalSize = size + extra;

        for (var layer = 1; layer < layers; layer++)
        {
            var layerOffset = layer * spacing;

            for (var i = 0; i < _glowMargins.Length; i++)
            {
                var inset = ((layers - 1) * spacing / 2.0) + 10 + _glowMargins[i] + layerOffset;
                var diameter = totalSize - (inset * 2.0);

                if (diameter <= 0)
                {
                    continue;
                }

                var ellipse = new Ellipse
                {
                    Width = diameter,
                    Height = diameter,
                    StrokeThickness = _glowThicknesses[i],
                    Fill = Brushes.Transparent,
                    IsHitTestVisible = false
                };

                Canvas.SetLeft(ellipse, inset);
                Canvas.SetTop(ellipse, inset);
                _arrowCanvas.Children.Add(ellipse);
            }
        }
    }

    private void ShowArrowLayers(double size, int layers)
    {
        _arrowCanvas.Visibility = Visibility.Visible;
        var arrowHeight = size * 0.4;
        var layerSpacing = arrowHeight * 0.5;
        var totalHeight = arrowHeight + ((layers - 1) * layerSpacing);
        var boxSize = Math.Max(size + 20, totalHeight + 20);
        Width = boxSize;
        Height = boxSize;
        var baseYOffset = (boxSize - totalHeight) / 2.0;

        for (var layer = 0; layer < layers; layer++)
        {
            var yOffset = baseYOffset + (layer * layerSpacing);
            for (var i = 0; i < _glowMargins.Length; i++)
            {
                var path = CreateArrowPath(Width, arrowHeight, _glowMargins[i], _glowThicknesses[i], yOffset);
                path.Tag = i;
                _arrowCanvas.Children.Add(path);
            }
        }
    }

    private void ShowSquareLayer(double size)
    {
        const double extra = 20;
        Width = size + extra;
        Height = size + extra;

        _glowInner.Visibility = Visibility.Visible;
        _glowInner.Margin = new Thickness(10);
        _glowInner.BorderThickness = new Thickness(GetSquareThickness(_spec.CharLocIntensity));
        _glowInner.CornerRadius = new CornerRadius(0);
    }

    private static double GetSquareThickness(double intensity)
    {
        if (intensity <= 6) return 1.5;
        if (intensity <= 14) return 3.0;
        if (intensity <= 25) return 5.0;
        return 8.0;
    }

    private static Path CreateArrowPath(double canvasWidth, double arrowHeight, double inset, double thickness, double yOffset)
    {
        var left = inset + 4;
        var right = canvasWidth - inset - 4;
        var top = yOffset + inset;
        var bottom = yOffset + arrowHeight - inset;
        var center = canvasWidth / 2.0;
        var geometry = new PathGeometry();
        var figure = new PathFigure
        {
            StartPoint = new Point(left, top),
            IsClosed = false,
            IsFilled = false
        };
        figure.Segments.Add(new LineSegment(new Point(center, bottom), true));
        figure.Segments.Add(new LineSegment(new Point(right, top), true));
        geometry.Figures.Add(figure);

        return new Path
        {
            Data = geometry,
            StrokeThickness = thickness,
            StrokeLineJoin = PenLineJoin.Round,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round,
            IsHitTestVisible = false
        };
    }

    private void UpdateGlowColor()
    {
        var color = ParseColor(_spec.CharLocColor, Colors.White);
        var borders = new[] { _glowOuter, _glowMid, _glowInner };

        if (string.Equals(_spec.CharLocShape, "Circle", StringComparison.OrdinalIgnoreCase)
            || string.Equals(_spec.CharLocShape, "Square", StringComparison.OrdinalIgnoreCase))
        {
            for (var i = 0; i < borders.Length; i++)
            {
                borders[i].BorderBrush = new SolidColorBrush(Color.FromArgb(_glowAlphas[i], color.R, color.G, color.B));
            }

            var ellipseIndex = 0;

            foreach (var ellipse in _arrowCanvas.Children.OfType<Ellipse>())
            {
                var layerIndex = ellipseIndex % 3;
                ellipse.Stroke = new SolidColorBrush(Color.FromArgb(_glowAlphas[layerIndex], color.R, color.G, color.B));
                ellipseIndex += 1;
            }

            return;
        }

        foreach (var child in _arrowCanvas.Children.OfType<Path>())
        {
            var layerIndex = child.Tag is int tag ? tag : 0;
            child.Stroke = new SolidColorBrush(Color.FromArgb(_glowAlphas[layerIndex], color.R, color.G, color.B));
        }
    }

    private void ApplyLockState()
    {
        _selectionBorder.Visibility = _spec.CharLocLocked ? Visibility.Collapsed : Visibility.Visible;

        if (_windowHandle == IntPtr.Zero)
        {
            return;
        }

        if (_spec.CharLocLocked)
        {
            WindowStyleInterop.MakeWindowClickThrough(_windowHandle);
        }
        else
        {
            WindowStyleInterop.MakeWindowDraggableNoActivate(_windowHandle);
        }
    }

    private void ApplyPulse()
    {
        _pulseStoryboard?.Stop(this);
        _pulseStoryboard = null;

        if (!_spec.CharLocPulse || !_spec.CharLocLocked)
        {
            Opacity = 1;
            return;
        }

        _pulseStoryboard = new Storyboard();
        var animation = new DoubleAnimation
        {
            From = 0.5,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(650),
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever
        };
        Storyboard.SetTarget(animation, this);
        Storyboard.SetTargetProperty(animation, new PropertyPath(Window.OpacityProperty));
        _pulseStoryboard.Children.Add(animation);
        _pulseStoryboard.Begin(this, true);
    }

    private void OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (_spec.CharLocLocked || e.ChangedButton != MouseButton.Left)
        {
            return;
        }

        _isDragging = true;
        _dragStartPoint = e.GetPosition(this);
        CaptureMouse();
        e.Handled = true;
    }

    private void OnMouseMove(object sender, MouseEventArgs e)
    {
        if (!_isDragging || !IsMouseCaptured || _spec.CharLocLocked)
        {
            return;
        }

        var point = PointToScreen(e.GetPosition(this));
        Left = point.X - _dragStartPoint.X;
        Top = point.Y - _dragStartPoint.Y;
        e.Handled = true;
    }

    private void OnMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (!_isDragging)
        {
            return;
        }

        _isDragging = false;

        if (IsMouseCaptured)
        {
            ReleaseMouseCapture();
        }

        PositionChanged?.Invoke(this, new RectInfo
        {
            X = (int)Math.Round(Left),
            Y = (int)Math.Round(Top),
            Width = (int)Math.Round(Width),
            Height = (int)Math.Round(Height)
        });
        e.Handled = true;
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
