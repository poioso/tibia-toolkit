# Update and public-download guide

This document is the mandatory procedure for releasing a new version of Tibia Toolkit.

## Fixed public download link

The website and Discord must always use this exact link:

```text
https://github.com/poioso/tibia-toolkit/releases/latest/download/Tibia-Toolkit-Setup.exe
```

Do not publish versioned download links on the website or Discord. GitHub resolves `/releases/latest/` to the latest published non-prerelease release. The link only works when that release contains an asset named exactly `Tibia-Toolkit-Setup.exe`.

Each release publishes two copies of the same installer bytes:

- `Tibia Toolkit Setup <version>.exe` is the versioned artifact used for traceability, manifests, checksums, and signing verification.
- `Tibia-Toolkit-Setup.exe` is the stable public-download asset. Its SHA-256 must equal the versioned installer SHA-256.

The assets belong to separate GitHub releases, so reusing the stable asset name in a later release does not create a conflict.

## Separate the public link from SignPath evidence

Use an immutable, version-specific GitHub release URL for SignPath Foundation applications, reviews, and signing evidence. For example:

```text
https://github.com/poioso/tibia-toolkit/releases/tag/v0.3.1
```

Never use a `/releases/latest/` link as SignPath evidence because it changes when a new release becomes the latest. The public stable link is for end users only.

## Required release order

1. Update the version and release notes; merge the reviewed source through the protected default branch.
2. Create and push an annotated tag such as `v0.3.2`.
3. Build from that exact tag in GitHub Actions.
4. After SignPath Foundation accepts the project, manually approve the SignPath signing request for every release. Do not bypass this approval.
5. Verify the signed versioned installer, application executable, and native helper. Regenerate `latest.yml` and checksums only from the signed installer.
6. Publish the GitHub release only after the signed artifacts are ready. Ensure it includes the stable `Tibia-Toolkit-Setup.exe` asset and is marked as the latest public release.
7. Verify that the fixed public URL downloads the stable asset and that its SHA-256 equals the versioned installer SHA-256. Only then announce the release; the site and Discord links themselves do not change.

## Current transition state

Until the in-app updater is explicitly migrated to GitHub Releases, existing installed copies continue to use the two configured update servers and the beta-to-public test procedure. This does not change the fixed GitHub link used by the website and Discord for initial downloads.

Foundation-review releases published before SignPath approval are unsigned review artifacts. Do not describe them as signed, and do not replace an existing versioned asset. After approval, the stable asset must be a byte-identical copy of the signed installer from its verified GitHub build.
