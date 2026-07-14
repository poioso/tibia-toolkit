# Remote assets and content packs

The repository contains source code and minimal build resources only. Large images, audio, JSON game data, and other content are distributed separately at runtime.

## Current client safeguards

The content-pack client accepts only HTTPS manifest and archive URLs. A manifest must declare a version, SHA-256, and byte size. The download is size-limited, hashed, extracted under a controlled directory, restricted to an allow-list of non-executable extensions, and replaced with rollback protection.

These checks reduce transport and archive risks, but the current manifest itself is not digitally signed. The maintainer must establish a signed-manifest design and key-management process before treating content delivery as fully authenticated.

## Maintainer requirements

- Publish packs only from reviewed HTTPS domains.
- Retain proof of the redistribution rights for every pack component.
- For Tibia-related media, complete [CIPSOFT_ASSET_COMPLIANCE.md](CIPSOFT_ASSET_COMPLIANCE.md) and preserve the required acknowledgement from [CREDITS.md](../CREDITS.md).
- Publish the content version, SHA-256, source, and any required attribution.
- Do not distribute executable files, scripts, installers, private configuration, or credentials through a content pack.
- Test upgrades, outages, corrupted archives, and rollback behavior before changing distribution endpoints.

`REMOTE_ASSET_AUDIT.md` records the initial classification. It is not a rights clearance.
