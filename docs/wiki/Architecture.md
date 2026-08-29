# Architecture

Elements keeps its page entrypoint small and loads the React picker only after
activation. A background service worker owns persistent writes. Page changes
are represented as reversible rules rather than destructive source edits.

## Components

| Component          | Responsibility                                                         | Boundary                                                                  |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Background worker  | Browser integration, validated requests, and persistent writes         | Receives the versioned extension protocol; owns browser storage mutations |
| Content entrypoint | Starts the page controller and lazy picker                             | Runs only on compatible HTTP and HTTPS pages                              |
| Picker and Options | Selection, actions, history, settings, import, and export              | Isolated extension UI with keyboard and accessibility behavior            |
| Rule engine        | Selector matching, visual CSS, reversible text changes, undo, and redo | Does not transmit page content or bypass site access controls             |
| Hybrid storage     | Sync-first storage with local fallback and safe deletion               | Browser-managed storage; no QenTerra backend                              |
| Product site       | Static documentation and product demonstration                         | Deployed separately through GitHub Pages                                  |

Custom CSS and imported backups are validated before persistent use. The full
runtime flow, persistence rules, and trust boundaries live in the maintained
[architecture document](https://github.com/QenTerra/elements/blob/main/docs/ARCHITECTURE.md).
