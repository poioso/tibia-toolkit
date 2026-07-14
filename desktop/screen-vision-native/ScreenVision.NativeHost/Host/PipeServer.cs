using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Host;

internal sealed class PipeServer : IDisposable
{
    internal const string DefaultPipeName = "poioso-screen-vision";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly CancellationTokenSource _cancellation = new();
    private readonly NativeMirrorManager _mirrorManager;
    private readonly NativeSelectionManager _selectionManager;
    private readonly NativeGridOverlayManager _gridOverlayManager;
    private readonly NativeVisualCustomizationManager _visualCustomizationManager;
    private readonly NativeAlertAudioPlayer _alertAudioPlayer;
    private readonly string _pipeName;
    private Task? _listenTask;

    internal PipeServer(
        NativeMirrorManager mirrorManager,
        NativeSelectionManager selectionManager,
        NativeGridOverlayManager gridOverlayManager,
        NativeVisualCustomizationManager visualCustomizationManager,
        NativeAlertAudioPlayer alertAudioPlayer,
        string? pipeName = null)
    {
        _mirrorManager = mirrorManager;
        _selectionManager = selectionManager;
        _gridOverlayManager = gridOverlayManager;
        _visualCustomizationManager = visualCustomizationManager;
        _alertAudioPlayer = alertAudioPlayer;
        _pipeName = string.IsNullOrWhiteSpace(pipeName) ? DefaultPipeName : pipeName.Trim();
    }

    internal void Start()
    {
        _listenTask ??= Task.Run(AcceptNextClientAsync);
    }

    private async Task AcceptNextClientAsync()
    {
        using var server = CreateServer();

        try
        {
            await server.WaitForConnectionAsync(_cancellation.Token).ConfigureAwait(false);

            if (!_cancellation.IsCancellationRequested)
            {
                _ = Task.Run(AcceptNextClientAsync, CancellationToken.None);
            }

            await HandleClientAsync(server, _cancellation.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (_cancellation.IsCancellationRequested)
        {
        }
        catch (IOException)
        {
        }
        catch (Exception ex)
        {
            LogError($"listen-loop-error {ex.Message}");
        }
    }

    private NamedPipeServerStream CreateServer()
    {
        return new NamedPipeServerStream(
            _pipeName,
            PipeDirection.InOut,
            NamedPipeServerStream.MaxAllowedServerInstances,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous);
    }

    private async Task HandleClientAsync(Stream stream, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, false, 1024, true);
        using var writer = new StreamWriter(stream, new UTF8Encoding(false), 1024, true)
        {
            AutoFlush = true
        };

        while (!cancellationToken.IsCancellationRequested)
        {
            string? line;

            try
            {
                line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (IOException)
            {
                break;
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                break;
            }

            var response = await DispatchAsync(line).ConfigureAwait(false);
            await writer.WriteLineAsync(response).ConfigureAwait(false);
        }
    }

    private async Task<string> DispatchAsync(string requestJson)
    {
        try
        {
            using var document = JsonDocument.Parse(requestJson);
            var root = document.RootElement;
            var command = root.TryGetProperty("command", out var commandElement)
                ? commandElement.GetString() ?? ""
                : "";

            return command switch
            {
                "ping" => JsonSerializer.Serialize(new { ok = true, command, data = new { status = "alive" } }),
                "getTibiaWindow" => JsonSerializer.Serialize(new { ok = true, command, data = WindowProbe.GetTibiaWindowInfo() }),
                "getForegroundProcess" => JsonSerializer.Serialize(new { ok = true, command, data = new { processName = WindowProbe.GetForegroundProcessName() } }),
                "isAnyControllerFocused" => JsonSerializer.Serialize(new { ok = true, command, data = new { focused = IsAnyControllerFocused(root) } }),
                "isTibiaBehindControllers" => JsonSerializer.Serialize(new { ok = true, command, data = new { visible = IsTibiaBehindControllers(root) } }),
                "syncMirrors" => await SyncMirrorsAsync(root, command).ConfigureAwait(false),
                "previewOpacity" => await PreviewOpacityAsync(root, command).ConfigureAwait(false),
                "startCountdown" => await StartCountdownAsync(root, command).ConfigureAwait(false),
                "stopCountdown" => await StopCountdownAsync(root, command).ConfigureAwait(false),
                "unsnapMirror" => await UnsnapMirrorAsync(root, command).ConfigureAwait(false),
                "setMirrorsVisible" => await SetMirrorsVisibleAsync(root, command).ConfigureAwait(false),
                "setMirrorsTopmost" => await SetMirrorsTopmostAsync(root, command).ConfigureAwait(false),
                "setGridOverlay" => await SetGridOverlayAsync(root, command).ConfigureAwait(false),
                "syncVisualCustomization" => await SyncVisualCustomizationAsync(root, command).ConfigureAwait(false),
                "playAlertSound" => PlayAlertSound(root, command),
                "clearMirrors" => await ClearMirrorsAsync(command).ConfigureAwait(false),
                "selectRegion" => await SelectRegionAsync(root, command).ConfigureAwait(false),
                "drainEvents" => DrainEvents(command),
                _ => JsonSerializer.Serialize(new { ok = false, command, error = "unknown-command" })
            };
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { ok = false, error = "invalid-request", message = ex.Message });
        }
    }

    private static bool IsTibiaBehindControllers(JsonElement root)
    {
        if (!root.TryGetProperty("controllerHwnds", out var handlesElement) || handlesElement.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        var handles = new List<long>();

        foreach (var entry in handlesElement.EnumerateArray())
        {
            if (entry.ValueKind == JsonValueKind.Number && entry.TryGetInt64(out var numericValue))
            {
                handles.Add(numericValue);
                continue;
            }

            if (entry.ValueKind == JsonValueKind.String && long.TryParse(entry.GetString(), out var stringValue))
            {
                handles.Add(stringValue);
            }
        }

        var allowedProcessIds = new List<int>();

        if (root.TryGetProperty("allowedProcessIds", out var processesElement) && processesElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var entry in processesElement.EnumerateArray())
            {
                if (entry.ValueKind == JsonValueKind.Number && entry.TryGetInt32(out var numericPid))
                {
                    allowedProcessIds.Add(numericPid);
                    continue;
                }

                if (entry.ValueKind == JsonValueKind.String && int.TryParse(entry.GetString(), out var stringPid))
                {
                    allowedProcessIds.Add(stringPid);
                }
            }
        }

        return WindowProbe.IsTibiaDirectlyBehindControllers(handles, allowedProcessIds);
    }

    private static bool IsAnyControllerFocused(JsonElement root)
    {
        if (!root.TryGetProperty("controllerHwnds", out var handlesElement) || handlesElement.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        var handles = new List<long>();

        foreach (var entry in handlesElement.EnumerateArray())
        {
            if (entry.ValueKind == JsonValueKind.Number && entry.TryGetInt64(out var numericValue))
            {
                handles.Add(numericValue);
                continue;
            }

            if (entry.ValueKind == JsonValueKind.String && long.TryParse(entry.GetString(), out var stringValue))
            {
                handles.Add(stringValue);
            }
        }

        return WindowProbe.IsAnyControllerFocused(handles);
    }

    private async Task<string> SyncMirrorsAsync(JsonElement root, string command)
    {
        if (!root.TryGetProperty("mirrors", out var mirrorsElement) || mirrorsElement.ValueKind != JsonValueKind.Array)
        {
            return JsonSerializer.Serialize(new { ok = false, command, error = "missing-mirrors" });
        }

        var mirrors = JsonSerializer.Deserialize<List<MirrorWindowSpec>>(mirrorsElement.GetRawText(), JsonOptions)
            ?.Where((entry) => entry is not null && !string.IsNullOrWhiteSpace(entry.Id))
            .Select((entry) => entry!)
            .ToList()
            ?? [];

        await _mirrorManager.SyncMirrorsAsync(mirrors).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { count = mirrors.Count } });
    }

