using System.Collections.Concurrent;
using System.IO;
using System.Media;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using NAudio.Vorbis;
using NAudio.Wave;

namespace ScreenVision.NativeHost.Host;

internal sealed class NativeAlertAudioPlayer : IDisposable
{
    private readonly Dictionary<string, SoundPlayer> _soundPlayers = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentQueue<(string path, double? volume)> _soundQueue = new();
    private readonly object _playbackLock = new();
    private readonly DispatcherTimer _queueTimer;
    private bool _isPlaying;
    private bool _disposed;
    private MediaPlayer? _currentPlayer;
    private DispatcherTimer? _fallbackTimer;

    internal NativeAlertAudioPlayer()
    {
        _queueTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(100)
        };
        _queueTimer.Tick += ProcessSoundQueue;
        _queueTimer.Start();
    }

    internal void QueueSound(string soundPath, double? volume = null)
    {
        if (string.IsNullOrWhiteSpace(soundPath) || _disposed)
        {
            return;
        }

        _soundQueue.Enqueue((soundPath, volume));
        Log($"queue {soundPath} vol={NormalizeVolume(volume):0.000}");
    }

    private void ProcessSoundQueue(object? sender, EventArgs e)
    {
        if (_disposed)
        {
            return;
        }

        lock (_playbackLock)
        {
            if (_isPlaying || !_soundQueue.TryDequeue(out var request))
            {
                return;
            }

            PlaySoundInternal(request.path, request.volume);
        }
    }

    private void PlaySoundInternal(string soundPath, double? perSoundVolume)
    {
        if (string.IsNullOrWhiteSpace(soundPath) || _disposed)
        {
            return;
        }

        try
        {
            CleanupCurrentPlayer();
            _isPlaying = true;

            var actualSoundPath = Path.GetFullPath(soundPath);
            if (!File.Exists(actualSoundPath))
            {
                Log($"missing-file {actualSoundPath}");
                OnSoundCompleted();
                return;
            }

            var extension = Path.GetExtension(actualSoundPath).ToLowerInvariant();
            var volume = NormalizeVolume(perSoundVolume);
            Log($"play-start {actualSoundPath} ext={extension} vol={volume:0.000}");

            if (extension == ".wav")
            {
                if (!_soundPlayers.TryGetValue(actualSoundPath, out var player))
                {
                    player = new SoundPlayer(actualSoundPath);
                    _soundPlayers[actualSoundPath] = player;
                }

                player.Play();
                StartFallbackTimer();
                return;
            }

            if (extension == ".ogg")
            {
                if (TryPlayOggWithNAudio(actualSoundPath, volume))
                {
                    return;
                }
            }

            if (TryPlayWithMediaPlayer(actualSoundPath, volume))
            {
                return;
            }

            Log($"play-failed {actualSoundPath}");
            OnSoundCompleted();
        }
        catch (Exception ex)
        {
            Log($"play-exception {ex.Message}");
            OnSoundCompleted();
        }
    }

    private bool TryPlayOggWithNAudio(string path, double volume)
    {
        WaveOutEvent? output = null;
        VorbisWaveReader? reader = null;

        try
        {
            reader = new VorbisWaveReader(path);
            output = new WaveOutEvent();
            output.Init(reader);
            output.Volume = (float)volume;
            output.PlaybackStopped += (_, _) =>
            {
                try
                {
                    output.Dispose();
                    reader.Dispose();
                }
                catch
                {
                }

                Log($"play-ended {path}");
                OnSoundCompleted();
            };
            output.Play();
            Log($"play-ogg-naudio {path}");
            return true;
        }
        catch (Exception ex)
        {
            try
            {
                output?.Dispose();
            }
            catch
            {
            }

            try
            {
                reader?.Dispose();
            }
            catch
            {
            }

            Log($"play-ogg-naudio-failed {path} message={ex.Message}");
            return false;
        }
    }

    private bool TryPlayWithMediaPlayer(string path, double volume)
    {
        try
        {
            var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

            void CreateAndOpen()
            {
                try
                {
                    CleanupCurrentPlayer();
                    _currentPlayer = new MediaPlayer();
                    StartFallbackTimer();

                    void Opened(object? s, EventArgs e)
                    {
                        try
                        {
                            StopFallbackTimer();
                            if (_currentPlayer is null)
                            {
                                OnSoundCompleted();
                                return;
                            }

                            _currentPlayer.MediaOpened -= Opened;
                            _currentPlayer.MediaFailed -= Failed;
                            _currentPlayer.Volume = volume;
                            _currentPlayer.Position = TimeSpan.Zero;
                            _currentPlayer.MediaEnded += OnMediaEnded;
                            _currentPlayer.MediaFailed += OnMediaFailed;
                            _currentPlayer.Play();
                            Log($"play-mediaplayer {path}");
                        }
                        catch (Exception ex)
                        {
                            Log($"play-mediaplayer-opened-failed {path} message={ex.Message}");
                            OnSoundCompleted();
                        }
                    }

                    void Failed(object? s, ExceptionEventArgs e)
                    {
                        StopFallbackTimer();
                        if (_currentPlayer is not null)
                        {
                            _currentPlayer.MediaOpened -= Opened;
                            _currentPlayer.MediaFailed -= Failed;
                        }
                        Log($"play-mediaplayer-failed {path} message={e.ErrorException?.Message ?? "unknown"}");
                        OnSoundCompleted();
                    }

                    _currentPlayer.MediaOpened += Opened;
                    _currentPlayer.MediaFailed += Failed;
                    _currentPlayer.Open(new Uri(path, UriKind.Absolute));
                }
                catch (Exception ex)
                {
                    Log($"play-mediaplayer-create-failed {path} message={ex.Message}");
                    OnSoundCompleted();
                }
            }

            if (!dispatcher.CheckAccess())
            {
                dispatcher.BeginInvoke((Action)CreateAndOpen);
            }
            else
            {
                CreateAndOpen();
            }

            return true;
        }
        catch (Exception ex)
        {
            Log($"play-mediaplayer-dispatch-failed {path} message={ex.Message}");
            return false;
        }
    }

    private void OnMediaEnded(object? sender, EventArgs e)
    {
        Log("play-media-ended");
        OnSoundCompleted();
    }

    private void OnMediaFailed(object? sender, ExceptionEventArgs e)
    {
        Log($"play-media-failed {e.ErrorException?.Message ?? "unknown"}");
        OnSoundCompleted();
    }

    private void StartFallbackTimer()
    {
        StopFallbackTimer();
        _fallbackTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(4)
        };
        _fallbackTimer.Tick += OnFallbackTimerTick;
        _fallbackTimer.Start();
    }

    private void StopFallbackTimer()
    {
        if (_fallbackTimer is null)
        {
            return;
        }

        _fallbackTimer.Stop();
        _fallbackTimer.Tick -= OnFallbackTimerTick;
        _fallbackTimer = null;
    }

    private void OnFallbackTimerTick(object? sender, EventArgs e)
    {
        Log("play-fallback-timeout");
        StopFallbackTimer();
        OnSoundCompleted();
    }

    private void OnSoundCompleted()
    {
        lock (_playbackLock)
        {
            _isPlaying = false;
            CleanupCurrentPlayer();
        }
    }

    private void CleanupCurrentPlayer()
    {
        if (_currentPlayer is not null)
        {
            try
            {
                _currentPlayer.MediaEnded -= OnMediaEnded;
                _currentPlayer.MediaFailed -= OnMediaFailed;
                _currentPlayer.Close();
            }
            catch
            {
            }

            _currentPlayer = null;
        }

        StopFallbackTimer();
    }

    private static double NormalizeVolume(double? value)
    {
        var volume = value ?? 1.0;
        if (volume > 1.0)
        {
            volume /= 100.0;
        }

        return Math.Clamp(volume, 0.0, 1.0);
    }

    private static void Log(string message)
    {
        try
        {
            Console.Error.WriteLine($"alert-audio {message}");
        }
        catch
        {
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _queueTimer.Stop();

        while (_soundQueue.TryDequeue(out _))
        {
        }

        CleanupCurrentPlayer();

        foreach (var player in _soundPlayers.Values)
        {
            try
            {
                player.Dispose();
            }
            catch
            {
            }
        }

        _soundPlayers.Clear();
        _isPlaying = false;
    }
}
