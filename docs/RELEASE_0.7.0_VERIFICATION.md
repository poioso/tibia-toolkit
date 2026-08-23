# Tibia Toolkit 0.7.0 — verification manifest

This document records the release gates for the public 0.7.0 candidate. It is
part of the release evidence and must remain alongside the immutable release
artifacts.

## Source and scope

- Version: `0.7.0`
- Public source branch: `codex/release-0.7.0`
- Development checkpoint: `0.7.0-dev.20260823-003816-app-full`
- Release source is isolated from the private development checkout.
- Site, homologation, private credentials, personal data, server-only services,
  caches, logs and administrative tooling are excluded from the public tree.

## Runtime and asset gates

- Public JavaScript check: passed (`108` files).
- Content contract: passed (`111` source files, `471` required references,
  `0` undeclared references and `0` missing references).
- Full runtime asset audit: passed (`21,637` asset files, `20,361` image
  files, `473` literal references, `160` spells, `3,457` library sprites,
  `3,121` book images and `10,226` proficiency icons).
- Negative audit: passed. Removing a CSS file, image, preload or module from a
  fixture fails the audit as required.
- The final content archive was extracted into a clean directory and all
  ScreenshotToolkit, tutorial and local QR assets were found.
- Packaged runtime audit: passed (`21` required files).
- Packaged module audit: passed (`6` required modules; server-only modules
  absent).

The ScreenshotToolkit gate explicitly includes its HTML, CSS, JavaScript,
preloads, `openscreenshotfolder.png`, `uncheck.png`, `folder.gif`,
`polaroid.gif`, `Dustbin.gif`, `balao-interrogacao.gif` and `Cross.png`.

## Content Pack

- Archive: `tibia-toolkit-content-0.7.0.zip`
- Archive files: `21,637`
- Archive size: `509,793,434` bytes
- SHA-256: `1a8b9bdb4ced5352f5c66969720469b2cafd3f377ee83d0a49485cfd5c98bfa0`

## Installer and updater

- Installer target: assisted NSIS (`oneClick=false`).
- Installer build: passed with Electron `31.7.7` and electron-builder
  `24.13.3`.
- `initialCheck` updater contract: passed.
- Automatic download remains disabled until user confirmation.
- Two-origin updater fallback: passed.
- Installer contract: passed for clean standard/custom installation, custom
  directory and shortcut choices, registry-folder reuse on update/reinstall,
  and user data outside the program directory.
- Installer and Native Host are intentionally unsigned because SignPath public
  trust approval is not available. No valid signature is claimed.

Release artifact hashes:

- `Tibia Toolkit Setup 0.7.0.exe`: 139,191,802 bytes,
  `ad93053a3f611f3ce4e391fc3668036a1e035f4a820b4e20384c028959cd6bd5`
- `Tibia Toolkit Setup 0.7.0.exe.blockmap`: 145,733 bytes,
  `f63d982aff5975188e3715f8518c99cfb7d9ff9682a9097bc5988909f37fe536`
- `Tibia-Toolkit-Setup.exe`: byte-identical to the versioned installer.
- `latest.yml`: 5,740 bytes,
  `ff359a171d65536afe47a47a18516c1c723f9934e629b17e50dad7ae1288e1f4`
- `SBOM.cdx.json`: 326,472 bytes,
  `d227898a7ba827d1ae3a12eddbdb9cb716b92bd99727fc26d11e38dcb0037848`

The actual public update gate remains blocking until a 0.6.7 installation has
been tested against the promoted 0.7.0 feed. The 0.6.7 installer was downloaded
from the published release and matched its published SHA-512 before that test.

## Test summary

- Node release tests: `36` files, `93` tests passed, `0` failed.
- Updater contract tests: `2` passed.
- Negative runtime audit tests: passed.
- Final ZIP audit: passed with no missing references.

The release is not considered published until the public feeds, GitHub assets,
clean-cache Content Pack load, 0.6.7 → 0.7.0 update, post-update data
preservation and rollback checks are recorded separately.
