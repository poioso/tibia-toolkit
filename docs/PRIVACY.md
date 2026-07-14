# Privacy policy

Last reviewed: 2026-07-14.

Tibia Toolkit is a local Windows desktop application. This document describes the behavior of the public source tree as reviewed on the date above. It must be updated before any feature that changes data handling is released.

## Data processed on the device

- App preferences and local cached data are stored in the application's Windows user-data area.
- The app can download public game, market, supporter, update, and content-pack data from endpoints configured in `desktop/app-config.json`.
- Optional OBS connection details and user-configured TOTP data are entered by the user and handled locally by the relevant feature. Do not enter secrets on an untrusted computer.
- Screen/window capture, mirrors, timers, and global hotkeys are optional features initiated or configured by the user.

The reviewed source contains no built-in advertising analytics or crash-reporting SDK. Network operators and third-party services used by configured endpoints may still process connection metadata such as IP address, time, and requested URL under their own policies.

## External services

When the app retrieves data or updates, the configured service receives the normal request data needed to respond. This can include IP address, user agent, requested resource, and request time. The project must publish the operator and privacy terms for each official endpoint before public release.

The project is not affiliated with CipSoft GmbH. Tibia-related information and external game content may be subject to separate rights and terms.

## Retention and removal

Uninstalling removes the installed application. Local user-data and downloaded content may remain until manually removed from the Windows user-data location. Avoid sharing logs, exported settings, screenshots, or diagnostics because they may contain information from the local environment.

## Security and contact

Report security vulnerabilities privately as described in `SECURITY.md`. For privacy questions or deletion requests concerning an official project-operated endpoint, the maintainer must add a public contact address before release.
