# Remote asset audit

**Status: official CipSoft Fankit and policy references identified; source mapping is still required before public distribution.**

The public source tree deliberately contains no `assets/` directory. The private working tree currently has approximately 455 MiB across 13,382 tracked asset files. They are not licensed by GPL merely because the source code is GPL.

| Asset group | Approx. size | Classification | Public repository | Rights status |
| --- | ---: | --- | --- | --- |
| `assets/tibia-client` | 210.5 MiB | Tibia/CipSoft-derived client content | Excluded | Map each distributable group to the official Fankit or other documented CipSoft permission before distribution |
| `assets/ui` | 137.9 MiB | Mixed project/third-party UI media | Excluded | Inventory origin and licenses |
| `assets/data` | 94.9 MiB | Static data and images from multiple sources | Excluded | Confirm each upstream source and attribution |
| `assets/i18n` | 6.1 MiB | Project translations/data | Excluded | Review before publishing packs |
| `assets/tibia-map-data` | 4.4 MiB | Map-related data | Excluded | Confirm source terms and attribution |
| `assets/wheel-of-destiny` | 1.6 MiB | Game-related content | Excluded | Map to the official Fankit or other documented CipSoft permission before distribution |
| `assets/screen-vision` and `assets/imbuements` | 1.2 MiB | Project/UI content | Excluded | Confirm authorship and license |

Observed formats in the current private tree are PNG, JSON, GIF, OGG, WebP, SVG, JPG, Markdown, and placeholder files. No executable files were found in the tracked asset tree. The downloader now blocks executable or unknown extensions.

The official Fankit announcement says that its materials are subject to the CipSoft Video and Screenshot Policy included with the Fankit. The Fankit and the official CipSoft information page are recorded in [CREDITS.md](CREDITS.md). This establishes a documented source for Fankit material, but does not establish that every file in a private client-derived collection is included in that Fankit.

Before an external content pack is announced publicly, the project owner must record each package's origin, author, license, redistribution permission, and required acknowledgement using [docs/CIPSOFT_ASSET_COMPLIANCE.md](docs/CIPSOFT_ASSET_COMPLIANCE.md). Do not move or relicence Tibia/CipSoft material based on this document.
