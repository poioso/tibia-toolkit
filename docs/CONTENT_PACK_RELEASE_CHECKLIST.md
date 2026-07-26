# Content pack release checklist

The installer intentionally excludes `assets/`. Every runtime asset must be in
the separately promoted content ZIP before an app version that references it is
published.

## Required order

1. In the development checkout, build a new immutable content ZIP with the
   same release version as the app:
   `TIBIA_TOOLKIT_CONTENT_VERSION=<version> node tools/build-content-pack.mjs`.
2. Validate that exact ZIP, including dynamic book-appearance images:
   `node tools/audit-content-pack.mjs <zip-path>`.
3. Run `npm run verify:content-contract` in the public release source. If a
   renderer asset is referenced but absent from `tools/content-pack-contract.json`,
   stop and regenerate/review the contract before opening a PR.
4. Upload the immutable ZIP to both configured content origins. Upload the ZIP
   first and promote `content/latest.json` last.
5. Fetch both public `content/latest.json` manifests. Verify the version,
   archive URL, SHA-256, byte size, and downloaded ZIP checksum match the local
   audited ZIP.
6. Only after both content origins pass, build and publish the installer.
7. Test a clean installed copy with an empty content cache. Confirm every new
   icon, image, audio file, and local catalog loads before announcement.

Never point `latest.json` at an archive that has not passed the audit. Never
publish an app whose new renderer assets have not been promoted in the content
pack first.
