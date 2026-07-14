namespace ScreenVision.NativeHost.Models;

internal sealed class RegionMirrorActionEventArgs : EventArgs
{
    internal string RegionId { get; init; } = "";

    internal string Action { get; init; } = "";

    internal bool? BoolValue { get; init; }

    internal int? IntValue { get; init; }

    internal string? StringValue { get; init; }
}
