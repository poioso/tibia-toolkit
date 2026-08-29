# Security policy

## Supported versions

Only the latest official release is supported for security fixes.

## Reporting a vulnerability

Do not disclose a critical vulnerability in a public issue. Use the repository's private security-advisory reporting feature or email [security@tibiatoolkit.com](mailto:security@tibiatoolkit.com). Include reproduction steps, affected version, and any relevant logs with secrets removed.

## Release verification

Verify the SHA-256 listed in `SHA256SUMS.txt` and download only from the official
release page. Current releases are unsigned; report any binary that claims to
have an official signature while Authenticode reports otherwise.

## Project security controls

- GitHub Actions runs only with minimum permissions.
- Pull requests do not receive deployment secrets.
- Unsigned releases require an immutable source tag, verified beta hashes,
  checksums and explicit SmartScreen disclosure.
- Large content packs are data-only and are verified before installation.

Repository administrators must enable two-factor authentication, secret scanning, push protection, Dependabot alerts, code scanning, and protected branches before public release.
