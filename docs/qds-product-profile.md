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

`src/qds/adapter/shadow-dom.ts` scopes the generated QDS CSS to the picker host. `shadow-dom.css` maps legacy picker variable names to QDS semantic roles without raw color values.

## Replaced legacy behavior

The picker no longer mounts the hand-authored `src/theme/tokens.css`; it mounts the pinned QDS document plus its Shadow DOM adapter.

## Product-specific components

The element highlighter, selector breadcrumb, edit-history controls, and picker dock remain Elements-specific. They consume the adapter variables rather than copy foundation values.

## Exceptions

The doctor audits `src`, `entrypoints`, and `site`. Five narrow `raw-color` exceptions record the canonical generated QDS snapshot plus legacy options/onboarding tokens, toolbar badges, host-page highlighter, and public-site styles. Each exception names its exact path and a migration trigger; none masks a whole root.

## Migration order

1. Establish the isolated picker adapter and product-wide audit boundary.
2. Migrate picker component geometry and states.
3. Migrate options/onboarding and remove their legacy stylesheet exception.
4. Migrate badge/highlighter integrations and the public site, removing each path exception as its consumer adopts QDS.

## Verification matrix

Automated: QDS doctor, typecheck, lint, formatting, unit tests, and production build. Rendered: Chrome extension E2E and narrow-view screenshots remain required for picker geometry. Live: keyboard, screen-reader, persistence, and host-page isolation checks remain manual acceptance work.
