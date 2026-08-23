using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using ScreenVision.NativeHost.Interop;
using ScreenVision.NativeHost.Models;

namespace ScreenVision.NativeHost.Views;

internal sealed class WindowSelectorWindow : Window
{
    private readonly ListBox _windowsList;

    internal TibiaWindowInfo? SelectedWindow { get; private set; }

    internal WindowSelectorWindow()
    {
        Title = "OBS Mirror";
        Width = 520;
        Height = 380;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        Topmost = true;
        Background = new SolidColorBrush(Color.FromRgb(31, 37, 48));

        var root = new Border
        {
            BorderBrush = new SolidColorBrush(Color.FromRgb(88, 196, 112)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(18),
            Background = new SolidColorBrush(Color.FromRgb(31, 37, 48))
        };
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var title = new TextBlock
        {
            Text = "Escolha a janela do OBS",
            Foreground = Brushes.White,
            FontSize = 20,
            FontWeight = FontWeights.Bold,
            Margin = new Thickness(0, 0, 0, 6)
        };
        layout.Children.Add(title);

        var description = new TextBlock
        {
            Text = "Selecione o projetor, a prévia ou a janela do OBS que será usada no espelho.",
            Foreground = new SolidColorBrush(Color.FromRgb(190, 199, 213)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        };
        Grid.SetRow(description, 1);
        layout.Children.Add(description);

        _windowsList = new ListBox
        {
            Background = new SolidColorBrush(Color.FromRgb(39, 46, 59)),
            Foreground = Brushes.White,
            BorderBrush = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Padding = new Thickness(4)
        };
        foreach (var window in WindowProbe.GetObsWindowInfos())
        {
            _windowsList.Items.Add(new WindowChoice(window));
        }
        if (_windowsList.Items.Count > 0)
        {
            _windowsList.SelectedIndex = 0;
        }
        var listFrame = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(39, 46, 59)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(65, 77, 95)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            ClipToBounds = true,
            Child = _windowsList
        };
        Grid.SetRow(listFrame, 2);
        layout.Children.Add(listFrame);

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 14, 0, 0)
        };
        var cancel = CreateIconButton("Cancelar", "cancel-off.png", "cancel-on.png");
        cancel.Click += (_, _) => { DialogResult = false; Close(); };
        var confirm = CreateIconButton("Continuar", "check-off.png", "check-on.png");
        confirm.Click += (_, _) => ConfirmSelection();
        actions.Children.Add(cancel);
        actions.Children.Add(confirm);
        Grid.SetRow(actions, 3);
        layout.Children.Add(actions);

        root.Child = layout;
        Content = root;
        _windowsList.MouseDoubleClick += (_, _) => ConfirmSelection();
    }

    private void ConfirmSelection()
    {
        if (_windowsList.SelectedItem is WindowChoice choice)
        {
            SelectedWindow = choice.Info;
            DialogResult = true;
            Close();
        }
    }

    private static Button CreateIconButton(string tooltip, string normalAssetName, string activeAssetName)
    {
        var normalSource = LoadAsset(normalAssetName);
        var activeSource = LoadAsset(activeAssetName) ?? normalSource;
        var image = new Image
        {
            Width = 38,
            Height = 38,
            Stretch = Stretch.Uniform,
            Source = normalSource
        };
        var button = new Button
        {
            Content = image,
            Width = 42,
            Height = 42,
            Margin = new Thickness(8, 0, 0, 0),
            Background = Brushes.Transparent,
            BorderBrush = Brushes.Transparent,
            BorderThickness = new Thickness(1),
            ToolTip = tooltip,
            Padding = new Thickness(0)
        };
        button.MouseEnter += (_, _) => image.Source = activeSource;
        button.MouseLeave += (_, _) => image.Source = normalSource;
        button.PreviewMouseLeftButtonDown += (_, _) => image.Source = activeSource;
        button.PreviewMouseLeftButtonUp += (_, _) => image.Source = button.IsMouseOver ? activeSource : normalSource;
        return button;
    }

    private static ImageSource? LoadAsset(string assetName)
    {
        var filePath = System.IO.Path.Combine(AppContext.BaseDirectory, "Assets", "selector", assetName);
        if (System.IO.File.Exists(filePath))
        {
            var image = new System.Windows.Media.Imaging.BitmapImage();
            image.BeginInit();
            image.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
            image.UriSource = new Uri(filePath, UriKind.Absolute);
            image.EndInit();
            image.Freeze();
            return image;
        }

        var packImage = new System.Windows.Media.Imaging.BitmapImage();
        packImage.BeginInit();
        packImage.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
        packImage.UriSource = new Uri($"pack://application:,,,/Assets/selector/{assetName}", UriKind.Absolute);
        packImage.EndInit();
        packImage.Freeze();
        return packImage;
    }

    private sealed class WindowChoice
    {
        internal TibiaWindowInfo Info { get; }

        internal WindowChoice(TibiaWindowInfo info)
        {
            Info = info;
        }

        public override string ToString()
        {
            var process = string.IsNullOrWhiteSpace(Info.ProcessName) ? "" : $"  [{Info.ProcessName}]";
            return $"{Info.Title}{process}";
        }
    }
}
