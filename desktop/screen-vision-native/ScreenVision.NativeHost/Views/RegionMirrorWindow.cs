using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using ScreenVision.NativeHost.Host;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

internal sealed class RegionMirrorWindow : Window
{
    private static RegionMirrorWindow? _activeContextMenuOwner;
    private static readonly GlobalMouseClickListener ContextMenuMouseClickListener = CreateContextMenuMouseClickListener();
    private const double MirrorFramePadding = 12;
    private static readonly SolidColorBrush MirrorAccentBrush = new(Color.FromRgb(88, 196, 112));
    private readonly Border _selectionBorder;
    private readonly Border _interactionSurface;
    private readonly Border _glowOuter;
    private readonly Border _glowMid;
    private readonly Border _glowInner;
    private readonly Border _flashBorder;
    private readonly Path _resizeHandle;
    private readonly Border _resizeInfoBadge;
    private readonly TextBlock _resizeInfoText;
    private readonly DispatcherTimer _boundsChangedTimer;
    private readonly DispatcherTimer _countdownTimer;
    private readonly DispatcherTimer _contextMenuTopmostRepairTimer = new()
    {
        Interval = TimeSpan.FromMilliseconds(450)
    };
    private MirrorWindowSpec _spec;
    private IntPtr _sourceHwnd;
    private IntPtr _thumbnail;
    private bool _globalVisible = true;
    private bool _isDragging;
    private bool _isResizing;
    private bool _suspendBoundsEvents;
    private bool _suppressClosedEvent;
    private readonly Func<IEnumerable<RegionMirrorWindow>>? _getAllMirrorWindows;
    private SnapGroup? _currentSnapGroup;
    private DateTime _lastUnsnapTime = DateTime.MinValue;
    private bool _skipSnapOnNextDragStart;
    private bool _skipSnapForCurrentDrag;
    private IntPtr _windowHandle;
    private bool _alwaysOnTop = true;
    private Point _dragStartPoint;
    private Point _lastMousePosition;
    private Point _resizeStartPoint;
    private double _resizeStartWidth;
    private double _resizeStartHeight;
    private RectInfo? _lastReportedBounds;
    private string _lastThumbnailDiagnostic = "";
    private CountdownBarWindow? _countdownBarWindow;
    private DispatcherTimer? _flashTimer;
    private bool _isCountdownRunning;
    private DateTime _countdownEndTime;
    private double _currentScale;
    private bool _isDraggingGlowIntensity;
    private bool? _appliedLockState;
    private bool? _appliedAlwaysOnTop;
    private IntPtr _appliedZOrderSourceHwnd;
    private DateTime _preserveLocalBoundsUntilUtc = DateTime.MinValue;
    private DateTime _preserveInteractionUntilUtc = DateTime.MinValue;
    private DateTime _suppressContextMenuOpenUntilUtc = DateTime.MinValue;

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out NativePoint point);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint
    {
        internal int X;
        internal int Y;
    }

    internal string RegionId => _spec.Id;
    internal bool IsLocked => _spec.IsLocked;
    internal bool AllowSnapping => _spec.AllowSnapping;
    internal bool IsOverlayVisible => _globalVisible && _spec.IsVisible && _sourceHwnd != IntPtr.Zero;
    internal bool IsAlwaysOnTop => _alwaysOnTop;
    internal bool IsInteractionActive => _isDragging
        || _isResizing
        || _currentSnapGroup?.IsDragging == true
        || !_spec.IsLocked
        || ContextMenu?.IsOpen == true
        || DateTime.UtcNow < _preserveInteractionUntilUtc;
    private double MirrorVisualOpacity => Math.Clamp(_spec.Opacity / 100.0, 0.15, 1.0);
    internal IntPtr SourceHwnd => _sourceHwnd;
    internal event EventHandler<RectInfo>? BoundsChanged;

    internal event EventHandler<RegionMirrorActionEventArgs>? ActionRequested;

    internal void PromoteForInteraction()
    {
        WindowStyleInterop.BringWindowToFrontNoActivate(_windowHandle, _alwaysOnTop);
    }

    internal void FlushInteractionBounds()
    {
        FlushBoundsChanged();
    }

    internal event EventHandler<string>? ClosedByUser;

    internal RegionMirrorWindow(MirrorWindowSpec spec, Func<IEnumerable<RegionMirrorWindow>>? getAllMirrorWindows = null)
    {
        _spec = spec;
        _getAllMirrorWindows = getAllMirrorWindows;

        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        ResizeMode = ResizeMode.NoResize;
        Width = spec.MirrorBounds.Width;
        Height = spec.MirrorBounds.Height;
        Left = spec.MirrorBounds.X;
        Top = spec.MirrorBounds.Y;
        // OBS targets these windows by title. Keep it independent from the
        // user-editable card name so a rename never breaks a capture source.
        Title = BuildObsWindowTitle(spec.Id);

        var grid = new Grid
        {
            ClipToBounds = false,
            Background = Brushes.Transparent
        };

        _interactionSurface = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(1, 255, 255, 255)),
            Cursor = Cursors.SizeAll,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Stretch
        };
        grid.Children.Add(_interactionSurface);

        _glowOuter = CreateGlowBorder();
        _glowMid = CreateGlowBorder();
        _glowInner = CreateGlowBorder();
        grid.Children.Add(_glowOuter);
        grid.Children.Add(_glowMid);
        grid.Children.Add(_glowInner);

        _selectionBorder = new Border
        {
            BorderBrush = MirrorAccentBrush,
            BorderThickness = new Thickness(3),
            CornerRadius = new CornerRadius(0),
            Background = Brushes.Transparent,
            Cursor = Cursors.SizeAll,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Stretch
        };

        _resizeHandle = new Path
        {
            Width = 15,
            Height = 15,
            Fill = Brushes.White,
            Stroke = new SolidColorBrush(Color.FromRgb(128, 128, 128)),
            StrokeThickness = 1,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Bottom,
            Margin = new Thickness(0, 0, 2, 2),
            Data = Geometry.Parse("M0,15 L15,0 L15,15")
        };

        grid.Children.Add(_selectionBorder);
        grid.Children.Add(_resizeHandle);
        Panel.SetZIndex(_selectionBorder, 6);
        Panel.SetZIndex(_resizeHandle, 8);

        _resizeInfoText = new TextBlock
        {
            Foreground = Brushes.White,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            TextAlignment = TextAlignment.Center
        };
        _resizeInfoBadge = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(220, 31, 38, 49)),
            BorderBrush = new SolidColorBrush(Color.FromArgb(120, 88, 196, 112)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(8, 4, 8, 4),
            Child = _resizeInfoText,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Bottom,
            Margin = new Thickness(0, 0, 0, -34)
        };
        grid.Children.Add(_resizeInfoBadge);
        Panel.SetZIndex(_resizeInfoBadge, 10);

        _flashBorder = new Border
        {
            BorderBrush = Brushes.White,
            BorderThickness = new Thickness(1.25),
            CornerRadius = new CornerRadius(4),
            Background = Brushes.Transparent,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Stretch,
            Margin = new Thickness(MirrorFramePadding - 0.5)
        };

        _flashBorder.Effect = new System.Windows.Media.Effects.DropShadowEffect
        {
            BlurRadius = 10,
            ShadowDepth = 0,
            Color = Colors.White,
            Opacity = 0.95
        };

        grid.Children.Add(_flashBorder);
        Content = grid;
        ContextMenu = new ContextMenu { StaysOpen = false };
        MirrorContextMenuTheme.Apply(ContextMenu);
        ContextMenu.Opened += (_, _) =>
        {
            CloseActiveContextMenu();
            _activeContextMenuOwner = this;
            Console.Error.WriteLine($"mirror-context-menu id={_spec.Id} state=opened");
            StartContextMenuPromotion();
            ContextMenuMouseClickListener.Start();
        };
        ContextMenu.Closed += (_, _) =>
        {
            _preserveInteractionUntilUtc = DateTime.UtcNow.AddMilliseconds(900);
            if (ReferenceEquals(_activeContextMenuOwner, this))
            {
                _activeContextMenuOwner = null;
                ContextMenuMouseClickListener.Stop();
            }
            Console.Error.WriteLine($"mirror-context-menu id={_spec.Id} state=closed");
            _contextMenuTopmostRepairTimer.Stop();
            _contextMenuTopmostRepairTimer.Start();
        };
        UpdateContextMenuItems();

        _boundsChangedTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(180)
        };
        _boundsChangedTimer.Tick += OnBoundsChangedTimerTick;
        _countdownTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(16)
        };
        _countdownTimer.Tick += OnCountdownTimerTick;
        _contextMenuTopmostRepairTimer.Tick += (_, _) =>
        {
            _contextMenuTopmostRepairTimer.Stop();
            if (!IsLoaded || !IsOverlayVisible)
            {
                return;
            }

            var tibiaInfo = WindowProbe.GetTibiaWindowInfo();
            var shouldBeTopmost = tibiaInfo?.IsForeground == true;
            var nativeTopmostBefore = WindowStyleInterop.IsWindowAlwaysOnTop(_windowHandle);
            var repairSucceeded = true;
            var repairError = 0;
            if (shouldBeTopmost)
            {
                (repairSucceeded, repairError) = RepairAlwaysOnTopAfterContextMenu();
            }

            Console.Error.WriteLine(
                $"mirror-context-menu id={_spec.Id} state=topmost-checked should={shouldBeTopmost} before={nativeTopmostBefore} after={WindowStyleInterop.IsWindowAlwaysOnTop(_windowHandle)} repaired={repairSucceeded} error={repairError} thumbnail={_thumbnail}");
        };
        SourceInitialized += OnSourceInitialized;
        Closed += OnClosed;
        SizeChanged += OnWindowSizeChanged;
        LocationChanged += OnWindowLocationChanged;
        MouseLeftButtonDown += OnMouseLeftButtonDown;
        MouseMove += OnMouseMove;
        MouseLeftButtonUp += OnMouseLeftButtonUp;
        MouseRightButtonUp += OnMouseRightButtonUp;
        grid.MouseLeftButtonDown += OnMouseLeftButtonDown;
        grid.MouseMove += OnMouseMove;
        grid.MouseLeftButtonUp += OnMouseLeftButtonUp;
        grid.MouseRightButtonUp += OnMouseRightButtonUp;
        _interactionSurface.MouseLeftButtonDown += OnMouseLeftButtonDown;
        _interactionSurface.MouseMove += OnMouseMove;
        _interactionSurface.MouseLeftButtonUp += OnMouseLeftButtonUp;
        _interactionSurface.MouseRightButtonUp += OnMouseRightButtonUp;
        _selectionBorder.MouseLeftButtonDown += OnMouseLeftButtonDown;
        _selectionBorder.MouseMove += OnMouseMove;
        _selectionBorder.MouseLeftButtonUp += OnMouseLeftButtonUp;
        _selectionBorder.MouseRightButtonUp += OnMouseRightButtonUp;
        _resizeHandle.MouseLeftButtonDown += OnResizeHandleMouseDown;

        ApplyLockState();
        ApplyOpacity();
        ApplyCountdownSpec();
        ApplyGlowState();
        _currentScale = ResolveCurrentScale();
        UpdateFlashBorderGeometry();
    }

    internal void ApplySpec(MirrorWindowSpec spec, TibiaWindowInfo? tibiaInfo)
    {
        var previousSpec = _spec;
        var sourceBoundsChanged = !AreBoundsEqual(previousSpec.CaptureBounds, spec.CaptureBounds)
            || !AreBoundsEqual(previousSpec.RelativeBounds, spec.RelativeBounds);
        _spec = spec;
        Title = BuildObsWindowTitle(spec.Id);
        var preserveLocalBounds = IsInteractionActive || DateTime.UtcNow < _preserveLocalBoundsUntilUtc;
        if (!preserveLocalBounds)
        {
            var currentBounds = GetCurrentMirrorBounds();
            if (!AreBoundsEqual(currentBounds, spec.MirrorBounds))
            {
                _suspendBoundsEvents = true;
                Left = spec.MirrorBounds.X;
                Top = spec.MirrorBounds.Y;
                Width = Math.Max(24, spec.MirrorBounds.Width);
                Height = Math.Max(24, spec.MirrorBounds.Height);
                _suspendBoundsEvents = false;
            }

            _lastReportedBounds = spec.MirrorBounds;
        }
        _currentScale = ResolveCurrentScale();
        ApplyOpacity();
        ApplyLockState();
        ApplyGlowState();
        ApplyCountdownSpec();
        UpdateSourceHandle(tibiaInfo);
        if (sourceBoundsChanged && _thumbnail != IntPtr.Zero)
        {
            UpdateThumbnail();
        }
        ApplyVisibilityState();

        if (ContextMenu?.IsOpen != true)
        {
            UpdateContextMenuItems();
        }
    }

    private static Border CreateGlowBorder()
    {
        return new Border
        {
            Background = Brushes.Transparent,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Stretch
        };
    }

    private static string BuildObsWindowTitle(string regionId)
    {
        return $"TibiaToolkit Mirror {regionId}";
    }

    internal void ApplyPreviewOpacity(int opacity)
    {
        var nextOpacity = Math.Clamp(opacity, 15, 100);

        if (_spec.Opacity == nextOpacity)
        {
            return;
        }

        _spec = CloneSpecWithOpacity(nextOpacity);
        ApplyOpacity();
        UpdateThumbnail();
    }

    internal void CloseProgrammatically()
    {
        _suppressClosedEvent = true;
        Close();
    }

    internal void SetMirrorsVisible(bool visible, TibiaWindowInfo? tibiaInfo)
    {
        if (!visible && ReferenceEquals(_activeContextMenuOwner, this))
        {
            CloseActiveContextMenu();
        }

        var nextSourceHandle = tibiaInfo is null ? IntPtr.Zero : new IntPtr(tibiaInfo.Hwnd);
        if (_globalVisible == visible
            && nextSourceHandle == _sourceHwnd
            && (_sourceHwnd == IntPtr.Zero || _thumbnail != IntPtr.Zero))
        {
            return;
        }

        _globalVisible = visible;
        UpdateSourceHandle(tibiaInfo);
        ApplyVisibilityState();
    }

    internal void SetAlwaysOnTop(bool enabled)
    {
        if (_appliedAlwaysOnTop == enabled
            && _appliedZOrderSourceHwnd == _sourceHwnd
            && Topmost == enabled
            && (_windowHandle == IntPtr.Zero || WindowStyleInterop.IsWindowAlwaysOnTop(_windowHandle) == enabled))
        {
            return;
        }

        _alwaysOnTop = enabled;
        Topmost = enabled;

        if (_windowHandle != IntPtr.Zero)
        {
            if (enabled || _sourceHwnd == IntPtr.Zero)
            {
                WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, enabled);
            }
            else
            {
                WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, false);
                WindowStyleInterop.PlaceWindowAbove(_windowHandle, _sourceHwnd);
            }
        }

        if (_countdownBarWindow is not null)
        {
            if (enabled || _sourceHwnd == IntPtr.Zero)
            {
                _countdownBarWindow.SetAlwaysOnTop(enabled);
            }
            else
            {
                _countdownBarWindow.PlaceAboveSource(_sourceHwnd);
            }
        }
        _currentSnapGroup?.SyncTopmostFromWindows();
        _appliedAlwaysOnTop = enabled;
        _appliedZOrderSourceHwnd = _sourceHwnd;
    }

    private (bool Success, int Error) RepairAlwaysOnTopAfterContextMenu()
    {
        if (_windowHandle == IntPtr.Zero)
        {
            return (false, 0);
        }

        _alwaysOnTop = true;

        // Toggle the managed flag as well. ContextMenu teardown can leave WPF's
        // cached value at true even though Windows removed WS_EX_TOPMOST.
        Topmost = false;
        Topmost = true;

        var success = WindowStyleInterop.ForceWindowAlwaysOnTop(_windowHandle, out var error);
        _appliedAlwaysOnTop = true;
        _appliedZOrderSourceHwnd = _sourceHwnd;
        _currentSnapGroup?.SyncTopmostFromWindows();
        return (success, error);
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        _windowHandle = new WindowInteropHelper(this).Handle;
        WindowStyleInterop.EnableToolWindow(_windowHandle);
        WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, _alwaysOnTop);
        ApplyWindowBehavior();
        _appliedLockState = _spec.IsLocked;
        UpdateSourceHandle(WindowProbe.GetTibiaWindowInfo());
        ApplyVisibilityState();
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        _boundsChangedTimer.Stop();
        _countdownTimer.Stop();
        _contextMenuTopmostRepairTimer.Stop();
        if (ReferenceEquals(_activeContextMenuOwner, this))
        {
            _activeContextMenuOwner = null;
            ContextMenuMouseClickListener.Stop();
        }
        _flashTimer?.Stop();
        _currentSnapGroup?.RemoveWindow(this);
        HideCountdownBar();

        if (_countdownBarWindow is not null)
        {
            try
            {
                _countdownBarWindow.Close();
            }
            catch
            {
            }

            _countdownBarWindow = null;
        }

        UnregisterThumbnail();

        if (!_suppressClosedEvent)
        {
            ClosedByUser?.Invoke(this, _spec.Id);
        }
    }

    private void OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (_spec.IsLocked || e.ChangedButton != MouseButton.Left)
        {
            return;
        }

        try
        {
            CloseActiveContextMenu();
            Console.Error.WriteLine($"mirror-interaction id={_spec.Id} action=left-down opacity={_spec.Opacity}");
            BringInteractionLayerToFront();
            _isDragging = true;
            _skipSnapForCurrentDrag = _skipSnapOnNextDragStart;
            _skipSnapOnNextDragStart = false;
            _dragStartPoint = e.GetPosition(this);
            _lastMousePosition = PointToScreen(_dragStartPoint);
            if (_currentSnapGroup is not null && _currentSnapGroup.Windows.Count > 1)
            {
                _currentSnapGroup.PrepareGroupMove();
            }
            CaptureMouse();
            e.Handled = true;
        }
        catch
        {
            _isDragging = false;
        }
    }

    private void OnResizeHandleMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (_spec.IsLocked || e.ChangedButton != MouseButton.Left)
        {
            return;
        }

        _isResizing = true;
        _resizeStartPoint = PointToScreen(e.GetPosition(this));
        _resizeStartWidth = Width;
        _resizeStartHeight = Height;
        CaptureMouse();
        UpdateResizeInfoBadge();
        e.Handled = true;
    }

    private void OnMouseMove(object sender, MouseEventArgs e)
    {
        if (_isDragging && IsMouseCaptured)
        {
            var currentPoint = PointToScreen(e.GetPosition(this));
            var deltaX = currentPoint.X - _lastMousePosition.X;
            var deltaY = currentPoint.Y - _lastMousePosition.Y;

            if (Math.Abs(deltaX) > 0.1 || Math.Abs(deltaY) > 0.1)
            {
                if (_currentSnapGroup is not null && _currentSnapGroup.Windows.Count > 1 && _currentSnapGroup.IsDragging)
                {
                    _currentSnapGroup.MoveGroup(new Vector(currentPoint.X - _lastMousePosition.X, currentPoint.Y - _lastMousePosition.Y));
                }
                else
                {
                    Left += deltaX;
                    Top += deltaY;
                    if (!_skipSnapForCurrentDrag)
                    {
                        TrySnapToOtherWindows();
                    }
                }
                _lastMousePosition = currentPoint;
            }

            e.Handled = true;
            return;
        }

        if (!_isResizing)
        {
            return;
        }

        var resizePoint = PointToScreen(e.GetPosition(this));
        var resizeDeltaX = resizePoint.X - _resizeStartPoint.X;
        var resizeDeltaY = resizePoint.Y - _resizeStartPoint.Y;
        var nextWidth = Math.Max(24, _resizeStartWidth + resizeDeltaX);
        var nextHeight = Math.Max(24, _resizeStartHeight + resizeDeltaY);

        if ((Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift)
        {
            var ratio = Math.Max(0.05, _resizeStartWidth / Math.Max(1.0, _resizeStartHeight));
            var widthFromHeight = nextHeight * ratio;
            var heightFromWidth = nextWidth / ratio;

            if (Math.Abs(nextWidth - _resizeStartWidth) >= Math.Abs(widthFromHeight - _resizeStartWidth))
            {
                nextHeight = Math.Max(24, heightFromWidth);
            }
            else
            {
                nextWidth = Math.Max(24, widthFromHeight);
            }
        }

        Width = nextWidth;
        Height = nextHeight;
        UpdateResizeInfoBadge();
        e.Handled = true;
    }

    private void OnMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (_isDragging)
        {
            _isDragging = false;
            _skipSnapForCurrentDrag = false;
            _currentSnapGroup?.FinishGroupMove();

            if (IsMouseCaptured)
            {
                ReleaseMouseCapture();
            }

            FlushBoundsChanged();
            e.Handled = true;
            return;
        }

        if (!_isResizing)
        {
            return;
        }

        _isResizing = false;
        _resizeInfoBadge.Visibility = Visibility.Collapsed;

        if (IsMouseCaptured)
        {
            ReleaseMouseCapture();
        }

        FlushBoundsChanged();
        e.Handled = true;
    }

    private void OnMouseRightButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (_spec.IsLocked || ContextMenu is null)
        {
            return;
        }

        if (DateTime.UtcNow < _suppressContextMenuOpenUntilUtc)
        {
            Console.Error.WriteLine($"mirror-context-menu id={_spec.Id} state=reopen-suppressed");
            e.Handled = true;
            return;
        }

        Console.Error.WriteLine($"mirror-interaction id={_spec.Id} action=right-up opacity={_spec.Opacity}");
        CloseActiveContextMenu();
        BringInteractionLayerToFront();
        UpdateContextMenuItems();
        ContextMenu.PlacementTarget = _interactionSurface;
        ContextMenu.Placement = PlacementMode.MousePoint;
        ContextMenu.IsOpen = true;
        e.Handled = true;
    }

    private void BringInteractionLayerToFront()
    {
        if (_currentSnapGroup is not null && _currentSnapGroup.Windows.Count > 1)
        {
            _currentSnapGroup.BringToFront(this);
            return;
        }

        PromoteForInteraction();
    }

    private void OnWindowLocationChanged(object? sender, EventArgs e)
    {
        QueueBoundsChanged();
        RepositionCountdownBar();
        _currentSnapGroup?.UpdateUnifiedBorderPosition();
    }

    private void OnWindowSizeChanged(object? sender, SizeChangedEventArgs e)
    {
        UpdateFlashBorderGeometry();
        UpdateThumbnail();
        QueueBoundsChanged();
        RepositionCountdownBar();
        _currentSnapGroup?.UpdateUnifiedBorderPosition();
    }

    private void OnBoundsChangedTimerTick(object? sender, EventArgs e)
    {
        _boundsChangedTimer.Stop();

        if (_suspendBoundsEvents)
        {
            return;
        }

        var currentBounds = new RectInfo
        {
            X = (int)Math.Round(Left),
            Y = (int)Math.Round(Top),
            Width = (int)Math.Round(Width),
            Height = (int)Math.Round(Height)
        };

        if (AreBoundsEqual(_lastReportedBounds, currentBounds))
        {
            return;
        }

        _lastReportedBounds = currentBounds;
        _preserveLocalBoundsUntilUtc = DateTime.UtcNow.AddSeconds(1);
        BoundsChanged?.Invoke(this, currentBounds);
    }

    private void QueueBoundsChanged()
    {
        if (_suspendBoundsEvents)
        {
            return;
        }

        _boundsChangedTimer.Stop();
        _boundsChangedTimer.Start();
    }

    private void FlushBoundsChanged()
    {
        if (_suspendBoundsEvents)
        {
            return;
        }

        _boundsChangedTimer.Stop();
        OnBoundsChangedTimerTick(this, EventArgs.Empty);
    }

    private void UpdateSourceHandle(TibiaWindowInfo? tibiaInfo)
    {
        var nextHandle = tibiaInfo is null ? IntPtr.Zero : new IntPtr(tibiaInfo.Hwnd);

        if (nextHandle == _sourceHwnd)
        {
            if (_thumbnail == IntPtr.Zero)
            {
                RefreshThumbnail();
            }

            return;
        }

        _sourceHwnd = nextHandle;
        RefreshThumbnail();
    }

    private void RefreshThumbnail()
    {
        UnregisterThumbnail();

        var destinationHandle = new WindowInteropHelper(this).Handle;

        if (destinationHandle == IntPtr.Zero || _sourceHwnd == IntPtr.Zero)
        {
            LogThumbnailDiagnostic($"refresh-skipped hwnd={destinationHandle} source={_sourceHwnd}");
            return;
        }

        var registerResult = DwmThumbnailInterop.DwmRegisterThumbnail(destinationHandle, _sourceHwnd, out _thumbnail);

        if (registerResult == 0)
        {
            ClearThumbnailDiagnostic();
            UpdateThumbnail();
            return;
        }

        LogThumbnailDiagnostic($"register-failed code={registerResult}");
    }

    private void UpdateThumbnail()
    {
        if (_thumbnail == IntPtr.Zero)
        {
            LogThumbnailDiagnostic("update-skipped thumbnail=0");
            return;
        }

        var destinationRect = DwmThumbnailInterop.ToDeviceRect(
            new Rect(
                MirrorFramePadding,
                MirrorFramePadding,
                Math.Max(0, ActualWidth - (MirrorFramePadding * 2)),
                Math.Max(0, ActualHeight - (MirrorFramePadding * 2))),
            this,
            new WindowInteropHelper(this).Handle);

        var sourceRectInfo = ResolveSourceBounds();

        if (sourceRectInfo is null)
        {
            LogThumbnailDiagnostic("update-skipped source-rect=null");
            return;
        }

        var sourceRect = DwmThumbnailInterop.ToDeviceRect(
            new Rect(
                sourceRectInfo.X,
                sourceRectInfo.Y,
                sourceRectInfo.Width,
                sourceRectInfo.Height),
            null,
            _sourceHwnd);

        if (destinationRect.Right <= destinationRect.Left || destinationRect.Bottom <= destinationRect.Top)
        {
            LogThumbnailDiagnostic(
                $"update-skipped invalid-destination left={destinationRect.Left} top={destinationRect.Top} right={destinationRect.Right} bottom={destinationRect.Bottom}");
            return;
        }

        if (sourceRect.Right <= sourceRect.Left || sourceRect.Bottom <= sourceRect.Top)
        {
            LogThumbnailDiagnostic(
                $"update-skipped invalid-source left={sourceRect.Left} top={sourceRect.Top} right={sourceRect.Right} bottom={sourceRect.Bottom}");
            return;
        }

        var properties = new DwmThumbnailInterop.ThumbnailProperties
        {
            Flags = DwmThumbnailInterop.ThumbnailRectDestination
                | DwmThumbnailInterop.ThumbnailRectSource
                | DwmThumbnailInterop.ThumbnailOpacity
                | DwmThumbnailInterop.ThumbnailVisible
                | DwmThumbnailInterop.ThumbnailSourceClientAreaOnly,
            Destination = destinationRect,
            Source = sourceRect,
            Opacity = (byte)Math.Clamp((int)Math.Round((_spec.Opacity / 100.0) * 255.0), 0, 255),
            Visible = true,
            SourceClientAreaOnly = true
        };

        var updateResult = DwmThumbnailInterop.DwmUpdateThumbnailProperties(_thumbnail, ref properties);

        if (updateResult == 0)
        {
            ClearThumbnailDiagnostic();
            return;
        }

        LogThumbnailDiagnostic($"update-failed code={updateResult}");
    }

    private RectInfo? ResolveSourceBounds()
    {
        if (_sourceHwnd == IntPtr.Zero)
        {
            return null;
        }

        if (_spec.CaptureBounds.Width > 0 && _spec.CaptureBounds.Height > 0)
        {
            var sourceFromScreen = WindowProbe.ConvertScreenToClientBounds(_sourceHwnd, _spec.CaptureBounds);

            if (sourceFromScreen is not null && sourceFromScreen.Width > 0 && sourceFromScreen.Height > 0)
            {
                return sourceFromScreen;
            }
        }

        if (_spec.RelativeBounds.Width <= 0 || _spec.RelativeBounds.Height <= 0)
        {
            return null;
        }

        return new RectInfo
        {
            X = _spec.RelativeBounds.X,
            Y = _spec.RelativeBounds.Y,
            Width = _spec.RelativeBounds.Width,
            Height = _spec.RelativeBounds.Height
        };
    }

    private void ApplyOpacity()
    {
        // The DWM thumbnail already applies the requested visual opacity. If the
        // layered WPF window is faded too, its 1-alpha hit surface can round to
        // fully transparent and let pointer input pass through to Tibia.
        Opacity = 1.0;

        if (_countdownBarWindow is not null)
        {
            _countdownBarWindow.Opacity = MirrorVisualOpacity;
        }
    }

    private void ApplyLockState()
    {
        if (_spec.IsLocked && ReferenceEquals(_activeContextMenuOwner, this))
        {
            CloseActiveContextMenu();
        }

        UpdateSnapGroupBorders();
        _resizeHandle.Visibility = _spec.IsLocked ? Visibility.Collapsed : Visibility.Visible;
        _resizeInfoBadge.Visibility = Visibility.Collapsed;
        if (_appliedLockState != _spec.IsLocked)
        {
            ApplyWindowBehavior();
            if (_windowHandle != IntPtr.Zero)
            {
                _appliedLockState = _spec.IsLocked;
            }
        }
        _currentSnapGroup?.UpdateBorderDisplay();
    }

    private void ApplyWindowBehavior()
    {
        if (_windowHandle == IntPtr.Zero)
        {
            return;
        }

        if (_spec.IsLocked)
        {
            WindowStyleInterop.MakeWindowClickThrough(_windowHandle);
            return;
        }

        WindowStyleInterop.MakeWindowDraggableNoActivate(_windowHandle);
    }

    private void ApplyVisibilityState()
    {
        var shouldShow = IsOverlayVisible;

        if (shouldShow)
        {
            if (!IsVisible)
            {
                Show();
            }

            SetAlwaysOnTop(_alwaysOnTop);

            if (_isCountdownRunning)
            {
                EnsureCountdownBarVisible();
            }
        }
        else if (IsVisible)
        {
            Hide();
            HideCountdownBar();
        }

        _currentSnapGroup?.UpdateBorderDisplay();
    }

    private void UnregisterThumbnail()
    {
        if (_thumbnail == IntPtr.Zero)
        {
            return;
        }

        DwmThumbnailInterop.DwmUnregisterThumbnail(_thumbnail);
        _thumbnail = IntPtr.Zero;
    }

    private void UpdateContextMenuItems()
    {
        var menu = ContextMenu;

        if (menu is null)
        {
            return;
        }

        menu.Items.Clear();

        var allowSnapping = CreateMenuItem("Permitir encaixe", () =>
        {
            var next = !_spec.AllowSnapping;

            if (!next && _currentSnapGroup is not null)
            {
                ForceUnsnap();
            }

            RaiseAction("set-allow-snapping", boolValue: next);
        });
        allowSnapping.IsCheckable = true;
        allowSnapping.IsChecked = _spec.AllowSnapping;
        menu.Items.Add(allowSnapping);
        allowSnapping.Icon = CreateSnappingIcon();

        if (_currentSnapGroup is not null && _currentSnapGroup.Windows.Count > 1)
        {
            var unsnapMirror = CreateMenuItem("Desencaixar", () =>
            {
                ForceUnsnap();
                RaiseAction("unsnap");
            }, CreateUnsnapIcon());
            menu.Items.Add(unsnapMirror);
        }

        menu.Items.Add(MirrorContextMenuTheme.CreateSeparator());

        var makeNewCrop = CreateMenuItem("Criar novo recorte", () => RaiseAction("make-new-crop"), CreateMakeNewCropIcon());
        var cropCurrentMirror = CreateMenuItem(
            "Cortar espelho atual",
            () => Dispatcher.BeginInvoke(CropCurrentMirror, DispatcherPriority.ContextIdle),
            CreateCropCurrentMirrorIcon());
        menu.Items.Add(makeNewCrop);
        menu.Items.Add(cropCurrentMirror);

        menu.Items.Add(MirrorContextMenuTheme.CreateSeparator());

        var scaleMenu = CreateMenuItem("Escala", null, CreateScaleIcon());

        foreach (var (label, value) in new (string label, double value)[]
        {
            ("50%", 0.5),
            ("75%", 0.75),
            ("100%", 1.0),
            ("125%", 1.25),
            ("150%", 1.5),
            ("200%", 2.0),
            ("300%", 3.0),
            ("400%", 4.0)
        })
        {
            var scaleValue = value;
            var item = CreateMenuItem(label, () => ApplyScaleSelection(scaleValue));
            item.IsCheckable = true;
            item.IsChecked = Math.Abs(ResolveCurrentScale() - scaleValue) < 0.01;
            scaleMenu.Items.Add(item);
        }

        menu.Items.Add(scaleMenu);
        menu.Items.Add(MirrorContextMenuTheme.CreateSeparator());

        var glowMenu = CreateMenuItem("Brilho", null, CreateGlowIcon());
        var toggleGlow = CreateMenuItem(_spec.GlowEnabled ? "Desativar brilho" : "Ativar brilho", () =>
        {
            var next = !_spec.GlowEnabled;
            ApplyLocalGlow(next, _spec.GlowColor, _spec.GlowIntensity);
            RaiseAction("set-glow-enabled", boolValue: next);
        });
        toggleGlow.IsCheckable = true;
        toggleGlow.IsChecked = _spec.GlowEnabled;
        glowMenu.Items.Add(toggleGlow);
        glowMenu.Items.Add(MirrorContextMenuTheme.CreateSeparator());

        var colorMenu = CreateMenuItem("Cor");
        colorMenu.Items.Add(CreateGlowColorPickerItem());

        glowMenu.Items.Add(colorMenu);

        var intensityMenu = CreateMenuItem("Intensidade");
        intensityMenu.Items.Add(CreateGlowIntensitySliderItem());
        glowMenu.Items.Add(intensityMenu);
        menu.Items.Add(glowMenu);

        menu.Items.Add(MirrorContextMenuTheme.CreateSeparator());

        var deleteMirror = CreateMenuItem("Apagar", () => RaiseAction("delete-region"), CreateTrashIcon());
        deleteMirror.Foreground = new SolidColorBrush(Color.FromRgb(255, 83, 83));
        menu.Items.Add(deleteMirror);
    }

    private MenuItem CreateGlowColorPickerItem()
    {
        var currentColor = ParseGlowColor(_spec.GlowColor);
        var currentHex = ColorToHex(currentColor);
        var savedColors = NormalizeGlowSavedColors(_spec.GlowSavedColors);

        var root = new StackPanel
        {
            MinWidth = 188,
            Margin = new Thickness(0, 2, 0, 2)
        };
        root.MouseDown += (_, e) => e.Handled = true;
        root.MouseUp += (_, e) => e.Handled = true;

        var warningText = new TextBlock
        {
            Text = "Delete uma cor para salvar outra.",
            Foreground = new SolidColorBrush(Color.FromRgb(255, 105, 105)),
            FontSize = 11,
            FontWeight = FontWeights.SemiBold,
            TextWrapping = TextWrapping.Wrap,
            Visibility = Visibility.Collapsed,
            Margin = new Thickness(4, 0, 4, 6)
        };
        root.Children.Add(warningText);

        var pickerRow = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(2, 0, 2, 7)
        };

        var currentPreview = new Ellipse
        {
            Width = 24,
            Height = 24,
            Stroke = Brushes.White,
            StrokeThickness = 1,
            Fill = new SolidColorBrush(currentColor),
            VerticalAlignment = VerticalAlignment.Center
        };
        pickerRow.Children.Add(currentPreview);

        var hueSlider = new Slider
        {
            Minimum = 0,
            Maximum = 359,
            Value = RgbToHue(currentColor),
            Width = 92,
            Height = 18,
            IsMoveToPointEnabled = true,
            Margin = new Thickness(8, 0, 0, 0),
            VerticalAlignment = VerticalAlignment.Center
        };
        ApplyHueSliderStyle(hueSlider);
        pickerRow.Children.Add(hueSlider);

        var brightnessSlider = new Slider
        {
            Minimum = 20,
            Maximum = 100,
            Value = RgbToBrightness(currentColor),
            Width = 48,
            Height = 18,
            IsMoveToPointEnabled = true,
            Margin = new Thickness(6, 0, 0, 0),
            VerticalAlignment = VerticalAlignment.Center
        };
        ApplyThinGreenSliderStyle(brightnessSlider);
        pickerRow.Children.Add(brightnessSlider);

        root.Children.Add(pickerRow);

        var selectedColor = currentHex;
        void ApplyPickerColor(bool commit)
        {
            var nextColor = ColorFromHsv(hueSlider.Value, 0.92, brightnessSlider.Value / 100.0);
            selectedColor = ColorToHex(nextColor);
            currentPreview.Fill = new SolidColorBrush(nextColor);
            ApplyLocalGlow(true, selectedColor, _spec.GlowIntensity, refreshMenu: false);

            if (commit)
            {
                RaiseAction("set-glow-color", stringValue: selectedColor);
            }
        }

        hueSlider.ValueChanged += (_, _) => ApplyPickerColor(commit: false);
        brightnessSlider.ValueChanged += (_, _) => ApplyPickerColor(commit: false);
        hueSlider.PreviewMouseLeftButtonUp += (_, _) => ApplyPickerColor(commit: true);
        brightnessSlider.PreviewMouseLeftButtonUp += (_, _) => ApplyPickerColor(commit: true);

        var pickerDivider = new Border
        {
            Height = 1,
            Background = new SolidColorBrush(Color.FromArgb(70, 255, 255, 255)),
            Margin = new Thickness(2, 0, 2, 7)
        };
        root.Children.Add(pickerDivider);

        var saveButton = CreateCompactMenuButton("Salvar cor", CreateSaveIcon());
        saveButton.HorizontalAlignment = HorizontalAlignment.Stretch;
        saveButton.Margin = new Thickness(2, 0, 2, 7);
        saveButton.Click += (_, e) =>
        {
            e.Handled = true;

            var nextColors = NormalizeGlowSavedColors(_spec.GlowSavedColors).ToList();
            var normalizedSelected = NormalizeGlowColorHex(selectedColor);

            if (nextColors.Any(color => string.Equals(color, normalizedSelected, StringComparison.OrdinalIgnoreCase)))
            {
                warningText.Visibility = Visibility.Collapsed;
                return;
            }

            if (nextColors.Count >= 10)
            {
                warningText.Visibility = Visibility.Visible;
                return;
            }

            nextColors.Add(normalizedSelected);
            warningText.Visibility = Visibility.Collapsed;
            ApplyLocalGlow(true, normalizedSelected, _spec.GlowIntensity, nextColors, refreshMenu: false);
            root.Children.Add(CreateGlowSavedColorRow(normalizedSelected));
            RaiseAction("set-glow-saved-colors", stringValue: JsonSerializer.Serialize(nextColors));
        };
        root.Children.Add(saveButton);

        foreach (var savedColor in savedColors)
        {
            root.Children.Add(CreateGlowSavedColorRow(savedColor));
        }

        var item = CreateMenuItem("");
        item.Header = root;
        item.StaysOpenOnClick = true;
        return item;
    }

    private FrameworkElement CreateGlowSavedColorRow(string colorHex)
    {
        var color = ParseGlowColor(colorHex);
        var isActive = string.Equals(NormalizeGlowColorHex(_spec.GlowColor), NormalizeGlowColorHex(colorHex), StringComparison.OrdinalIgnoreCase);
        var row = new Grid
        {
            Margin = new Thickness(2, 2, 2, 0)
        };
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var swatchButton = new Button
        {
            Height = 24,
            HorizontalContentAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(6, 2, 6, 2),
            Background = new SolidColorBrush(Color.FromRgb(31, 38, 49)),
            BorderBrush = new SolidColorBrush(isActive ? Color.FromRgb(88, 196, 112) : Color.FromArgb(90, 170, 178, 191)),
            BorderThickness = new Thickness(1),
            Cursor = Cursors.Hand
        };
        swatchButton.Content = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Children =
            {
                new Border
                {
                    Width = 18,
                    Height = 14,
                    CornerRadius = new CornerRadius(2),
                    Background = new SolidColorBrush(color),
                    BorderBrush = Brushes.White,
                    BorderThickness = new Thickness(string.Equals(NormalizeGlowColorHex(colorHex), "#FFFFFF", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
                },
                new TextBlock
                {
                    Text = NormalizeGlowColorHex(colorHex),
                    Foreground = Brushes.White,
                    FontSize = 11,
                    Margin = new Thickness(7, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center
                }
            }
        };
        swatchButton.Click += (_, e) =>
        {
            e.Handled = true;
            var normalized = NormalizeGlowColorHex(colorHex);
            ApplyLocalGlow(true, normalized, _spec.GlowIntensity, refreshMenu: false);
            RaiseAction("set-glow-color", stringValue: normalized);
        };
        row.Children.Add(swatchButton);

        if (isActive)
        {
            var check = CreateCheckIcon();
            check.Margin = new Thickness(7, 0, 2, 0);
            check.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(check, 1);
            row.Children.Add(check);
        }

        var deleteButton = CreateCompactMenuButton("", CreateTrashIcon());
        deleteButton.Width = 26;
        deleteButton.Height = 24;
        deleteButton.Margin = new Thickness(5, 0, 0, 0);
        deleteButton.IsEnabled = !string.Equals(NormalizeGlowColorHex(colorHex), "#FFFFFF", StringComparison.OrdinalIgnoreCase);
        deleteButton.Opacity = deleteButton.IsEnabled ? 1 : 0.35;
        deleteButton.Click += (_, e) =>
        {
            e.Handled = true;
            var nextColors = NormalizeGlowSavedColors(_spec.GlowSavedColors)
                .Where(colorValue => !string.Equals(NormalizeGlowColorHex(colorValue), NormalizeGlowColorHex(colorHex), StringComparison.OrdinalIgnoreCase))
                .ToList();
            ApplyLocalGlow(true, _spec.GlowColor, _spec.GlowIntensity, nextColors, refreshMenu: false);
            if (row.Parent is Panel parent)
            {
                parent.Children.Remove(row);
            }
            RaiseAction("set-glow-saved-colors", stringValue: JsonSerializer.Serialize(nextColors));
        };
        Grid.SetColumn(deleteButton, 2);
        row.Children.Add(deleteButton);

        return row;
    }

    private MenuItem CreateGlowIntensitySliderItem()
    {
        var valueText = new TextBlock
        {
            Text = $"{GlowIntensityToPercent(_spec.GlowIntensity)}%",
            Foreground = Brushes.White,
            FontSize = 11,
            FontWeight = FontWeights.Bold,
            MinWidth = 34,
            TextAlignment = TextAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center
        };

        var slider = new Slider
        {
            Minimum = 1,
            Maximum = 30,
            Value = Math.Clamp(_spec.GlowIntensity, 1, 30),
            Width = 104,
            Height = 18,
            IsMoveToPointEnabled = true,
            VerticalAlignment = VerticalAlignment.Center
        };
        ApplyThinGreenSliderStyle(slider);
        slider.ValueChanged += (_, _) =>
        {
            var nextIntensity = Math.Clamp(slider.Value, 1, 30);
            valueText.Text = $"{GlowIntensityToPercent(nextIntensity)}%";
            ApplyLocalGlow(true, _spec.GlowColor, nextIntensity, refreshMenu: false);
        };
        slider.PreviewMouseLeftButtonDown += (_, _) => _isDraggingGlowIntensity = true;
        slider.PreviewMouseLeftButtonUp += (_, _) =>
        {
            _isDraggingGlowIntensity = false;
            CommitGlowIntensity(slider.Value);
        };
        slider.LostMouseCapture += (_, _) =>
        {
            if (_isDraggingGlowIntensity)
            {
                _isDraggingGlowIntensity = false;
                CommitGlowIntensity(slider.Value);
            }
        };
        slider.KeyUp += (_, _) => CommitGlowIntensity(slider.Value);

        var header = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            MinWidth = 158
        };
        header.MouseDown += (_, e) => e.Handled = true;
        header.MouseUp += (_, e) => e.Handled = true;
        header.Children.Add(slider);
        header.Children.Add(new Border { Width = 8, Background = Brushes.Transparent });
        header.Children.Add(valueText);

        var item = CreateMenuItem("");
        item.Header = header;
        item.StaysOpenOnClick = true;
        return item;
    }

    private void CommitGlowIntensity(double value)
    {
        var nextIntensity = Math.Clamp(value, 1, 30);
        RaiseAction("set-glow-intensity", stringValue: nextIntensity.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    private static void ApplyThinGreenSliderStyle(Slider slider)
    {
        slider.Style = (Style)XamlReader.Parse("""
<Style xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
       xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
       TargetType="{x:Type Slider}">
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="{x:Type Slider}">
        <Grid Height="18" Background="Transparent">
          <Track x:Name="PART_Track" VerticalAlignment="Center">
            <Track.DecreaseRepeatButton>
              <RepeatButton Command="Slider.DecreaseLarge" Focusable="False" Height="3">
                <RepeatButton.Template>
                  <ControlTemplate TargetType="{x:Type RepeatButton}">
                    <Border Height="3" CornerRadius="2" Background="#58C470" />
                  </ControlTemplate>
                </RepeatButton.Template>
              </RepeatButton>
            </Track.DecreaseRepeatButton>
            <Track.Thumb>
              <Thumb Width="12" Height="12">
                <Thumb.Template>
                  <ControlTemplate TargetType="{x:Type Thumb}">
                    <Ellipse Fill="#58C470" Stroke="#8EF0A4" StrokeThickness="1" />
                  </ControlTemplate>
                </Thumb.Template>
              </Thumb>
            </Track.Thumb>
            <Track.IncreaseRepeatButton>
              <RepeatButton Command="Slider.IncreaseLarge" Focusable="False" Height="3">
                <RepeatButton.Template>
                  <ControlTemplate TargetType="{x:Type RepeatButton}">
                    <Border Height="3" CornerRadius="2" Background="#5B6472" />
                  </ControlTemplate>
                </RepeatButton.Template>
              </RepeatButton>
            </Track.IncreaseRepeatButton>
          </Track>
        </Grid>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
""");
    }

    private static void ApplyHueSliderStyle(Slider slider)
    {
        slider.Style = (Style)XamlReader.Parse("""
<Style xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
       xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
       TargetType="{x:Type Slider}">
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="{x:Type Slider}">
        <Grid Height="18" Background="Transparent">
          <Track x:Name="PART_Track" VerticalAlignment="Center">
            <Track.DecreaseRepeatButton>
              <RepeatButton Command="Slider.DecreaseLarge" Focusable="False" Height="5">
                <RepeatButton.Template>
                  <ControlTemplate TargetType="{x:Type RepeatButton}">
                    <Border Height="5" CornerRadius="3">
                      <Border.Background>
                        <LinearGradientBrush StartPoint="0,0.5" EndPoint="1,0.5">
                          <GradientStop Color="#FF0000" Offset="0" />
                          <GradientStop Color="#FFFF00" Offset="0.17" />
                          <GradientStop Color="#00FF00" Offset="0.34" />
                          <GradientStop Color="#00FFFF" Offset="0.51" />
                          <GradientStop Color="#0000FF" Offset="0.68" />
                          <GradientStop Color="#FF00FF" Offset="0.85" />
                          <GradientStop Color="#FF0000" Offset="1" />
                        </LinearGradientBrush>
                      </Border.Background>
                    </Border>
                  </ControlTemplate>
                </RepeatButton.Template>
              </RepeatButton>
            </Track.DecreaseRepeatButton>
            <Track.Thumb>
              <Thumb Width="12" Height="12">
                <Thumb.Template>
                  <ControlTemplate TargetType="{x:Type Thumb}">
                    <Ellipse Fill="#F8FAFC" Stroke="#111827" StrokeThickness="1" />
                  </ControlTemplate>
                </Thumb.Template>
              </Thumb>
            </Track.Thumb>
            <Track.IncreaseRepeatButton>
              <RepeatButton Command="Slider.IncreaseLarge" Focusable="False" Height="5">
                <RepeatButton.Template>
                  <ControlTemplate TargetType="{x:Type RepeatButton}">
                    <Border Height="5" CornerRadius="3">
                      <Border.Background>
                        <LinearGradientBrush StartPoint="0,0.5" EndPoint="1,0.5">
                          <GradientStop Color="#FF0000" Offset="0" />
                          <GradientStop Color="#FFFF00" Offset="0.17" />
                          <GradientStop Color="#00FF00" Offset="0.34" />
                          <GradientStop Color="#00FFFF" Offset="0.51" />
                          <GradientStop Color="#0000FF" Offset="0.68" />
                          <GradientStop Color="#FF00FF" Offset="0.85" />
                          <GradientStop Color="#FF0000" Offset="1" />
                        </LinearGradientBrush>
                      </Border.Background>
                    </Border>
                  </ControlTemplate>
                </RepeatButton.Template>
              </RepeatButton>
            </Track.IncreaseRepeatButton>
          </Track>
        </Grid>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
""");
    }

    private static Button CreateCompactMenuButton(string text, object? icon = null)
    {
        var content = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };

        if (icon is not null)
        {
            content.Children.Add((UIElement)icon);
        }

        if (!string.IsNullOrWhiteSpace(text))
        {
            content.Children.Add(new TextBlock
            {
                Text = text,
                Foreground = Brushes.White,
                FontSize = 11,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(icon is null ? 0 : 7, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            });
        }

        return new Button
        {
            Content = content,
            Height = 26,
            Padding = new Thickness(8, 2, 8, 2),
            Background = new SolidColorBrush(Color.FromRgb(31, 38, 49)),
            BorderBrush = new SolidColorBrush(Color.FromArgb(90, 170, 178, 191)),
            BorderThickness = new Thickness(1),
            Cursor = Cursors.Hand
        };
    }

    private static Viewbox CreateCheckIcon()
    {
        return CreatePathIcon("M2,8 L6.2,12.2 L14,3.8", Color.FromRgb(88, 196, 112), 16, 16, 2.4);
    }

    private static Viewbox CreateTrashIcon()
    {
        return CreatePathIcon("M4,5 L12,5 M6,5 L6,13 M10,5 L10,13 M5,5 L5.5,14 L10.5,14 L11,5 M6.5,3 L9.5,3 L10.5,5 L5.5,5 Z", Color.FromRgb(255, 83, 83), 16, 16, 1.45);
    }

    private static Viewbox CreateSaveIcon()
    {
        return CreatePathIcon("M3,3 L12,3 L14,5 L14,13 L3,13 Z M5,3 L5,7 L11,7 L11,3 M5,13 L5,9 L12,9 L12,13", Color.FromRgb(88, 196, 112), 16, 16, 1.55);
    }

    private static Viewbox CreatePathIcon(string data, Color color, double width, double height, double strokeThickness)
    {
        var path = new Path
        {
            Data = Geometry.Parse(data),
            Stroke = new SolidColorBrush(color),
            StrokeThickness = strokeThickness,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round,
            StrokeLineJoin = PenLineJoin.Round,
            Fill = Brushes.Transparent
        };
        var canvas = new Canvas
        {
            Width = width,
            Height = height
        };
        canvas.Children.Add(path);

        return new Viewbox
        {
            Width = width,
            Height = height,
            Child = canvas
        };
    }

    private MenuItem CreateMenuItem(string header, Action? onClick = null, object? icon = null)
    {
        var item = new MenuItem
        {
            Header = header
        };

        if (icon is not null)
        {
            item.Icon = icon;
        }

        MirrorContextMenuTheme.Apply(item);

        if (onClick is not null)
        {
            item.Click += (_, _) => onClick();
        }

        return item;
    }

    private void RaiseOpacity(int opacity)
    {
        ActionRequested?.Invoke(this, new RegionMirrorActionEventArgs
        {
            RegionId = _spec.Id,
            Action = "set-opacity",
            IntValue = opacity
        });
    }

    private MirrorWindowSpec CloneSpecWithOpacity(int opacity)
    {
        return new MirrorWindowSpec
        {
            Id = _spec.Id,
            Name = _spec.Name,
            CaptureBounds = _spec.CaptureBounds,
            MirrorBounds = _spec.MirrorBounds,
            RelativeBounds = _spec.RelativeBounds,
            Opacity = opacity,
            IsLocked = _spec.IsLocked,
            IsVisible = _spec.IsVisible,
            IsFixedCrop = _spec.IsFixedCrop,
            AllowSnapping = _spec.AllowSnapping,
            Scale = _spec.Scale,
            GlowEnabled = _spec.GlowEnabled,
            GlowColor = _spec.GlowColor,
            GlowSavedColors = _spec.GlowSavedColors,
            GlowIntensity = _spec.GlowIntensity,
            Countdown = _spec.Countdown
        };
    }

    private void CropCurrentMirror()
    {
        if (_spec.CaptureBounds.Width <= 0 || _spec.CaptureBounds.Height <= 0)
        {
            return;
        }

        if (ContextMenu is not null)
        {
            ContextMenu.IsOpen = false;
        }

        const double selectorMargin = 96;
        var innerBounds = GetMirrorBounds();
        var initialSelectionBounds = new RectInfo
        {
            X = (int)Math.Round(innerBounds.X),
            Y = (int)Math.Round(innerBounds.Y),
            Width = Math.Max(1, (int)Math.Round(innerBounds.Width)),
            Height = Math.Max(1, (int)Math.Round(innerBounds.Height))
        };
        var virtualLeft = SystemParameters.VirtualScreenLeft;
        var virtualTop = SystemParameters.VirtualScreenTop;
        var virtualRight = virtualLeft + SystemParameters.VirtualScreenWidth;
        var virtualBottom = virtualTop + SystemParameters.VirtualScreenHeight;
        var overlayLeft = Math.Max(virtualLeft, innerBounds.X - selectorMargin);
        var overlayTop = Math.Max(virtualTop, innerBounds.Y - selectorMargin);
        var overlayRight = Math.Min(virtualRight, innerBounds.Right + selectorMargin);
        var overlayBottom = Math.Min(virtualBottom, innerBounds.Bottom + selectorMargin);
        var overlayBounds = new RectInfo
        {
            X = (int)Math.Round(overlayLeft),
            Y = (int)Math.Round(overlayTop),
            Width = Math.Max(1, (int)Math.Round(overlayRight - overlayLeft)),
            Height = Math.Max(1, (int)Math.Round(overlayBottom - overlayTop))
        };

        var selector = new RegionSelectorWindow(
            overlayBounds,
            initialSelectionBounds,
            showBackdrop: false,
            showInstructions: false)
        {
            Owner = null,
            Topmost = true,
            ShowInTaskbar = false
        };

        bool? confirmed;
        RectInfo? selection;
        var temporarilyLoweredMirror = _windowHandle != IntPtr.Zero;

        if (temporarilyLoweredMirror)
        {
            WindowStyleInterop.MakeWindowClickThrough(_windowHandle);
            WindowStyleInterop.SetWindowAlwaysOnTop(_windowHandle, false);
        }

        try
        {
            confirmed = selector.ShowDialog();
            selection = selector.SelectedCaptureBounds;
        }
        finally
        {
            if (temporarilyLoweredMirror)
            {
                ApplyWindowBehavior();
                SetAlwaysOnTop(_alwaysOnTop);
            }
        }

        if (confirmed != true || selection is null || selection.Width < 1 || selection.Height < 1)
        {
            return;
        }

        var contentWidth = Math.Max(1.0, innerBounds.Width);
        var contentHeight = Math.Max(1.0, innerBounds.Height);
        var ratioX = (selection.X - innerBounds.X) / contentWidth;
        var ratioY = (selection.Y - innerBounds.Y) / contentHeight;
        var ratioWidth = selection.Width / contentWidth;
        var ratioHeight = selection.Height / contentHeight;

        ratioX = Math.Clamp(ratioX, 0.0, 1.0);
        ratioY = Math.Clamp(ratioY, 0.0, 1.0);
        ratioWidth = Math.Clamp(ratioWidth, 0.001, 1.0 - ratioX);
        ratioHeight = Math.Clamp(ratioHeight, 0.001, 1.0 - ratioY);

        var nextCaptureBounds = new RectInfo
        {
            X = (int)Math.Round(_spec.CaptureBounds.X + (_spec.CaptureBounds.Width * ratioX)),
            Y = (int)Math.Round(_spec.CaptureBounds.Y + (_spec.CaptureBounds.Height * ratioY)),
            Width = Math.Max(1, (int)Math.Round(_spec.CaptureBounds.Width * ratioWidth)),
            Height = Math.Max(1, (int)Math.Round(_spec.CaptureBounds.Height * ratioHeight))
        };

        var nextRelativeBounds = new RectInfo
        {
            X = (int)Math.Round(_spec.RelativeBounds.X + (_spec.RelativeBounds.Width * ratioX)),
            Y = (int)Math.Round(_spec.RelativeBounds.Y + (_spec.RelativeBounds.Height * ratioY)),
            Width = Math.Max(1, (int)Math.Round(_spec.RelativeBounds.Width * ratioWidth)),
            Height = Math.Max(1, (int)Math.Round(_spec.RelativeBounds.Height * ratioHeight))
        };

        var nextMirrorBounds = new RectInfo
        {
            X = selection.X - (int)Math.Round(MirrorFramePadding),
            Y = selection.Y - (int)Math.Round(MirrorFramePadding),
            Width = Math.Max(24, selection.Width + (int)Math.Round(MirrorFramePadding * 2)),
            Height = Math.Max(24, selection.Height + (int)Math.Round(MirrorFramePadding * 2))
        };

        _spec = new MirrorWindowSpec
        {
            Id = _spec.Id,
            Name = _spec.Name,
            CaptureBounds = nextCaptureBounds,
            MirrorBounds = nextMirrorBounds,
            RelativeBounds = nextRelativeBounds,
            Opacity = _spec.Opacity,
            IsLocked = _spec.IsLocked,
            IsVisible = _spec.IsVisible,
            IsFixedCrop = _spec.IsFixedCrop,
            AllowSnapping = _spec.AllowSnapping,
            Scale = ResolveCurrentScale(),
            GlowEnabled = _spec.GlowEnabled,
            GlowColor = _spec.GlowColor,
            GlowSavedColors = _spec.GlowSavedColors,
            GlowIntensity = _spec.GlowIntensity,
            Countdown = _spec.Countdown
        };

        _suspendBoundsEvents = true;
        Left = nextMirrorBounds.X;
        Top = nextMirrorBounds.Y;
        Width = nextMirrorBounds.Width;
        Height = nextMirrorBounds.Height;
        _suspendBoundsEvents = false;
        _currentScale = ResolveCurrentScale();
        UpdateThumbnail();
        ApplyGlowState();
        QueueBoundsChanged();
        FlushBoundsChanged();
        UpdateContextMenuItems();

        var payload = JsonSerializer.Serialize(new
        {
            captureBounds = nextCaptureBounds,
            relativeBounds = nextRelativeBounds,
            mirrorBounds = nextMirrorBounds,
            scale = _currentScale
        });

        RaiseAction("crop-current-mirror", stringValue: payload);
    }

    private void ApplyScaleSelection(double scaleValue)
    {
        if (scaleValue <= 0)
        {
            return;
        }

        if (_currentSnapGroup is not null && _currentSnapGroup.Windows.Count > 1)
        {
            foreach (var window in _currentSnapGroup.Windows)
            {
                window.ApplyScaleLocal(scaleValue);
            }

            return;
        }

        ApplyScaleLocal(scaleValue);
    }

    private void ApplyScaleLocal(double scaleValue)
    {
        if (scaleValue <= 0 || _spec.CaptureBounds.Width <= 0 || _spec.CaptureBounds.Height <= 0)
        {
            return;
        }

        var nextWidth = Math.Max(24, (_spec.CaptureBounds.Width * scaleValue) + (MirrorFramePadding * 2));
        var nextHeight = Math.Max(24, (_spec.CaptureBounds.Height * scaleValue) + (MirrorFramePadding * 2));

        _currentScale = scaleValue;
        _spec = new MirrorWindowSpec
        {
            Id = _spec.Id,
            Name = _spec.Name,
            CaptureBounds = _spec.CaptureBounds,
            MirrorBounds = new RectInfo
            {
                X = (int)Math.Round(Left),
                Y = (int)Math.Round(Top),
                Width = (int)Math.Round(nextWidth),
                Height = (int)Math.Round(nextHeight)
            },
            RelativeBounds = _spec.RelativeBounds,
            Opacity = _spec.Opacity,
            IsLocked = _spec.IsLocked,
            IsVisible = _spec.IsVisible,
            IsFixedCrop = _spec.IsFixedCrop,
            AllowSnapping = _spec.AllowSnapping,
            Scale = scaleValue,
            GlowEnabled = _spec.GlowEnabled,
            GlowColor = _spec.GlowColor,
            GlowSavedColors = _spec.GlowSavedColors,
            GlowIntensity = _spec.GlowIntensity,
            Countdown = _spec.Countdown
        };

        _suspendBoundsEvents = true;
        Width = nextWidth;
        Height = nextHeight;
        _suspendBoundsEvents = false;
        UpdateThumbnail();
        RepositionCountdownBar();
        _currentSnapGroup?.UpdateUnifiedBorderPosition();
        QueueBoundsChanged();
        FlushBoundsChanged();
        UpdateContextMenuItems();
        RaiseAction("set-scale", stringValue: scaleValue.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    private double ResolveCurrentScale()
    {
        if (double.IsFinite(_spec.Scale) && _spec.Scale > 0)
        {
            return _spec.Scale;
        }

        if (_spec.CaptureBounds.Width > 0)
        {
            var innerWidth = Math.Max(1.0, Width - (MirrorFramePadding * 2));
            return Math.Max(0.1, innerWidth / _spec.CaptureBounds.Width);
        }

        return 1.0;
    }

    private void ApplyLocalGlow(bool enabled, string colorHex, double intensity, IEnumerable<string>? savedColors = null, bool refreshMenu = true)
    {
        _spec = new MirrorWindowSpec
        {
            Id = _spec.Id,
            Name = _spec.Name,
            CaptureBounds = _spec.CaptureBounds,
            MirrorBounds = _spec.MirrorBounds,
            RelativeBounds = _spec.RelativeBounds,
            Opacity = _spec.Opacity,
            IsLocked = _spec.IsLocked,
            IsVisible = _spec.IsVisible,
            IsFixedCrop = _spec.IsFixedCrop,
            AllowSnapping = _spec.AllowSnapping,
            Scale = _currentScale,
            GlowEnabled = enabled,
            GlowColor = string.IsNullOrWhiteSpace(colorHex) ? "#FFFFFF" : colorHex,
            GlowSavedColors = NormalizeGlowSavedColors(savedColors ?? _spec.GlowSavedColors),
            GlowIntensity = Math.Clamp(intensity, 1, 30),
            Countdown = _spec.Countdown
        };

        ApplyGlowState();
        if (refreshMenu)
        {
            UpdateContextMenuItems();
        }
    }

    private void ApplyGlowState()
    {
        if (!_spec.GlowEnabled)
        {
            _glowOuter.Visibility = Visibility.Collapsed;
            _glowMid.Visibility = Visibility.Collapsed;
            _glowInner.Visibility = Visibility.Collapsed;
            return;
        }

        var color = ParseGlowColor(_spec.GlowColor);
        var intensityFactor = GetGlowIntensityFactor(_spec.GlowIntensity);
        var margins = new[] { 4.0, 7.0, 9.0 };
        var thicknesses = new[] { 3.0, 2.0, 2.0 };
        var radii = new[] { 8.0, 7.0, 6.0 };
        var alphas = new[] { 64.0, 128.0, 221.0 };
        var borders = new[] { _glowOuter, _glowMid, _glowInner };

        for (var index = 0; index < borders.Length; index++)
        {
            var alpha = (byte)Math.Clamp(Math.Round(alphas[index] * intensityFactor), 0, 255);
            borders[index].BorderBrush = new SolidColorBrush(Color.FromArgb(alpha, color.R, color.G, color.B));
            borders[index].BorderThickness = new Thickness(thicknesses[index]);
            borders[index].CornerRadius = new CornerRadius(radii[index]);
            borders[index].Margin = new Thickness(margins[index]);
            borders[index].Visibility = Visibility.Visible;
        }
    }

    private static Color ParseGlowColor(string? colorHex)
    {
        try
        {
            return (Color)ColorConverter.ConvertFromString(string.IsNullOrWhiteSpace(colorHex) ? "#FFFFFF" : colorHex)!;
        }
        catch
        {
            return Colors.White;
        }
    }

    private static string NormalizeGlowColorHex(string? colorHex)
    {
        return ColorToHex(ParseGlowColor(colorHex));
    }

    private static IReadOnlyList<string> NormalizeGlowSavedColors(IEnumerable<string>? colors)
    {
        var normalized = new List<string>();

        foreach (var color in colors ?? Array.Empty<string>())
        {
            var hex = NormalizeGlowColorHex(color);

            if (!normalized.Any(item => string.Equals(item, hex, StringComparison.OrdinalIgnoreCase)))
            {
                normalized.Add(hex);
            }

            if (normalized.Count >= 10)
            {
                break;
            }
        }

        if (!normalized.Any(item => string.Equals(item, "#FFFFFF", StringComparison.OrdinalIgnoreCase)))
        {
            normalized.Insert(0, "#FFFFFF");
        }

        return normalized.Take(10).ToList();
    }

    private static string ColorToHex(Color color)
    {
        return $"#{color.R:X2}{color.G:X2}{color.B:X2}";
    }

    private static double RgbToBrightness(Color color)
    {
        return Math.Clamp(Math.Max(color.R, Math.Max(color.G, color.B)) / 255.0 * 100.0, 20, 100);
    }

    private static double RgbToHue(Color color)
    {
        var r = color.R / 255.0;
        var g = color.G / 255.0;
        var b = color.B / 255.0;
        var max = Math.Max(r, Math.Max(g, b));
        var min = Math.Min(r, Math.Min(g, b));
        var delta = max - min;

        if (delta <= 0.0001)
        {
            return 0;
        }

        double hue;

        if (Math.Abs(max - r) < 0.0001)
        {
            hue = 60 * (((g - b) / delta) % 6);
        }
        else if (Math.Abs(max - g) < 0.0001)
        {
            hue = 60 * (((b - r) / delta) + 2);
        }
        else
        {
            hue = 60 * (((r - g) / delta) + 4);
        }

        return hue < 0 ? hue + 360 : hue;
    }

    private static Color ColorFromHsv(double hue, double saturation, double value)
    {
        hue = ((hue % 360) + 360) % 360;
        saturation = Math.Clamp(saturation, 0, 1);
        value = Math.Clamp(value, 0, 1);

        var chroma = value * saturation;
        var x = chroma * (1 - Math.Abs((hue / 60 % 2) - 1));
        var m = value - chroma;
        double r;
        double g;
        double b;

        if (hue < 60)
        {
            (r, g, b) = (chroma, x, 0);
        }
        else if (hue < 120)
        {
            (r, g, b) = (x, chroma, 0);
        }
        else if (hue < 180)
        {
            (r, g, b) = (0, chroma, x);
        }
        else if (hue < 240)
        {
            (r, g, b) = (0, x, chroma);
        }
        else if (hue < 300)
        {
            (r, g, b) = (x, 0, chroma);
        }
        else
        {
            (r, g, b) = (chroma, 0, x);
        }

        return Color.FromRgb(
            (byte)Math.Round((r + m) * 255),
            (byte)Math.Round((g + m) * 255),
            (byte)Math.Round((b + m) * 255));
    }

    private static int GlowIntensityToPercent(double intensity)
    {
        return (int)Math.Round(((Math.Clamp(intensity, 1, 30) - 1) / 29) * 100);
    }

    private static Viewbox CreateSnappingIcon()
    {
        var canvas = new Canvas
        {
            Width = 18,
            Height = 18
        };

        var leftRect = new Rectangle
        {
            Width = 6,
            Height = 5,
            Stroke = Brushes.White,
            StrokeThickness = 1.4,
            Fill = Brushes.Transparent
        };
        canvas.Children.Add(leftRect);
        Canvas.SetLeft(leftRect, 0);
        Canvas.SetTop(leftRect, 6);

        var rightRect = new Rectangle
        {
            Width = 6,
            Height = 5,
            Stroke = Brushes.White,
            StrokeThickness = 1.4,
            Fill = Brushes.Transparent
        };
        canvas.Children.Add(rightRect);
        Canvas.SetLeft(rightRect, 11);
        Canvas.SetTop(rightRect, 6);

        canvas.Children.Add(new Line
        {
            X1 = 3,
            Y1 = 3,
            X2 = 6,
            Y2 = 5.8,
            Stroke = Brushes.White,
            StrokeThickness = 1.6,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });
        canvas.Children.Add(new Line
        {
            X1 = 9,
            Y1 = 0.5,
            X2 = 9,
            Y2 = 4.5,
            Stroke = Brushes.White,
            StrokeThickness = 1.6,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });
        canvas.Children.Add(new Line
        {
            X1 = 15,
            Y1 = 3,
            X2 = 12,
            Y2 = 5.8,
            Stroke = Brushes.White,
            StrokeThickness = 1.6,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });
        canvas.Children.Add(new Line
        {
            X1 = 3,
            Y1 = 15,
            X2 = 6,
            Y2 = 12.2,
            Stroke = Brushes.White,
            StrokeThickness = 1.6,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });
        canvas.Children.Add(new Line
        {
            X1 = 9,
            Y1 = 17.5,
            X2 = 9,
            Y2 = 13.5,
            Stroke = Brushes.White,
            StrokeThickness = 1.6,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });
        canvas.Children.Add(new Line
        {
            X1 = 15,
            Y1 = 15,
            X2 = 12,
            Y2 = 12.2,
            Stroke = Brushes.White,
            StrokeThickness = 1.6,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });

        return new Viewbox
        {
            Width = 18,
            Height = 18,
            Child = canvas
        };
    }

    private static Viewbox CreateUnsnapIcon()
    {
        var canvas = new Canvas
        {
            Width = 18,
            Height = 18
        };

        foreach (var (x1, y1, x2, y2) in new (double, double, double, double)[]
        {
            (4, 5, 8, 9),
            (8, 5, 4, 9),
            (10, 9, 14, 13),
            (14, 9, 10, 13)
        })
        {
            canvas.Children.Add(new Line
            {
                X1 = x1,
                Y1 = y1,
                X2 = x2,
                Y2 = y2,
                Stroke = Brushes.White,
                StrokeThickness = 1.7,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round
            });
        }

        return new Viewbox
        {
            Width = 18,
            Height = 18,
            Child = canvas
        };
    }

    private static double GetGlowIntensityFactor(double intensity)
    {
        if (intensity <= 6)
        {
            return 0.6;
        }

        if (intensity >= 14)
        {
            return 1.5;
        }

        return 1.0;
    }

    private static Viewbox CreateMakeNewCropIcon()
    {
        return new Viewbox
        {
            Width = 16,
            Height = 16,
            Child = new Path
            {
                Stroke = Brushes.White,
                StrokeThickness = 1.5,
                Fill = Brushes.Transparent,
                Data = Geometry.Parse("M2,3 L10,3 L10,11 L2,11 M12,8 L16,8 M14,6 L14,10")
            }
        };
    }

    private static Viewbox CreateCropCurrentMirrorIcon()
    {
        return new Viewbox
        {
            Width = 16,
            Height = 16,
            Child = new Path
            {
                Stroke = Brushes.White,
                StrokeThickness = 1.5,
                Fill = Brushes.Transparent,
                Data = Geometry.Parse("M2,2 L6,2 M2,2 L2,6 M14,2 L10,2 M14,2 L14,6 M2,14 L6,14 M2,14 L2,10 M14,14 L10,14 M14,14 L14,10")
            }
        };
    }

    private static Viewbox CreateScaleIcon()
    {
        var canvas = new Canvas
        {
            Width = 16,
            Height = 16
        };

        var fillRect = new Rectangle
        {
            Width = 8,
            Height = 8,
            Fill = Brushes.White
        };
        Canvas.SetLeft(fillRect, 2);
        Canvas.SetTop(fillRect, 2);
        canvas.Children.Add(fillRect);

        var strokeRect = new Rectangle
        {
            Width = 12,
            Height = 12,
            Stroke = Brushes.White,
            StrokeThickness = 1,
            Fill = Brushes.Transparent
        };
        Canvas.SetLeft(strokeRect, 2);
        Canvas.SetTop(strokeRect, 2);
        canvas.Children.Add(strokeRect);

        return new Viewbox
        {
            Width = 16,
            Height = 16,
            Child = canvas
        };
    }

    private static Viewbox CreateGlowIcon()
    {
        return new Viewbox
        {
            Width = 16,
            Height = 16,
            Child = new Path
            {
                Stroke = Brushes.White,
                StrokeThickness = 1.3,
                Fill = Brushes.Transparent,
                Data = Geometry.Parse("M8,1 L9.5,5.2 L14,6.7 L9.8,8.2 L8.3,13 L6.7,8.2 L2,6.7 L6.2,5.2 Z")
            }
        };
    }

    internal void StartCountdown()
    {
        StartCountdown(false);
    }

    internal void StartCountdown(bool triggeredByHotkey)
    {
        var countdown = _spec.Countdown;

        if (!countdown.Enabled || countdown.DurationSeconds <= 0)
        {
            return;
        }

        if (triggeredByHotkey && _isCountdownRunning && countdown.RetriggerEnabled)
        {
            return;
        }

        _countdownTimer.Stop();
        _countdownEndTime = DateTime.Now.AddSeconds(countdown.DurationSeconds);
        _isCountdownRunning = true;
        ShowCountdownBar();
        UpdateCountdownProgress(1.0);
        _countdownTimer.Start();
        RaiseAction("countdown-started");
    }

    internal void StopCountdown(bool notify = true)
    {
        _countdownTimer.Stop();
        var wasRunning = _isCountdownRunning;
        _isCountdownRunning = false;
        HideCountdownBar();

        if (notify && wasRunning)
        {
            RaiseAction("countdown-stopped");
        }
    }

    private void OnCountdownTimerTick(object? sender, EventArgs e)
    {
        var durationSeconds = Math.Max(_spec.Countdown.DurationSeconds, 1);
        var totalSeconds = (_countdownEndTime - DateTime.Now).TotalSeconds;
        var progress = Math.Max(0.0, Math.Min(1.0, totalSeconds / durationSeconds));
        UpdateCountdownProgress(progress);

        if (totalSeconds > 0)
        {
            return;
        }

        _countdownTimer.Stop();
        _isCountdownRunning = false;
        HideCountdownBar();

        if (_spec.Countdown.FlashEnabled)
        {
            FlashGlow();
        }

        RaiseAction("countdown-finished");
    }

    private void ApplyCountdownSpec()
    {
        if (!_spec.Countdown.Enabled)
        {
            StopCountdown(false);
            return;
        }

        if (_countdownBarWindow is not null)
        {
            _countdownBarWindow.Configure(
                _spec.Countdown.Side,
                _spec.Countdown.Direction,
                _spec.Countdown.BorderWidth,
                _spec.Countdown.BorderRadius,
                _spec.Countdown.BorderColor);
            _countdownBarWindow.SetColor(_spec.Countdown.Color);
            ApplyCountdownBarGeometry();
            _countdownBarWindow.Opacity = MirrorVisualOpacity;

            if (_isCountdownRunning)
            {
                var durationSeconds = Math.Max(_spec.Countdown.DurationSeconds, 1);
                var totalSeconds = (_countdownEndTime - DateTime.Now).TotalSeconds;
                var progress = Math.Max(0.0, Math.Min(1.0, totalSeconds / durationSeconds));
                _countdownBarWindow.UpdateProgress(progress);
            }
        }
    }

    private void ShowCountdownBar()
    {
        if (!_globalVisible || !_spec.IsVisible || _sourceHwnd == IntPtr.Zero || !_spec.Countdown.Enabled)
        {
            return;
        }

        if (_countdownBarWindow is null)
        {
            _countdownBarWindow = new CountdownBarWindow();
        }

        _countdownBarWindow.Configure(
            _spec.Countdown.Side,
            _spec.Countdown.Direction,
            _spec.Countdown.BorderWidth,
            _spec.Countdown.BorderRadius,
            _spec.Countdown.BorderColor);
        _countdownBarWindow.SetColor(_spec.Countdown.Color);
        ApplyCountdownBarGeometry();
        _countdownBarWindow.Opacity = MirrorVisualOpacity;
        _countdownBarWindow.UpdateProgress(1.0);

        if (!_countdownBarWindow.IsVisible)
        {
            _countdownBarWindow.Show();
        }
    }

    private void EnsureCountdownBarVisible()
    {
        if (!_globalVisible || !_spec.IsVisible || _sourceHwnd == IntPtr.Zero || !_spec.Countdown.Enabled)
        {
            return;
        }

        if (_countdownBarWindow is null)
        {
            _countdownBarWindow = new CountdownBarWindow();
        }

        _countdownBarWindow.Configure(
            _spec.Countdown.Side,
            _spec.Countdown.Direction,
            _spec.Countdown.BorderWidth,
            _spec.Countdown.BorderRadius,
            _spec.Countdown.BorderColor);
        _countdownBarWindow.SetColor(_spec.Countdown.Color);
        ApplyCountdownBarGeometry();
        _countdownBarWindow.Opacity = MirrorVisualOpacity;

        if (!_countdownBarWindow.IsVisible)
        {
            _countdownBarWindow.Show();
        }
    }

    private void HideCountdownBar()
    {
        _countdownBarWindow?.Hide();
    }

    private void UpdateCountdownProgress(double progress)
    {
        if (_countdownBarWindow is null)
        {
            return;
        }

        _countdownBarWindow.UpdateProgress(progress);
        _countdownBarWindow.Opacity = MirrorVisualOpacity;
    }

    private void RepositionCountdownBar()
    {
        if (_countdownBarWindow is not null && _countdownBarWindow.IsVisible)
        {
            ApplyCountdownBarGeometry();
        }
    }

    private void ApplyCountdownBarGeometry()
    {
        if (_countdownBarWindow is null)
        {
            return;
        }

        var thickness = Math.Max(_spec.Countdown.BarThickness, 1);
        var length = Math.Max(_spec.Countdown.BarLength, 1);
        var centerX = Left + (Width / 2.0);
        var centerY = Top + (Height / 2.0);
        var direction = string.IsNullOrWhiteSpace(_spec.Countdown.Direction)
            ? "LeftToRight"
            : _spec.Countdown.Direction;
        var isVertical = direction == "TopToBottom" || direction == "BottomToTop";
        double left;
        double top;
        double width;
        double height;

        switch (_spec.Countdown.Side)
        {
            case "Above":
                if (isVertical)
                {
                    left = centerX - (thickness / 2.0);
                    top = Top - length;
                    width = thickness;
                    height = length;
                }
                else
                {
                    left = centerX - (length / 2.0);
                    top = Top - thickness;
                    width = length;
                    height = thickness;
                }
                break;
            case "Below":
                if (isVertical)
                {
                    left = centerX - (thickness / 2.0);
                    top = Top + Height;
                    width = thickness;
                    height = length;
                }
                else
                {
                    left = centerX - (length / 2.0);
                    top = Top + Height;
                    width = length;
                    height = thickness;
                }
                break;
            case "Left":
                if (isVertical)
                {
                    left = Left - thickness;
                    top = centerY - (length / 2.0);
                    width = thickness;
                    height = length;
                }
                else
                {
                    left = Left - length;
                    top = centerY - (thickness / 2.0);
                    width = length;
                    height = thickness;
                }
                break;
            default:
                if (isVertical)
                {
                    left = Left + Width;
                    top = centerY - (length / 2.0);
                    width = thickness;
                    height = length;
                }
                else
                {
                    left = Left + Width;
                    top = centerY - (thickness / 2.0);
                    width = length;
                    height = thickness;
                }
                break;
        }

        _countdownBarWindow.Left = left;
        _countdownBarWindow.Top = top;
        _countdownBarWindow.Width = width;
        _countdownBarWindow.Height = height;
    }

    private void UpdateFlashBorderGeometry()
    {
        var innerWidth = Math.Max(1, ActualWidth - (MirrorFramePadding * 2.0));
        var innerHeight = Math.Max(1, ActualHeight - (MirrorFramePadding * 2.0));
        var radius = Math.Min(6.0, Math.Max(0.0, Math.Min(innerWidth, innerHeight) * 0.18));

        _flashBorder.Margin = new Thickness(MirrorFramePadding - 0.5);
        _flashBorder.CornerRadius = new CornerRadius(radius);
        _resizeHandle.Margin = new Thickness(0, 0, -1, -1);
    }

    private void UpdateResizeInfoBadge()
    {
        if (!_isResizing || _spec.IsLocked)
        {
            _resizeInfoBadge.Visibility = Visibility.Collapsed;
            return;
        }

        var innerWidth = Math.Max(1, (int)Math.Round(Math.Max(1, ActualWidth - (MirrorFramePadding * 2))));
        var innerHeight = Math.Max(1, (int)Math.Round(Math.Max(1, ActualHeight - (MirrorFramePadding * 2))));
        _resizeInfoText.Text = $"{innerWidth}px x {innerHeight}px";
        _resizeInfoBadge.Visibility = Visibility.Visible;
    }

    private void FlashGlow()
    {
        _flashTimer?.Stop();
        UpdateFlashBorderGeometry();
        _flashBorder.Visibility = Visibility.Visible;
        var flashCount = 0;
        _flashTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(80)
        };
        _flashTimer.Tick += (_, _) =>
        {
            if (flashCount >= 10)
            {
                _flashTimer?.Stop();
                _flashBorder.Visibility = Visibility.Collapsed;
                return;
            }

            _flashBorder.Visibility = flashCount % 2 == 0 ? Visibility.Visible : Visibility.Collapsed;
            flashCount++;
        };
        _flashTimer.Start();
    }

    internal Rect GetMirrorBounds()
    {
        return new Rect(
            Left + MirrorFramePadding,
            Top + MirrorFramePadding,
            Math.Max(1, Width - (MirrorFramePadding * 2)),
            Math.Max(1, Height - (MirrorFramePadding * 2)));
    }

    internal SnapGroup? GetSnapGroup()
    {
        return _currentSnapGroup;
    }

    internal void SetSnapGroup(SnapGroup? snapGroup)
    {
        _currentSnapGroup = snapGroup;
        UpdateSnapGroupBorders();
    }

    internal void UpdateSnapGroupBorders()
    {
        _selectionBorder.BorderBrush = MirrorAccentBrush;
        _selectionBorder.BorderThickness = new Thickness(3);
        _selectionBorder.CornerRadius = new CornerRadius(0);

        if (_currentSnapGroup is not null && _currentSnapGroup.Windows.Count > 1)
        {
            if (_spec.IsLocked)
            {
                _selectionBorder.Visibility = Visibility.Visible;
                _selectionBorder.Opacity = 0;
            }
            else
            {
                _selectionBorder.Visibility = Visibility.Visible;
                _selectionBorder.Opacity = 0.3;
            }

            return;
        }

        if (_spec.IsLocked)
        {
            _selectionBorder.Visibility = Visibility.Collapsed;
        }
        else
        {
            _selectionBorder.Visibility = Visibility.Visible;
            _selectionBorder.Opacity = 1;
        }
    }

    internal void ForceUnsnap()
    {
        if (_currentSnapGroup is null)
        {
            return;
        }

        var allWindows = _currentSnapGroup.Windows.ToList();
        var group = _currentSnapGroup;
        var now = DateTime.Now;

        foreach (var window in allWindows)
        {
            window._lastUnsnapTime = now;
            window._skipSnapOnNextDragStart = true;
            window._skipSnapForCurrentDrag = false;
        }

        _currentSnapGroup = null;
        group.RemoveWindow(this);

        if (allWindows.Count == 2)
        {
            Left += 20;
        }

        UpdateSnapGroupBorders();
        group.UpdateBorderDisplay();
        FlushBoundsChanged();
    }

    private void TrySnapToOtherWindows()
    {
        var otherWindows = _getAllMirrorWindows?.Invoke()
            ?.Where((window) => window != this && window.AllowSnapping)
            ?.ToList();

        if (otherWindows is null || otherWindows.Count == 0 || !AllowSnapping)
        {
            return;
        }

        if ((DateTime.Now - _lastUnsnapTime).TotalMilliseconds <= 2000)
        {
            return;
        }

        var current = GetMirrorBounds();
        const double threshold = 4;

        foreach (var candidate in otherWindows)
        {
            var target = candidate.GetMirrorBounds();
            var sameTop = Math.Abs(current.Top - target.Top) <= threshold;
            var sameLeft = Math.Abs(current.Left - target.Left) <= threshold;

            if (sameTop && Math.Abs(current.Right - target.Left) <= threshold)
            {
                Left = target.Left - current.Width - MirrorFramePadding;
                Top = target.Top - MirrorFramePadding;
                CreateSnapGroup(candidate);
                return;
            }

            if (sameTop && Math.Abs(current.Left - target.Right) <= threshold)
            {
                Left = target.Right - MirrorFramePadding;
                Top = target.Top - MirrorFramePadding;
                CreateSnapGroup(candidate);
                return;
            }

            if (sameLeft && Math.Abs(current.Bottom - target.Top) <= threshold)
            {
                Left = target.Left - MirrorFramePadding;
                Top = target.Top - current.Height - MirrorFramePadding;
                CreateSnapGroup(candidate);
                return;
            }

            if (sameLeft && Math.Abs(current.Top - target.Bottom) <= threshold)
            {
                Left = target.Left - MirrorFramePadding;
                Top = target.Bottom - MirrorFramePadding;
                CreateSnapGroup(candidate);
                return;
            }
        }
    }

    private void CreateSnapGroup(RegionMirrorWindow targetWindow)
    {
        if (_currentSnapGroup is not null || targetWindow._currentSnapGroup is not null)
        {
            if (targetWindow._currentSnapGroup is not null && _currentSnapGroup is null)
            {
                targetWindow._currentSnapGroup.AddWindow(this);
            }
            else if (_currentSnapGroup is not null && targetWindow._currentSnapGroup is null)
            {
                _currentSnapGroup.AddWindow(targetWindow);
            }

            return;
        }

        var snapGroup = new SnapGroup();
        _currentSnapGroup = snapGroup;
        targetWindow._currentSnapGroup = snapGroup;
        snapGroup.AddWindow(this);
        snapGroup.AddWindow(targetWindow);
        snapGroup.UpdateBorderDisplay();
    }

    private void RaiseAction(string action, bool? boolValue = null, int? intValue = null, string? stringValue = null)
    {
        ActionRequested?.Invoke(this, new RegionMirrorActionEventArgs
        {
            RegionId = _spec.Id,
            Action = action,
            BoolValue = boolValue,
            IntValue = intValue,
            StringValue = stringValue
        });
    }

    private void PromoteContextMenuPopup()
    {
        if (ContextMenu is null)
        {
            return;
        }

        var popupHandle = PresentationSource.FromVisual(ContextMenu) is HwndSource source
            ? source.Handle
            : IntPtr.Zero;

        if (popupHandle == IntPtr.Zero)
        {
            return;
        }

        // Never probe the desktop for the popup HWND: the sampled point can
        // belong to Tibia or another app and would incorrectly make it topmost.
        WindowStyleInterop.SetWindowAlwaysOnTop(popupHandle, _alwaysOnTop);

        if (_windowHandle != IntPtr.Zero)
        {
            WindowStyleInterop.PlaceWindowAbove(popupHandle, _windowHandle);
        }
    }

    private void StartContextMenuPromotion()
    {
        PromoteContextMenuPopup();
        Dispatcher.BeginInvoke(PromoteContextMenuPopup, DispatcherPriority.ApplicationIdle);
        Dispatcher.BeginInvoke(PromoteContextMenuPopup, DispatcherPriority.ContextIdle);
    }

    private static GlobalMouseClickListener CreateContextMenuMouseClickListener()
    {
        var listener = new GlobalMouseClickListener();
        listener.MousePressed += OnGlobalContextMenuMousePressed;
        return listener;
    }

    private static void OnGlobalContextMenuMousePressed(int screenX, int screenY)
    {
        var owner = _activeContextMenuOwner;
        if (owner?.ContextMenu?.IsOpen != true)
        {
            return;
        }

        var isInside = owner.IsPointerInsideContextMenu(screenX, screenY);
        Console.Error.WriteLine(
            $"mirror-context-menu id={owner._spec.Id} state=global-click inside={isInside} x={screenX} y={screenY}");
        if (!isInside)
        {
            Console.Error.WriteLine($"mirror-context-menu id={owner._spec.Id} state=dismissed-outside");
            owner._suppressContextMenuOpenUntilUtc = DateTime.UtcNow.AddMilliseconds(500);
            owner.ContextMenu.IsOpen = false;
        }
    }

    private bool IsPointerInsideContextMenu(int? screenX = null, int? screenY = null)
    {
        if (ContextMenu is null)
        {
            return false;
        }

        NativePoint cursor;
        if (screenX.HasValue && screenY.HasValue)
        {
            cursor = new NativePoint { X = screenX.Value, Y = screenY.Value };
        }
        else if (!GetCursorPos(out cursor))
        {
            return false;
        }

        try
        {
            var topLeft = ContextMenu.PointToScreen(new Point(0, 0));
            var insideRoot = cursor.X >= topLeft.X
                && cursor.X <= topLeft.X + ContextMenu.ActualWidth
                && cursor.Y >= topLeft.Y
                && cursor.Y <= topLeft.Y + ContextMenu.ActualHeight;
            return insideRoot;
        }
        catch
        {
            return false;
        }
    }

    private static void CloseActiveContextMenu(RegionMirrorWindow? except = null)
    {
        var owner = _activeContextMenuOwner;
        if (owner is null || ReferenceEquals(owner, except) || owner.ContextMenu?.IsOpen != true)
        {
            return;
        }

        _activeContextMenuOwner = null;
        owner.ContextMenu.IsOpen = false;
    }

    private static bool AreBoundsEqual(RectInfo? left, RectInfo right)
    {
        if (left is null)
        {
            return false;
        }

        return left.X == right.X
            && left.Y == right.Y
            && left.Width == right.Width
            && left.Height == right.Height;
    }

    private RectInfo GetCurrentMirrorBounds()
    {
        return new RectInfo
        {
            X = (int)Math.Round(Left),
            Y = (int)Math.Round(Top),
            Width = (int)Math.Round(Width),
            Height = (int)Math.Round(Height)
        };
    }

    private void LogThumbnailDiagnostic(string message)
    {
        if (string.Equals(_lastThumbnailDiagnostic, message, StringComparison.Ordinal))
        {
            return;
        }

        _lastThumbnailDiagnostic = message;
        Console.Error.WriteLine($"mirror[{_spec.Id}] {message}");
    }

    private void ClearThumbnailDiagnostic()
    {
        _lastThumbnailDiagnostic = "";
    }
}