    private async Task<string> SetMirrorsVisibleAsync(JsonElement root, string command)
    {
        var visible = true;

        if (root.TryGetProperty("visible", out var visibleElement))
        {
            visible = visibleElement.ValueKind != JsonValueKind.False;
        }

        await _mirrorManager.SetMirrorsVisibleAsync(visible).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { visible } });
    }

    private async Task<string> SetMirrorsTopmostAsync(JsonElement root, string command)
    {
        var enabled = true;

        if (root.TryGetProperty("enabled", out var enabledElement))
        {
            enabled = enabledElement.ValueKind != JsonValueKind.False;
        }

        await _mirrorManager.SetMirrorsTopmostAsync(enabled).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { enabled } });
    }

    private async Task<string> PreviewOpacityAsync(JsonElement root, string command)
    {
        var regionId = root.TryGetProperty("regionId", out var regionIdElement)
            ? regionIdElement.GetString() ?? ""
            : "";
        var opacity = root.TryGetProperty("opacity", out var opacityElement) && opacityElement.TryGetInt32(out var parsedOpacity)
            ? parsedOpacity
            : 100;

        if (string.IsNullOrWhiteSpace(regionId))
        {
            return JsonSerializer.Serialize(new { ok = false, command, error = "missing-region-id" });
        }

        await _mirrorManager.PreviewOpacityAsync(regionId, opacity).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { regionId, opacity } });
    }

    private async Task<string> ClearMirrorsAsync(string command)
    {
        await _mirrorManager.ClearMirrorsAsync().ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command });
    }

    private string PlayAlertSound(JsonElement root, string command)
    {
        var filePath = root.TryGetProperty("filePath", out var filePathElement)
            ? filePathElement.GetString() ?? ""
            : "";
        var volume = root.TryGetProperty("volume", out var volumeElement) && volumeElement.TryGetDouble(out var parsedVolume)
            ? parsedVolume
            : 1.0;

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return JsonSerializer.Serialize(new { ok = false, command, error = "missing-file-path" });
        }

        _alertAudioPlayer.QueueSound(filePath, volume);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { queued = true } });
    }

    private async Task<string> StartCountdownAsync(JsonElement root, string command)
    {
        var regionId = root.TryGetProperty("regionId", out var regionIdElement)
            ? regionIdElement.GetString() ?? ""
            : "";

        if (string.IsNullOrWhiteSpace(regionId))
        {
            return JsonSerializer.Serialize(new { ok = false, command, error = "missing-region-id" });
        }

        await _mirrorManager.StartCountdownAsync(regionId).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { regionId } });
    }

    private async Task<string> StopCountdownAsync(JsonElement root, string command)
    {
        var regionId = root.TryGetProperty("regionId", out var regionIdElement)
            ? regionIdElement.GetString() ?? ""
            : "";

        if (string.IsNullOrWhiteSpace(regionId))
        {
            return JsonSerializer.Serialize(new { ok = false, command, error = "missing-region-id" });
        }

        await _mirrorManager.StopCountdownAsync(regionId).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { regionId } });
    }

    private async Task<string> UnsnapMirrorAsync(JsonElement root, string command)
    {
        var regionId = root.TryGetProperty("regionId", out var regionIdElement)
            ? regionIdElement.GetString() ?? ""
            : "";

        if (string.IsNullOrWhiteSpace(regionId))
        {
            return JsonSerializer.Serialize(new { ok = false, command, error = "missing-region-id" });
        }

        await _mirrorManager.UnsnapMirrorAsync(regionId).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { regionId } });
    }

    private string DrainEvents(string command)
    {
        var events = _mirrorManager.DrainEvents();
        return JsonSerializer.Serialize(new { ok = true, command, data = new { events } });
    }

    private async Task<string> SelectRegionAsync(JsonElement root, string command)
    {
        RectInfo? initialCaptureBounds = null;
        var mode = root.TryGetProperty("mode", out var modeElement)
            ? modeElement.GetString() ?? "standard"
            : "standard";
        int? fixedSize = null;

        if (root.TryGetProperty("initialCaptureBounds", out var initialBoundsElement)
            && initialBoundsElement.ValueKind == JsonValueKind.Object)
        {
            initialCaptureBounds = JsonSerializer.Deserialize<RectInfo>(initialBoundsElement.GetRawText(), JsonOptions);
        }

        if (root.TryGetProperty("fixedSize", out var fixedSizeElement)
            && fixedSizeElement.ValueKind == JsonValueKind.Number
            && fixedSizeElement.TryGetInt32(out var parsedFixedSize))
        {
            fixedSize = parsedFixedSize;
        }

        var selection = await _selectionManager.SelectRegionAsync(initialCaptureBounds, mode, fixedSize).ConfigureAwait(false);
        return JsonSerializer.Serialize(new
        {
            ok = true,
            command,
            data = new
            {
                cancelled = selection is null,
                captureBounds = selection?.CaptureBounds
            }
        });
    }

    private async Task<string> SetGridOverlayAsync(JsonElement root, string command)
    {
        var enabled = root.TryGetProperty("enabled", out var enabledElement)
            && enabledElement.ValueKind != JsonValueKind.False;
        var visible = !root.TryGetProperty("visible", out var visibleElement)
            || visibleElement.ValueKind != JsonValueKind.False;
        var gridSize = root.TryGetProperty("gridSize", out var sizeElement) && sizeElement.TryGetInt32(out var parsedSize)
            ? parsedSize
            : 32;

        await _gridOverlayManager.SetAsync(enabled, gridSize, visible).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { enabled, gridSize, visible } });
    }

    private async Task<string> SyncVisualCustomizationAsync(JsonElement root, string command)
    {
        var spec = root.TryGetProperty("visualCustomization", out var visualElement)
            && visualElement.ValueKind == JsonValueKind.Object
            ? JsonSerializer.Deserialize<VisualCustomizationSpec>(visualElement.GetRawText(), JsonOptions) ?? new VisualCustomizationSpec()
            : new VisualCustomizationSpec();
        var visible = !root.TryGetProperty("visible", out var visibleElement)
            || visibleElement.ValueKind != JsonValueKind.False;

        await _visualCustomizationManager.SyncAsync(spec, visible).ConfigureAwait(false);
        return JsonSerializer.Serialize(new { ok = true, command, data = new { visible } });
    }

    public void Dispose()
    {
        _cancellation.Cancel();

        try
        {
            _listenTask?.Wait(TimeSpan.FromSeconds(2));
        }
        catch
        {
        }

        _cancellation.Dispose();
    }

    private static void LogError(string message)
    {
        try
        {
            Console.Error.WriteLine($"[pipe-server] {message}");
        }
        catch
        {
        }
    }
}
