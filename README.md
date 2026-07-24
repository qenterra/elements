<p align="center">
  <img src="public/icons/icon_128.png" width="96" height="96" alt="Elements logo">
</p>

<h1 align="center">Elements</h1>

<p align="center">
  A local-first browser extension for hiding elements, editing visible text, and restyling any page.
</p>

<p align="center">
  <a href="https://github.com/QenTerra/elements/releases">Releases</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="TERMS_OF_USE.md">Terms</a> ·
  <a href="LICENSE">MIT License</a>
</p>

Elements is a cross-browser Manifest V3 extension for making precise, per-site
changes to webpages. Hide distracting elements, edit visible text, round
corners, blur, dim, or restyle blocks.
Changes can be kept per site and synchronized across devices when browser
storage allows it. Elements has no analytics, advertising, remote code, or
developer-operated backend.

## Highlights

- Activate the picker from the toolbar or `Ctrl/Cmd+Shift+X`.
- Hover and select elements; `Q`/`W` move through their ancestor chain; a mini
  toolbar next to the selection puts every action one click away.
- Hide (`Space` or click), edit text transactionally (`E`), round corners (`C`), or
  blur / dim / desaturate from the overflow menu.
- Full undo/redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`) with status feedback for
  every action.
- Light, dark, and system themes across the picker and Options.
- Edit a rule's CSS selector in a popover with live match counts; adjust the
  corner radius per rule; advanced mode adds sanitized custom CSS.
- Pause rules per site without deleting them; the toolbar badge shows how many
  rules are active.
- Options: expandable per-site rule lists, search, undoable deletes, and
  import with a detailed Merge/Replace review and rollback.
- Export and import versioned JSON backups; legacy v1 backups migrate on import.
- Adaptive picker layout: corner dock on desktop, bottom sheet on narrow
  viewports, and touch-sized controls.
- Private windows keep edits temporary and never write their rules or settings.
- Respect `prefers-reduced-motion` across picker and Options interactions.

## Release downloads

Each GitHub release contains a separate build for every supported browser:

| Archive                      | Target                       | Usage                                                                    |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `elements-1.2.0-chrome.zip`  | Chrome and Chromium browsers | Unzip and load as an unpacked extension                                  |
| `elements-1.2.0-firefox.zip` | Firefox                      | Load temporarily for development or submit for Mozilla signing           |
| `elements-1.2.0-safari.zip`  | Safari                       | Use as the WebExtension input for Safari conversion and signing in Xcode |

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

| Permission       | Why                                                            |
| ---------------- | -------------------------------------------------------------- |
| `storage`        | Save remembered edits and extension settings                   |
| `scripting`      | Inject into compatible tabs that were open before installation |
| `*://*/*` (host) | Reapply user-created rules on matching websites                |

Elements does not use these permissions to transmit page data to the developer.
See [PRIVACY.md](PRIVACY.md) for the complete data-handling policy.

## Architecture

The project is built with WXT, Vite, TypeScript, and React. The background
service worker is the sole owner of persistent writes and exposes a versioned,
runtime-validated protocol. React owns Options and is loaded into the Shadow
DOM picker only when the user activates it.

```text
entrypoints/
  background.ts          MV3 service worker
  content.ts             content-script entrypoint
  options.html           Options document and visual design
  options/main.tsx       React Options application
  onboarding.html        first-run welcome page
  onboarding/main.tsx    React onboarding application
src/
  components/            shared UI components and brand mark
  core/                  storage, data contracts, theme resolution
  content/               selector engine, page controller, React overlay
  theme/                 design tokens shared by every surface
```

The content controller delegates page changes to a rule engine. Visual rules
are compiled into one isolated stylesheet; text rules use reversible wrappers
that retain the original DOM nodes and their event listeners. A mutation
observer exists only while active text rules need it. The repository serializes
reads and writes, migrates legacy rules to stable IDs, and routes oversized or
failed sync writes to authoritative local storage.

## Development

```sh
npm install
npm run dev
npm run validate
npm run build
```

End-to-end tests drive a built Chrome extension with Playwright:

```sh
npm run build:chrome
npx playwright install --no-shell chromium   # once
npm run test:e2e
```

Store screenshots regenerate with `npm run screenshots` (same
prerequisites as the e2e suite).

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

WXT writes the archives to `.output/`. SVG branding sources live in
`scripts/icons`; `npm run icons` renders them to `public/icons` on any
platform (Node + resvg). Tagged pushes (`v*`) build and attach the archives
to a draft GitHub release automatically.

## Documentation

- [Privacy policy](PRIVACY.md)
- [Terms of use](TERMS_OF_USE.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Author

[Nikita Melnychenko (QenTerra)](https://github.com/QenTerra)

## License

[MIT License](LICENSE) © 2026 Nikita Melnychenko (QenTerra).
