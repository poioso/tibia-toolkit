using System.Windows;
using ScreenVision.NativeHost.Models;
using ScreenVision.NativeHost.Views;

namespace ScreenVision.NativeHost.Host;

internal sealed class NativeVisualCustomizationManager : IDisposable
{
    private readonly NativeHostEventQueue _eventQueue;
    private CharacterLocationWindow? _characterLocationWindow;
    private CursorGlowWindow? _cursorGlowWindow;
    private VisualCustomizationSpec _lastSpec = new();
    private bool _isOverlayVisible = true;

    internal NativeVisualCustomizationManager(NativeHostEventQueue eventQueue)
    {
        _eventQueue = eventQueue;
    }

    internal async Task SyncAsync(VisualCustomizationSpec spec, bool visible)
    {
        _lastSpec = spec ?? new VisualCustomizationSpec();
        _isOverlayVisible = visible;

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_lastSpec.CharLocEnabled)
            {
                ShowCharacterLocation(_lastSpec);
            }
            else
            {
                CloseCharacterLocation();
            }

            if (_lastSpec.CursorGlowEnabled)
            {
                ShowCursorGlow(_lastSpec);
            }
            else
            {
                CloseCursorGlow();
            }
        });
    }

    private void ShowCharacterLocation(VisualCustomizationSpec spec)
    {
        if (_characterLocationWindow is null)
        {
            if (!_isOverlayVisible)
            {
                return;
            }

            _characterLocationWindow = new CharacterLocationWindow(spec);
            _characterLocationWindow.PositionChanged += OnCharacterLocationPositionChanged;
            _characterLocationWindow.Closed += (_, _) => _characterLocationWindow = null;
            _characterLocationWindow.Show();
        }
        else
        {
            _characterLocationWindow.ApplySpec(spec);

            if (_isOverlayVisible && !_characterLocationWindow.IsVisible)
            {
                _characterLocationWindow.Show();
            }
            else if (!_isOverlayVisible && _characterLocationWindow.IsVisible)
            {
                _characterLocationWindow.Hide();
            }
        }
    }

    private void ShowCursorGlow(VisualCustomizationSpec spec)
    {
        if (_cursorGlowWindow is null)
        {
            if (!_isOverlayVisible)
            {
                return;
            }

            _cursorGlowWindow = new CursorGlowWindow(spec);
            _cursorGlowWindow.Closed += (_, _) => _cursorGlowWindow = null;
            _cursorGlowWindow.Show();
        }
        else
        {
            _cursorGlowWindow.ApplySpec(spec);

            if (_isOverlayVisible && !_cursorGlowWindow.IsVisible)
            {
                _cursorGlowWindow.Show();
            }
            else if (!_isOverlayVisible && _cursorGlowWindow.IsVisible)
            {
                _cursorGlowWindow.Hide();
            }
        }
    }

    private void CloseCharacterLocation()
    {
        if (_characterLocationWindow is null)
        {
            return;
        }

        try
        {
            _characterLocationWindow.PositionChanged -= OnCharacterLocationPositionChanged;
            _characterLocationWindow.Close();
        }
        catch
        {
        }

        _characterLocationWindow = null;
    }

    private void CloseCursorGlow()
    {
        if (_cursorGlowWindow is null)
        {
            return;
        }

        try
        {
            _cursorGlowWindow.Close();
        }
        catch
        {
        }

        _cursorGlowWindow = null;
    }

    private void OnCharacterLocationPositionChanged(object? sender, RectInfo bounds)
    {
        _eventQueue.Enqueue(new NativeHostEvent
        {
            Type = "visual-charloc-position-changed",
            Bounds = bounds
        });
    }

    public void Dispose()
    {
        CloseCharacterLocation();
        CloseCursorGlow();
    }
}
