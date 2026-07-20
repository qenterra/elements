# Changelog

All notable changes to Elements are documented in this file.

## [1.1.0] — Unreleased

### Added

- Light, dark, and system themes driven by a single design-token layer shared
  by the picker and the Options page, with a theme switcher in both.
- Visible action toolbar in the picker and a mini toolbar next to the selected
  element, so every action works with the mouse alone.
- New actions: blur, dim, grayscale, adjustable corner radius, and a
  sanitized custom-CSS action behind the new Advanced mode.
- Draggable picker panel with corner snapping.
- Selector editing popover with live match counts, replacing `prompt()`.
- Redo (Ctrl/Cmd+Shift+Z) and an action-based undo stack that also covers
  deletions.
- Status toasts with Undo for every picker action, plus a floating hint and
  outline while editing text in place.
- First-run coachmark and an onboarding page shown after installation.
- Per-site pause (picker footer and Options) and a toolbar badge showing the
  number of active rules.
- Options: expandable per-site rule lists, site search, a Settings card
  (theme, remember default, corner radius, advanced mode, shortcut), undoable
  deletes, import review with Merge/Replace and an automatic undo snapshot,
  and busy states for import/export.
- Russian localization.
- A selected-element brand mark with editable text rows and a matching flat
  toolbar icon set, refreshed further later in this release with two-tone
  text rows, a gradient plate at 128 px, and a dedicated 16 px cut with two
  thicker rows for toolbar legibility.
- Terms of Use and direct links to the project's legal and third-party
  documents from the Options page.
- Playwright end-to-end suite, release and GitHub Pages workflows, store
  listing drafts, and a landing page.

### Fixed

- Background message responses (saved rules, settings, hotkey) never reached
  content scripts in Chromium because the listener returned a Promise, which
  native Chrome ignores; remembered rules now re-apply after reload.

### Changed

- Icon rendering moved from a macOS-only Swift script to a cross-platform
  Node/resvg pipeline.
- Responsive picker spacing, bounded breadcrumbs, and readable long selectors;
  terminal breadcrumb focus and fixed edit-list columns keep action buttons
  in view.
- Leaner production bundles: removed unused SVG source assets and an orphaned
  export message handler.

## [1.0.0] — 2026-07-15

### Added

- Cross-browser Manifest V3 builds for Chrome, Firefox, and Safari.
- Element picker with keyboard navigation and accessible controls.
- Hide, text-edit, and corner-rounding actions with undo and preview.
- Per-site persistence using synchronized storage with a local fallback.
- Import and export of all settings as a JSON backup.
- Options page with site management, sorting, and responsive layout.
- Dedicated active, inactive, and unavailable toolbar icons.

### Polished

- Interruptible popup minimize/expand morph and coordinated content crossfade.
- Smooth switches, selection overlay transitions, and card hover motion.
- Reduced-motion and touch-specific behavior across decorative interactions.
- New Elements brand mark and complete 16/32/48/128 px icon set.

### Privacy

- No analytics, ads, remote code, or developer-operated backend.
- Saved rules remain in browser-managed extension storage.

[1.0.0]: https://github.com/QenTerra/elements/releases/tag/v1.0.0
