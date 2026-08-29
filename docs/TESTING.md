# Testing

## Complete gate

```sh
node scripts/verify-repository.mjs
```

The command first audits the canonical checkout. It then copies source into a
unique external temporary directory, installs the locked dependencies and
Playwright Chromium there, and runs:

1. TypeScript, Oxlint, Prettier, documentation, icon, site, QDS bridge, and
   Vitest validation.
2. `npm audit` at the high-severity threshold.
3. The production Chrome build and manifest/package verification.
4. Headed Chromium extension E2E and GitHub Pages E2E suites; Linux runs the
   extension suite through Xvfb.
5. Version/tag/changelog checks, release ZIP creation and inspection, checksum,
   and release-note generation for the current version.

All dependency trees, browser binaries, build output, reports, and release
staging remain outside the repository and are deleted after the run unless the
caller explicitly preserves the temporary workspace.

## Evidence layers

| Layer                               | Purpose                                                                                                                        | Evidence limit                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Repository audit                    | Governance, identity, contacts, naming, documentation, workflow hardening, and public-tree hygiene                             | Does not prove live GitHub settings or runtime behavior                         |
| Type, lint, format, and unit checks | Contracts and isolated behavior                                                                                                | Does not prove browser integration                                              |
| Production build checks             | Manifest, packaged files, permissions, and forbidden runtime patterns                                                          | Does not prove installation or store review                                     |
| Extension E2E                       | Picker, Options, onboarding, storage, import/export, localization, and accessibility rules in the bundled Chromium environment | Does not cover every website, account, browser version, or assistive technology |
| Pages E2E                           | Desktop and narrow product pages, navigation, demo, product tour, accessibility rules, and reduced motion                      | Does not replace human visual review                                            |
| Release artifact checks             | Version, changelog, ZIP structure, checksum, and notes                                                                         | Does not prove remote tag, release, or download integrity                       |
| Manual acceptance                   | Installed-extension UX, real-site compatibility, browser sync, screen readers, high zoom, and visual quality                   | Requires current named human or device evidence                                 |

## Fixtures and failures

Use deterministic synthetic pages and storage records. Never read personal
browsing data, real exported backups, production credentials, or private page
content for a normal gate. Reproduce failures before repair and do not weaken
assertions, allowlist a cache, or add private material merely to make a check
green.
