# Tibia Toolkit

Tibia Toolkit is an unofficial Windows desktop companion for the Tibia community. It provides item and market lookups, NPC and creature information, overlay tools, Screen Vision utilities, optional OBS integration, and locally managed helper tools.

> Tibia and related trademarks are the property of CipSoft GmbH. Tibia Toolkit is an unofficial community project and is not affiliated with or endorsed by CipSoft GmbH.
>
> Tibia e suas marcas relacionadas pertencem à CipSoft GmbH. O Tibia Toolkit é um projeto comunitário não oficial e não é afiliado nem endossado pela CipSoft GmbH.

The project is governed by the public [Tibia fansite agreement](https://www.tibia.com/community/?subtopic=fansites&page=agreement): it must remain an unofficial, lawful community tool and must not provide cheats or hacks.

## Features

- Desktop overlay built with Electron.
- Item, creature, NPC, boss, world, guild, and market information.
- Optional Screen Vision overlays, mirrors, timers, and user-configured global hotkeys.
- Optional user-configured OBS WebSocket integration.
- Content packs downloaded separately after installation; source code and the installer do not include the large content library.

## Windows support

The release target is Windows x64. The project currently builds an NSIS installer and a self-contained .NET native helper.

## Installation and removal

Download releases only from the official site or the official GitHub releases page once it is published. Run the installer and follow the Windows prompts. The installer creates an uninstaller; use **Installed apps** in Windows or the Tibia Toolkit uninstall entry to remove the program.

The first run can download a content pack. The pack is stored under the app's user-data directory and can be removed manually after uninstall if the user also wants to reclaim its cached data.

## Building from source

Requirements:

- Node.js 22.18.0 (`.nvmrc`)
- .NET SDK 10.0.301 (`global.json`)
- Windows x64

```powershell
npm ci
npm test
npm run build:installer
```

See [docs/BUILDING.md](docs/BUILDING.md) for the full reproducible-build instructions. The local `desktop/app-config.json` currently represents public runtime endpoints; copy and adapt [desktop/app-config.example.json](desktop/app-config.example.json) for another deployment.

## Content packs

Large images, audio, JSON data, and other non-executable content are intentionally kept outside Git. The app downloads content only through HTTPS, checks its declared size and SHA-256, rejects executable extensions, protects extraction paths, and retains the prior verified pack if a swap fails. See [docs/REMOTE_ASSETS.md](docs/REMOTE_ASSETS.md).

The source-code license does **not** apply to external content or third-party assets. See [REMOTE_ASSET_AUDIT.md](REMOTE_ASSET_AUDIT.md) and [CREDITS.md](CREDITS.md) before redistributing any content pack.

## Verifying a release

After a signed release exists, verify its hash:

```powershell
Get-FileHash .\Tibia-Toolkit-Setup-<version>.exe -Algorithm SHA256
```

Verify its Authenticode signature:

```powershell
Get-AuthenticodeSignature .\Tibia-Toolkit-Setup-<version>.exe
```

Do not treat an unsigned artifact as an official signed release.

## Project documents

- [License](LICENSE) — GPL-3.0-only for the project source code.
- [Privacy policy](docs/PRIVACY.md)
- [Security policy](SECURITY.md)
- [Trademark policy](TRADEMARKS.md)
- [Credits and CipSoft acknowledgement](CREDITS.md)
- [CipSoft asset compliance register](docs/CIPSOFT_ASSET_COMPLIANCE.md)
- [Code signing policy](docs/CODE_SIGNING_POLICY.md)
- [Release process](docs/RELEASE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Code signing policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

The project is being prepared for application to the SignPath Foundation open-source code signing program. Signed releases will only be identified as such after approval and successful signature verification.

- Committer and reviewer: Luan Montenegro — `@poioso`.
- Release approver: Luan Montenegro — `@poioso`.

Official repository: <https://github.com/poioso/tibia-toolkit>. Release artifact links will be added only after the first verified release exists.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.
