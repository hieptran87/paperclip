# Business Rules Maintainer Skills

This folder is the plugin-level source for Business Rules managed company skills. Paperclip installs these skills into the company skill library and syncs them onto the BRMS Maintainer agent. The BRMS Maintainer's identity and operating loop live in `agents/brms-maintainer/AGENTS.md`; the brms-root `AGENTS.md` remains the brms schema for rule layout, citation style, and log format.

Each skill is an isolated SKILL.md describing one job — when to invoke it, the inputs that must be true before starting, the steps, and the durable output the operation must leave behind.

## Skill registry

| Skill | When to invoke |
|---|---|
| [`brms-maintainer`](./brms-maintainer/SKILL.md) | General Business Rules maintenance and tool-use guidance shared by the operation skills. |
| [`brms-ingest`](./brms-ingest/SKILL.md) | A new file landed in `raw/` and the operation issue says "ingest" — turn the source into durable brms rules. |
| [`brms-query`](./brms-query/SKILL.md) | The user asked the brms a question; answer with citations and offer to file durable synthesis back into `brms/`. |
| [`brms-lint`](./brms-lint/SKILL.md) | A lint or health-check operation — audit for contradictions, orphan rules, weak provenance, broken links, missing concept rules. |
| [`paperclip-distill`](./paperclip-distill/SKILL.md) | Cursor-window, distill, or backfill operation on Paperclip activity — write a brms-insightful project rule, decisions log, and history note. |
| [`index-refresh`](./index-refresh/SKILL.md) | Refresh `brms/index.md` so each entry has a tight, scannable summary; flag drift between the index and recent log activity. |

## Layering

```
AGENTS.md (brms root)                              ← schema for the brms itself: rule conventions, frontmatter, voice
  agents/brms-maintainer/AGENTS.md                 ← agent identity and operating loop
  skills/<skill>/SKILL.md                          ← plugin-managed company skills installed onto the maintainer
```

When a skill conflicts with the brms-root `AGENTS.md`, the brms schema wins for rule format/voice and the skill wins for operation flow. When a skill conflicts with the agent's `AGENTS.md`, the agent file wins for identity and the skill wins for the operation procedure.

## Skill conventions

- Front matter has `name` (kebab-case) and `description` (one or two sentences with the trigger condition).
- Each skill names the input it expects (e.g. an operation issue with `originKind` ending in `:ingest`, a captured `raw/` path, a Paperclip source bundle).
- Each skill ends with a verification checklist — what must be true before the operation issue is closed `done`.
- Skills cite the brms-plugin tools they rely on (`brms_search`, `brms_read_rule`, `brms_write_rule`, `brms_read_source`, `brms_list_sources`).
- Skills do not duplicate the rule conventions from the brms root `AGENTS.md`. They reference it instead.
