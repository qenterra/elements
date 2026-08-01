# Dependencies

This document separates code included in the extension from development tools
and the public product-site runtime.

## Version policy

- `package.json` declares direct versions and safe transitive overrides.
- `package-lock.json` records the exact installed dependency graph.
- Runtime and build output are regenerated; `.output/` is not committed.
- Browser APIs are selected by the generated Manifest V3 build.

## Runtime dependencies

| Package     |  Version | Role                               | License |
| ----------- | -------: | ---------------------------------- | ------- |
| `react`     | `19.2.7` | Picker, Options, and onboarding UI | MIT     |
| `react-dom` | `19.2.7` | React DOM runtime                  | MIT     |

Compiled transitive runtime packages and their attribution are listed in
[Third-party notices](../THIRD_PARTY_NOTICES.md). The lockfile remains the exact
source for the complete graph.

## Development and build tools

WXT generates the extension, TypeScript checks types, Oxlint and Prettier check
source style, Vitest runs unit tests, Playwright runs browser and Pages E2E, and
axe-core supports automated accessibility analysis.

Exact installed versions and transitive dependencies are recorded in
`package-lock.json`; license identifiers and sources are documented in
[Third-party notices](../THIRD_PARTY_NOTICES.md).

## Website runtime

The GitHub Pages product site uses pinned GSAP and ScrollTrigger browser scripts
with subresource-integrity hashes. They are not included in extension archives.

## Updating dependencies

1. Review the upstream release, license, and security impact.
2. Update `package.json` and regenerate `package-lock.json` with a clean install.
3. Update [Third-party notices](../THIRD_PARTY_NOTICES.md).
4. Run `npm run audit:all`, `npm run validate`, both production builds and E2E
   suites relevant to the change.
5. Inspect the runtime archive and product site before publishing.
