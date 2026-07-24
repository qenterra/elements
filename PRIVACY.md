# Privacy Policy

**Elements** is developed by [Nikita Melnychenko (QenTerra)](https://github.com/QenTerra).

**Effective date:** 2026-07-24

This policy describes how Elements handles information when it is installed in
Chrome, Firefox, Safari, or another compatible browser. Elements has no
developer-operated server, analytics service, advertising network, or remote
code endpoint.

## Information handled

Elements handles only the information needed for its user-requested features:

- the hostname of a website where the user creates a rule;
- the CSS selector and action for that rule (hide, text edit, rounded
  corners, blur, dim, grayscale, or custom CSS);
- replacement text entered by the user for a text-edit rule, and the CSS
  declarations entered by the user for a custom-CSS rule;
- whether the user has paused rule enforcement on a given site;
- extension settings — theme, default remember behavior, default corner
  radius, advanced mode — and the user's backup data when export or import
  is used.

When the user starts a text edit, Elements reads the selected element's
current text in memory to support preview, undo, and restoring the original
appearance. That original text is not written to persistent storage.

Elements does not intentionally collect browsing history, full page contents,
cookies, passwords, form submissions, account information, personal
communications, or payment information. It does not use analytics identifiers,
advertising identifiers, or tracking pixels.

## Where information is stored

Rules and settings are stored in the browser's extension storage. Elements uses
`storage.sync` when the data fits the browser's sync limits, and falls back to
`storage.local` for larger data or when sync is unavailable. The browser may
process synced data through its own account and synchronization service; the
developer does not receive a copy of that data.

When the user exports a backup, Elements creates a JSON file locally and does
not upload it. Import reads only the file selected by the user and stores the
validated settings in extension storage. A local rollback snapshot is retained
until the next import undo or replacement. It is not uploaded by Elements.

In private or incognito windows, new rules and setting changes are temporary
for that session and are not written to extension storage by Elements.

## How information is used

Stored rules are used to reapply the visual changes requested by the user on
the matching website. Settings are used to operate the picker and Options
page. Elements does not sell information, use it for advertising, or share it
with the developer or other third parties. The browser's own sync provider may
process data that the user chooses to synchronize, as described above.

## Retention and deletion

The user can delete a website's saved rules from the Options page. The
corresponding local and synced entries are removed by the extension. Exported
JSON files are controlled by the user and must be deleted manually. Browser
uninstallation and storage cleanup behavior can vary by browser.

## Permissions

Elements requests `storage` to save rules and settings, `scripting` to inject
its content script into an already-open compatible tab when needed, and
`*://*/*` host access so that user-saved rules can be applied on any HTTP or
HTTPS website selected by the user. The extension does not use these
permissions to transmit page data to the developer.

## Changes to this policy

If Elements' data practices change, this policy will be updated before the
change is released. The effective date at the top will identify the current
version.

## Contact

For privacy questions, use the support contact published with the Elements
listing or the contact channel provided by [QenTerra](https://github.com/QenTerra).

## Related documents

- [Terms of Use](TERMS_OF_USE.md)
- [Security Policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
