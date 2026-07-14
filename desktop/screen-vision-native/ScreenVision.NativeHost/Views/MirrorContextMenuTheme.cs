using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;

namespace ScreenVision.NativeHost.Views;

internal static class MirrorContextMenuTheme
{
    private static readonly Lazy<ResourceDictionary> Resources = new(CreateResources);

    internal static void Apply(ContextMenu menu)
    {
        var resources = Resources.Value;

        if (resources["ModernContextMenu"] is Style contextMenuStyle)
        {
            menu.Style = contextMenuStyle;
        }
    }

    internal static void Apply(MenuItem item)
    {
        var resources = Resources.Value;

        if (resources["ModernMenuItem"] is Style menuItemStyle)
        {
            item.Style = menuItemStyle;
        }
    }

    internal static Separator CreateSeparator()
    {
        var separator = new Separator
        {
            Background = System.Windows.Media.Brushes.Transparent,
            Margin = new Thickness(4, 2, 4, 2)
        };

        separator.Template = (ControlTemplate)XamlReader.Parse("""
<ControlTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                 xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
                 TargetType="{x:Type Separator}">
  <Border Height="1"
          Margin="0,2,0,2"
          Background="#454545"
          SnapsToDevicePixels="True" />
</ControlTemplate>
""");

        return separator;
    }

    private static ResourceDictionary CreateResources()
    {
        const string xaml = """
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <DropShadowEffect x:Key="MirrorMenuShadow" ShadowDepth="3" Direction="315" Color="Black" Opacity="0.6" BlurRadius="8" />
  <Style x:Key="ModernContextMenu" TargetType="{x:Type ContextMenu}">
    <Setter Property="Background" Value="#232A35" />
    <Setter Property="BorderBrush" Value="#3A4352" />
    <Setter Property="BorderThickness" Value="1" />
    <Setter Property="FontFamily" Value="Nunito" />
    <Setter Property="FontSize" Value="12" />
    <Setter Property="Padding" Value="4" />
    <Setter Property="Effect" Value="{StaticResource MirrorMenuShadow}" />
    <Setter Property="Template">
      <Setter.Value>
        <ControlTemplate TargetType="{x:Type ContextMenu}">
          <Border Background="{TemplateBinding Background}"
                  BorderBrush="{TemplateBinding BorderBrush}"
                  BorderThickness="{TemplateBinding BorderThickness}"
                  CornerRadius="0"
                  Effect="{TemplateBinding Effect}">
            <ScrollViewer VerticalScrollBarVisibility="Hidden"
                          HorizontalScrollBarVisibility="Hidden"
                          CanContentScroll="False">
              <ItemsPresenter Margin="{TemplateBinding Padding}" KeyboardNavigation.DirectionalNavigation="Cycle" />
            </ScrollViewer>
          </Border>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
  </Style>
  <Style x:Key="ModernMenuItem" TargetType="{x:Type MenuItem}">
    <Setter Property="Foreground" Value="#FFFFFFFF" />
    <Setter Property="Background" Value="#00FFFFFF" />
    <Setter Property="FontFamily" Value="Nunito" />
    <Setter Property="FontSize" Value="12" />
    <Setter Property="Padding" Value="8,6" />
    <Setter Property="Margin" Value="0" />
    <Setter Property="Template">
      <Setter.Value>
        <ControlTemplate TargetType="{x:Type MenuItem}">
          <Border Name="Border" Background="{TemplateBinding Background}" BorderThickness="0" CornerRadius="0" Margin="{TemplateBinding Margin}">
            <Grid>
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="24" />
                <ColumnDefinition Width="*" />
                <ColumnDefinition Width="Auto" />
              </Grid.ColumnDefinitions>
              <ContentPresenter Grid.Column="0" Content="{TemplateBinding Icon}" Margin="4,0" VerticalAlignment="Center" HorizontalAlignment="Center" />
              <ContentPresenter Grid.Column="1" Content="{TemplateBinding Header}" Margin="{TemplateBinding Padding}" VerticalAlignment="Center" />
              <Path Name="CheckMark" Grid.Column="2" Width="12" Height="12" Margin="0,0,8,0" VerticalAlignment="Center" Fill="#58C470" Data="M0,5 L3,8 L8,3 L7,2 L3,6 L1,4" Visibility="Collapsed" />
              <Path Name="Arrow" Grid.Column="2" Width="8" Height="8" Margin="0,0,8,0" VerticalAlignment="Center" Fill="#FFFFFFFF" Data="M0,0 L4,4 L0,8" Visibility="Collapsed" />
              <Popup Name="SubMenuPopup"
                     AllowsTransparency="True"
                     Focusable="False"
                     Placement="Right"
                     PopupAnimation="Fade"
                     IsOpen="{Binding Path=IsSubmenuOpen, RelativeSource={RelativeSource TemplatedParent}}">
                <Border Background="#232A35" BorderBrush="#3A4352" BorderThickness="1" CornerRadius="0" Effect="{StaticResource MirrorMenuShadow}">
                  <ScrollViewer VerticalScrollBarVisibility="Hidden"
                                HorizontalScrollBarVisibility="Hidden"
                                CanContentScroll="False">
                    <ItemsPresenter Margin="4" />
                  </ScrollViewer>
                </Border>
              </Popup>
            </Grid>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property="IsHighlighted" Value="True">
              <Setter TargetName="Border" Property="Background" Value="#1E5A31" />
            </Trigger>
            <Trigger Property="IsChecked" Value="True">
              <Setter TargetName="CheckMark" Property="Visibility" Value="Visible" />
            </Trigger>
            <Trigger Property="HasItems" Value="True">
              <Setter TargetName="Arrow" Property="Visibility" Value="Visible" />
            </Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate>
      </Setter.Value>
    </Setter>
  </Style>
</ResourceDictionary>
""";

        return (ResourceDictionary)XamlReader.Parse(xaml);
    }
}
