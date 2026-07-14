namespace ScreenVision.NativeHost.Models;

public sealed class TibiaWindowInfo
{
    public long Hwnd { get; init; }

    public string Title { get; init; } = "";

    public string ProcessName { get; init; } = "";

    public bool IsVisible { get; init; }

    public bool IsForeground { get; init; }

    public bool IsMinimized { get; init; }

    public bool IsMaximized { get; init; }

    public RectInfo Bounds { get; init; } = new();

    public RectInfo ClientBounds { get; init; } = new();
}

public sealed class RectInfo
{
    public int X { get; init; }

    public int Y { get; init; }

    public int Width { get; init; }

    public int Height { get; init; }
}
