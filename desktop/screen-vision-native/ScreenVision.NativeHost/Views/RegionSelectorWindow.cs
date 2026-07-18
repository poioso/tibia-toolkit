using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

internal sealed class RegionSelectorWindow : Window
{
    // Keep this aligned with Electron's persistence guard. A smaller crop was
    // accepted by the selector but later rejected silently by the app.
    private const double MinimumSelectionSize = 24;
    private const double HandleSize = 10;
    private const double CornerHandleSize = 10;
    private const double ActionButtonSize = 38;
    private const double ActionButtonGap = 8;
    private static readonly Brush AccentBrush = new SolidColorBrush(Color.FromRgb(88, 196, 112));

    private readonly Canvas _overlayCanvas;
    private readonly Rectangle _selectionRectangle;
    private readonly Border _instructionsShell;
    private readonly TextBlock _instructionsText;
    private readonly Grid _actionButtonsPanel;
    private readonly ImageButton _cancelButton;
    private readonly ImageButton _confirmButton;
    private readonly Border _sizeBadge;
    private readonly TextBlock _sizeBadgeText;
    private readonly Rectangle _northHandle;
    private readonly Rectangle _southHandle;
    private readonly Rectangle _eastHandle;
    private readonly Rectangle _westHandle;
    private readonly Rectangle _northWestHandle;
    private readonly Rectangle _northEastHandle;
    private readonly Rectangle _southEastHandle;
    private readonly Rectangle _southWestHandle;
    private bool _isSelecting;
    private bool _selectionReady;
    private bool _isDraggingHandle;
    private bool _isDraggingSelection;
    private string _activeHandle = "";
    private Point _startPoint;
    private Point _endPoint;
    private Point _handleDragStart;
    private Point _selectionDragStart;
    private Rect _rectStart;
    private readonly RectInfo _overlayBounds;
    private readonly int? _fixedSelectionSize;
    private readonly bool _showBackdrop;
    private readonly bool _showInstructions;

    internal RectInfo? SelectedCaptureBounds { get; private set; }

    internal RegionSelectorWindow(
        RectInfo overlayBounds,
        RectInfo? initialCaptureBounds = null,
        int? fixedSelectionSize = null,
        bool showBackdrop = true,
        bool showInstructions = true)
    {
        _overlayBounds = overlayBounds;
        _fixedSelectionSize = fixedSelectionSize;
        _showBackdrop = showBackdrop;
        _showInstructions = showInstructions;

        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = true;
        Focusable = true;
        ResizeMode = ResizeMode.NoResize;
        WindowStartupLocation = WindowStartupLocation.Manual;
        Left = overlayBounds.X;
        Top = overlayBounds.Y;
        Width = overlayBounds.Width;
        Height = overlayBounds.Height;
        Title = "Tibia Mirror Region Selector";

        var root = new Grid
        {
            ClipToBounds = false,
            Background = Brushes.Transparent
        };
        if (_showBackdrop)
        {
            root.Children.Add(new Rectangle
            {
                Fill = new SolidColorBrush(Color.FromArgb(179, 0, 0, 0))
            });
        }

        _overlayCanvas = new Canvas
        {
            ClipToBounds = false,
            Background = Brushes.Transparent
        };
        root.Children.Add(_overlayCanvas);

        _selectionRectangle = new Rectangle
        {
            Stroke = Brushes.White,
            StrokeThickness = 2,
            Fill = Brushes.Transparent,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false
        };
        _overlayCanvas.Children.Add(_selectionRectangle);

        _instructionsText = new TextBlock
        {
            Text = "Clique e arraste para selecionar a area. ESC cancela.",
            Foreground = Brushes.White,
            FontSize = 16,
            FontWeight = FontWeights.Bold,
            TextAlignment = TextAlignment.Center,
            TextWrapping = TextWrapping.Wrap
        };

        _instructionsShell = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(204, 16, 20, 28)),
            BorderBrush = new SolidColorBrush(Color.FromArgb(120, 255, 255, 255)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(12, 10, 12, 10),
            Child = _instructionsText,
            Visibility = _showInstructions ? Visibility.Visible : Visibility.Collapsed
        };
        _overlayCanvas.Children.Add(_instructionsShell);

