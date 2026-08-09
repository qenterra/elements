# Product profile: Elements

## Product promise

Let people hide, edit, and restyle visible page elements while keeping every rule local to browser-managed storage.

## Primary tasks and risks

The picker must remain readable above arbitrary host pages, make selection state obvious, and preserve keyboard recovery. Its UI must never inherit page CSS or leak QDS selectors into the page.

## Platforms and density

Chrome/Chromium Manifest V3 browser extension. The Shadow DOM picker uses the compact density profile, with a responsive bottom sheet for narrow viewports.

## Inherited family core

The picker consumes pinned QDS semantic color, spacing, radius, typography, motion, and focus roles through the local CSS token adapter.

## Adapted components and patterns

`src/qds/adapter/shadow-dom.ts` scopes the generated QDS CSS to the picker host. `document.css` maps the same semantic roles for options and onboarding, while `primitives.css` provides shared button, row, status, radio, dialog, tooltip, and keycap contracts across both surfaces.

## Replaced legacy behavior

The picker and document pages no longer mount the hand-authored `src/theme/tokens.css`; they mount the pinned QDS output with platform-specific semantic adapters.

## Product-specific components

The element highlighter, selector breadcrumb, edit-history controls, and picker dock remain Elements-specific. They consume the adapter variables rather than copy foundation values.

## Exceptions

The doctor audits `src`, `entrypoints`, and `site`. The upstream-compatible [`qds-exceptions.json`](../qds-exceptions.json) remains the path-level doctor registry. Elements additionally runs [`qds-metric-exceptions.json`](../qds-metric-exceptions.json), whose entries require an exact path, property, value, reason, and migration trigger. Canonical generated snapshots must also match their pinned SHA-256, so a comment cannot launder drift as compliance.

- `qds-generated-css-snapshot` — `src/qds/qds-tokens.css`
- `legacy-toolbar-badge-colors` — `entrypoints/background.ts`
- `legacy-host-highlighter-colors` — `src/content/controller.ts`
- `product-illustration-colors` — `site/product-illustration.css`
- `qds-web-token-bridge` — `site/qds-web.css`

The local gate rejects raw `rgb`/`rgba`, duration, radius, spacing, typography, width/height/min/max, layout-column, stroke/outline, and positioned-inset metrics in CSS blocks and inline HTML declarations. It also validates both exception registries as strict schemas: unknown rules or fields, empty data, duplicate signatures, stale entries, escaping/missing paths, and canonical SHA drift fail the gate.

Non-canonical exceptions remain exact rather than file-wide. They cover Chrome badge colors, host-document targeting colors that cannot resolve Shadow DOM CSS variables, four authored product-illustration colors, and 21 product geometry signatures for CSS glyphs, screenshot/demo aspect constraints, responsive overlay height caps, compact range widths, and the public-site canvas/browser floor. Each geometry entry names one path, property, and value and carries its own removal trigger.

## Migration order

1. Establish the isolated picker adapter and product-wide audit boundary.
2. Migrate shared document theme and primitives.
3. Migrate picker component geometry and states.
4. Migrate options/onboarding composition, badge/highlighter integrations, and the public site, removing each remaining exception as its consumer adopts QDS.

## Verification matrix

Automated: enhanced QDS gate plus upstream doctor, token-bridge integrity, typecheck, lint, formatting, unit tests, production build, rendered Chromium E2E, and deterministic screenshots. Manual platform acceptance remains separate for installed system Chrome, VoiceOver, native Increased Contrast, and browser-UI zoom.
