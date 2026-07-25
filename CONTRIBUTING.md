# Contributing

Elements accepts focused bug fixes, accessibility improvements, tests, and
documentation corrections.

## Before opening an issue

- Search existing issues and releases.
- Confirm the problem with the latest release or current `master`.
- Record the browser name and version, operating system, page URL when it can
  be shared, and exact reproduction steps.
- Use GitHub's private vulnerability reporting for security issues. Do not put
  exploit details in a public issue.

## Local setup

Use Node.js 22 and npm:

```sh
npm ci
npm run validate
npm run build:chrome
npm run test:e2e
```

The end-to-end suite opens a headed Chromium instance because extension service
workers are unreliable in headless mode. Linux CI supplies the display through
Xvfb.

## Pull requests

- Keep one change per pull request.
- Add or update tests for behavior changes.
- Run `npm run validate` before submitting.
- Run the relevant production builds and `npm run verify:build` when manifests,
  entrypoints, build scripts, or dependencies change.
- Include before and after screenshots for visible UI changes.
- Update user-facing documentation when behavior, permissions, storage, or
  installation steps change.

Commit subjects use the Conventional Commits form, for example:

```text
fix(picker): keep the locked target while opening actions
docs(readme): clarify Firefox installation
```

Use the imperative mood, keep the subject specific, and omit generated
signatures or tool attribution.

## Formatting

Run `npm run format` only for files in your change, then review the resulting
diff. The validation command checks TypeScript, Oxlint, Prettier, and Vitest.

## License

By contributing, you agree that your contribution is available under the
project's [MIT License](LICENSE).
