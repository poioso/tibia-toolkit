using System.Windows;
using ScreenVision.NativeHost.Models;
using ScreenVision.NativeHost.Views;

namespace ScreenVision.NativeHost.Host;

internal sealed class NativeMirrorManager : IDisposable
{
    private readonly NativeHostEventQueue _eventQueue;
    private readonly Dictionary<string, RegionMirrorWindow> _windows = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<int, List<CountdownHotkeyBinding>> _countdownHotkeys = [];
    private readonly GlobalHotkeyListener _hotkeyListener;
    private bool _mirrorsVisible = true;
    private bool _mirrorsAlwaysOnTop = true;

    internal NativeMirrorManager(NativeHostEventQueue eventQueue)
    {
        _eventQueue = eventQueue;
        _hotkeyListener = new GlobalHotkeyListener();
        _hotkeyListener.KeyPressed += OnHotkeyPressed;
        _hotkeyListener.Start();
    }

    internal async Task SyncMirrorsAsync(IReadOnlyList<MirrorWindowSpec> mirrors)
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var tibiaInfo = Interop.WindowProbe.GetTibiaWindowInfo();
            var visibleIds = new HashSet<string>(mirrors.Select((entry) => entry.Id), StringComparer.OrdinalIgnoreCase);

            foreach (var staleId in _windows.Keys.Where((key) => !visibleIds.Contains(key)).ToList())
            {
                CloseWindow(staleId);
            }

            foreach (var mirror in mirrors)
            {
                if (!_windows.TryGetValue(mirror.Id, out var window))
                {
                    window = new RegionMirrorWindow(mirror, () => _windows.Values);
                    window.BoundsChanged += OnWindowBoundsChanged;
                    window.ActionRequested += OnWindowActionRequested;
                    window.ClosedByUser += OnWindowClosedByUser;
                    _windows[mirror.Id] = window;
                }

                window.ApplySpec(mirror, tibiaInfo);
                window.SetAlwaysOnTop(_mirrorsAlwaysOnTop);
                window.SetMirrorsVisible(_mirrorsVisible, tibiaInfo);
            }

