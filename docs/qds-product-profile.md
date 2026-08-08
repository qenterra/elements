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

The doctor audits `src`, `entrypoints`, and `site`. Four narrow `raw-color` exceptions record the canonical generated QDS snapshot, toolbar badges, host-page highlighter, and public-site styles. Each exception names its exact path and a migration trigger; none masks a whole root.

## Migration order

1. Establish the isolated picker adapter and product-wide audit boundary.
2. Migrate shared document theme and primitives.
3. Migrate picker component geometry and states.
4. Migrate options/onboarding composition, badge/highlighter integrations, and the public site, removing each remaining exception as its consumer adopts QDS.

## Verification matrix

Automated: QDS doctor, typecheck, lint, formatting, unit tests, and production build. Rendered: Chrome extension E2E and narrow-view screenshots remain required for picker geometry. Live: keyboard, screen-reader, persistence, and host-page isolation checks remain manual acceptance work.
