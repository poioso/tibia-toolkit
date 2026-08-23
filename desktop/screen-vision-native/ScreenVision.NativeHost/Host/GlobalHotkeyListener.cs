using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Threading;

namespace ScreenVision.NativeHost.Host;

internal sealed class GlobalHotkeyListener : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmSysKeyDown = 0x0104;
    private const int WmKeyUp = 0x0101;
    private const int WmSysKeyUp = 0x0105;

    private readonly LowLevelKeyboardProc _hookCallback;
    // One state set is shared by the hook and its polling fallback.  A key is
    // emitted once until released, regardless of which input path observed it.
    // Unlike the old handler, this set is never polluted by unrelated keys.
    private readonly HashSet<int> _activeConfiguredKeys = [];
    private readonly HashSet<(int KeyCode, int Modifiers)> _polledBindings = [];
    private readonly RawInputHotkeyListener _rawInputListener;
    private readonly object _inputStateLock = new();
    private readonly DispatcherTimer _pollTimer;
    private IntPtr _hookId;

    internal event Action<int, int>? KeyPressed;

    internal GlobalHotkeyListener()
    {
        _hookCallback = HookCallback;
        _rawInputListener = new RawInputHotkeyListener();
        _rawInputListener.KeyStateChanged += OnRawInputKeyStateChanged;
        _pollTimer = new DispatcherTimer(DispatcherPriority.Input)
        {
            // RubinOT can use direct keyboard input. Keep this light fallback
            // responsive for the few configured bindings without polling every
            // key or changing what the game itself receives.
            Interval = TimeSpan.FromMilliseconds(8)
        };
        _pollTimer.Tick += PollConfiguredHotkeys;
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
        Console.Error.WriteLine(
            _hookId == IntPtr.Zero
                ? $"global-hotkey-hook failed error={Marshal.GetLastWin32Error()}"
                : "global-hotkey-hook started");
        _rawInputListener.Start();
    }

    internal void SetPolledBindings(IEnumerable<(int KeyCode, int Modifiers)> bindings)
    {
        _polledBindings.Clear();
        foreach (var binding in bindings)
        {
            if (binding.KeyCode > 0)
            {
                _polledBindings.Add((binding.KeyCode, binding.Modifiers & 15));
            }
        }

        lock (_inputStateLock)
        {
            _activeConfiguredKeys.Clear();
        }
        if (_polledBindings.Count > 0)
        {
            _pollTimer.Start();
        }
        else
        {
            _pollTimer.Stop();
        }
        Console.Error.WriteLine($"global-hotkey-poll bindings={_polledBindings.Count}");
    }

    internal void Stop()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }

        _pollTimer.Stop();
        _polledBindings.Clear();
        lock (_inputStateLock)
        {
            _activeConfiguredKeys.Clear();
        }
        _rawInputListener.KeyStateChanged -= OnRawInputKeyStateChanged;
        _rawInputListener.Dispose();
    }

    private void PollConfiguredHotkeys(object? sender, EventArgs eventArgs)
    {
        _ = sender;
        _ = eventArgs;
        var modifiers = ReadModifiers();

        foreach (var binding in _polledBindings)
        {
            var isDown = (GetAsyncKeyState(binding.KeyCode) & 0x8000) != 0;
            if (!isDown)
            {
                ReleaseObservedKey(binding.KeyCode);
                continue;
            }

            if (binding.Modifiers != modifiers)
            {
                continue;
            }

            TryEmitObservedKey(binding.KeyCode, binding.Modifiers, "poll");
        }
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var keyCode = Marshal.ReadInt32(lParam);
            var message = unchecked((int)wParam.ToInt64());

            if (message == WmKeyUp || message == WmSysKeyUp)
            {
                ReleaseObservedKey(keyCode);
            }
            else if (message == WmKeyDown || message == WmSysKeyDown)
            {
                var modifiers = ReadModifiers();
                if (!IsConfiguredBinding(keyCode, modifiers))
                {
                    return CallNextHookEx(_hookId, nCode, wParam, lParam);
                }

                TryEmitObservedKey(keyCode, modifiers, "hook");
            }
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private bool IsConfiguredBinding(int keyCode, int modifiers)
    {
        return _polledBindings.Contains((keyCode, modifiers & 15));
    }

    private void OnRawInputKeyStateChanged(int keyCode, bool isPressed)
    {
        if (!isPressed)
        {
            ReleaseObservedKey(keyCode);
            return;
        }

        var modifiers = ReadModifiers();
        if (IsConfiguredBinding(keyCode, modifiers))
        {
            TryEmitObservedKey(keyCode, modifiers, "raw-input");
        }
    }

    private void ReleaseObservedKey(int keyCode)
    {
        lock (_inputStateLock)
        {
            _activeConfiguredKeys.Remove(keyCode);
        }
    }

    private void TryEmitObservedKey(int keyCode, int modifiers, string source)
    {
        lock (_inputStateLock)
        {
            if (!_activeConfiguredKeys.Add(keyCode))
            {
                return;
            }
        }

        Application.Current?.Dispatcher.BeginInvoke(() =>
        {
            Console.Error.WriteLine($"global-hotkey-fired source={source} keyCode={keyCode} modifiers={modifiers}");
            KeyPressed?.Invoke(keyCode, modifiers);
        });
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

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
}
