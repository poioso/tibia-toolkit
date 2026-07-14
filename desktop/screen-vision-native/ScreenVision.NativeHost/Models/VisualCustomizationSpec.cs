namespace ScreenVision.NativeHost.Models;

public sealed class VisualCustomizationSpec
{
    public double? WindowLeft { get; init; }

    public double? WindowTop { get; init; }

    public bool CharLocEnabled { get; init; }

    public double CharLocX { get; init; }

    public double CharLocY { get; init; }

    public double CharLocSize { get; init; } = 40;

    public string CharLocShape { get; init; } = "Circle";

    public string CharLocColor { get; init; } = "#58C470";

    public double CharLocIntensity { get; init; } = 10;

    public bool CharLocPulse { get; init; }

    public bool CharLocLocked { get; init; }

    public bool CursorGlowEnabled { get; init; }

    public double CursorGlowSize { get; init; } = 40;

    public string CursorGlowColor { get; init; } = "#58C470";
}
