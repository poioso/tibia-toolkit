# Release process

Do not publish a release until every blocker in `OPEN_SOURCE_AUDIT.md` is closed.

## Before creating a tag

1. Update `package.json`, `RELEASE_NOTES.md`, and `RELEASE_NOTES.i18n.json` with the same SemVer release version.
2. Run `npm ci`, `npm run check`, the secret scan, dependency audit, and a clean Windows build.
3. Generate and review an SPDX SBOM for Node dependencies. Complete the separate NuGet/transitive-license review.
4. Confirm that all official runtime endpoints use reviewed HTTPS domains, and that content rights and attribution are documented. For Tibia-related media, complete `docs/CIPSOFT_ASSET_COMPLIANCE.md` and include the acknowledgement in `CREDITS.md`.
5. Confirm that repository URLs, owner usernames, privacy contact, and SignPath settings are real rather than placeholders.
6. Commit the reviewed source, merge through the protected default branch, and create an annotated tag such as `v0.3.1`.

## GitHub workflow behavior

The release workflow builds an unsigned artifact. It submits the artifact to SignPath only after both Foundation approval and `SIGNPATH_ENABLED=true` have been configured. It never substitutes an unsigned artifact for a signed public release.

After signing, it regenerates the updater manifest so its SHA-512 and size match the signed installer, verifies project-owned executable signatures, creates checksums and provenance, and opens a draft release. A maintainer reviews the draft before it becomes public.

## Local preflight

```powershell
.\scripts\scan-secrets.ps1
npm ci
npm run check
npm audit --omit=dev --audit-level=high
.\scripts\build-release.ps1
```

`build-release.ps1` checks an unsigned local package. It does not sign or publish anything.

## Rollback

Never replace a published installer in place. Publish a new version with new checksums and an updated signed artifact. If a release must be withdrawn, unpublish or mark the release as revoked in the official channel, explain the issue, and publish a corrected version after review.
