# Website handoff

The official GitHub repository and verified public releases are available.

## Current signing status

The project does not currently have an approved Authenticode signing service.
Installers are distributed unsigned with public SHA-256 checksums. Do not state
that the app is signed while `Get-AuthenticodeSignature` reports `NotSigned`.

## Publication links

```text
Repository: https://github.com/poioso/tibia-toolkit
Source code: https://github.com/poioso/tibia-toolkit
Latest release: https://github.com/poioso/tibia-toolkit/releases/latest
All releases: https://github.com/poioso/tibia-toolkit/releases
Installer: https://github.com/poioso/tibia-toolkit/releases/latest/download/Tibia-Toolkit-Setup.exe
SHA256SUMS: https://github.com/poioso/tibia-toolkit/releases/latest/download/SHA256SUMS.txt
License: https://github.com/poioso/tibia-toolkit/blob/main/LICENSE
Privacy: https://github.com/poioso/tibia-toolkit/blob/main/docs/PRIVACY.md
Code signing policy: https://github.com/poioso/tibia-toolkit/blob/main/docs/CODE_SIGNING_POLICY.md
Security: https://github.com/poioso/tibia-toolkit/blob/main/SECURITY.md
Trademark policy: https://github.com/poioso/tibia-toolkit/blob/main/TRADEMARKS.md
```

## Copy for the website

**Português**

> O Tibia Toolkit é uma ferramenta comunitária não oficial, sem cheats ou hacks. O código-fonte é disponibilizado sob GPL-3.0-only. Os assets grandes são baixados separadamente como dados não executáveis e verificados antes do uso. Tibia é uma marca registrada da CipSoft GmbH; este projeto não é afiliado nem endossado pela CipSoft. Mídia relacionada a Tibia é usada somente conforme os termos aplicáveis do Fankit oficial e da CipSoft Video and Screenshot Policy.

**English**

> Tibia Toolkit is an unofficial community tool, with no cheats or hacks. Its source code is available under GPL-3.0-only. Large assets are downloaded separately as non-executable data and verified before use. Tibia is a registered trademark of CipSoft GmbH; this project is not affiliated with or endorsed by CipSoft. Tibia-related media is used only under the applicable official Fankit and CipSoft Video and Screenshot Policy terms.

**Unsigned installer notice**

> O instalador atual não possui assinatura Authenticode. O Windows pode exibir
> um aviso do SmartScreen; confirme o SHA-256 publicado antes de executar.

## Placement checklist

| Page | Content | When |
| --- | --- | --- |
| Home | Open-source notice, unofficial-project notice | Before public repository |
| Download | Signature status, hash instructions, content-pack disclosure | Before first release |
| Release page | Exact version, date, installer size, SHA-256, verified signature status | Per release |
| Footer | Source, license, privacy, security, trademark links | After repository URL exists |
| Legal/credits | CipSoft acknowledgement and Fankit/policy reference | Before any Tibia-related media is distributed |
| Home/footer | Link to the Tibia fansite agreement and visible unofficial/no-cheats notice | Before public repository |
