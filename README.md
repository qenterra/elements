<p align="center">
  <img src="public/icons/icon_128.png" width="128" height="128" alt="Elements icon">
</p>

<h1 align="center">Elements</h1>

<p align="center">
  Hide distractions, edit visible text, and restyle page elements.<br>
  Your rules stay in browser-managed storage and apply again on your next visit.
</p>

<p align="center">
  <a href="https://github.com/QenTerra/elements/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/QenTerra/elements/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/QenTerra/elements/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/QenTerra/elements?display_name=tag&sort=semver"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-f2f2f2"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-f2f2f2">
  <a href="https://buymeacoffee.com/qenterra"><img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=000000"></a>
</p>

<p align="center">
  <a href="#interface">Interface</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#documentation">Documentation</a>
</p>

## Interface

![Elements picker locked to a banner on a sample article](docs/images/picker-dark.png)

![Elements Options page in the dark theme](docs/images/options-dark.png)

<table>
  <tr>
    <td width="38%" valign="top">
      <img src="docs/images/picker-narrow.png" alt="Elements picker in a narrow mobile-sized viewport">
    </td>
    <td width="62%" valign="top">
      <img src="docs/images/onboarding-dark.png" alt="Elements onboarding page in the dark theme">
    </td>
  </tr>
</table>

## Features

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Pick precisely</strong><br>
      Hover to preview, click to lock, then choose an action. Use <code>Q</code> and <code>W</code> to move through parent and child layers without losing the active breadcrumb.
    </td>
    <td width="33%" valign="top">
      <strong>Change what you see</strong><br>
      Hide blocks, replace visible text, round corners, blur, dim, desaturate, or add sanitized custom CSS. Undo and redo cover every rule change.
    </td>
    <td width="33%" valign="top">
      <strong>Keep it local</strong><br>
      Save rules per site, pause them without deleting them, and export a JSON backup. Private-window changes remain temporary.
    </td>
  </tr>
</table>

The picker opens from the toolbar or with `Ctrl/Cmd+Shift+X`. Its layout adapts
from a desktop corner panel to a touch-sized bottom sheet, with light, dark, and
system themes throughout the extension.

## Quick start

### Download

The [latest release](https://github.com/QenTerra/elements/releases/latest)
contains the unsigned Chrome and Chromium build.

| Browser             | Archive                                                                                                                | Intended use                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Chrome and Chromium | [`elements-1.0.0-chrome.zip`](https://github.com/QenTerra/elements/releases/latest/download/elements-1.0.0-chrome.zip) | Unpack and load from the extensions page |

Chrome Web Store distribution still requires its signing and review process.

### Install

1. Download and unpack the Chrome archive.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**, then choose the extracted folder.

## Permissions and privacy

| Permission  | Purpose                                                      |
| ----------- | ------------------------------------------------------------ |
| `storage`   | Save rules and settings in browser-managed extension storage |
| `scripting` | Start Elements in a compatible tab that was already open     |
| `*://*/*`   | Reapply user-created rules on HTTP and HTTPS sites           |

Elements has no analytics, advertising, remote code, or developer-operated
backend. It does not send saved rules or page contents to the developer.
Browser sync may process saved data when available; Elements falls back to
local storage when data is too large or sync is unavailable. See the
[Privacy Policy](PRIVACY.md) for the complete data-handling description.

## Development

Requirements: Node.js 22 and npm.

```sh
npm ci
npm run validate
npm run build:chrome
npm run verify:build
```

For local development, run `npm run dev`. WXT generates manifests and build
directories; the repository intentionally has no root `manifest.json`.
Load `.output/chrome-mv3` from `chrome://extensions`.

The Chromium end-to-end suite drives a built extension:

```sh
npx playwright install --no-shell chromium
npm run build:chrome
npm run test:e2e
npm run test:site
npm run site:serve
```

`npm run test:site` checks the public product page at desktop and narrow
viewports, including its demo, product tour, accessibility, and reduced-motion
fallback. `npm run site:serve` opens the static site at
`http://127.0.0.1:4173` for local review. `npm run screenshots` refreshes the
product images used by the documentation and GitHub Pages after the Chrome
build.

## Architecture

Elements uses WXT, TypeScript, React, and the Manifest V3 extension model.

```text
entrypoints/
  background.ts          persistent-write owner and browser integration
  content.ts             lightweight content-script entrypoint
  elements-ui.tsx        lazy picker application
  options/               settings and saved-rule management
  onboarding/            first-run guide
src/
  core/                  storage, data contracts, themes, protocol
  content/               selector engine, rule engine, controller, overlay
  components/            shared UI components
  theme/                 shared design tokens
```

The background service worker validates a versioned message protocol and owns
persistent writes. The page controller compiles visual rules into an isolated
stylesheet; reversible text wrappers retain original DOM nodes and listeners.
React is loaded into the picker only after activation.

## Releasing

```sh
npm run validate
npm run audit:all
npm run release:archives
npm run verify:build
npm run verify:release -- v1.0.0
```

A `v*` tag runs the full release workflow, including Chromium E2E tests, and
publishes the Chrome archive with notes taken from [CHANGELOG.md](CHANGELOG.md).

## Current limitations

- The published build targets Chrome and compatible Chromium browsers only.
- Chrome Web Store distribution still requires its signing and review process.
- Installation from GitHub uses an unsigned archive and Chrome's developer mode.

## Documentation

- [Product and user Wiki](https://github.com/QenTerra/elements/wiki)
- [Documentation index](docs/README.md)
- [Building from source](docs/BUILDING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Dependencies](docs/DEPENDENCIES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Contributing guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Privacy Policy](PRIVACY.md)
- [Terms of Use](TERMS_OF_USE.md)
- [Security Policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [MIT License](LICENSE)

## Support

Elements is maintained by
[Nikita Melnychenko (QenTerra)](https://github.com/QenTerra). If it saves you
time, you can [buy me a coffee](https://buymeacoffee.com/qenterra).

Bug reports and focused pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening one and use
[SECURITY.md](SECURITY.md) for private vulnerability reports.

## License

Elements source code is available under the [MIT License](LICENSE). Runtime,
build, and website dependencies remain subject to their own licenses; see
[Third-party notices](THIRD_PARTY_NOTICES.md).
