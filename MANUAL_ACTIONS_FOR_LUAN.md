# Manual actions for Luan

## Blocking actions before public release

1. **Asset rights:** use [docs/CIPSOFT_ASSET_COMPLIANCE.md](docs/CIPSOFT_ASSET_COMPLIANCE.md) to map every Tibia/CipSoft-derived pack to the official Fankit or another documented permission, then keep the required CipSoft acknowledgement visible. Do not assume a client-extracted file is part of the Fankit without a match.
2. **Public HTTPS endpoints:** place market/data/content endpoints behind intended public HTTPS domains; do not expose administrative ports or credentials.
3. **GitHub identity:** the official repository is <https://github.com/poioso/tibia-toolkit>. Keep 2FA enabled and add artifact links only after the first verified release exists.
4. **GitHub security:** enable secret scanning, push protection, Dependabot alerts/updates, CodeQL, branch protection, and a protected `release-signing` environment.
5. **SignPath:** apply only after the repository is public, documented, released, and independently buildable.

## SignPath values to enter only after approval

- Secret: `SIGNPATH_API_TOKEN`
- Variables: `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG`, `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`
- Variable: set `SIGNPATH_ENABLED=true` only after the artifact configuration is reviewed.

Never put these values in source files, `.env.example`, release notes, screenshots, or public issues.

## Per-release order

1. Merge reviewed code to `main`.
2. Create a SemVer tag such as `v0.3.1`.
3. Confirm CI passed.
4. Trigger the release workflow.
5. Review and manually approve the SignPath request.
6. Confirm signatures and generated hashes.
7. Review the draft GitHub release, then publish it.
8. Publish only the verified signed artifact to the official download channel.
