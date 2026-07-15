<p align="center">
  <img src="public/icons/icon_128.png" width="96" height="96" alt="Elements logo">
</p>

<h1 align="center">Elements</h1>

<p align="center">
  A polished, local-first browser extension for hiding, editing, and restyling webpage elements.
</p>

<p align="center">
  <a href="https://github.com/QenTerra/elements/releases">Releases</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="LICENSE">MIT License</a>
</p>

Elements is a cross-browser Manifest V3 extension for cleaning up webpages by
hand. Hide distracting elements, edit visible text, or round sharp corners.
Changes can be kept per site and synchronized across devices when browser
storage allows it. Elements has no analytics, advertising, remote code, or
developer-operated backend.

## Highlights

- Activate the picker from the toolbar or `Ctrl/Cmd+Shift+X`.
- Hover and select elements; `Q`/`W` move through their ancestor chain.
- Hide an element with a click or `Space`.
- Edit visible text with `E`; `Enter` saves and `Escape` cancels.
- Round corners with `C` and undo the latest change with `Ctrl/Cmd+Z`.
- Preview an edit, change its CSS selector, and choose whether it is remembered.
- Temporarily compare the edited page with its original appearance.
- Export and import all settings as a single JSON backup.
- Respect `prefers-reduced-motion` across picker and Options interactions.

## Release downloads

Each GitHub release contains a separate build for every supported browser:

| Archive | Target | Usage |
| --- | --- | --- |
| `elements-v1.0.0-chrome.zip` | Chrome and Chromium browsers | Unzip and load as an unpacked extension |
| `elements-v1.0.0-firefox.zip` | Firefox | Load temporarily for development or submit for Mozilla signing |
| `elements-v1.0.0-safari.zip` | Safari | Use as the WebExtension input for Safari conversion and signing in Xcode |

The release archives are unsigned development/self-distribution builds. Store
distribution still requires the signing and review process of each browser.

### Chrome / Chromium

1. Download and unzip the Chrome archive.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder.

### Firefox

1. Download and unzip the Firefox archive.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select `manifest.json`.

### Safari

The Safari archive contains the Safari-targeted WebExtension build. Convert it
into a signed Safari App Extension with Apple's Safari Web Extension Converter
and Xcode before installation or distribution.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save remembered edits and extension settings |
| `scripting` | Inject into compatible tabs that were open before installation |
| `*://*/*` (host) | Reapply user-created rules on matching websites |

Elements does not use these permissions to transmit page data to the developer.
See [PRIVACY.md](PRIVACY.md) for the complete data-handling policy.

## Architecture

The project is built with WXT, Vite, TypeScript, and React. React owns the
extension UI (Options and the Shadow DOM picker), while the page-facing engine
uses direct DOM APIs so it does not impose a virtual DOM over the host page.

```text
entrypoints/
  background.ts          MV3 service worker
  content.ts             content-script entrypoint
  options.html           Options document and visual design
  options/main.tsx       React Options application
src/
  components/            shared UI components and brand mark
  core/                  storage and data contracts
  content/               selector engine, page controller, React overlay
```

The content controller keeps hide/round rules in one stylesheet and applies
text edits directly. A mutation observer reapplies text edits after SPA
navigation replaces page nodes. Stored data remains compatible with the v1
JSON shape, including implicit hide actions.

## Development

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The source root intentionally has no runtime `manifest.json`: WXT generates it
from `wxt.config.ts`. For local Chrome testing, load exactly:

```text
Elements/.output/chrome-mv3
```

Do not select the repository root. Firefox and Safari use the matching
`.output/firefox-mv3` and `.output/safari-mv3` folders.

## Release archives

Generate production ZIP archives for every target with:

```sh
npm run release:archives
```

WXT writes the archives to `.output/`. The SVG and PNG branding sources can be
regenerated on macOS with `npm run icons`.

## Documentation

- [Privacy policy](PRIVACY.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [UX/UI and motion audit](docs/UX_UI_AUDIT.md) (Russian)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

MIT © 2026 Nikita Melnychenko (QenTerra).
