# Troubleshooting

Start with the canonical checks:

```sh
node scripts/verify-repository.mjs
```

## The extension does not load

Run the verifier with `ELEMENTS_KEEP_VERIFY_WORKSPACE=1`, then load
`.output/chrome-mv3` from the printed external `workspace` path rather than the
repository root. WXT generates the manifest and runtime files; there is
intentionally no root `manifest.json`.

Rebuild after changing `package.json`, `wxt.config.ts`, entrypoints, permissions,
icons, or localization files.

## The picker does not open

Confirm that the active tab uses an HTTP or HTTPS URL supported by Chrome
extensions. Browser-internal pages, extension pages, and restricted store pages
can reject scripting access.

Reload both the unpacked extension and the target page after a new build.

## Saved rules do not sync

Browser sync has quota and account requirements. Elements falls back to local
extension storage when synchronized storage is unavailable or too small. Export
a JSON backup before clearing browser data.

## A rule stopped matching

Websites can change their DOM. Open the picker, select the element again, and
review the selector before replacing the old rule. Elements does not bypass a
site's access controls or guarantee selectors across redesigns.

## End-to-end tests cannot find the extension

The complete verifier installs its Playwright Chromium build outside the
repository. On Linux, extension E2E runs in headed Chromium through Xvfb. A
headless shell without extension support is not a valid smoke test.

## Reporting a problem

Follow [CONTRIBUTING.md](../CONTRIBUTING.md) and remove private page content,
account details, exported rules, and personal paths from evidence. Report
vulnerabilities privately through [SECURITY.md](../SECURITY.md).
