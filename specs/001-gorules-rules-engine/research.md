# Research Notes: Gorules Business Rules Engine Integration

## Zen Engine Instantiation and Lifecycle

### Decision
Instantiate a single, shared `ZenEngine` instance inside the plugin worker's context instead of instantiating it on every rule evaluation call.

### Rationale
`@gorules/zen-engine` uses native Rust bindings. Repeatedly calling `new ZenEngine()` incurs resource initialization overhead. A single global or context-shared instance can evaluate multiple loaded decision models concurrently, resulting in sub-millisecond execution times.

### Alternatives Considered
- **Per-request instantiation**: Rejected because native binding loads are heavy and add unnecessary CPU overhead.
- **External API Service**: Rejected because running in-process Zen Engine is faster, eliminates network latency, and requires no external service dependencies.

---

## File-Base Structure (.json JDM files)

### Decision
Store the JSON Decision Models (JDMs) directly in the company's local folder path under `rules/*.json`. Use the `ctx.localFolders` API to manage reading, writing, and listing these files.

### Rationale
Cloning the architecture of `plugin-llm-wiki`, this keeps the source of truth for the rule logic in the local filesystem where developers can version-control JDM files. The Paperclip database is used only to index metadata (such as rule name, description, and status) and to store evaluation execution logs.

### Alternatives Considered
- **DB-only storage**: Rejected because JDM files are complex JSON structures that are easiest to edit, version, and maintain as files in a local directory rather than database blobs.

---

## Agent Integration (Skills & Tools)

### Decision
Expose the rules engine to AI agents via:
1. A managed skill: `gorules-rules-engine` describing how and when to invoke rule evaluations.
2. A registered tool: `evaluate_rule(key: string, input: Record<string, any>)` that returns the evaluation results.

### Rationale
This provides a clean, declarative interface that aligns with the other agent capabilities in Paperclip. By encapsulating rule evaluation in a standard tool, any agent (CEO, developer, etc.) can evaluate business logic without having to understand Zen JDM structure or parse files directly.

### Alternatives Considered
- **HTTP endpoint only**: Rejected because requiring agents to construct and make HTTP requests introduces unnecessary complexity compared to invoking a native tool.

---

## @gorules/jdm-editor Integration

### Decision
Integrate `@gorules/jdm-editor` as a **visual JDM authoring editor** in the plugin UI — replacing the raw JSON textarea approach. The editor opens when a rule is selected in the folder tree.

### Rationale
`@gorules/jdm-editor` provides a production-quality visual decision graph editor (React component, MIT licensed) that supports:
- `DecisionGraph` component with controlled mode (`value` + `onChange`)
- `DecisionTable` sub-node type for spreadsheet-style rule editing
- Export of the full JDM JSON object on every change

This dramatically improves operator UX compared to paste-raw-JSON workflows.

### WASM / SharedArrayBuffer Constraint
The editor uses WASM for expression syntax highlighting and autocomplete. This requires `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` HTTP headers. The Paperclip server does not currently set these headers globally.

**Mitigation**: The basic `DecisionGraph` rendering and editing works without the WASM module (table editing, node drag-drop, edge wiring). We skip calling `overrideConfig` / WASM initialization in the plugin UI. Advanced expression syntax highlighting gracefully degrades (shows plain text input instead of a Monaco-powered cell). This is acceptable for V1.

### Alternatives Considered
- **Monaco editor (raw JSON)**: Simpler but poor UX for business users authoring decision tables.
- **Require COEP/COOP header changes to Paperclip server**: Too invasive for a plugin-scoped feature. Blocked by the constraint that many users may run Paperclip behind a reverse proxy they don't fully control.

---

## Rule Folder Tree (Custom Implementation)

### Decision
Build a **custom folder/file tree** component in the plugin UI (pure React) to organize JDM rule files. The tree is backed by a new `folder` DB column on `rule_models` (defaults to `""` = root) and new API endpoints for listing and re-parenting.

### Rationale
`@gorules/jdm-editor` has **no built-in folder tree**. Folder organization is purely application-level. The tree uses a flat list from the DB, grouped client-side by `folder` prefix (similar to how S3 virtual folders work). No recursive DB schema is needed.

### Folder Tree Structure (Virtual, Client-Side)
```
rules/
├── pricing/
│   ├── discount-rules      [JDM]
│   └── vip-pricing         [JDM]
├── compliance/
│   └── gdpr-consent-check  [JDM]
└── shipping-rules           [JDM]
```
- Rules store `folder` as a string (e.g. `"pricing"`, `"compliance"`, or `""` for root)
- The tree renders folder groups based on `folder` prefixes
- Clicking a rule in the tree opens the JDM editor for that rule
- New "Create folder" operation updates the `folder` field on existing rules via a move action

### New DB Schema Change
Add `folder TEXT NOT NULL DEFAULT ''` to `rule_models`. Requires a new migration.

### New API Routes
- `GET /rules/:key/content` → returns raw JDM JSON content from localFolders
- `PUT /rules/:key/content` → accepts JDM JSON, writes back to localFolders, bumps version
- `PATCH /rules/:key` → moves rule to a different folder (updates `folder` field in DB)

### Alternatives Considered
- **Nested DB folder table**: Over-engineered for V1. Flat `folder` string is sufficient and avoids recursive SQL queries.
- **Rely on filesystem directory structure**: The `ctx.localFolders` API doesn't expose directory listing natively; using virtual folder strings in DB is safer.
