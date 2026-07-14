# Open-source release audit

**Classification: ready with manual blockers — do not publish yet.**

## Identified stack

- Electron desktop app, Node.js, `electron-builder`, NSIS, and `electron-updater`.
- Self-contained .NET 10 WPF native helper named `ScreenVision.NativeHost.exe`.
- External content pack downloader using a JSON manifest and ZIP archive.

## Changes in this preparation tree

- Created a separate clean Git repository without the private repository history, generated assets, VPS tooling, Discord tooling, operational states, or prototypes.
- Retained only the public desktop source, the game-data hub source required by the client, build metadata, and the minimal bootstrap resources.
- Removed content-pack generation from the installer build; assets remain external at runtime.
- Replaced the ignored local .NET SDK dependency with `dotnet`/`DOTNET_HOST_PATH` and pinned SDK 10.0.301 in `global.json`.
- Added GPL-3.0-only, source checks, documentation, CI/release preparation, release verification, checksums, and an SPDX SBOM generator.
- Hardened remote content-pack download validation: HTTPS only, required size, hash, extension allow-list, extraction limits, and rollback-aware swap.
- Updated Electron from 31.7.7 to 43.1.1 and electron-builder from 24.13.3 to 26.15.3. The preparation build and full `npm audit` complete with zero reported vulnerabilities.
- Kept the published .NET native helper in the installer while excluding its C# source and intermediate output from the packaged application.
- Made local source runs use a normal installed .NET SDK or `DOTNET_HOST_PATH`, rather than a private `third_party` SDK path.
- Added a post-signing manifest sync so `latest.yml` matches the signed installer hash and size.
- Removed a deployment-specific reverse-tunnel example and production-host references from the public game-data-hub deployment examples; the remaining template uses a dedicated service account and an untracked, permission-restricted environment file for optional secrets.

## Sensitive functionality reviewed

The client uses a user-initiated screen/window capture flow, a low-level keyboard hook for configured hotkeys, optional OBS WebSocket integration, and a user-provided TOTP authenticator. Targeted searches did not find process memory access, DLL injection, remote-thread creation, or input injection APIs. The privacy policy must remain accurate when features change.

The project also records the Tibia fansite agreement as a release constraint: it must be presented as an unofficial community tool and must not contain cheats, hacks, or unlawful functionality. See [CREDITS.md](CREDITS.md) for the official agreement link and the visible acknowledgement.

## Secrets and history

The original private repository contains operational and credential-adjacent tooling, so it must not be made public. A local targeted scan and `npm audit` passed in this preparation tree. This is not a substitute for the Gitleaks GitHub Action over the public repository; that action must pass before the first public release. The new public repository starts with no inherited history.

## Manual blockers

1. Complete the CipSoft asset compliance register for every external content pack, especially Tibia/CipSoft-derived material. The official Fankit and its policy reference are documented, but client-extracted files still need a source match before distribution.
2. Move public API endpoints from raw HTTP/IP addresses to reviewed HTTPS public domains before release.
3. Add the first verified release and its artifact URLs after it exists; do not invent a download link before then.
4. Retain the generated SPDX SBOM with the release and repeat the NuGet/transitive-license review when dependencies change.
5. Run Gitleaks and the complete CI workflow from the public GitHub repository, then validate a clean-clone build there.
6. Publish an unsigned public release and obtain SignPath Foundation acceptance before claiming a signed release.
