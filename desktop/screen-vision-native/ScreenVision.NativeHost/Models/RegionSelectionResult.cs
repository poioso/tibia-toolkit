namespace ScreenVision.NativeHost.Models;

public sealed class RegionSelectionResult
{
    public RectInfo CaptureBounds { get; init; } = new();

    public string SourceType { get; init; } = "tibia";

    public string SourceGame { get; init; } = "tibia";

    public long SourceHwnd { get; init; }

    public string SourceWindowTitle { get; init; } = "";

    public string SourceProcessName { get; init; } = "";

    public RectInfo SourceBounds { get; init; } = new();
}
