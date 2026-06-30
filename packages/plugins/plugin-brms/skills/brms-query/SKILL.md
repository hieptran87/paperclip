---
name: brms-query
description: Use when an operation issue asks you to answer a question from the Business Rules — `operationType: "query"` and a question in the issue body. Answer with citations to brms rules and raw sources, and offer to file durable synthesis back into `brms/synthesis/` so the work compounds instead of disappearing into a chat thread.
---

# BRMS Query

Answer a question from what the brms actually contains, with citations.

## Inputs

- An operation issue with `operationType: "query"` and the question in the body.
- The operation issue's target `brmsId`, `spaceSlug`, and space root.

## Workflow

1. **Open the target space's `brms/index.md` first** — it is the navigation aid. Identify candidate rules.
2. **Read the candidate rules** end to end with `brms_read_rule`, always passing the operation issue's `brmsId` and `spaceSlug`. Follow `[[brms-links]]` to neighbouring rules when the question spans entities or concepts.
3. **Inspect raw sources** when a brms rule's claim feels thin. The brms points to `raw/` precisely so you can verify before answering. Use `brms_read_source`.
4. **Answer the question** in the operation issue thread. Structure:
   - Direct answer first, in 1–4 sentences.
   - Then the supporting facts as bullet points, each with an inline citation: `(see [[brms/concepts/managed-resources]])` or `(see raw/<filename>)`.
   - If you needed to read a raw source the brms did not summarise, name that as a gap.
5. **Decide whether the answer is durable.** If the question forced you to do real synthesis (a comparison, a tradeoff, a definition of something that isn't already a rule), offer to file it under `brms/synthesis/<slug>.md`. Do not write the synthesis rule silently — it is opt-in. If the user accepts, write the rule, link it from `brms/index.md`, and append a `query | filed synthesis` log entry.
6. **When the brms cannot answer**, say so plainly. Suggest a source the user should ingest, a Paperclip project that would help if distilled, or a web lookup. Never bluff.

## Voice

- Lead with the answer.
- Cite as you go, not in a footnote block at the end.
- Use the brms's terse, factual voice. The query response is itself a candidate for filing into `brms/synthesis/`.

## Verification

Before closing the operation issue:

- [ ] Every claim in the answer cites a brms rule or raw source.
- [ ] If the brms was insufficient, that is stated directly with a concrete next step (ingest source X, distill project Y, web search Z).
- [ ] If you wrote a synthesis rule, `brms/index.md` lists it and `brms/log.md` has a `query | filed synthesis` entry.
- [ ] No file under `raw/` was modified.

## Tools

`brms_search`, `brms_read_rule`, `brms_list_sources`, `brms_read_source`, `brms_write_rule` (only when filing synthesis). Always include the operation issue's `brmsId` and `spaceSlug`.
