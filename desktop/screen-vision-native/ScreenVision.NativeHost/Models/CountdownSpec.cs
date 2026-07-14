namespace ScreenVision.NativeHost.Models;

public sealed class CountdownSpec
{
    public bool Enabled { get; init; }

    public int DurationSeconds { get; init; } = 60;

    public string Hotkey { get; init; } = "";

    public int HotkeyKeyCode { get; init; }

    public int HotkeyModifiers { get; init; }

    public string Side { get; init; } = "Above";

    public string Direction { get; init; } = "LeftToRight";

    public string Color { get; init; } = "gradient";

    public int BarThickness { get; init; } = 22;

    public int BarLength { get; init; } = 200;

    public int BorderWidth { get; init; } = 1;

    public int BorderRadius { get; init; } = 3;

    public string BorderColor { get; init; } = "#ffffff";

    public bool FlashEnabled { get; init; } = true;

    public bool RetriggerEnabled { get; init; }
}
