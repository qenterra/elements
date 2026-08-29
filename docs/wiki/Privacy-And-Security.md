# Privacy and Security

Elements has no analytics, advertising, remote code, or developer-operated
backend. It does not send saved rules or page contents to QenTerra.

## Permissions

| Permission  | Purpose                                                       |
| ----------- | ------------------------------------------------------------- |
| `storage`   | Save rules and settings in browser-managed extension storage. |
| `scripting` | Start Elements in a compatible tab that is already open.      |
| `*://*/*`   | Reapply user-created rules on matching HTTP and HTTPS pages.  |

Browser sync may process saved data when available. Elements falls back to
local extension storage when data is too large or sync is unavailable.
Private-window changes are temporary.

## Security boundaries

- A versioned runtime-validated protocol separates content scripts from the
  background service worker that owns persistent writes.
- Custom CSS is sanitized before storage or application.
- Imported backups are validated before transactional replacement.
- Extension-owned overlays and styles are isolated from saved page rules.
- The published Manifest V3 build does not load remote code.

Read the repository
[Privacy Policy](https://github.com/QenTerra/elements/blob/main/PRIVACY.md) and
[Security Policy](https://github.com/QenTerra/elements/blob/main/SECURITY.md)
for the complete boundaries and private reporting route.
