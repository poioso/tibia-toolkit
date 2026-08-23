namespace ScreenVision.NativeHost.Models;

public sealed class MirrorWindowSpec
{
    public string Id { get; init; } = "";

    public string Name { get; init; } = "";

    public RectInfo CaptureBounds { get; init; } = new();

    public RectInfo MirrorBounds { get; init; } = new();

    public RectInfo RelativeBounds { get; init; } = new();

    public string SourceType { get; init; } = "tibia";

    // Kept separate from SourceType: obs-window remains a distinct capture
    // family, while normal game mirrors can target Tibia, RubinOT or Medivia.
    public string SourceGame { get; init; } = "tibia";

    public long SourceHwnd { get; init; }

    public string SourceWindowTitle { get; init; } = "";

    public string SourceProcessName { get; init; } = "";

    public int Opacity { get; init; } = 100;

    public bool IsLocked { get; init; }

    public bool IsVisible { get; init; } = true;

    public bool IsFixedCrop { get; init; }

    public bool AllowSnapping { get; init; } = true;

    public double Scale { get; init; } = 1.0;

    public bool GlowEnabled { get; init; }

    public string GlowColor { get; init; } = "#FFFFFF";

    public IReadOnlyList<string> GlowSavedColors { get; init; } = new[] { "#FFFFFF" };

    public double GlowIntensity { get; init; } = 10.0;

    public CountdownSpec Countdown { get; init; } = new();
}
