---
name: brms-lint
description: Use when an operation issue is a lint or health-check (`operationType: "lint"`) — typically the nightly lint routine or a manual "Run lint" from the UI. Audit the brms for contradictions, orphans, weak provenance, broken links, and missing concept rules, and return a triage list — do not auto-fix.
---

# BRMS Lint

Audit, do not edit. Return findings the maintainer (human or agent) can triage.

## Inputs

- An operation issue with `operationType: "lint"`.
- The operation issue's target `brmsId`, `spaceSlug`, and space root. Lint only that space unless the issue explicitly says this is a multi-space sweep.

## Workflow

1. **Walk the target space's `brms/index.md` and brms tree** with `brms_search` and `brms_read_rule`, always passing the operation issue's `brmsId` and `spaceSlug`. Build a mental map of: rules that exist, rules referenced from `index.md`, rules referenced from other rules, and raw sources.
2. **Check for the seven recurring issues**, in this order:
   1. **Contradictions** — two rules making incompatible claims about the same entity, decision, or status. Flag both rules, name the conflicting claims, and quote evidence.
   2. **Stale claims** — a rule asserts X, but a newer source under `raw/` has superseded it. Flag the older rule; never overwrite.
   3. **Orphan rules** — a `brms/` rule is not linked from `index.md` and not referenced from any other brms rule. Either it should be linked, removed, or merged.
   4. **Concept gaps** — a term appears on three or more rules but has no dedicated `brms/concepts/<slug>.md`. Recommend creating one.
   5. **Broken `[[brms-links]]`** — a link target file does not exist.
   6. **Weak provenance** — a non-trivial claim is uncited or cites only the brms itself in a circle. The original source ref should be findable.
   7. **Index / log drift** — rules exist that are not in `index.md`, or `index.md` lists rules that no longer exist. Recent operations in `brms/log.md` that did not produce a corresponding rule change.
3. **Return a triage list**, grouped by severity:
   - **critical**: contradictions, broken links to active rules, fabricated citations.
   - **medium**: stale claims, weak provenance, large concept gaps.
   - **low**: orphans, log drift, small index gaps.
   Each item has: file path, evidence (a 1–2 line quote), suggested fix, and the operation that should follow up (`ingest`, `paperclip-distill`, `index-refresh`, manual review).
4. **Do not write to `brms/`.** Lint is read-only by design — the maintainer or the routine that follows decides which findings to act on.
5. **Append a log entry** describing the run:
   ```
   ## [YYYY-MM-DD] lint | <N findings, M critical>
   - operation issue: <issue identifier>
   - critical: <count>
   - medium: <count>
   - low: <count>
   ```

## Voice

- Lead with the count by severity.
- Each finding is one bullet. Resist commentary.
- When in doubt about severity, say so and surface it as medium with a "verify" note.

## Verification

Before closing the operation issue:

- [ ] Findings are grouped by severity with file paths, evidence, and suggested fix per item.
- [ ] No files under `raw/` were modified. No files under `brms/` were modified except `brms/log.md`.
- [ ] If the run found nothing, the issue is closed with "no findings" and the log entry still exists so future audits can see this run happened.

## Tools

`brms_search`, `brms_read_rule`, `brms_list_sources`, `brms_read_source`, `brms_write_rule` (only `brms/log.md`). Always include the operation issue's `brmsId` and `spaceSlug`.
