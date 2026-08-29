# Troubleshooting

## Elements does not start on this page

Chrome blocks extensions on browser-internal pages, the Chrome Web Store, and
some protected surfaces. Open a normal HTTP or HTTPS page and try again.

## A saved rule does not reapply

1. Confirm Elements is not paused for the site.
2. Check whether the page URL still matches the saved site.
3. Open Options and confirm the rule still exists and is enabled.
4. If the site's DOM changed, select the element again and replace the old
   rule.

## A custom CSS rule is rejected

Elements sanitizes custom CSS before storing or applying it. Remove unsafe or
unsupported constructs instead of weakening the sanitizer.

## An imported backup fails

Use a JSON export created by Elements and keep its schema intact. Invalid
imports are rejected before replacing current rules. Preserve the original
export until the import succeeds.

## Build or validation fails

Use Node.js 22 and run:

```sh
node scripts/verify-repository.mjs
```

The verifier prints the failed command and keeps all generated working state
outside the repository. For deeper details, read the maintained
[troubleshooting guide](https://github.com/QenTerra/elements/blob/main/docs/TROUBLESHOOTING.md).

## Reporting a problem

Use synthetic page content and remove private URLs, rules, backups, and browsing
details. Report suspected vulnerabilities through GitHub private vulnerability
reporting, never a public issue.
