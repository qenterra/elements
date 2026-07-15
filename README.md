# Elements

Elements is a cross-browser MV3 extension for cleaning up web pages by hand:
hide an element, edit its text, or round its corners. Changes can be kept per
site and synchronized across devices when browser storage allows it.

## Features

- Activate the picker from the toolbar or `Ctrl/Cmd+Shift+X`.
- Hover and select elements; `Q`/`W` move through their ancestor chain.
- Hide an element with a click or `Space`.
- Edit visible text with `E`; `Enter` saves and `Escape` cancels.
- Round corners with `C` and undo the latest change with `Ctrl/Cmd+Z`.
- Preview an edit, change its CSS selector, and control whether it is remembered.
- Temporarily compare the page with its original appearance.
- Export and import all settings as one JSON backup.
- Respect `prefers-reduced-motion` for the picker and Options animations.

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
  core/                  storage and data contracts
  content/               selector engine, page controller, React overlay
```

The content controller keeps hide/round rules in one style sheet and applies
text edits directly. A mutation observer re-applies text edits after SPA
navigation replaces page nodes. Stored data remains compatible with the v1
JSON shape, including implicit hide actions.

## Development

```sh
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

The source root intentionally has no runtime `manifest.json`: WXT generates it
from `wxt.config.ts`. In Chrome, open `chrome://extensions`, enable Developer
mode, choose **Load unpacked**, and select exactly:

```text
Elements/.output/chrome-mv3
```

Do not select the repository root. Firefox and Safari use the matching
`.output/firefox-mv3` and `.output/safari-mv3` folders.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Remembered edits and settings |
| `scripting` | Fallback injection for tabs opened before installation |
| `*://*/*` (host) | Re-apply remembered edits on matching sites |

## License

MIT — see [LICENSE](LICENSE). Notices for npm dependencies are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Privacy

See [PRIVACY.md](PRIVACY.md) for the extension's data handling and deletion
practices.
