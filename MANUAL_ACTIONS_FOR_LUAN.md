# Manual actions for Luan

## Blocking actions before public release

1. **Asset rights:** use [docs/CIPSOFT_ASSET_COMPLIANCE.md](docs/CIPSOFT_ASSET_COMPLIANCE.md) to map every Tibia/CipSoft-derived pack to the official Fankit or another documented permission, then keep the required CipSoft acknowledgement visible. Do not assume a client-extracted file is part of the Fankit without a match.
2. **Public HTTPS endpoints:** place market/data/content endpoints behind intended public HTTPS domains; do not expose administrative ports or credentials.
3. **GitHub identity:** the official repository is <https://github.com/poioso/tibia-toolkit>. Keep 2FA enabled and add artifact links only after the first verified release exists.
4. **GitHub security:** enable secret scanning, push protection, Dependabot alerts/updates, CodeQL and branch protection.
5. **Unsigned releases:** keep the SmartScreen/unsigned notice visible and publish SHA-256 checksums for every installer.

## Per-release order

1. Merge reviewed code to `main`.
2. Create a SemVer tag such as `v0.3.1`.
3. Confirm CI passed.
4. Confirm that the exact beta artifact is the one selected for promotion.
5. Confirm the `NotSigned` state and generated hashes.
6. Review the GitHub release, then publish it.
7. Publish only the verified artifact to the official download channel.
