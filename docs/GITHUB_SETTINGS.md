# GitHub settings and verification

## Expected and verified settings

- Repository: `https://github.com/QenTerra/elements`; visibility: public;
  default branch: `main`.
- Homepage: `https://qenterra.github.io/elements/`.
- Issues and Wiki enabled; Projects and Discussions disabled.
- Squash merge enabled; merge commits and rebase merge disabled; merged head
  branches deleted automatically.
- Active ruleset `Protect main` (`21773615`) rejects branch deletion and
  non-fast-forward updates and requires linear history on the default branch.
- Default workflow permissions are read-only and workflows cannot approve pull
  requests. Individual release and Pages workflows declare their narrower
  required permissions.
- Dependabot alerts and security updates, secret scanning, push protection, and
  private vulnerability reporting are enabled.

## Verification record

| Checked at           | Evidence source           | Reviewer                         | Result                                                                                                                       | Remaining boundary                                                                                  |
| -------------------- | ------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 2026-08-29T00:31:47Z | GitHub REST API read-back | Nikita Melnychenko (`@qenterra`) | Metadata, features, merge settings, workflow defaults, security features, private reporting, and ruleset `21773615` verified | Code scanning and release immutability remain release-specific checks when those surfaces are used. |

Recheck after a visibility, ownership, plan, default-branch, workflow, release,
Pages, Wiki, or feature change. Repository files express intent; only live
provider read-back proves current settings.
