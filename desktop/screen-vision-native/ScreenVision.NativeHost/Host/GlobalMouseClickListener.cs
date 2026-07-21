using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;

namespace ScreenVision.NativeHost.Host;

internal sealed class GlobalMouseClickListener : IDisposable
{
    private const int WhMouseLl = 14;
    private const int WmLeftButtonDown = 0x0201;
    private const int WmRightButtonDown = 0x0204;
    private const int WmMiddleButtonDown = 0x0207;

    private readonly LowLevelMouseProc _hookCallback;
    private IntPtr _hookId;

    internal event Action<int, int>? MousePressed;

    internal GlobalMouseClickListener()
    {
        _hookCallback = HookCallback;
    }

    internal void Start()
    {
        if (_hookId != IntPtr.Zero)
        {
            return;
        }

        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule;
        _hookId = SetWindowsHookEx(WhMouseLl, _hookCallback, GetModuleHandle(module?.ModuleName), 0);
        Console.Error.WriteLine(
            _hookId == IntPtr.Zero
                ? $"global-mouse-hook state=failed error={Marshal.GetLastWin32Error()}"
                : "global-mouse-hook state=started");
    }

    internal void Stop()
    {
        if (_hookId == IntPtr.Zero)
        {
            return;
        }

        UnhookWindowsHookEx(_hookId);
        _hookId = IntPtr.Zero;
        Console.Error.WriteLine("global-mouse-hook state=stopped");
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var message = unchecked((int)wParam.ToInt64());
            if (message is WmLeftButtonDown or WmRightButtonDown or WmMiddleButtonDown)
            {
                var data = Marshal.PtrToStructure<LowLevelMouseData>(lParam);
                Application.Current?.Dispatcher.BeginInvoke(
                    () => MousePressed?.Invoke(data.Point.X, data.Point.Y));
            }
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    public void Dispose()
    {
        Stop();
    }

    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint
    {
        internal int X;
        internal int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LowLevelMouseData
    {
        internal NativePoint Point;
        internal uint MouseData;
        internal uint Flags;
        internal uint Time;
        internal nuint ExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hmod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
}
