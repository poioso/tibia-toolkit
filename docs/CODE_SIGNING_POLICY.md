# Unsigned Windows release policy

The project does not currently have an approved Authenticode signing service.
Windows installers and project-owned executables are distributed unsigned until
a future signing solution is separately approved and documented.

## Scope

For each Windows release, record the Authenticode state of the project-owned executable files that users run:

- `Tibia Toolkit Setup <version>.exe` (NSIS installer)
- `Tibia Toolkit.exe` (main Electron application)
- `ScreenVision.NativeHost.exe` (project native helper)

`elevate.exe` is supplied by the Electron packaging toolchain and is not a project-owned signing target in this policy. Its provenance must be reviewed during each toolchain upgrade.

## Release controls

- GitHub Actions hosted runners validate the public source and unsigned package.
- Public notes must explicitly state that the installer is unsigned and may
  trigger SmartScreen.
- SHA-256, updater SHA-512, byte size, SBOM and provenance remain mandatory.
- The exact beta artifact must be promoted without rebuilding or replacing the
  same version in place.

## Roles and access

Keep least-privilege repository permissions for the published GitHub identities below.

| Role | Required owner |
| --- | --- |
| Repository administrator and committer | `@poioso` |
| Release approver | `@poioso` |
| Security contact | See `SECURITY.md` |

Use multi-factor authentication on GitHub. Never store certificates, private
keys, hardware-token PINs or signing-service tokens in Git, release assets,
issues or pull requests.

## Verification

Every published Windows release must generate checksums and record the expected
`NotSigned` state:

```powershell
.\scripts\verify-release.ps1 -ReleaseDirectory .\dist\tibia-toolkit-release -AllowUnsigned
.\scripts\generate-checksums.ps1 -InputPath .\dist\tibia-toolkit-release
```

Users should verify the SHA-256 against the published checksum file and download
only from the official release channel. `Get-AuthenticodeSignature` is expected
to report `NotSigned` while this policy is active.
