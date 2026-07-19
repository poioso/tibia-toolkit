# Release announcement procedure

Every public Tibia Toolkit release must be represented consistently on GitHub,
in the website Patch Notes and `Noticias do Tibia Toolkit`, and in the official
Discord `updates` channel.

Do not announce while the release is still in beta. Announce only after the
exact tested artifacts are public, the permanent download URL has been
verified, and the website Patch Notes endpoint reports the new version.

## Shared source of truth

- Use the final version and reviewed contents of `RELEASE_NOTES.md` and
  `RELEASE_NOTES.i18n.json`.
- Do not announce fixes that are absent from the published artifacts.
- Do not describe an unsigned release as signed.
- Keep this permanent download URL unchanged:

```text
https://github.com/poioso/tibia-toolkit/releases/latest/download/Tibia-Toolkit-Setup.exe
```

## Official website

- Confirm the public `latest.yml` contains `releaseNotesByLocale` for `pt-BR`,
  `en`, and `de`.
- Wait for `tibia-toolkit-github-sync.timer` to promote that manifest.
- Validate `/api/patch-notes` and the Patch Notes button in all three locales.
- Add the matching localized entry to `site/data/toolkit-news.json`, reusing the
  existing standard update GIF path instead of copying the media again.
- Deploy from the current live site release so unrelated newer website changes
  are preserved.

## Official Discord

- Inspect the live `updates` channel first to avoid duplicates.
- Post in English as the configured project bot with `@everyone`.
- Mention the real `downloads` channel and keep its permanent GitHub URL.
- If correcting a post, edit the bot message instead of creating a duplicate.

## Final verification

- GitHub release is public and has the stable installer asset.
- Stable and versioned installers are byte-identical.
- Public updater and website Patch Notes report the same version and notes.
- The localized website news entry is visible.
- Discord contains one correct bot announcement with the required mentions.
