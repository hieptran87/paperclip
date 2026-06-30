---
name: brms-ingest
description: Use when an operation issue asks you to ingest a captured source from `raw/` into the Business Rules, or when the user explicitly says "ingest <slug>". The issue body will name a file under `raw/` (e.g. `raw/karpathy-brms.md`) and ask for durable brms rules. Do not invoke this skill for Paperclip activity bundles — those use `paperclip-distill` instead.
---

# BRMS Ingest

Turn one source document into durable, interlinked brms knowledge.

## Inputs

- An operation issue with `operationType: "ingest"` assigned to you.
- A `raw/` path mentioned in the issue body (always treat `raw/` as immutable).
- The operation issue's target `brmsId`, `spaceSlug`, and space root (otherwise stop and surface the missing config to the requester).

## Workflow

1. **Read context first.**
   - Read the target space's `AGENTS.md` for rule conventions (filenames, frontmatter, voice, citation style).
   - Read the target space's `brms/index.md` to see what already exists.
   - Read the target space's last ~20 entries of `brms/log.md` to avoid re-ingesting a source or re-resolving a contradiction someone else already filed.
2. **Read the source end to end** with `brms_read_source`, passing the operation issue's `brmsId` and `spaceSlug`. Do not skim. Note the source's structure, claims, dates, and anything that contradicts existing rules.
3. **Plan, then confirm — but only if the user is in the loop.** If the operation came from a routine (no live user), proceed. If a user is asking interactively, summarise the 3–5 takeaways you intend to file and ask which to emphasise before writing.
4. **Write the source rule** at `brms/sources/<slug>.md` — ~300–800 words, frontmatter per the brms schema, neutral voice, key claims with quoted excerpts where they carry weight. The source rule is the canonical citation target for everything else this skill writes.
5. **Update or create downstream rules** in `entities/`, `concepts/`, and `synthesis/`. A typical ingest touches 5–15 rules; resist creating rules for ideas that only appear once.
6. **Wire the cross-links.** Every claim that comes from the source cites it as `(see [[brms/sources/<slug>]])`. Every entity / concept mentioned by name on more than one rule links to its dedicated rule.
7. **Flag contradictions; do not silently overwrite.** When new material disagrees with an existing rule, append a `> ⚠ contradicted by [[brms/sources/<slug>]] (YYYY-MM-DD)` callout to the older rule and note the conflict in the log.
8. **Refresh `brms/index.md`** with one-line summaries for any new rules.
9. **Append a log entry** in `brms/log.md`:
   ```
   ## [YYYY-MM-DD] ingest | <source title>
   - source: raw/<filename>
   - new rules: [[...]], [[...]]
   - updated rules: [[...]], [[...]]
   - notes: <one-line synthesis or open question>
   ```

## Voice

- Terse, factual, neutral. Reference material, not narrative.
- No "Today I learned" or "This is interesting because" framing.
- Quote the source verbatim when paraphrasing would lose precision.

## Verification

Before closing the operation issue:

- [ ] Source rule exists at `brms/sources/<slug>.md` with valid frontmatter and a `sources:` field pointing to the raw path.
- [ ] Every new or updated rule links back to the source rule or a downstream rule that does.
- [ ] `brms/index.md` lists every new rule under the right category with a one-line summary.
- [ ] `brms/log.md` has the ingest entry with the exact filename heading format (so `grep "^## \[" brms/log.md` keeps working).
- [ ] Any contradiction between the new source and an older rule is annotated, not silently overwritten.
- [ ] No file under `raw/` was modified.

## Tools

`brms_list_sources`, `brms_read_source`, `brms_search`, `brms_read_rule`, `brms_write_rule`. Always include the operation issue's `brmsId` and `spaceSlug`.
