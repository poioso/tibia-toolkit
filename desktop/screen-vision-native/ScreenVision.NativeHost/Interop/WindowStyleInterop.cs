using System.Runtime.InteropServices;

namespace ScreenVision.NativeHost.Interop;

internal static class WindowStyleInterop
{
    private const int GwlExStyle = -20;
    private const int WsExToolWindow = 0x80;
    private const int WsExTransparent = 0x20;
    private const int WsExLayered = 0x80000;
    private const int WsExNoActivate = 0x8000000;
    private const uint SwpNoZOrder = 0x0004;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpFrameChanged = 0x0020;
    private const uint GwHwndPrev = 3;
    private static readonly IntPtr HwndTop = new(0);
    private static readonly IntPtr HwndTopmost = new(-1);
    private static readonly IntPtr HwndNotTopmost = new(-2);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hwnd, int index);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hwnd, int index, int newLong);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(
        IntPtr hwnd,
        IntPtr hwndInsertAfter,
        int x,
        int y,
        int cx,
        int cy,
        uint flags);

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr hwnd, uint command);

    internal static int GetWindowExtendedStyle(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return 0;
        }

        return GetWindowLong(hwnd, GwlExStyle);
    }

    internal static void SetWindowExtendedStyle(IntPtr hwnd, int style)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        SetWindowLong(hwnd, GwlExStyle, style);
    }

    internal static void SetWindowAlwaysOnTop(IntPtr hwnd, bool enabled)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        SetWindowPos(
            hwnd,
            enabled ? HwndTopmost : HwndNotTopmost,
            0,
            0,
            0,
            0,
            SwpNoMove | SwpNoSize | SwpNoActivate);
    }

    internal static void PlaceWindowAbove(IntPtr hwnd, IntPtr referenceHwnd)
    {
        if (hwnd == IntPtr.Zero || referenceHwnd == IntPtr.Zero)
        {
            return;
        }

        // SetWindowPos places hwnd behind hwndInsertAfter. To place hwnd directly
        // above referenceHwnd, insert it behind the window currently above reference.
        var insertAfter = GetWindow(referenceHwnd, GwHwndPrev);
        if (insertAfter == IntPtr.Zero || insertAfter == hwnd)
        {
            insertAfter = HwndTop;
        }

        SetWindowPos(
            hwnd,
            insertAfter,
            0,
            0,
            0,
            0,
            SwpNoMove | SwpNoSize | SwpNoActivate);
    }

    internal static void EnableToolWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        var style = GetWindowExtendedStyle(hwnd);
        style |= WsExToolWindow;
        SetWindowExtendedStyle(hwnd, style);
        RefreshFrame(hwnd);
    }

    internal static void MakeWindowClickThrough(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        var style = GetWindowExtendedStyle(hwnd);
        style |= WsExLayered | WsExTransparent | WsExNoActivate;
        SetWindowExtendedStyle(hwnd, style);
        RefreshFrame(hwnd);
    }

    internal static void MakeWindowClickable(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        var style = GetWindowExtendedStyle(hwnd);
        style &= ~(WsExTransparent | WsExNoActivate);
        style |= WsExLayered;
        SetWindowExtendedStyle(hwnd, style);
        RefreshFrame(hwnd);
    }

    internal static void MakeWindowDraggableNoActivate(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        var style = GetWindowExtendedStyle(hwnd);
        style &= ~WsExTransparent;
        style |= WsExLayered | WsExNoActivate;
        SetWindowExtendedStyle(hwnd, style);
        RefreshFrame(hwnd);
    }

    internal static void SetClickThrough(IntPtr hwnd, bool enabled)
    {
        if (enabled)
        {
            MakeWindowClickThrough(hwnd);
            return;
        }

        MakeWindowClickable(hwnd);
    }

    private static void RefreshFrame(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, SwpNoMove | SwpNoSize | SwpNoActivate | SwpNoZOrder | SwpFrameChanged);
    }
}
