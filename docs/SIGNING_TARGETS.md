# Windows signing targets

The project release contains several executable files. The target list below keeps the signing scope clear and prevents accidental claims that every bundled file is project-owned.

| File | Owner / role | Required release action |
| --- | --- | --- |
| `Tibia Toolkit Setup <version>.exe` | Project NSIS installer | Sign and verify |
| `Tibia Toolkit.exe` | Project Electron application | Sign and verify |
| `resources/app/desktop/screen-vision-native/publish/win-x64/ScreenVision.NativeHost.exe` | Project .NET helper | Sign and verify |
| `elevate.exe` | Electron packaging dependency | Do not sign under project identity; review provenance on upgrades |

The SignPath artifact configuration must match the package structure and deep-sign the three project-owned targets above. Configure exclusions for third-party files only after reviewing the resulting artifact. Do not copy a configuration slug or signing policy from another project.
