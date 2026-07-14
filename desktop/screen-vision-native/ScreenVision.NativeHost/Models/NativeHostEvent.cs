namespace ScreenVision.NativeHost.Models;

public sealed class NativeHostEvent
{
    public string Type { get; init; } = "";

    public string RegionId { get; init; } = "";

    public RectInfo? Bounds { get; init; }

    public bool? BoolValue { get; init; }

    public int? IntValue { get; init; }

    public string? StringValue { get; init; }
}
