# Implementation Plan: Gorules Business Rules Engine Plugin — Phase 2

**Branch**: `001-gorules-rules-engine` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Phase 2 Input**: Add `@gorules/jdm-editor` visual editor + custom rule folder tree to the plugin UI, backed by new API routes and a DB migration.

## Summary

Upgrade the plugin UI from a raw-JSON textarea workflow to a **full visual decision model authoring experience** using `@gorules/jdm-editor`. Add a **virtual folder tree** as the primary navigation for managing multiple rules in an organized hierarchy. Three new worker API routes support loading rule content, saving it back, and moving rules between folders.

## Constitution Check

- **Principle I (Code Quality & Scope Isolation)**: All new API routes enforce `companyId` scoping. The new DB column is added via a proper migration.
- **Principle II (Strict Testing Discipline)**: Unit tests for new routes (`get-rule-content`, `update-rule-content`, `move-rule`) are added to `tests/plugin.spec.ts`.
- **Principle III (User Experience Consistency)**: The folder tree + JDM editor replaces the raw JSON textarea. Errors from save/load operations surface in toast notifications.
- **Principle IV (Performance & Resource Efficiency)**: JDM editor is lazy-loaded only when a rule is selected. esbuild config externalizes `@gorules/jdm-editor` CSS; the component tree renders conditionally.
- **Principle V (Control-Plane Invariants)**: Content saves and folder moves log activity events.

## User Review Required

> [!IMPORTANT]
> **WASM / SharedArrayBuffer headers**: The `@gorules/jdm-editor` uses WASM for expression syntax highlighting inside decision table cells. This requires `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` headers. **We do NOT add these to Paperclip globally** — too invasive. We skip WASM init, so expression cell highlight gracefully degrades to plain text. Decision table row/column editing and graph wiring still work without WASM. Acceptable for V1?

> [!NOTE]
> **Folder depth**: V1 supports **one level** of virtual folders (e.g. `"pricing"`, `"compliance"`). Multi-level nesting (e.g. `"pricing/vip"`) is not implemented but the schema supports it because `folder` is a free-form string. Nested tree rendering can be added in V2 by splitting `folder` on `/`.

## Proposed Changes

---

### DB / Migration

#### [NEW] `migrations/0002_add_folder_to_rule_models.sql`
```sql
ALTER TABLE rule_models ADD COLUMN folder TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_rule_models_company_folder ON rule_models (company_id, folder);
```

---

### Shared types (`src/rules/db-schema.ts`)

#### [MODIFY] `db-schema.ts`
Add `folder: string` to `RuleModelRow` type.

---

### Backend worker (`src/rules/core.ts`)

#### [MODIFY] `core.ts`
- `listRules()` — add `folder` to SELECT and return type
- `registerRule()` — accept optional `folder?: string` param (default `""`)
- `getRuleContent()` — new function: reads raw JDM JSON string from `ctx.localFolders`
- `updateRuleContent()` — new function: writes JDM JSON to local file, bumps version in DB
- `moveRule()` — new function: updates `folder` field in DB only

---

### Worker entry (`src/worker.ts`)

#### [MODIFY] `worker.ts`

Register 3 new API routes and 3 new actions:

**New API Routes:**
| routeKey | Method | Path | Auth |
|---|---|---|---|
| `get-rule-content` | `GET` | `/rules/:key/content` | `board-or-agent` |
| `update-rule-content` | `PUT` | `/rules/:key/content` | `board` |
| `move-rule` | `PATCH` | `/rules/:key` | `board` |

**New `ctx.actions.register` entries:**
- `get-rule-content` → calls `getRuleContent(ctx, companyId, key)`
- `update-rule-content` → calls `updateRuleContent(ctx, companyId, key, content)`
- `move-rule` → calls `moveRule(ctx, companyId, key, folder)`

**Updated `register-rule` action/route:** accept optional `folder` field (pass to `registerRule()`).

---

### Manifest (`src/manifest.ts`)

#### [MODIFY] `manifest.ts`

