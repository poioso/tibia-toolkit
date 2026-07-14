# Code signing policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

This policy applies only after the project is accepted into the SignPath Foundation program and the service configuration has been completed. Until then, all locally built and ordinary CI artifacts are unsigned test artifacts.

## Scope

For each Windows release, the signing request must cover the project-owned executable files that users run:

- `Tibia Toolkit Setup <version>.exe` (NSIS installer)
- `Tibia Toolkit.exe` (main Electron application)
- `ScreenVision.NativeHost.exe` (project native helper)

`elevate.exe` is supplied by the Electron packaging toolchain and is not a project-owned signing target in this policy. Its provenance must be reviewed during each toolchain upgrade.

## Release controls

- GitHub Actions hosted runners build the unsigned release artifact.
- Signing is enabled only when the repository variable `SIGNPATH_ENABLED` is set to `true` after Foundation approval.
- The SignPath organization, project slug, artifact configuration slug, policy slug, and signing token are GitHub configuration values or secrets. They are intentionally absent from this repository.
- A release approver manually approves every signing request in the SignPath workflow.
- The workflow verifies Authenticode signatures after signing, generates checksums, produces provenance attestation, and creates only a draft GitHub release.

## Roles and access

Before signing activation, configure least-privilege repository permissions for the published GitHub identities below.

| Role | Required owner |
| --- | --- |
| Repository administrator and committer | `@poioso` |
| Release approver | `@poioso` |
| Security contact | See `SECURITY.md` |

Use multi-factor authentication on GitHub and SignPath accounts. Never store a certificate, private key, hardware-token PIN, or SignPath token in Git, release assets, issues, or pull requests.

## Verification

Every published Windows release must be verified with:

```powershell
.\scripts\verify-signatures.ps1 -ReleaseDirectory .\dist\tibia-toolkit-release
.\scripts\generate-checksums.ps1 -InputPath .\dist\tibia-toolkit-release
```

Users can also verify the installer with `Get-AuthenticodeSignature` and compare its SHA-256 against the published checksum file. A valid signature alone does not replace checking that the download came from an official release channel.
