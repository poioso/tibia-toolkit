# Content pack release checklist

The installer intentionally excludes `assets/`, except for three bootstrap
assets that must work before the content pack is available:
`assets/ui/Tick.png`, `assets/ui/Cross.png`, and
`assets/ui/tutorial/update.gif`. Every other runtime asset must be in the
separately promoted content ZIP before an app version that references it is
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
8. Run `npm run verify:packaged-runtime` against the exact `win-unpacked`
   output. It verifies the bootstrap assets above as well as the required
   desktop runtime files. Do not substitute a source-tree check for this step.

## Packaged dependency and external-window gate

The installed application must be audited from
`win-unpacked/resources/app`, not only from the source checkout. Run both
`npm run verify:packaged-runtime` and
`node tools/verify-packaged-runtime-modules.mjs` and confirm that every
runtime dependency imported by the main process, preload scripts, and
auxiliary windows is present under the packaged `node_modules` tree. In
particular, `@msgpack/msgpack` must contain its package metadata, its actual
CommonJS entry point `dist/index.js`, and its packaged ES module entry point;
an installer that starts with `MODULE_NOT_FOUND` is invalid even when the
dependency exists in the development checkout.

Exercise or inspect every auxiliary window that loads with `BrowserWindow`.
Its HTML, scripts, preload markup, and runtime-generated elements must resolve
media through `tibiatoolkit://app/assets/...` (or the runtime content URL),
including the supporters/Buy me a Coffee window, window-move handle, and
ScreenshotToolkit assistant. Physical presence in the Content Pack alone is
not sufficient: the effective packaged URL and successful load must also be
verified.

Never point `latest.json` at an archive that has not passed the audit. Never
publish an app whose new renderer assets have not been promoted in the content
pack first.
