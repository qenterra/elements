# Development

## Verify the repository

Requirements are Node.js 22, npm, Python 3.11 or later, and Chrome or compatible
Chromium support for manual review.

```sh
git clone https://github.com/QenTerra/elements.git
cd elements
node scripts/verify-repository.mjs
```

The verifier installs dependencies, browsers, generated builds, reports, and
release staging in a unique operating-system temporary directory outside the
repository. Preserve that external workspace for an intentional interactive
session with:

```sh
ELEMENTS_KEEP_VERIFY_WORKSPACE=1 node scripts/verify-repository.mjs
```

Public contributions must not add caches, build output, personal data, AI or
agent files, prompts, skills, private plans, or tool state, even when ignored.

Read the canonical
[development guide](https://github.com/QenTerra/elements/blob/main/docs/DEVELOPMENT.md),
[testing guide](https://github.com/QenTerra/elements/blob/main/docs/TESTING.md),
and [contribution policy](https://github.com/QenTerra/elements/blob/main/CONTRIBUTING.md).
