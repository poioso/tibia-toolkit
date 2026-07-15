# Security policy

## Supported versions

Only the latest official release is supported for security fixes.

## Reporting a vulnerability

Do not disclose a critical vulnerability in a public issue. Use the repository's private security-advisory reporting feature or email [security@tibiatoolkit.com](mailto:security@tibiatoolkit.com). Include reproduction steps, affected version, and any relevant logs with secrets removed.

## Release verification

When signed releases become available, verify both the SHA-256 listed in `SHA256SUMS.txt` and the Authenticode signature. Report a binary that claims to be official but fails either check.

## Project security controls

- GitHub Actions runs only with minimum permissions.
- Pull requests do not receive signing or deployment secrets.
- Signed releases require a verified GitHub-hosted build and manual SignPath approval.
- Large content packs are data-only and are verified before installation.

Repository administrators must enable two-factor authentication, secret scanning, push protection, Dependabot alerts, code scanning, and protected branches before public release.
