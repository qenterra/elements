# Maintenance

Elements is maintained by Nikita Melnychenko (QenTerra).

## Routine cadence

- Every change: run the repository verifier and Git whitespace checks against
  the exact source tree.
- Dependency or workflow update: inspect upstream release notes, licenses,
  pinned action commits, permissions, lockfile changes, and archive contents.
- Release: verify the exact clean commit, version, changelog, Chromium flows,
  archive, checksum, remote tag, release target, and downloadable asset.
- Monthly: review failed workflows, vulnerability and dependency alerts, open
  support requests, flaky tests, stale documentation, and obsolete permissions.
- Quarterly: read back GitHub metadata, features, ruleset, security settings,
  Wiki projection, ownership, contact routes, licensing, and recovery guidance.

## Repository hygiene

The public repository contains maintained product source and human-facing
project material. Caches, dependency trees, builds, reports, temporary files,
personal paths, AI or agent operating files, prompts, transcripts, skills, MCP
configuration, private plans, and tool state belong in unique temporary
directories outside the checkout. The repository audit scans tracked,
untracked, and ignored paths.

## Dependency and documentation lifecycle

`package-lock.json` owns dependency resolution. Keep direct dependency names and
license notices aligned with `THIRD_PARTY_NOTICES.md`. Retest the documented
install, export, import, troubleshooting, and release paths when their code
changes. Review storage, permission, privacy, and compatibility text with every
corresponding product change.

## Current record

| Date       | Scope                              | Evidence                                                                               | Result                                                                                    | Next review                                       |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 2026-08-29 | Repository standard 1.2.0 adoption | Full external verifier, governance audit, GitHub API read-back, and Wiki source review | Passed on the adoption tree; remote branch and Wiki read-back remain publication evidence | Next release or 2026-11-29, whichever comes first |

If active maintenance stops, update the README and repository description with
the final supported version, security boundary, replacement, and archival date.
Transfer, visibility change, archival, deletion, and release publication remain
separately authorised actions.
