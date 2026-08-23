using System.Runtime.InteropServices;
using System.Windows.Interop;
using System.Windows.Threading;

namespace ScreenVision.NativeHost.Host;

// Raw Input is delivered directly to this process' message window.  It does
// not install a hook in the game and never consumes the original keystroke.
// Keeping it on its own dispatcher prevents overlay rendering from delaying
// or silently removing the keyboard listener.
internal sealed class RawInputHotkeyListener : IDisposable
{
    private const int WmInput = 0x00FF;
    private const uint RidInput = 0x10000003;
    private const uint RimTypeKeyboard = 1;
    private const uint RidevInputSink = 0x00000100;
    private const ushort HidUsagePageGeneric = 0x01;
    private const ushort HidUsageKeyboard = 0x06;
    private const ushort RiKeyBreak = 0x0001;
    private static readonly IntPtr HwndMessage = new(-3);

    private readonly object _sync = new();
    private Thread? _thread;
    private HwndSource? _source;
    private Dispatcher? _dispatcher;
    private readonly ManualResetEventSlim _ready = new(false);
    private bool _disposed;

    internal event Action<int, bool>? KeyStateChanged;

    internal void Start()
    {
        lock (_sync)
        {
            if (_thread is not null || _disposed)
            {
                return;
            }

            _thread = new Thread(RunMessageLoop)
            {
                IsBackground = true,
                Name = "ScreenVision.RawInput"
            };
            _thread.SetApartmentState(ApartmentState.STA);
            _thread.Start();
        }

        if (!_ready.Wait(TimeSpan.FromSeconds(2)))
        {
            Console.Error.WriteLine("global-hotkey-raw-input failed error=start-timeout");
        }
    }

    private void RunMessageLoop()
    {
        try
        {
            var parameters = new HwndSourceParameters("ScreenVisionRawInput")
            {
                ParentWindow = HwndMessage,
                Width = 0,
                Height = 0,
                WindowStyle = 0
            };
            _source = new HwndSource(parameters);
            _source.AddHook(WindowProc);
            _dispatcher = Dispatcher.CurrentDispatcher;

            var device = new RawInputDevice
            {
                UsagePage = HidUsagePageGeneric,
                Usage = HidUsageKeyboard,
                Flags = RidevInputSink,
                Target = _source.Handle
            };
            var registered = RegisterRawInputDevices(
                [device],
                1,
                (uint)Marshal.SizeOf<RawInputDevice>());
            Console.Error.WriteLine(registered
                ? "global-hotkey-raw-input started"
                : $"global-hotkey-raw-input failed error={Marshal.GetLastWin32Error()}");
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"global-hotkey-raw-input failed error={error.Message}");
        }
        finally
        {
            _ready.Set();
        }

        Dispatcher.Run();

        _source?.RemoveHook(WindowProc);
        _source?.Dispose();
        _source = null;
        _dispatcher = null;
    }

    private IntPtr WindowProc(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        _ = hwnd;
        _ = wParam;
        if (message == WmInput)
        {
            ProcessRawInput(lParam);
        }

        handled = false;
        return IntPtr.Zero;
    }

    private void ProcessRawInput(IntPtr rawInputHandle)
    {
        uint size = 0;
        var headerSize = (uint)Marshal.SizeOf<RawInputHeader>();
        if (GetRawInputData(rawInputHandle, RidInput, IntPtr.Zero, ref size, headerSize) == uint.MaxValue || size == 0)
        {
            return;
        }

        var buffer = Marshal.AllocHGlobal((int)size);
        try
        {
            if (GetRawInputData(rawInputHandle, RidInput, buffer, ref size, headerSize) == uint.MaxValue)
            {
                return;
            }

            var rawInput = Marshal.PtrToStructure<RawInput>(buffer);
            if (rawInput.Header.Type != RimTypeKeyboard || rawInput.Keyboard.VirtualKey == 0)
            {
                return;
            }

            var isReleased = (rawInput.Keyboard.Flags & RiKeyBreak) != 0;
            KeyStateChanged?.Invoke(rawInput.Keyboard.VirtualKey, !isReleased);
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"global-hotkey-raw-input-read-failed error={error.Message}");
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    public void Dispose()
    {
        Dispatcher? dispatcher;
        Thread? thread;
        lock (_sync)
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            dispatcher = _dispatcher;
            thread = _thread;
        }

        if (dispatcher is not null && !dispatcher.HasShutdownStarted)
        {
            dispatcher.BeginInvokeShutdown(DispatcherPriority.Send);
        }

        if (thread is not null && thread != Thread.CurrentThread)
        {
            thread.Join(TimeSpan.FromSeconds(1));
        }

        _ready.Dispose();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RawInputDevice
    {
        internal ushort UsagePage;
        internal ushort Usage;
        internal uint Flags;
        internal IntPtr Target;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RawInputHeader
    {
        internal uint Type;
        internal uint Size;
        internal IntPtr Device;
        internal IntPtr WParam;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RawKeyboard
    {
        internal ushort MakeCode;
        internal ushort Flags;
        internal ushort Reserved;
        internal ushort VirtualKey;
        internal uint Message;
        internal uint ExtraInformation;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RawInput
    {
        internal RawInputHeader Header;
        internal RawKeyboard Keyboard;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterRawInputDevices(
        [In] RawInputDevice[] devices,
        uint numberOfDevices,
        uint sizeOfRawInputDevice);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetRawInputData(
        IntPtr rawInput,
        uint command,
        IntPtr data,
        ref uint size,
        uint headerSize);
}
