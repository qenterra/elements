# Changelog

All notable changes to Elements are documented in this file.

## [1.2.0] — Unreleased

### Added

- Versioned backup v2 with import limits, conflict review, merge/replace
  transactions, automatic rollback, and undo of the last successful import.
- Stable rule IDs and timestamps with automatic migration of legacy data.
- Adaptive picker dock that becomes a safe-area-aware bottom sheet on narrow
  viewports, plus touch-sized controls and explicit incognito behavior.
- Component coverage for focus trapping and unit coverage for storage fallback,
  repository transactions, protocol validation, history, text restoration, and
  the rule engine.
- Oxlint and Prettier checks in the local validation and CI workflow.

### Changed

- The picker now separates hover preview from click-to-lock selection, so moving
  into its controls cannot silently retarget the pending action.
- The background service worker now owns every persistent write behind a typed,
  runtime-validated protocol.
- Storage operations are serialized across sync and local areas; local route
  markers prevent stale sync values from resurrecting deleted or oversized data.
- Text editing now uses an external transactional editor and reversible DOM
  wrappers, preserving original nodes and event listeners.
- Undo/redo stores complete rule snapshots and covers edits, permanence changes,
  custom CSS, deletions, and text replacements.
- React picker UI is loaded only when activated; text mutation observers exist
  only while active text rules require them.
- Options import now provides a detailed review, atomic deletion uses restorable
  site snapshots, and theme initialization no longer flashes the wrong theme.
- Privacy copy now explicitly describes browser-managed sync and temporary
  incognito behavior.

### Fixed

- The first page click after locking a target now clears the selection instead
  of immediately locking the clicked element; a fresh hover and click are
  required before another action can run.
- Minimized picker branding and onboarding step numbers now stay vertically
  centered at narrow widths and high zoom.
- Overflow menus, history actions, breadcrumbs, text editors, and selector
  popovers now remain visible and usable at narrow widths and viewport edges.
- Undo and delete snapshots are dispatched to the background immediately, so a
  quick tab close cannot leave an older persisted rule behind.
- Theme changes no longer animate through an inaccessible low-contrast midpoint.
- Concurrent repository operations can no longer lose metadata or resurrect a
  rule deleted by another operation.
- Public hostnames no longer split saved rules by port; localhost and IP
  development origins still remain isolated by port.
- Extension-owned overlays, styles, and iframe shields use namespaced ownership
  and deterministic cleanup.

## [1.1.0] — 2026-07-20

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
[1.1.0]: https://github.com/QenTerra/elements/releases/tag/v1.1
