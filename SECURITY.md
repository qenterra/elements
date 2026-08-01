# Security Policy

## Supported versions

Security fixes are provided for the latest released version of Elements.

| Version          | Supported |
| ---------------- | --------- |
| 1.0.x            | Yes       |
| Earlier versions | No        |

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Use
[GitHub private vulnerability reporting](https://github.com/QenTerra/elements/security/advisories/new).

Include, when available:

- the affected Elements, Chrome, and operating-system versions;
- reproduction steps and expected impact;
- whether the issue concerns host access, scripting, storage, custom CSS,
  import/export, the background protocol, or the product site;
- a minimal synthetic page or rule export.

Remove cookies, credentials, account details, private page contents, browsing
history, personal paths, and unrelated extension data.

Reports will be assessed privately before coordinated disclosure when feasible.
Elements does not currently operate a bug-bounty program.

## Security boundaries

Elements:

- uses Manifest V3 and does not load remote executable extension code;
- injects into compatible HTTP and HTTPS pages only for user-requested picker
  activation and saved-rule application;
- routes persistent writes through a versioned, runtime-validated background
  protocol;
- sanitizes custom CSS before storage and application;
- validates imported backups before applying them and retains a local rollback
  snapshot;
- keeps private-window changes temporary;
- has no developer-operated backend, analytics, advertising, or tracking code.

Broad host access lets saved rules work on sites selected by the user. It does
not make page content trustworthy or grant permission to bypass site controls.

## Dependency vulnerabilities

Report an Elements impact privately even when the root cause is React, WXT, a
browser API, a development tool, or the GitHub Pages runtime. A fix may require
an upstream update, integration change, mitigation, or documentation change.

See [Dependencies](docs/DEPENDENCIES.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md).
