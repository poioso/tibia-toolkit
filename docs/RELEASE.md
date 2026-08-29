# Release process

Do not publish a release until every blocker in `OPEN_SOURCE_AUDIT.md` is closed.

The complete operational rules, including the fixed download URL for the website and Discord, are in [UPDATE_RELEASE_GUIDE.md](UPDATE_RELEASE_GUIDE.md).

The mandatory post-release announcement procedure for GitHub, the official
website, and Discord is in [RELEASE_ANNOUNCEMENTS.md](RELEASE_ANNOUNCEMENTS.md).

## Before creating a tag

1. Update `package.json`, `RELEASE_NOTES.md`, and `RELEASE_NOTES.i18n.json` with the same SemVer release version.
2. Run `npm ci`, `npm run check`, `npm run verify:content-contract`, the secret scan, dependency audit, a clean Windows build, and `npm run verify:packaged-runtime` against the generated `win-unpacked` directory. Complete [CONTENT_PACK_RELEASE_CHECKLIST.md](CONTENT_PACK_RELEASE_CHECKLIST.md) whenever runtime assets or local catalogs changed.
3. Generate and review an SPDX SBOM for Node dependencies. Complete the separate NuGet/transitive-license review.
4. Confirm that all official runtime endpoints use reviewed HTTPS domains, and that content rights and attribution are documented. For Tibia-related media, complete `docs/CIPSOFT_ASSET_COMPLIANCE.md` and include the acknowledgement in `CREDITS.md`.
5. Confirm that repository URLs, owner usernames, privacy contact, and the unsigned-release notice are current.
6. Commit the reviewed source, merge through the protected default branch, and create an annotated tag such as `v0.3.1`.

## GitHub workflow behavior

The release workflow retrieves the exact previously validated beta artifact,
checks it against immutable versioned metadata, and publishes it without a
rebuild. The project does not currently have an approved Authenticode signing
service, so a public release must state that Windows may show a SmartScreen
warning. Never describe the installer as signed.

The installer is published twice in each GitHub release: once with its
versioned build name for traceability, and once as `Tibia-Toolkit-Setup.exe`.
The second asset is byte-for-byte identical and is the only asset used by the
stable public download URL. Checksums, manifest size/SHA-512 and provenance are
still mandatory.

## Public announcement

After the exact tested artifacts are public and the permanent download URL has
been verified, publish matching patch notes on GitHub, in `Noticias do Tibia
Toolkit` for `pt-BR`, `en`, and `de`, and in the Discord `updates` channel. The
Discord announcement is posted in English by the configured bot with
`@everyone` and a mention of the `downloads` channel. Follow
[RELEASE_ANNOUNCEMENTS.md](RELEASE_ANNOUNCEMENTS.md) and do not announce beta
artifacts.

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

Never replace a published installer in place. Publish a new version with new checksums and a newly validated artifact. If a release must be withdrawn, unpublish or mark the release as revoked in the official channel, explain the issue, and publish a corrected version after review.
