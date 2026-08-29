# GitHub settings and verification

## Expected and verified settings

- Repository: `https://github.com/QenTerra/elements`; visibility: public;
  default branch: `main`.
- Homepage: `https://qenterra.github.io/elements/`.
- Issues and Wiki enabled; Projects and Discussions disabled.
- Squash merge enabled; merge commits and rebase merge disabled; merged head
  branches deleted automatically.
- Active ruleset `Protect main` (`21773615`) requires pull requests, the
  `repository-governance` and `verify` checks, conversation resolution, and
  linear history while rejecting branch deletion and non-fast-forward updates.
- Active ruleset `Protect release tags` (`21775841`) rejects deletion and
  replacement of tags matching `v*`; neither ruleset has a bypass actor.
- Default workflow permissions are read-only and workflows cannot approve pull
  requests. Individual release and Pages workflows declare their narrower
  required permissions.
- Dependabot alerts and security updates, secret scanning, push protection, and
  private vulnerability reporting are enabled.

## Verification record

| Checked at           | Evidence source           | Reviewer                         | Result                                                                                                                                              | Remaining boundary                                                                        |
| -------------------- | ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2026-08-29T01:24:30Z | GitHub REST API read-back | Nikita Melnychenko (`@qenterra`) | Metadata, features, merge settings, workflow defaults, security features, private reporting, main protection, and release-tag immutability verified | Code scanning and Chrome Web Store publication remain separate product or release checks. |

Recheck after a visibility, ownership, plan, default-branch, workflow, release,
Pages, Wiki, or feature change. Repository files express intent; only live
provider read-back proves current settings.
