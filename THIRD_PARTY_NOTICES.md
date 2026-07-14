# Third-party notices

This file inventories direct dependencies used by the public source tree. It is not a substitute for the generated SBOM required for each release.

| Component | Version | License | Use |
| --- | --- | --- | --- |
| Electron | 43.1.1 | MIT | Windows desktop runtime |
| electron-builder | 26.15.3 | MIT | NSIS packaging |
| electron-updater | 6.8.9 | MIT | In-app updater |
| adm-zip | 0.5.18 | MIT | Content-pack parsing |
| driver.js | 1.6.0 | MIT | Guided UI components |
| jQuery | 3.7.1 | MIT | UI compatibility |
| Leaflet | 1.9.4 | BSD-2-Clause | Map UI |
| obs-websocket-js | 5.0.8 | MIT | Optional OBS integration |
| Playwright | 1.61.1 | Apache-2.0 | Development tooling |
| Cheerio | 1.1.2 | MIT | Data parsing support |
| google-translate-api-x | 10.7.3 | MIT | Development translation tooling |
| png-to-ico | 3.0.2 | MIT | Development icon tooling |
| rcedit | 5.0.2 | MIT | Windows executable metadata |
| NAudio | 2.3.0 | MIT | Native helper audio support |
| NAudio.Vorbis | 1.5.0 | MIT | Native helper audio support |
| NAudio.Asio, NAudio.Core, NAudio.Midi, NAudio.Wasapi, NAudio.WinForms, NAudio.WinMM | 2.3.0 | MIT | Transitive native-helper packages |
| NVorbis | 0.10.4 | MIT | Transitive Vorbis decoder |
| Microsoft.NET.ILLink.Tasks | 10.0.9 | MIT | .NET publish tooling |

The JavaScript licenses above were read from installed package metadata during the preparation audit. NuGet metadata and the included NVorbis license were also reviewed. `scripts/generate-sbom.ps1` generates a release SPDX SBOM for npm dependencies; the maintainer must keep the NuGet/transitive review current when package versions change.
