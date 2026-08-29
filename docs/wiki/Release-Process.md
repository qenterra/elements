# Release Process

Elements uses Semantic Versioning from `package.json`, `v<version>` tags, dated
changelog entries, and unsigned Chrome release archives. The current public
release is 1.0.0.

Before a release, the maintainer verifies the exact clean revision with
`node scripts/verify-repository.mjs`, completes the named manual browser checks,
and reviews dependencies, permissions, privacy, notices, version links, and
known limitations. The release workflow rebuilds and tests the archive from the
tagged revision; the remote tag, release target, asset checksum, notes, and
download are then read back.

Read the canonical
[release guide](https://github.com/QenTerra/elements/blob/main/docs/RELEASING.md)
and [changelog](https://github.com/QenTerra/elements/blob/main/CHANGELOG.md).
This Wiki page does not authorise tagging, publishing, deploying, or replacing
release assets.
