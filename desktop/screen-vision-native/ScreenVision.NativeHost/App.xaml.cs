using System.Windows;

namespace ScreenVision.NativeHost;

public partial class App : Application
{
    private Host.NativeHost? _host;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;
        _host = new Host.NativeHost(e.Args);
        _host.Start();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _host?.Dispose();
        _host = null;
        base.OnExit(e);
    }
}
