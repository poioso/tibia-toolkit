using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;

namespace ScreenVision.NativeHost.Host;

internal sealed class GlobalHotkeyListener : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmSysKeyDown = 0x0104;
    private const int WmKeyUp = 0x0101;
    private const int WmSysKeyUp = 0x0105;

    private readonly LowLevelKeyboardProc _hookCallback;
    private readonly HashSet<int> _heldKeys = [];
    private IntPtr _hookId;

    internal event Action<int, int>? KeyPressed;

    internal GlobalHotkeyListener()
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
        _hookId = SetWindowsHookEx(WhKeyboardLl, _hookCallback, GetModuleHandle(module?.ModuleName), 0);
    }

    internal void Stop()
    {
        if (_hookId == IntPtr.Zero)
        {
            return;
        }

        UnhookWindowsHookEx(_hookId);
        _hookId = IntPtr.Zero;
        _heldKeys.Clear();
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var keyCode = Marshal.ReadInt32(lParam);
            var message = unchecked((int)wParam.ToInt64());

            if (message == WmKeyUp || message == WmSysKeyUp)
            {
                _heldKeys.Remove(keyCode);
            }
            else if (message == WmKeyDown || message == WmSysKeyDown)
            {
                if (_heldKeys.Contains(keyCode))
                {
                    return CallNextHookEx(_hookId, nCode, wParam, lParam);
                }

                _heldKeys.Add(keyCode);
                var modifiers = ReadModifiers();
                Application.Current?.Dispatcher.BeginInvoke(() => KeyPressed?.Invoke(keyCode, modifiers));
            }
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private static int ReadModifiers()
    {
        var modifiers = 0;

        if ((GetKeyState(17) & 0x8000) != 0)
        {
            modifiers |= 2;
        }

        if ((GetKeyState(18) & 0x8000) != 0)
        {
            modifiers |= 1;
        }

        if ((GetKeyState(16) & 0x8000) != 0)
        {
            modifiers |= 4;
        }

        if ((GetKeyState(91) & 0x8000) != 0 || (GetKeyState(92) & 0x8000) != 0)
        {
            modifiers |= 8;
        }

        return modifiers;
    }

    public void Dispose()
    {
        Stop();
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hmod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int nVirtKey);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
}
