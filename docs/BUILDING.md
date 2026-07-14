# Building Tibia Toolkit

This repository is the public source tree. It intentionally does not include the large runtime content pack, private infrastructure tools, operational data, or signing credentials.

## Prerequisites

- Windows x64
- Node.js 22.18.0 (see `.nvmrc`)
- .NET SDK 10.0.301 (see `global.json`)
- Git

Use the SDK selected by `global.json`. If an isolated SDK is needed, set `DOTNET_HOST_PATH` to its `dotnet.exe` before building.

```powershell
npm ci
npm run check
npm run build:installer
```

The installer is written to `dist/tibia-toolkit-release`. It is intentionally unsigned in a local or ordinary CI build. An unsigned result is for testing only and must not be presented as an official signed release.

## Runtime configuration

`desktop/app-config.json` is the current runtime configuration. For another deployment, start with `desktop/app-config.example.json` and use only reviewed HTTPS endpoints. Do not put passwords, private keys, signing tokens, or unpublished server addresses in this file.

The released app obtains its large content pack after installation. A development run needs an appropriate local `assets` directory or a separately configured runtime content source; those content files are not supplied by this repository.

## Reproducibility notes

`npm ci` uses `package-lock.json`; .NET uses the SDK pinned in `global.json`; and the build version comes from `package.json`. Before a release, record the commit SHA, installer SHA-256, SBOM, and signature-verification result.