            RestoreSnapGroups();
            RebuildHotkeyMap(mirrors);

        });
    }

    internal async Task SetMirrorsVisibleAsync(bool visible)
    {
        _mirrorsVisible = visible;

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var tibiaInfo = Interop.WindowProbe.GetTibiaWindowInfo();

            foreach (var window in _windows.Values)
            {
                window.SetMirrorsVisible(visible, tibiaInfo);
            }
        });
    }

    internal async Task SetMirrorsTopmostAsync(bool enabled)
    {
        _mirrorsAlwaysOnTop = enabled;

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            foreach (var window in _windows.Values)
            {
                window.SetAlwaysOnTop(enabled);
            }
        });
    }

    internal async Task PreviewOpacityAsync(string regionId, int opacity)
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (!_windows.TryGetValue(regionId, out var window))
            {
                return;
            }

            window.ApplyPreviewOpacity(opacity);
        });
    }

    internal async Task StartCountdownAsync(string regionId)
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_windows.TryGetValue(regionId, out var window))
            {
                window.StartCountdown();
            }
        });
    }

    internal async Task StopCountdownAsync(string regionId)
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_windows.TryGetValue(regionId, out var window))
            {
                window.StopCountdown();
            }
        });
    }

    internal async Task ClearMirrorsAsync()
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            foreach (var regionId in _windows.Keys.ToList())
            {
                CloseWindow(regionId);
            }
        });
    }

    internal async Task UnsnapMirrorAsync(string regionId)
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_windows.TryGetValue(regionId, out var window))
            {
                window.ForceUnsnap();
            }
        });
    }

    private void CloseWindow(string regionId)
    {
        if (!_windows.Remove(regionId, out var window))
        {
            return;
        }

        try
        {
            window.BoundsChanged -= OnWindowBoundsChanged;
            window.ActionRequested -= OnWindowActionRequested;
            window.ClosedByUser -= OnWindowClosedByUser;
            window.CloseProgrammatically();
        }
        catch
        {
        }
    }

    internal IReadOnlyList<NativeHostEvent> DrainEvents()
    {
        return _eventQueue.DrainAll();
    }

    public void Dispose()
    {
        _hotkeyListener.KeyPressed -= OnHotkeyPressed;
        _hotkeyListener.Dispose();
    }

    private void OnWindowBoundsChanged(object? sender, RectInfo bounds)
    {
        if (sender is not RegionMirrorWindow window)
        {
            return;
        }

        _eventQueue.Enqueue(new NativeHostEvent
        {
            Type = "mirror-bounds-changed",
            RegionId = window.RegionId,
            Bounds = bounds
        });
    }

    private void OnWindowActionRequested(object? sender, RegionMirrorActionEventArgs e)
    {
        _eventQueue.Enqueue(new NativeHostEvent
        {
            Type = $"mirror-{e.Action}",
            RegionId = e.RegionId,
            BoolValue = e.BoolValue,
            IntValue = e.IntValue,
            StringValue = e.StringValue
        });
    }

    private void OnWindowClosedByUser(object? sender, string regionId)
    {
        _windows.Remove(regionId);
        _eventQueue.Enqueue(new NativeHostEvent
        {
            Type = "mirror-closed",
            RegionId = regionId
        });
    }

    private void RebuildHotkeyMap(IReadOnlyList<MirrorWindowSpec> mirrors)
    {
        _countdownHotkeys.Clear();

        foreach (var mirror in mirrors)
        {
            if (!mirror.IsLocked || !mirror.Countdown.Enabled || string.IsNullOrWhiteSpace(mirror.Countdown.Hotkey))
            {
                if (mirror.Countdown.HotkeyKeyCode <= 0)
                {
                    continue;
                }
            }

            var parsed = ResolveHotkeyBinding(mirror.Countdown);

            if (parsed is null)
            {
                continue;
            }

            if (!_countdownHotkeys.TryGetValue(parsed.Value.modifiers, out var bindings))
            {
                bindings = [];
                _countdownHotkeys[parsed.Value.modifiers] = bindings;
            }

            bindings.Add(new CountdownHotkeyBinding
            {
                RegionId = mirror.Id,
                Hotkey = mirror.Countdown.Hotkey,
                KeyCodes = ExpandKeyCodes(parsed.Value.keyCode)
            });

            LogHotkey($"bind region={mirror.Id} keyCode={parsed.Value.keyCode} modifiers={parsed.Value.modifiers} label={mirror.Countdown.Hotkey}");
        }
    }

    private void RestoreSnapGroups()
    {
        ClearSnapGroups();
        var windows = _windows.Values.Where((window) => window.AllowSnapping).ToList();

        if (windows.Count < 2)
        {
            return;
        }

        var visited = new HashSet<RegionMirrorWindow>();

        foreach (var window in windows)
        {
            if (visited.Contains(window) || window.GetSnapGroup() is not null)
            {
                continue;
            }

            var queue = new Queue<RegionMirrorWindow>();
            var component = new List<RegionMirrorWindow>();
            queue.Enqueue(window);
            visited.Add(window);

            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                component.Add(current);

                foreach (var candidate in windows)
                {
                    if (visited.Contains(candidate) || candidate == current)
                    {
                        continue;
                    }

                    if (AreAdjacent(current, candidate))
                    {
                        visited.Add(candidate);
                        queue.Enqueue(candidate);
                    }
                }
            }

            if (component.Count < 2)
            {
                continue;
            }

            var snapGroup = new SnapGroup();

            foreach (var member in component)
            {
                member.SetSnapGroup(snapGroup);
                snapGroup.AddWindow(member);
            }

            snapGroup.UpdateBorderDisplay();
        }
    }

    private void ClearSnapGroups()
    {
        var allWindows = _windows.Values.ToList();
        var groups = allWindows
            .Select((window) => window.GetSnapGroup())
            .Where((group) => group is not null)
            .Distinct()
            .ToList();

        foreach (var window in allWindows)
        {
            if (window.GetSnapGroup() is null)
            {
                continue;
            }

            window.SetSnapGroup(null);
            window.UpdateSnapGroupBorders();
        }

        foreach (var group in groups)
        {
            group?.Dispose();
        }
    }

    private static bool AreAdjacent(RegionMirrorWindow left, RegionMirrorWindow right)
    {
        var a = left.GetMirrorBounds();
        var b = right.GetMirrorBounds();
        const double threshold = 4;
        var sameTop = Math.Abs(a.Top - b.Top) <= threshold;
        var sameLeft = Math.Abs(a.Left - b.Left) <= threshold;
        var rightTouch = Math.Abs(a.Right - b.Left) <= threshold;
        var leftTouch = Math.Abs(b.Right - a.Left) <= threshold;
        var bottomTouch = Math.Abs(a.Bottom - b.Top) <= threshold;
        var topTouch = Math.Abs(b.Bottom - a.Top) <= threshold;

        if (sameTop && (rightTouch || leftTouch))
        {
            return true;
        }

        if (sameLeft && (bottomTouch || topTouch))
        {
            return true;
        }

        return false;
    }

    private void OnHotkeyPressed(int keyCode, int modifiers)
    {
        _eventQueue.Enqueue(new NativeHostEvent
        {
            Type = "global-hotkey-pressed",
            IntValue = keyCode,
            BoolValue = modifiers != 0,
            StringValue = modifiers.ToString()
        });

        if (!_countdownHotkeys.TryGetValue(modifiers, out var bindings))
        {
            return;
        }

        foreach (var binding in bindings)
        {
            if (!binding.KeyCodes.Contains(keyCode)
                && !IsBacktickKeyMatch(keyCode, binding.KeyCodes)
                && !IsNumPlusKeyMatch(keyCode, binding.KeyCodes))
            {
                continue;
            }

            if (_windows.TryGetValue(binding.RegionId, out var window))
            {
                LogHotkey($"hit region={binding.RegionId} keyCode={keyCode} modifiers={modifiers} label={binding.Hotkey}");
                window.StartCountdown(triggeredByHotkey: true);
            }
        }
    }

    private static (int keyCode, int modifiers)? ResolveHotkeyBinding(CountdownSpec countdown)
    {
        if (countdown.HotkeyKeyCode > 0)
        {
            return (countdown.HotkeyKeyCode, countdown.HotkeyModifiers);
        }

        return ParseHotkey(countdown.Hotkey);
    }

    private static (int keyCode, int modifiers)? ParseHotkey(string hotkey)
    {
        if (string.IsNullOrWhiteSpace(hotkey))
        {
            return null;
        }

        var parts = hotkey
            .Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 0)
        {
            return null;
        }

        var modifiers = 0;

        foreach (var modifier in parts.Take(parts.Length - 1))
        {
            switch (modifier.Trim().ToUpperInvariant())
            {
                case "CTRL":
                case "CONTROL":
                    modifiers |= 2;
                    break;
                case "ALT":
                    modifiers |= 1;
                    break;
                case "SHIFT":
                    modifiers |= 4;
                    break;
                case "WIN":
                case "WINDOWS":
                    modifiers |= 8;
                    break;
            }
        }

        var keyToken = parts[^1].Trim().ToUpperInvariant();

        if (keyToken.Length == 1)
        {
            var c = keyToken[0];

            if (char.IsDigit(c) || (c >= 'A' && c <= 'Z'))
            {
                return ((int)c, modifiers);
            }
        }

        if (keyToken.StartsWith('F')
            && int.TryParse(keyToken[1..], out var functionNumber)
            && functionNumber >= 1
            && functionNumber <= 24)
        {
            return (111 + functionNumber, modifiers);
        }

        return null;
    }

    private static bool IsBacktickKeyMatch(int detectedKeyCode, IReadOnlySet<int> registeredKeyCodes)
    {
        var backtickCodes = new HashSet<int> { 192, 223, 96, 126, 41 };
        return backtickCodes.Contains(detectedKeyCode)
            && registeredKeyCodes.Any((registeredKeyCode) => backtickCodes.Contains(registeredKeyCode));
    }

    private static bool IsNumPlusKeyMatch(int detectedKeyCode, IReadOnlySet<int> registeredKeyCodes)
    {
        var plusCodes = new HashSet<int> { 107 };
        return plusCodes.Contains(detectedKeyCode)
            && registeredKeyCodes.Any((registeredKeyCode) => plusCodes.Contains(registeredKeyCode));
    }

    private static HashSet<int> ExpandKeyCodes(int keyCode)
    {
        var keyCodes = new HashSet<int> { keyCode };

        if (keyCode >= 48 && keyCode <= 57)
        {
            keyCodes.Add(keyCode + 48);
        }
        else if (keyCode >= 96 && keyCode <= 105)
        {
            keyCodes.Add(keyCode - 48);
        }

        return keyCodes;
    }

    private sealed class CountdownHotkeyBinding
    {
        internal required string RegionId { get; init; }

        internal required string Hotkey { get; init; }

        internal required HashSet<int> KeyCodes { get; init; }
    }

    private static void LogHotkey(string message)
    {
        try
        {
            Console.Error.WriteLine($"[hotkey] {message}");
        }
        catch
        {
        }
    }
}
