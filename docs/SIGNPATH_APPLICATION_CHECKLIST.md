# SignPath Foundation application checklist

Complete every item with real project details before submitting an application. This file deliberately contains no SignPath credentials or invented project identifiers.

- [ ] The public GitHub repository has been created and contains this clean source history only.
- [ ] The source is released under GPL-3.0-only, and all project files needed to build are public.
- [ ] The project is maintained, documented, and has a clear Windows release process.
- [ ] External content is excluded from the source repository and has a documented rights/attribution decision.
- [ ] The README includes the required SignPath attribution sentence.
- [ ] `docs/CODE_SIGNING_POLICY.md` identifies committers, release approvers, MFA expectations, and manual approval of every signing request.
- [ ] GitHub Actions uses hosted runners for the build path that produces the signing artifact.
- [ ] The default branch is protected and only authorized maintainers can modify signing configuration, workflows, or releases.
- [ ] GitHub usernames, security contact, privacy contact, and official links have replaced all placeholders.
- [ ] The privacy-policy and installer disclosure requirement has been reviewed against the final network behavior; if the app transfers user data beyond user-requested operation, the installer presents the policy and a disable option as required by the Foundation terms.
- [ ] A clean clone passes secret scanning, CI, and a Windows installer build.
- [ ] An unsigned public release has been published for the Foundation review, if requested by the program.
- [ ] The SignPath organization, project, artifact configuration, policy, and secret have been configured after acceptance.
- [ ] A test signing request is manually approved and the resulting installer, main app, and native helper pass Authenticode verification.

Use the current official SignPath Foundation terms and documentation during submission; program eligibility and configuration requirements can change.
