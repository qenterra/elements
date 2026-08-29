# Updates and distribution

## Version contract

Elements uses Semantic Versioning. `package.json` is the version source; the
corresponding Git tag is `v<version>`, the GitHub Release title is
`Elements <version>`, and the Chrome archive is
`elements-<version>-chrome.zip`. The current version is `1.0.0`. There is no
separate public build number in the current GitHub distribution.

## Install and update

The supported public channel is an unsigned ZIP attached to a GitHub Release.
Users unpack it and load the directory through Chrome or Chromium Developer
mode. Chrome Web Store signing, review, distribution, and automatic store
updates are not currently available. An unpacked GitHub installation does not
poll QenTerra for updates; users must review and install a newer archive
manually.

Before replacing an installed build, export a JSON backup from Options and keep
it outside the repository. Verify the new release tag, archive name, checksum,
permissions, and release notes before loading it.

## Data compatibility and recovery

Elements normalizes legacy persisted rules and accepts validated version 1 and
version 2 backup data. Import supports review and transactional rollback, but a
future release may introduce a migration that an older build cannot interpret.
Downgrade compatibility is therefore not guaranteed; preserve the pre-update
export until the new build and saved rules are accepted.

## Uninstall

Removing the extension and deleting its browser-managed data are conceptually
separate, but Chrome controls their exact lifecycle. Export anything you need
before removal. QenTerra operates no account service or backend copy from which
rules can be recovered.
