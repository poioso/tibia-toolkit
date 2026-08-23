using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

/// <summary>
/// Click-through, non-activating visual magnifier for the Tibia client. It is
/// shared by the 32x32 positioning preview and the standalone cursor zoom. The
/// preview uses a DWM thumbnail, so no pixels are injected into or read from
/// the game process.
/// </summary>
internal sealed class CropMagnifierWindow : Window
{
    private const int ExtendedStyleIndex = -20;
    private const int ExtendedStyleTransparent = 0x20;
    private const int ExtendedStyleLayered = 0x80000;
    private const int ExtendedStyleToolWindow = 0x80;
    private const int ExtendedStyleNoActivate = 0x08000000;
    private const uint MonitorDefaultToNearest = 0x00000002;
    private const double PreviewSize = 200;
    private const double FrameThickness = 2;
    private const double CursorGap = 28;

    private readonly IntPtr _sourceHwnd;
    private readonly FrameworkElement _cursorCenterMarker;
    private CenterMarkerOverlayWindow? _centerMarkerOverlay;
    private IntPtr _thumbnail;

    internal IntPtr SourceHwnd => _sourceHwnd;

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hwnd, int index);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromPoint(NativePoint point, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

    [StructLayout(LayoutKind.Sequential)]
    private readonly struct NativePoint
    {
        internal readonly int X;
        internal readonly int Y;

        internal NativePoint(int x, int y)
        {
            X = x;
            Y = y;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        internal int Left;
        internal int Top;
        internal int Right;
        internal int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MonitorInfo
    {
        internal int Size;
        internal NativeRect Monitor;
        internal NativeRect WorkArea;
        internal uint Flags;
    }

    internal CropMagnifierWindow(IntPtr sourceHwnd)
    {
        _sourceHwnd = sourceHwnd;
        Title = "Tibia Toolkit Magnifier";
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        Width = PreviewSize;
        Height = PreviewSize;
        Background = new SolidColorBrush(Color.FromRgb(88, 196, 112));
        var root = new System.Windows.Controls.Grid
        {
            IsHitTestVisible = false
        };
        root.Children.Add(new System.Windows.Controls.Border
        {
            BorderBrush = new SolidColorBrush(Color.FromRgb(88, 196, 112)),
            BorderThickness = new Thickness(FrameThickness),
            Background = Brushes.Transparent,
            IsHitTestVisible = false
        });
        var marker = new System.Windows.Controls.Grid
        {
            Width = 17,
            Height = 17,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false
        };
        marker.Children.Add(new System.Windows.Controls.Border
        {
            Width = 15,
            Height = 3,
            Background = Brushes.White,
            BorderBrush = Brushes.Black,
            BorderThickness = new Thickness(1),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        });
        marker.Children.Add(new System.Windows.Controls.Border
        {
            Width = 3,
            Height = 15,
            Background = Brushes.White,
            BorderBrush = Brushes.Black,
            BorderThickness = new Thickness(1),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        });
        root.Children.Add(marker);
        _cursorCenterMarker = marker;
        Content = root;

        Loaded += (_, _) =>
        {
            MakeClickThrough();
            RegisterThumbnail();
        };
    }

    internal void ShowRegionPreview(RectInfo screenBounds, Point cursorScreenPoint, bool showCursorCenterMarker = false)
    {
        if (_sourceHwnd == IntPtr.Zero || screenBounds.Width < 1 || screenBounds.Height < 1)
        {
            return;
        }

        if (!IsVisible)
        {
            Show();
        }

        _cursorCenterMarker.Visibility = showCursorCenterMarker
            ? Visibility.Visible
            : Visibility.Collapsed;

        if (!showCursorCenterMarker)
        {
            _centerMarkerOverlay?.Hide();
        }

        if (_thumbnail == IntPtr.Zero)
        {
            RegisterThumbnail();
        }

        var clientBounds = WindowProbe.ConvertScreenToClientBounds(_sourceHwnd, screenBounds);

        if (clientBounds is null || clientBounds.Width < 1 || clientBounds.Height < 1 || _thumbnail == IntPtr.Zero)
        {
            return;
        }

        var destinationHandle = new WindowInteropHelper(this).Handle;
        var destination = DwmThumbnailInterop.ToDeviceRect(
            new Rect(
                FrameThickness,
                FrameThickness,
                PreviewSize - (FrameThickness * 2),
                PreviewSize - (FrameThickness * 2)),
            this,
            destinationHandle);
        var source = DwmThumbnailInterop.ToDeviceRect(
            new Rect(clientBounds.X, clientBounds.Y, clientBounds.Width, clientBounds.Height),
            null,
            _sourceHwnd);
        var properties = new DwmThumbnailInterop.ThumbnailProperties
        {
            Flags = DwmThumbnailInterop.ThumbnailRectDestination
                | DwmThumbnailInterop.ThumbnailRectSource
                | DwmThumbnailInterop.ThumbnailOpacity
                | DwmThumbnailInterop.ThumbnailVisible
                | DwmThumbnailInterop.ThumbnailSourceClientAreaOnly,
            Destination = destination,
            Source = source,
            Opacity = byte.MaxValue,
            Visible = true,
            SourceClientAreaOnly = true
        };

        DwmThumbnailInterop.DwmUpdateThumbnailProperties(_thumbnail, ref properties);
        PlaceNear(cursorScreenPoint, destinationHandle);

        if (showCursorCenterMarker)
        {
            _centerMarkerOverlay ??= new CenterMarkerOverlayWindow(this);
            _centerMarkerOverlay.ShowCenteredOn(this);
        }
    }

    internal void HidePreview()
    {
        if (IsVisible)
        {
            Hide();
        }
    }

    private void RegisterThumbnail()
    {
        if (_thumbnail != IntPtr.Zero || _sourceHwnd == IntPtr.Zero)
        {
            return;
        }

        var destinationHandle = new WindowInteropHelper(this).Handle;

        if (destinationHandle == IntPtr.Zero)
        {
            return;
        }

        var result = DwmThumbnailInterop.DwmRegisterThumbnail(destinationHandle, _sourceHwnd, out _thumbnail);

        if (result != 0)
        {
            _thumbnail = IntPtr.Zero;
        }
    }

    private void MakeClickThrough()
    {
        var handle = new WindowInteropHelper(this).Handle;

        if (handle == IntPtr.Zero)
        {
            return;
        }

        var currentStyle = GetWindowLong(handle, ExtendedStyleIndex);
        SetWindowLong(
            handle,
            ExtendedStyleIndex,
            currentStyle
                | ExtendedStyleTransparent
                | ExtendedStyleLayered
                | ExtendedStyleToolWindow
                | ExtendedStyleNoActivate);
    }

    private void PlaceNear(Point cursorScreenPoint, IntPtr destinationHandle)
    {
        var dpiScale = 1.0;

        try
        {
            dpiScale = Math.Max(1, GetDpiForWindow(destinationHandle)) / 96.0;
        }
        catch
        {
        }

        var previewPhysicalSize = PreviewSize * dpiScale;
        var left = cursorScreenPoint.X + CursorGap;
        var top = cursorScreenPoint.Y + CursorGap;

        if (TryGetMonitorBounds(cursorScreenPoint.X, cursorScreenPoint.Y, out var cursorMonitor, out _)
            && TryGetMonitorBounds(
                left + (previewPhysicalSize / 2.0),
                top + (previewPhysicalSize / 2.0),
                out var destinationMonitor,
                out var destinationBounds))
        {
            // Crossing into a real adjacent monitor is valid. Only flip while
            // the proposed preview still belongs to the cursor's monitor and
            // would cross that monitor's external edge.
            if (destinationMonitor == cursorMonitor)
            {
                if (left + previewPhysicalSize > destinationBounds.Right)
                {
                    left = cursorScreenPoint.X - CursorGap - previewPhysicalSize;
                }

                if (top + previewPhysicalSize > destinationBounds.Bottom)
                {
                    top = cursorScreenPoint.Y - CursorGap - previewPhysicalSize;
                }
            }

            // The flip can move the preview to another display. Resolve the
            // final monitor again and clamp to its physical bounds so gaps in
            // the virtual desktop can never leave part of the magnifier off-screen.
            if (TryGetMonitorBounds(
                left + (previewPhysicalSize / 2.0),
                top + (previewPhysicalSize / 2.0),
                out _,
                out var finalBounds))
            {
                left = Math.Clamp(left, finalBounds.Left, Math.Max(finalBounds.Left, finalBounds.Right - previewPhysicalSize));
                top = Math.Clamp(top, finalBounds.Top, Math.Max(finalBounds.Top, finalBounds.Bottom - previewPhysicalSize));
            }
        }
        else
        {
            var virtualLeft = SystemParameters.VirtualScreenLeft * dpiScale;
            var virtualTop = SystemParameters.VirtualScreenTop * dpiScale;
            var virtualRight = virtualLeft + (SystemParameters.VirtualScreenWidth * dpiScale);
            var virtualBottom = virtualTop + (SystemParameters.VirtualScreenHeight * dpiScale);
            left = Math.Clamp(left, virtualLeft, Math.Max(virtualLeft, virtualRight - previewPhysicalSize));
            top = Math.Clamp(top, virtualTop, Math.Max(virtualTop, virtualBottom - previewPhysicalSize));
        }

        Left = left / dpiScale;
        Top = top / dpiScale;
    }

    private static bool TryGetMonitorBounds(double x, double y, out IntPtr monitor, out NativeRect bounds)
    {
        monitor = MonitorFromPoint(
            new NativePoint((int)Math.Round(x), (int)Math.Round(y)),
            MonitorDefaultToNearest);
        bounds = default;

        if (monitor == IntPtr.Zero)
        {
            return false;
        }

        var info = new MonitorInfo
        {
            Size = Marshal.SizeOf<MonitorInfo>()
        };

        if (!GetMonitorInfo(monitor, ref info))
        {
            return false;
        }

        bounds = info.Monitor;
        return bounds.Right > bounds.Left && bounds.Bottom > bounds.Top;
    }

    private sealed class CenterMarkerOverlayWindow : Window
    {
        private const int ExtendedStyleIndex = -20;
        private const int ExtendedStyleTransparent = 0x20;
        private const int ExtendedStyleLayered = 0x80000;
        private const int ExtendedStyleToolWindow = 0x80;
        private const int ExtendedStyleNoActivate = 0x08000000;
        private const uint SwpNoSize = 0x0001;
        private const uint SwpNoMove = 0x0002;
        private const uint SwpNoActivate = 0x0010;
        private static readonly IntPtr HwndTopmost = new(-1);

        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hwnd, int index);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(
            IntPtr hwnd,
            IntPtr insertAfter,
            int x,
            int y,
            int width,
            int height,
            uint flags);

        internal CenterMarkerOverlayWindow(Window owner)
        {
            Owner = owner;
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            ShowInTaskbar = false;
            ShowActivated = false;
            Topmost = true;
            Focusable = false;
            IsHitTestVisible = false;
            ResizeMode = ResizeMode.NoResize;
            Width = 17;
            Height = 17;

            var marker = new System.Windows.Controls.Grid
            {
                IsHitTestVisible = false
            };
            marker.Children.Add(new System.Windows.Controls.Border
            {
                Width = 15,
                Height = 3,
                Background = Brushes.White,
                BorderBrush = Brushes.Black,
                BorderThickness = new Thickness(1),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            });
            marker.Children.Add(new System.Windows.Controls.Border
            {
                Width = 3,
                Height = 15,
                Background = Brushes.White,
                BorderBrush = Brushes.Black,
                BorderThickness = new Thickness(1),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            });
            Content = marker;

            Loaded += (_, _) => MakeClickThrough();
        }

        internal void ShowCenteredOn(Window owner)
        {
            var ownerWidth = owner.ActualWidth > 0 ? owner.ActualWidth : owner.Width;
            var ownerHeight = owner.ActualHeight > 0 ? owner.ActualHeight : owner.Height;
            Left = owner.Left + ((ownerWidth - Width) / 2);
            Top = owner.Top + ((ownerHeight - Height) / 2);

            if (!IsVisible)
            {
                Show();
            }

            var handle = new WindowInteropHelper(this).Handle;
            if (handle != IntPtr.Zero)
            {
                SetWindowPos(
                    handle,
                    HwndTopmost,
                    0,
                    0,
                    0,
                    0,
                    SwpNoMove | SwpNoSize | SwpNoActivate);
            }
        }

        private void MakeClickThrough()
        {
            var handle = new WindowInteropHelper(this).Handle;
            if (handle == IntPtr.Zero)
            {
                return;
            }

            var currentStyle = GetWindowLong(handle, ExtendedStyleIndex);
            SetWindowLong(
                handle,
                ExtendedStyleIndex,
                currentStyle
                    | ExtendedStyleTransparent
                    | ExtendedStyleLayered
                    | ExtendedStyleToolWindow
                    | ExtendedStyleNoActivate);
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        try
        {
            _centerMarkerOverlay?.Close();
        }
        catch
        {
        }

        _centerMarkerOverlay = null;

        if (_thumbnail != IntPtr.Zero)
        {
            DwmThumbnailInterop.DwmUnregisterThumbnail(_thumbnail);
            _thumbnail = IntPtr.Zero;
        }

        base.OnClosed(e);
    }
}
