namespace ScreenVision.NativeHost.Host;

internal sealed class NativeHost : IDisposable
{
    private readonly NativeHostEventQueue _eventQueue = new();
    private readonly NativeAlertAudioPlayer _alertAudioPlayer;
    private readonly NativeMirrorManager _mirrorManager;
    private readonly NativeSelectionManager _selectionManager;
    private readonly NativeGridOverlayManager _gridOverlayManager;
    private readonly NativeVisualCustomizationManager _visualCustomizationManager;
    private readonly PipeServer _pipeServer;

    internal NativeHost(string[]? arguments = null)
    {
        _alertAudioPlayer = new NativeAlertAudioPlayer();
        _mirrorManager = new NativeMirrorManager(_eventQueue);
        _selectionManager = new NativeSelectionManager();
        _gridOverlayManager = new NativeGridOverlayManager();
        _visualCustomizationManager = new NativeVisualCustomizationManager(_eventQueue);
        _pipeServer = new PipeServer(
            _mirrorManager,
            _selectionManager,
            _gridOverlayManager,
            _visualCustomizationManager,
            _alertAudioPlayer,
            ResolvePipeName(arguments));
    }

    internal void Start()
    {
        _pipeServer.Start();
    }

    public void Dispose()
    {
        _mirrorManager.ClearMirrorsAsync().GetAwaiter().GetResult();
        _gridOverlayManager.Dispose();
        _visualCustomizationManager.Dispose();
        _alertAudioPlayer.Dispose();
        _mirrorManager.Dispose();
        _pipeServer.Dispose();
    }

    private static string ResolvePipeName(string[]? arguments)
    {
        if (arguments is null)
        {
            return PipeServer.DefaultPipeName;
        }

        for (var index = 0; index < arguments.Length - 1; index += 1)
        {
            if (string.Equals(arguments[index], "--pipe", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(arguments[index + 1]))
            {
                return arguments[index + 1].Trim();
            }
        }

        return PipeServer.DefaultPipeName;
    }
}
