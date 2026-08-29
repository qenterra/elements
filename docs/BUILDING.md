# Building from source

This guide builds the current Chrome and Chromium extension from a clean
checkout.

## Requirements

- Node.js 22
- npm
- Chrome or a compatible Chromium browser for extension E2E tests

## Clone and verify

```sh
git clone https://github.com/QenTerra/elements.git
cd elements
node scripts/verify-repository.mjs
```

`package-lock.json` is the dependency source of truth. The verifier copies the
source to an operating-system temporary directory, installs the exact lockfile
there, and runs the complete gate without creating dependency or build caches
inside the repository.

## Development

Preserve a verified external workspace when you need an interactive session:

```sh
ELEMENTS_KEEP_VERIFY_WORKSPACE=1 node scripts/verify-repository.mjs
```

The command prints the temporary path. Run `npm run dev` from its `workspace`
directory. WXT generates manifests and build output there; the canonical
repository intentionally has no root `manifest.json`.

## Production build

The complete verifier builds and checks Chrome output. With the external
workspace preserved, load its `.output/chrome-mv3` directory from
`chrome://extensions` with **Developer mode** enabled.

## Verification

```sh
node scripts/verify-repository.mjs
```

The extension E2E suite requires a Chromium build that supports unpacked
extensions. Linux CI runs headed Chromium through Xvfb. The Pages suite verifies
desktop and narrow layouts, accessibility, product-tour behavior, and reduced
motion.

Store review, browser-managed sync behavior, high zoom, screen-reader meaning,
and clean-profile installation remain manual release checks.

## Generated and local-only paths

Do not keep `.output/`, `.wxt/`, `node_modules/`, browser profiles, downloaded
test browsers, reports, exported backups containing real browsing data,
credentials, private screenshots, or AI and agent operating files anywhere in
the public checkout, even when ignored. Reproducible working state belongs in a
unique temporary directory outside the repository.
