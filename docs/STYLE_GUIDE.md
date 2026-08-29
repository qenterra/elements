# Style guide

## Language and product voice

Public code identifiers, repository documentation, issues, pull requests,
commits, and release notes use English. User interface copy is direct, calm,
and specific about actions and consequences. Preserve supported English and
Russian localisation keys together when product copy changes.

## Names and layout

- General directories and modules use lowercase `kebab-case` where the existing
  API does not require another form.
- React component files and exported components use `PascalCase`; hooks begin
  with `use`; TypeScript values and functions use `camelCase`.
- Tests use `<subject>.test.ts`, `<subject>.test.tsx`, or Playwright
  `<subject>.spec.ts` names.
- GitHub community, policy, and legal documents use their canonical uppercase
  root names. Maintained engineering documents in `docs/` use uppercase
  `SNAKE_CASE.md`; Wiki pages use `Title-Case-with-Hyphens.md`.
- New top-level paths require a durable product, documentation, test, or tooling
  responsibility and an update to the repository contract.

## Code

Prettier is the formatter, Oxlint is the linter, TypeScript supplies static type
checks, and Vitest covers unit and integration behavior. Prefer explicit
interfaces, runtime validation at message and import boundaries, small modules,
and comments that explain invariants or browser constraints rather than syntax.

## Interface and accessibility

Keyboard access, focus ownership, semantic names, contrast, zoom, narrow
viewports, reduced motion, light/dark/system themes, and localization are
product requirements. Visible changes include before-and-after evidence and
retain the picker boundary from arbitrary page styles.

## Documentation

Use descriptive headings, portable Markdown, runnable commands, meaningful link
text, and accurate alternative text. State automated, live-provider, and manual
evidence separately. Do not publish placeholders, private planning prose, raw
tool history, or generated filler.