Add 3 new API route declarations:
```ts
{ routeKey: "get-rule-content",    method: "GET",   path: "/rules/:key/content", auth: "board-or-agent", companyResolution: { from: "query", key: "companyId" } },
{ routeKey: "update-rule-content", method: "PUT",   path: "/rules/:key/content", auth: "board",          companyResolution: { from: "body",  key: "companyId" } },
{ routeKey: "move-rule",           method: "PATCH", path: "/rules/:key",         auth: "board",          companyResolution: { from: "body",  key: "companyId" } },
```

---

### Plugin package (`package.json`)

#### [MODIFY] `package.json`
Add new dev dependency:
```json
"@gorules/jdm-editor": "^0.x.x"
```

---

### UI (`src/ui/app.tsx`)

The entire `app.tsx` is significantly reworked into a **two-panel layout**:

#### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Header: "Rules Engine"                         [+ New Rule]  [+ New Folder] │
├──────────────────────────┬───────────────────────────────────────────────────┤
│  RULE TREE PANEL (280px) │  EDITOR PANEL (fill)                              │
│                          │                                                   │
│  📁 pricing (2)          │  ┌─ Rule: Discount Rules ──────────── [Save] [▶] ┐│
│    📄 discount-rules  ←  │  │                                               ││
│    📄 vip-pricing        │  │   @gorules/jdm-editor DecisionGraph component  ││
│  📁 compliance (1)       │  │                                               ││
│    📄 gdpr-check         │  │   (visual node canvas / decision table)       ││
│  📄 shipping-rules       │  │                                               ││
│                          │  └───────────────────────────────────────────────┘│
│                          │                                                   │
│                          │  ┌─ Simulator ─────────────────────────────────┐ │
│                          │  │  Input JSON  →  [Evaluate]  →  Result JSON  │ │
│                          │  └─────────────────────────────────────────────┘ │
├──────────────────────────┴───────────────────────────────────────────────────┤
│  Evaluation Logs (bottom strip, collapsible)                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### New components (all in `app.tsx` or extracted files):

| Component | Purpose |
|---|---|
| `RuleFolderTree` | Left panel: renders virtual folder+file tree from flat rules list. Folder collapse/expand. Click → selects rule. |
| `RuleEditorPanel` | Right panel: holds `DecisionGraph` + Save button + version badge. Loads content via `get-rule-content` action on rule select. |
| `NewRuleModal` | Updated register form: adds `folder` dropdown/input field |
| `NewFolderModal` | Dialog to create a named folder (moves a new or existing rule into it) |
| `SimulatorPanel` | Extracted from current inline simulator; below the editor |

#### Key behaviors:
- **Tree selection** → calls `get-rule-content` action → populates `DecisionGraph value`
- **DecisionGraph onChange** → sets local dirty state, shows [Save] button
- **[Save]** → calls `update-rule-content` action → toast success
- **Drag rule to folder** (V2, not in scope for V1) — folder assignment via "Move to..." context menu in V1
- **[+ New Rule]** → `NewRuleModal` with folder select
- **[+ New Folder]** → `NewFolderModal` — just creates a placeholder (empty folder rendered once a rule is moved there)

#### `@gorules/jdm-editor` integration:
```tsx
import { JdmConfigProvider, DecisionGraph } from '@gorules/jdm-editor';
import '@gorules/jdm-editor/dist/style.css';

// No WASM init — degrades gracefully (expression cells show plain text)
<JdmConfigProvider>
  <DecisionGraph
    value={jdmGraph}
    onChange={(updated) => { setJdmGraph(updated); setDirty(true); }}
  />
</JdmConfigProvider>
```

---

### esbuild (`esbuild.config.mjs`)

#### [MODIFY] `esbuild.config.mjs`
The `@gorules/jdm-editor` and its CSS are handled by esbuild's UI bundle (not worker). No special external needed for the UI bundle. The CSS import is included automatically.

---

### Tests (`tests/plugin.spec.ts`)

