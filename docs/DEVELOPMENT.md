# Development

## Source boundary

Elements is a WXT Manifest V3 extension written in TypeScript and React. The
canonical checkout contains reviewed source, documentation, tests, and static
product assets. Dependency installs, generated manifests, extension builds,
browser binaries, test reports, release archives, and screenshot intermediates
are reproducible working state and stay outside the repository.

Public repository content must remain human-facing. Do not add AI or agent
instructions, prompts, transcripts, skills, MCP configuration, tool state,
private plans, local paths, caches, logs, or personal browsing data. The audit
checks tracked, untracked, and ignored paths; `.gitignore` is not a hiding place.

## Complete verification

Requirements are Node.js 22, npm, Python 3.11 or later, and Chrome or compatible
Chromium support for manual use.

```sh
node scripts/verify-repository.mjs
```

The verifier audits the canonical checkout, copies source to a unique
operating-system temporary directory, installs the lockfile and Playwright
browser there, and runs the complete test and release-artifact gate. It removes
the temporary workspace on success or failure.

Preserve the external workspace only for an intentional debugging session:

```sh
ELEMENTS_KEEP_VERIFY_WORKSPACE=1 node scripts/verify-repository.mjs
```

The printed path contains a `workspace` directory with the installed
dependencies and generated `.output` tree. Run `npm run dev` or an individual
package script there. Make durable changes in the canonical checkout and rerun
the complete verifier before publication.

## Source map

- `entrypoints/` defines the background worker, content entrypoint, picker,
  Options page, and onboarding page.
- `src/core/` owns data contracts, storage, protocol, settings, and transport.
- `src/content/` owns selection, rule application, history, persistence, and
  the page overlay.
- `src/components/` contains shared React components and hooks.
- `src/qds/` contains the checked-in QenTerra Design System bridge used by the
  extension.
- `site/` is the source for the GitHub Pages product site.
- `tests/` contains unit, repository, extension E2E, Pages E2E, and design-system
  integrity checks.

## Configuration and generated state

`package.json` is the version and script source of truth; `package-lock.json`
locks JavaScript dependencies; `wxt.config.ts` defines extension metadata;
Playwright, TypeScript, Vitest, Oxlint, and Prettier use their versioned project
configuration. No live credentials or signing material are required for local
verification.

`src/qds/qds-tokens.source.css` is the human-maintained source for the pinned
QDS token snapshot. Run `node scripts/verify-qds-artifacts.mjs --write` after a
reviewed source change; it deterministically refreshes
`src/qds/qds-tokens.css`, `site/qds-web.css`, and their checksum manifest.
`npm run verify:qds-artifacts` regenerates the expected bytes in memory and
fails if either committed output or the manifest drifts.

WXT creates `.output/` and `.wxt/`. npm creates `node_modules/` and cache data.
Playwright downloads browser binaries and writes reports. Screenshot capture
uses an operating-system temporary directory before approved images are copied
to `docs/images/` and `site/assets/`. None of the working paths belongs in the
canonical checkout.

## Review boundary

Automated checks do not prove Chrome Web Store review, real-site compatibility,
browser sync across accounts, installed-extension UX, screen-reader meaning, or
visual quality on every page. Record those as named manual evidence when they
matter to a change.
