using System.Collections.Concurrent;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Host;

internal sealed class NativeHostEventQueue
{
    private readonly ConcurrentQueue<NativeHostEvent> _queue = new();

    internal void Enqueue(NativeHostEvent hostEvent)
    {
        if (hostEvent is null || string.IsNullOrWhiteSpace(hostEvent.Type))
        {
            return;
        }

        _queue.Enqueue(hostEvent);
    }

    internal IReadOnlyList<NativeHostEvent> DrainAll()
    {
        var items = new List<NativeHostEvent>();

        while (_queue.TryDequeue(out var item))
        {
            items.Add(item);
        }

        return items;
    }
}