        _northHandle = CreateHandle("north", Cursors.SizeNS);
        _southHandle = CreateHandle("south", Cursors.SizeNS);
        _eastHandle = CreateHandle("east", Cursors.SizeWE);
        _westHandle = CreateHandle("west", Cursors.SizeWE);
        _northWestHandle = CreateHandle("northwest", Cursors.SizeNWSE, isCorner: true);
        _northEastHandle = CreateHandle("northeast", Cursors.SizeNESW, isCorner: true);
        _southEastHandle = CreateHandle("southeast", Cursors.SizeNWSE, isCorner: true);
        _southWestHandle = CreateHandle("southwest", Cursors.SizeNESW, isCorner: true);

        _cancelButton = CreateActionButton(
            "cancel-off.png",
            "cancel-on.png",
            "Cancelar selecao",
            OnCancelButtonClick);
        _confirmButton = CreateActionButton(
            "check-off.png",
            "check-on.png",
            "Confirmar selecao",
            ConfirmButton_Click);

        _actionButtonsPanel = new Grid
        {
            Width = (ActionButtonSize * 2) + ActionButtonGap,
            Height = ActionButtonSize,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = true
        };
        _actionButtonsPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(ActionButtonSize) });
        _actionButtonsPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(ActionButtonGap) });
        _actionButtonsPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(ActionButtonSize) });
        Grid.SetColumn(_cancelButton, 0);
        Grid.SetColumn(_confirmButton, 2);
        _actionButtonsPanel.Children.Add(_cancelButton);
        _actionButtonsPanel.Children.Add(_confirmButton);
        _overlayCanvas.Children.Add(_actionButtonsPanel);

        _sizeBadgeText = new TextBlock
        {
            Foreground = Brushes.White,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            TextAlignment = TextAlignment.Center
        };
        _sizeBadge = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(220, 31, 38, 49)),
            BorderBrush = new SolidColorBrush(Color.FromArgb(120, 88, 196, 112)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(8, 4, 8, 4),
            Child = _sizeBadgeText,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false
        };
        _overlayCanvas.Children.Add(_sizeBadge);

        Content = root;

        Loaded += OnLoaded;
        PreviewKeyDown += OnKeyDown;
        MouseLeftButtonDown += Overlay_MouseLeftButtonDown;
        MouseMove += Overlay_MouseMove;
        MouseLeftButtonUp += Overlay_MouseLeftButtonUp;

        if (initialCaptureBounds is not null)
        {
            ApplyInitialSelection(initialCaptureBounds);
        }
    }

    private void OnLoaded(object? sender, RoutedEventArgs e)
    {
        Activate();
        Focus();
        Keyboard.Focus(this);
        PositionInstructionBanner();

        if (_selectionRectangle.Visibility == Visibility.Visible)
        {
            UpdateSelectionMetadata();
        }

        if (_fixedSelectionSize is not null && !_selectionReady)
        {
            InstructionsSet("Mova o cursor, clique para posicionar o recorte rapido e confirme.");
        }
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CancelSelection();
            return;
        }

        if (e.Key == Key.Return && _selectionReady)
        {
            e.Handled = true;
            ConfirmSelection();
        }
    }

    private void Overlay_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        Activate();
        Focus();
        Keyboard.Focus(this);

        if (_isDraggingHandle)
        {
            return;
        }

        if (e.OriginalSource is DependencyObject source && FindParent<Button>(source) is not null)
        {
            return;
        }

        var position = e.GetPosition(_overlayCanvas);

        if (_selectionReady && GetCurrentSelectionRect().Contains(position))
        {
            _isDraggingSelection = true;
            _selectionDragStart = position;
            _rectStart = GetCurrentSelectionRect();
            CaptureMouse();
            e.Handled = true;
            return;
        }

        if (_fixedSelectionSize is not null && !_selectionReady)
        {
            ApplySelection(GetFixedSelectionRect(position));
            InstructionsSet("Arraste para ajustar, redimensione pelos pontos e confirme.");
            UpdateSelectionMetadata();
            return;
        }

        _isSelecting = true;
        _startPoint = position;
        _endPoint = _startPoint;
        _selectionRectangle.Visibility = Visibility.Visible;
        HideHandlesAndActions();
        InstructionsSet("Arraste para selecionar a area. Solte para continuar.");
        CaptureMouse();
        UpdateSelectionRectangle();
    }

    private void Overlay_MouseMove(object sender, MouseEventArgs e)
    {
        if (_isDraggingHandle)
        {
            UpdateHandleDrag(e.GetPosition(_overlayCanvas));
            return;
        }

        if (_isDraggingSelection)
        {
            UpdateSelectionDrag(e.GetPosition(_overlayCanvas));
            return;
        }

        if (_fixedSelectionSize is not null && !_selectionReady && !_isSelecting)
        {
            DrawSelection(GetFixedSelectionRect(e.GetPosition(_overlayCanvas)));
            UpdateSizeBadge(false);
            return;
        }

        if (!_isSelecting)
        {
            return;
        }

        _endPoint = e.GetPosition(_overlayCanvas);
        UpdateSelectionRectangle();
    }

    private void Overlay_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource is DependencyObject source && FindParent<Button>(source) is not null)
        {
            return;
        }

        if (_isDraggingHandle)
        {
            _isDraggingHandle = false;
            _activeHandle = "";
            ReleaseMouseCapture();
            UpdateSelectionMetadata();
            return;
        }

        if (_isDraggingSelection)
        {
            _isDraggingSelection = false;
            ReleaseMouseCapture();
            UpdateSelectionMetadata();
            return;
        }

        if (!_isSelecting)
        {
            return;
        }

        _isSelecting = false;
        ReleaseMouseCapture();

        var selection = GetCurrentSelectionRect();

        if (selection.Width >= MinimumSelectionSize && selection.Height >= MinimumSelectionSize)
        {
            ApplySelection(selection);
            InstructionsSet("Ajuste pelos pontos e confirme ou cancele.");
            return;
        }

        ResetSelection();
        InstructionsSet("Selecao muito pequena. Clique e arraste novamente.");
    }

    private Rectangle CreateHandle(string handleName, Cursor cursor, bool isCorner = false)
    {
        var size = isCorner ? CornerHandleSize : HandleSize;
        var handle = new Rectangle
        {
            Width = size,
            Height = size,
            Fill = AccentBrush,
            Visibility = Visibility.Collapsed,
            Cursor = cursor
        };

        handle.MouseLeftButtonDown += (_, e) => StartHandleDrag(handleName, e);
        _overlayCanvas.Children.Add(handle);
        return handle;
    }

    private ImageButton CreateActionButton(string normalImageName, string activeImageName, string tooltip, RoutedEventHandler clickHandler)
    {
        var button = new ImageButton(
            ResolveAssetPath(normalImageName),
            ResolveAssetPath(activeImageName))
        {
            Width = ActionButtonSize,
            Height = ActionButtonSize,
            ToolTip = tooltip
        };
        button.Click += clickHandler;
        return button;
    }

    private void StartHandleDrag(string handleName, MouseButtonEventArgs e)
    {
        if (_selectionRectangle.Visibility != Visibility.Visible)
        {
            return;
        }

        _isDraggingHandle = true;
        _activeHandle = handleName;
        _handleDragStart = e.GetPosition(_overlayCanvas);
        _rectStart = GetCurrentSelectionRect();
        Activate();
        Focus();
        Keyboard.Focus(this);
        CaptureMouse();
        e.Handled = true;
    }

    private void UpdateHandleDrag(Point currentPosition)
    {
        var deltaX = currentPosition.X - _handleDragStart.X;
        var deltaY = currentPosition.Y - _handleDragStart.Y;
        var nextRect = _rectStart;

        if (_activeHandle == "north")
        {
            nextRect.Y = Clamp(_rectStart.Y + deltaY, 0, _rectStart.Bottom - MinimumSelectionSize);
            nextRect.Height = _rectStart.Bottom - nextRect.Y;
        }
        else if (_activeHandle == "south")
        {
            nextRect.Height = Clamp(_rectStart.Height + deltaY, MinimumSelectionSize, ActualHeight - _rectStart.Y);
        }
        else if (_activeHandle == "east")
        {
            nextRect.Width = Clamp(_rectStart.Width + deltaX, MinimumSelectionSize, ActualWidth - _rectStart.X);
        }
        else if (_activeHandle == "west")
        {
            nextRect.X = Clamp(_rectStart.X + deltaX, 0, _rectStart.Right - MinimumSelectionSize);
            nextRect.Width = _rectStart.Right - nextRect.X;
        }
        else
        {
            nextRect = CalculateCornerResizeRect(currentPosition);
        }

        DrawSelection(nextRect);
        UpdateSelectionMetadata();
    }

    private Rect CalculateCornerResizeRect(Point currentPosition)
    {
        var ratio = Math.Max(0.01, _rectStart.Width / Math.Max(1, _rectStart.Height));
        var deltaX = currentPosition.X - _handleDragStart.X;
        var deltaY = currentPosition.Y - _handleDragStart.Y;
        double widthCandidate;
        double heightCandidate;
        double nextWidth;
        double nextHeight;

        switch (_activeHandle)
        {
            case "northwest":
                widthCandidate = _rectStart.Width - deltaX;
                heightCandidate = _rectStart.Height - deltaY;
                break;
            case "northeast":
                widthCandidate = _rectStart.Width + deltaX;
                heightCandidate = _rectStart.Height - deltaY;
                break;
            case "southwest":
                widthCandidate = _rectStart.Width - deltaX;
                heightCandidate = _rectStart.Height + deltaY;
                break;
            default:
                widthCandidate = _rectStart.Width + deltaX;
                heightCandidate = _rectStart.Height + deltaY;
                break;
        }

        widthCandidate = Math.Max(MinimumSelectionSize, widthCandidate);
        heightCandidate = Math.Max(MinimumSelectionSize, heightCandidate);

        if (Math.Abs(widthCandidate - _rectStart.Width) >= Math.Abs((heightCandidate * ratio) - _rectStart.Width))
        {
            nextWidth = widthCandidate;
            nextHeight = nextWidth / ratio;
        }
        else
        {
            nextHeight = heightCandidate;
            nextWidth = nextHeight * ratio;
        }

        nextWidth = Math.Max(MinimumSelectionSize, nextWidth);
        nextHeight = Math.Max(MinimumSelectionSize, nextHeight);

        double nextX;
        double nextY;

        switch (_activeHandle)
        {
            case "northwest":
                nextX = _rectStart.Right - nextWidth;
                nextY = _rectStart.Bottom - nextHeight;
                break;
            case "northeast":
                nextX = _rectStart.X;
                nextY = _rectStart.Bottom - nextHeight;
                break;
            case "southwest":
                nextX = _rectStart.Right - nextWidth;
                nextY = _rectStart.Y;
                break;
            default:
                nextX = _rectStart.X;
                nextY = _rectStart.Y;
                break;
        }

        nextX = Clamp(nextX, 0, Math.Max(0, ActualWidth - nextWidth));
        nextY = Clamp(nextY, 0, Math.Max(0, ActualHeight - nextHeight));
        nextWidth = Clamp(nextWidth, MinimumSelectionSize, Math.Max(MinimumSelectionSize, ActualWidth - nextX));
        nextHeight = Clamp(nextHeight, MinimumSelectionSize, Math.Max(MinimumSelectionSize, ActualHeight - nextY));

        return new Rect(nextX, nextY, nextWidth, nextHeight);
    }

    private void UpdateSelectionDrag(Point currentPosition)
    {
        var deltaX = currentPosition.X - _selectionDragStart.X;
        var deltaY = currentPosition.Y - _selectionDragStart.Y;
        var nextRect = new Rect(
            Clamp(_rectStart.X + deltaX, 0, Math.Max(0, ActualWidth - _rectStart.Width)),
            Clamp(_rectStart.Y + deltaY, 0, Math.Max(0, ActualHeight - _rectStart.Height)),
            _rectStart.Width,
            _rectStart.Height);

        DrawSelection(nextRect);
        UpdateSelectionMetadata();
    }

    private void ConfirmButton_Click(object sender, RoutedEventArgs e)
    {
        ConfirmSelection();
    }

    private void OnCancelButtonClick(object sender, RoutedEventArgs e)
    {
        CancelSelection();
    }

    private void CancelSelection()
    {
        DialogResult = false;
        Close();
    }

    private void ConfirmSelection()
    {
        var selection = GetCurrentSelectionRect();

        if (selection.Width < MinimumSelectionSize || selection.Height < MinimumSelectionSize)
        {
            return;
        }

        SelectedCaptureBounds = new RectInfo
        {
            X = (int)Math.Round(Left + selection.X),
            Y = (int)Math.Round(Top + selection.Y),
            Width = (int)Math.Round(selection.Width),
            Height = (int)Math.Round(selection.Height)
        };

        DialogResult = true;
        Close();
    }

    private void ApplyInitialSelection(RectInfo initialCaptureBounds)
    {
        var selection = new Rect(
            initialCaptureBounds.X - _overlayBounds.X,
            initialCaptureBounds.Y - _overlayBounds.Y,
            initialCaptureBounds.Width,
            initialCaptureBounds.Height);

        selection.X = Clamp(selection.X, 0, Math.Max(0, Width - selection.Width));
        selection.Y = Clamp(selection.Y, 0, Math.Max(0, Height - selection.Height));
        selection.Width = Clamp(selection.Width, MinimumSelectionSize, Math.Max(MinimumSelectionSize, Width - selection.X));
        selection.Height = Clamp(selection.Height, MinimumSelectionSize, Math.Max(MinimumSelectionSize, Height - selection.Y));

        ApplySelection(selection);
        InstructionsSet("Ajuste pelos pontos e confirme ou cancele.");
    }

    private void ApplySelection(Rect selection)
    {
        _selectionReady = true;
        DrawSelection(selection);
        UpdateSelectionMetadata();
    }

    private void UpdateSelectionRectangle()
    {
        DrawSelection(GetNormalizedRect(_startPoint, _endPoint));
        UpdateSelectionMetadata();
    }

    private void DrawSelection(Rect selection)
    {
        _selectionRectangle.Visibility = Visibility.Visible;
        Canvas.SetLeft(_selectionRectangle, selection.X);
        Canvas.SetTop(_selectionRectangle, selection.Y);
        _selectionRectangle.Width = selection.Width;
        _selectionRectangle.Height = selection.Height;
        UpdateSizeBadge(_isSelecting || _isDraggingHandle || _isDraggingSelection);
    }

    private void UpdateSelectionMetadata()
    {
        if (_selectionRectangle.Visibility != Visibility.Visible)
        {
            return;
        }

        _selectionReady = true;
        ShowHandles();
        PositionActionButtons();
        PositionInstructionBanner();
    }

    private void ShowHandles()
    {
        var rect = GetCurrentSelectionRect();
        var left = rect.X;
        var top = rect.Y;
        var right = rect.Right;
        var bottom = rect.Bottom;
        var middleX = left + (rect.Width / 2);
        var middleY = top + (rect.Height / 2);

        PositionHandle(_northHandle, middleX - (HandleSize / 2), top - (HandleSize / 2));
        PositionHandle(_southHandle, middleX - (HandleSize / 2), bottom - (HandleSize / 2));
        PositionHandle(_eastHandle, right - (HandleSize / 2), middleY - (HandleSize / 2));
        PositionHandle(_westHandle, left - (HandleSize / 2), middleY - (HandleSize / 2));
        PositionHandle(_northWestHandle, left - (CornerHandleSize / 2), top - (CornerHandleSize / 2));
        PositionHandle(_northEastHandle, right - (CornerHandleSize / 2), top - (CornerHandleSize / 2));
        PositionHandle(_southEastHandle, right - (CornerHandleSize / 2), bottom - (CornerHandleSize / 2));
        PositionHandle(_southWestHandle, left - (CornerHandleSize / 2), bottom - (CornerHandleSize / 2));
    }

    private void PositionHandle(FrameworkElement handle, double left, double top)
    {
        handle.Visibility = Visibility.Visible;
        Canvas.SetLeft(handle, left);
        Canvas.SetTop(handle, top);
        Panel.SetZIndex(handle, 20);
    }

    private void PositionActionButtons()
    {
        var rect = GetCurrentSelectionRect();
        var panelWidth = (ActionButtonSize * 2) + ActionButtonGap;
        const double selectionGap = 12;
        var left = rect.X + (rect.Width / 2) - (panelWidth / 2);
        var top = rect.Y - ActionButtonSize - selectionGap;

        if (top < 10)
        {
            top = rect.Bottom + selectionGap;
        }

        if (top + ActionButtonSize > ActualHeight - 10)
        {
            top = Math.Max(10, rect.Y - ActionButtonSize - selectionGap);
        }

        left = Clamp(left, 10, Math.Max(10, ActualWidth - panelWidth - 10));
        top = Clamp(top, 10, Math.Max(10, ActualHeight - ActionButtonSize - 10));

        Canvas.SetLeft(_actionButtonsPanel, left);
        Canvas.SetTop(_actionButtonsPanel, top);
        Panel.SetZIndex(_actionButtonsPanel, 30);
        _actionButtonsPanel.Visibility = Visibility.Visible;
    }

    private void PositionInstructionBanner()
    {
        if (!_showInstructions)
        {
            _instructionsShell.Visibility = Visibility.Collapsed;
            return;
        }

        _instructionsShell.Measure(new Size(Math.Max(240, ActualWidth - 80), double.PositiveInfinity));
        var width = Math.Min(_instructionsShell.DesiredSize.Width, Math.Max(240, ActualWidth - 80));
        _instructionsShell.Width = width;

        double left;
        double top;

        if (_selectionReady && _actionButtonsPanel.Visibility == Visibility.Visible)
        {
            var buttonsLeft = Canvas.GetLeft(_actionButtonsPanel);
            var buttonsTop = Canvas.GetTop(_actionButtonsPanel);
            var panelWidth = (ActionButtonSize * 2) + ActionButtonGap;
            left = buttonsLeft + (panelWidth / 2) - (width / 2);
            top = buttonsTop - _instructionsShell.DesiredSize.Height - 10;

            if (top < 10)
            {
                top = 12;
            }
        }
        else
        {
            left = (ActualWidth - width) / 2;
            top = 20;
        }

        left = Clamp(left, 10, Math.Max(10, ActualWidth - width - 10));
        Canvas.SetLeft(_instructionsShell, left);
        Canvas.SetTop(_instructionsShell, top);
        Panel.SetZIndex(_instructionsShell, 25);
    }

    private void UpdateSizeBadge(bool visible)
    {
        if (!visible || _selectionRectangle.Visibility != Visibility.Visible)
        {
            _sizeBadge.Visibility = Visibility.Collapsed;
            return;
        }

        var rect = GetCurrentSelectionRect();
        _sizeBadgeText.Text = $"{Math.Max(1, (int)Math.Round(rect.Width))}px x {Math.Max(1, (int)Math.Round(rect.Height))}px";
        _sizeBadge.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));

        var left = rect.X + (rect.Width / 2) - (_sizeBadge.DesiredSize.Width / 2);
        var top = rect.Bottom + 14;

        if (top + _sizeBadge.DesiredSize.Height > ActualHeight - 10)
        {
            top = rect.Y - _sizeBadge.DesiredSize.Height - 14;
        }

        left = Clamp(left, 10, Math.Max(10, ActualWidth - _sizeBadge.DesiredSize.Width - 10));
        top = Clamp(top, 10, Math.Max(10, ActualHeight - _sizeBadge.DesiredSize.Height - 10));

        Canvas.SetLeft(_sizeBadge, left);
        Canvas.SetTop(_sizeBadge, top);
        Panel.SetZIndex(_sizeBadge, 24);
        _sizeBadge.Visibility = Visibility.Visible;
    }

    private void HideHandlesAndActions()
    {
        _northHandle.Visibility = Visibility.Collapsed;
        _southHandle.Visibility = Visibility.Collapsed;
        _eastHandle.Visibility = Visibility.Collapsed;
        _westHandle.Visibility = Visibility.Collapsed;
        _northWestHandle.Visibility = Visibility.Collapsed;
        _northEastHandle.Visibility = Visibility.Collapsed;
        _southEastHandle.Visibility = Visibility.Collapsed;
        _southWestHandle.Visibility = Visibility.Collapsed;
        _actionButtonsPanel.Visibility = Visibility.Collapsed;
        _sizeBadge.Visibility = Visibility.Collapsed;
        _selectionReady = false;
    }

    private void ResetSelection()
    {
        _selectionRectangle.Visibility = Visibility.Collapsed;
        HideHandlesAndActions();
        PositionInstructionBanner();
    }

    private void InstructionsSet(string text)
    {
        _instructionsText.Text = text;
        PositionInstructionBanner();
    }

    private Rect GetCurrentSelectionRect()
    {
        return new Rect(
            Canvas.GetLeft(_selectionRectangle),
            Canvas.GetTop(_selectionRectangle),
            _selectionRectangle.Width,
            _selectionRectangle.Height);
    }

    private static Rect GetNormalizedRect(Point start, Point end)
    {
        var x = Math.Min(start.X, end.X);
        var y = Math.Min(start.Y, end.Y);
        var width = Math.Abs(end.X - start.X);
        var height = Math.Abs(end.Y - start.Y);
        return new Rect(x, y, width, height);
    }

    private Rect GetFixedSelectionRect(Point position)
    {
        var size = Math.Max(1, _fixedSelectionSize ?? 32);
        var x = Clamp(position.X - (size / 2.0), 0, Math.Max(0, ActualWidth - size));
        var y = Clamp(position.Y - (size / 2.0), 0, Math.Max(0, ActualHeight - size));
        return new Rect(x, y, size, size);
    }

    private static double Clamp(double value, double min, double max)
    {
        return Math.Min(Math.Max(value, min), max);
    }

    private static T? FindParent<T>(DependencyObject? node) where T : DependencyObject
    {
        while (node is not null)
        {
            if (node is T match)
            {
                return match;
            }

            node = VisualTreeHelper.GetParent(node);
        }

        return null;
    }

    private static string ResolveAssetPath(string fileName)
    {
        return System.IO.Path.Combine(AppContext.BaseDirectory, "Assets", "selector", fileName);
    }

    private sealed class ImageButton : Button
    {
        private readonly Image _image;
        private readonly BitmapImage? _normalSource;
        private readonly BitmapImage? _activeSource;

        internal ImageButton(string normalPath, string activePath)
        {
            _normalSource = LoadBitmap(normalPath);
            _activeSource = LoadBitmap(activePath) ?? _normalSource;
            _image = new Image
            {
                Stretch = Stretch.Fill,
                Width = ActionButtonSize,
                Height = ActionButtonSize,
                Source = _normalSource
            };

            Background = Brushes.Transparent;
            BorderThickness = new Thickness(0);
            Padding = new Thickness(0);
            Width = ActionButtonSize;
            Height = ActionButtonSize;
            Cursor = Cursors.Hand;
            Focusable = false;
            Content = _image;

            // Keep the selector image-only even when the Windows theme is active.
            var contentPresenter = new FrameworkElementFactory(typeof(ContentPresenter));
            contentPresenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            contentPresenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            Template = new ControlTemplate(typeof(Button))
            {
                VisualTree = contentPresenter
            };

            MouseEnter += (_, _) => UpdateVisualState(true);
            MouseLeave += (_, _) => UpdateVisualState(false);
            PreviewMouseLeftButtonDown += (_, _) => UpdateVisualState(true);
            PreviewMouseLeftButtonUp += (_, _) => UpdateVisualState(IsMouseOver);
        }

        private void UpdateVisualState(bool active)
        {
            _image.Source = active ? (_activeSource ?? _normalSource) : _normalSource;
        }

        private static BitmapImage? LoadBitmap(string path)
        {
            if (File.Exists(path))
            {
                var image = new BitmapImage();
                image.BeginInit();
                image.CacheOption = BitmapCacheOption.OnLoad;
                image.UriSource = new Uri(path, UriKind.Absolute);
                image.EndInit();
                image.Freeze();
                return image;
            }

            try
            {
                var fileName = System.IO.Path.GetFileName(path);
                var image = new BitmapImage();
                image.BeginInit();
                image.CacheOption = BitmapCacheOption.OnLoad;
                image.UriSource = new Uri($"pack://application:,,,/Assets/selector/{fileName}", UriKind.Absolute);
                image.EndInit();
                image.Freeze();
                return image;
            }
            catch
            {
                return null;
            }
        }
    }
}