#### [MODIFY] `plugin.spec.ts`
Add test cases for:
- `get-rule-content` — verify it reads the file content from localFolders
- `update-rule-content` — verify it writes back and bumps the `version` field in DB
- `move-rule` — verify it updates the `folder` field in DB
- `register-rule with folder` — verify `folder` is persisted correctly

---

## Verification Plan

### Automated Tests
```sh
cd packages/plugins/plugin-gorules-rules-engine
pnpm test
```
All new test cases for `get-rule-content`, `update-rule-content`, `move-rule` must pass.

```sh
pnpm -r typecheck
pnpm build
```

### Manual Verification
1. Navigate to **Rules Engine** page in the Paperclip UI
2. Create a new rule in the `pricing` folder → verify it appears in the tree under the folder
3. Click the rule → JDM editor loads with blank graph (`{ nodes: [], edges: [] }`)
4. Add a Decision Table node → click Save → verify "Saved" toast
5. Select a different rule → come back → verify content persists
6. Use "Move to folder" on a rule → verify tree re-groups it
7. Run simulator with a valid JSON payload → verify output appears

### Plugin lifecycle
```sh
pnpm paperclipai plugin enable paperclipai.plugin-gorules-rules-engine
```
Plugin must start with status `ready` and health checks passing.

---

## Phase 3: Code Structure Alignment (Same structure as plugin-llm-wiki)

**Goal**: Align `plugin-gorules-rules-engine` file entrypoint layout with `plugin-llm-wiki` by promoting the internal rules engine logic interface to a top-level `src/rules.ts` module, matching the pattern of `src/wiki.ts` in `plugin-llm-wiki`.

### Proposed Structural Changes

#### [NEW] [rules.ts](file:///Users/hietran5/Documents/bavaan/paperclip/packages/plugins/plugin-gorules-rules-engine/src/rules.ts)
A new entrypoint module that acts as the public interface for the rules logic, exporting everything from `db-schema.ts` and `core.ts`:
```typescript
export * from "./rules/db-schema.js";
export * from "./rules/core.js";
```

#### [DELETE] [index.ts](file:///Users/hietran5/Documents/bavaan/paperclip/packages/plugins/plugin-gorules-rules-engine/src/rules/index.ts)
Delete `src/rules/index.ts` to avoid redundant nested entrypoints.

#### [MODIFY] [worker.ts](file:///Users/hietran5/Documents/bavaan/paperclip/packages/plugins/plugin-gorules-rules-engine/src/worker.ts)
Update imports to reference `./rules.js` instead of `./rules/index.js`.

---

## Phase 4: JDM Visual Editor and JSON Rules in plugin-brms

**Goal**: Convert BRMS rule files from Markdown (`.md`) to JDM JSON (`.json`) format and replace the markdown editor/viewer with the `@gorules/jdm-editor` visual decision model editor in `packages/plugins/plugin-brms`.

### Proposed Changes

#### UI (`packages/plugins/plugin-brms/src/ui/app.tsx`)
- Import `DecisionGraph` and `JdmConfigProvider` from `@gorules/jdm-editor`.
- Import `@gorules/jdm-editor/dist/style.css` at the top of the file.
- Rework `BRMSRule` component to load JDM visual editor if `path` ends in `.json`. Fallback to markdown editor for `.md` files.

#### Core Logic (`packages/plugins/plugin-brms/src/brms/core.ts`)
- Allow both `.json` and `.md` file extensions in `assertRulePath` and local rule scanners.

#### esbuild (`packages/plugins/plugin-brms/esbuild.config.mjs`)
- Add file loaders for Monaco Editor fonts (`.ttf`, `.woff`, `.woff2`, `.eot`).

#### Fixtures (`packages/plugins/plugin-brms/fixtures/`)
- Remove old markdown rules (`knowledge.md`, `plugin-boundaries.md`).
- Add realistic decision model templates similar to gorules.io/templates as JDM `.json` files:
  - `loan-approval.json`: Credit score and income evaluation decision table.
  - `policy-eligibility.json`: Insurance policy underwriting eligibility decision table.
  - `dynamic-pricing.json`: Retail/VIP discount and dynamic pricing decision table.


