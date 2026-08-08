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

None in the declared QDS adapter root. Product migration outside that root is intentionally deferred and must be declared before it joins the doctor audit.

## Migration order

1. Establish the isolated picker adapter and audit boundary.
2. Migrate picker component geometry and states.
3. Declare and migrate options/onboarding surfaces.
4. Remove remaining legacy token sources only after their consumers are covered.

## Verification matrix

Automated: QDS doctor, typecheck, lint, formatting, unit tests, and production build. Rendered: Chrome extension E2E and narrow-view screenshots remain required for picker geometry. Live: keyboard, screen-reader, persistence, and host-page isolation checks remain manual acceptance work.
