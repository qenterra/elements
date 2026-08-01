# Building from source

This guide builds the current Chrome and Chromium extension from a clean
checkout.

## Requirements

- Node.js 22
- npm
- Chrome or a compatible Chromium browser for extension E2E tests

## Clone and install

```sh
git clone https://github.com/QenTerra/elements.git
cd elements
npm ci
```

`package-lock.json` is the dependency source of truth. Use `npm ci` for a clean,
reproducible installation instead of updating packages implicitly.

## Development

```sh
npm run dev
```

WXT generates the development build. The repository intentionally has no root
`manifest.json`; browser manifests are generated from `wxt.config.ts` and
`package.json`.

## Production build

```sh
npm run build:chrome
npm run verify:build
```

Load `.output/chrome-mv3` from `chrome://extensions` with **Developer mode**
enabled.

## Verification

```sh
npm run validate
npm run audit:all
npm run build:chrome
npm run verify:build
npm run test:e2e
npm run test:site
```

The extension E2E suite requires a Chromium build that supports unpacked
extensions. Linux CI runs headed Chromium through Xvfb. The Pages suite verifies
desktop and narrow layouts, accessibility, product-tour behavior, and reduced
motion.

Store review, browser-managed sync behavior, high zoom, screen-reader meaning,
and clean-profile installation remain manual release checks.

## Generated and local-only paths

Do not commit `.output/`, `node_modules/`, browser profiles, downloaded test
browsers, exported backups containing real browsing data, credentials, or
private screenshots.
