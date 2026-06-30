# Tasks: Gorules Business Rules Engine Plugin — Phase 2 (JDM Editor + Folder Tree)

**Input**: Design documents from `specs/001-gorules-rules-engine/`

**Branch**: `001-gorules-rules-engine` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Dependencies & Migration)

**Purpose**: Install the JDM editor package, add DB migration for `folder`, and configure the build.

- [x] T001 Install `@gorules/jdm-editor` in `packages/plugins/plugin-gorules-rules-engine/package.json` via `pnpm add @gorules/jdm-editor --filter @paperclipai/plugin-gorules-rules-engine`
- [x] T002 Create DB migration `packages/plugins/plugin-gorules-rules-engine/migrations/0002_add_folder_to_rule_models.sql` adding `folder TEXT NOT NULL DEFAULT ''` and index on `(company_id, folder)`
- [x] T003 [P] Update `packages/plugins/plugin-gorules-rules-engine/src/rules/db-schema.ts` to add `folder: string` to `RuleModelRow` type

---

## Phase 2: Foundational (Backend — New Routes & Core Logic)

**Purpose**: Core worker changes that all UI stories depend on. Must be complete before UI work.

**⚠️ CRITICAL**: No UI story work can begin until this phase is complete.

- [x] T004 Update `packages/plugins/plugin-gorules-rules-engine/src/rules/core.ts` — add `folder?: string` param to `registerRule()` and include `folder` in INSERT + RETURNING columns; update `listRules()` SELECT to include `folder`
- [x] T005 [P] Add `getRuleContent(ctx, companyId, key)` function to `packages/plugins/plugin-gorules-rules-engine/src/rules/core.ts` — reads raw JDM JSON string from `ctx.localFolders.readText()` and returns `{ key, content, version }`
- [x] T006 [P] Add `updateRuleContent(ctx, companyId, key, content)` function to `packages/plugins/plugin-gorules-rules-engine/src/rules/core.ts` — writes JDM JSON to `ctx.localFolders.writeTextAtomic()`, increments version in DB (semver patch bump), logs activity
- [x] T007 [P] Add `moveRule(ctx, companyId, key, folder)` function to `packages/plugins/plugin-gorules-rules-engine/src/rules/core.ts` — updates `folder` column in DB, logs activity
- [x] T008 Add `getRuleContent`, `updateRuleContent`, `moveRule` exports to `packages/plugins/plugin-gorules-rules-engine/src/rules/index.ts`
- [x] T009 Register 3 new `ctx.actions` handlers in `packages/plugins/plugin-gorules-rules-engine/src/worker.ts`: `get-rule-content` → `getRuleContent`, `update-rule-content` → `updateRuleContent`, `move-rule` → `moveRule`
- [x] T010 Register 3 new `onApiRequest` route handlers in `packages/plugins/plugin-gorules-rules-engine/src/worker.ts`: routeKeys `get-rule-content` (GET), `update-rule-content` (PUT), `move-rule` (PATCH)
- [x] T011 Add 3 new API route declarations to `packages/plugins/plugin-gorules-rules-engine/src/manifest.ts`: `get-rule-content`, `update-rule-content`, `move-rule` with correct methods, paths, auth, and `companyResolution`
- [x] T012 Update existing `register-rule` action/route in `packages/plugins/plugin-gorules-rules-engine/src/worker.ts` to accept and forward `folder` field (defaults to `""`)

**Checkpoint**: Backend complete — rebuild plugin (`pnpm build`) and verify worker starts healthy.

---

## Phase 3: User Story 1 — Manage Decision Models with Folder Tree (Priority: P1) 🎯 MVP

**Goal**: Replace the flat rules list with a visual folder tree. Operators can create rules in named folders, rename folders (by moving rules), and navigate the tree to select a rule.

**Independent Test**: Navigate to Rules Engine page → create two rules with different folders → verify both folder groups appear in the tree with correct rules nested inside.

### Implementation for User Story 1

- [x] T013 [US1] Extract folder tree state logic (group flat `rules[]` by `folder`, collapse/expand state) into a `useRuleTree` hook in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx`
- [x] T014 [P] [US1] Build `RuleFolderTree` component in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — renders collapsible `📁 folder` groups and `📄 rule` leaf nodes; calls `onSelectRule(key)` on click; highlights selected rule
- [x] T015 [P] [US1] Build `NewRuleModal` component in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — update existing register rule modal to include `folder` text input (dropdown of existing folders + free-form input); passes `folder` to `register-rule` action
- [x] T016 [P] [US1] Build `NewFolderModal` component in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — dialog that lets operator type a folder name; uses `move-rule` action on a selected rule to assign it to the new folder; or just sets a pending `defaultFolder` for the next `NewRuleModal`
- [x] T017 [US1] Integrate `RuleFolderTree` into the main two-panel layout in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — left 280px panel, replaces old rules table; add `[+ New Rule]` and `[+ New Folder]` buttons in header
- [x] T018 [US1] Add "Move to folder" inline action (⋯ menu or right-click context button) on each rule leaf node in `RuleFolderTree` — calls `move-rule` action with new `folder` value, then refreshes rules list

**Checkpoint**: Tree renders correctly, rules appear under their folders, moving rules updates tree.

---

## Phase 4: User Story 2 — Visual JDM Editor (Priority: P2)

**Goal**: When a rule is selected in the tree, the right panel loads its JDM JSON into the `@gorules/jdm-editor` `DecisionGraph` visual editor. Operators can visually edit the decision model and save it back.

**Independent Test**: Select a rule in the tree → `DecisionGraph` renders (even with blank `{ nodes:[], edges:[] }` graph) → add a Decision Table node → click Save → navigate away → click rule again → Decision Table node is still there.

### Implementation for User Story 2

- [x] T019 [US2] Add `usePluginAction("get-rule-content")` and `usePluginAction("update-rule-content")` calls in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx`; manage `jdmGraph` state and `dirty` flag
- [x] T020 [US2] Implement `RuleEditorPanel` component in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — on mount fetches `get-rule-content` action for selected rule key; parses JSON string to `DecisionGraphType` object; renders `JdmConfigProvider` + `DecisionGraph value={jdmGraph} onChange={(v) => { setJdmGraph(v); setDirty(true); }}`
- [x] T021 [US2] Add **Save button** in `RuleEditorPanel` header — disabled when `!dirty` or saving; on click serializes `jdmGraph` to JSON string and calls `update-rule-content` action; on success shows toast + resets `dirty`; shows version badge from response
- [x] T022 [US2] Import `@gorules/jdm-editor/dist/style.css` in `packages/plugins/plugin-gorules-rules-engine/src/ui/index.tsx` (or at top of `app.tsx`); verify CSS loads without build errors
- [x] T023 [US2] Handle loading state in `RuleEditorPanel` — show skeleton/spinner while `get-rule-content` is in flight; handle null/empty content by defaulting to `{ nodes: [], edges: [] }`; show error toast on fetch failure
- [x] T024 [US2] Wire `RuleEditorPanel` into the two-panel layout — right panel shows editor when a rule is selected; `[+ Evaluate]` button at top right of panel triggers simulator scroll/expand

**Checkpoint**: Full visual round-trip: select rule → see graph → modify → save → verify persisted.

---

## Phase 5: User Story 3 — Decision Simulator (Priority: P2, second sub-feature)

**Goal**: The simulator panel (JSON input → evaluate → JSON output) remains functional and is accessible below the JDM editor when a rule is selected.

**Independent Test**: Select a rule with a working JDM → type `{ "customer": { "tier": "premium" } }` in input → click Evaluate → see output result and execution time.

### Implementation for User Story 3

- [x] T025 [US3] Extract `SimulatorPanel` component from existing inline simulator code in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — props: `companyId`, `selectedRule`, `onEvaluated`; renders below `RuleEditorPanel` in the right column
- [x] T026 [US3] Ensure `SimulatorPanel` refreshes the evaluation logs list after a successful evaluation by calling `refetchLogs()` passed via prop from parent
- [x] T027 [US3] Update `EvaluationLogsStrip` (extracted from existing logs table) in `packages/plugins/plugin-gorules-rules-engine/src/ui/app.tsx` — render as a collapsible bottom strip (collapsed by default, expands to show last 10 log rows) rather than a full-height section

**Checkpoint**: Simulator works alongside the new editor; logs strip toggles open/closed.

---

## Phase 6: User Story 4 — Agent Rule Evaluation (Priority: P3)

**Goal**: AI agents can call the `evaluate_rule` tool with a valid rule key and input context, and receive the decision result. This phase verifies the existing agent tool registration is correct now that `folder` is added to DB.

**Independent Test**: Agent calls tool `evaluate_rule` with `{ companyId, ruleKey: "discount-rules", input: { customer: { tier: "premium" } } }` → returns `{ result: { discount: 0.15 }, performanceMs: N }`.

### Implementation for User Story 4

- [x] T028 [US4] Verify `evaluate_rule` tool registration in `packages/plugins/plugin-gorules-rules-engine/src/worker.ts` — ensure `getRuleByKey` query still works after migration adds `folder` column (SELECT must include `folder` or be explicit)
- [x] T029 [P] [US4] Add unit test cases in `packages/plugins/plugin-gorules-rules-engine/tests/plugin.spec.ts` for `get-rule-content` action: mock `localFolders.readText`, assert returned `content` matches written value
- [x] T030 [P] [US4] Add unit test cases in `packages/plugins/plugin-gorules-rules-engine/tests/plugin.spec.ts` for `update-rule-content` action: verify `localFolders.writeTextAtomic` called with new content and DB version bumped
- [x] T031 [P] [US4] Add unit test cases in `packages/plugins/plugin-gorules-rules-engine/tests/plugin.spec.ts` for `move-rule` action: verify DB `folder` field updated correctly
- [x] T032 [US4] Add unit test case in `packages/plugins/plugin-gorules-rules-engine/tests/plugin.spec.ts` for `register-rule` with `folder` field — verify `folder` persisted in DB row

**Checkpoint**: `pnpm test` in plugin dir — all tests pass including new ones.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Build verification, typecheck, cleanup, and final lifecycle test.

- [x] T033 Run `pnpm -r typecheck` from repo root — fix any TypeScript errors introduced by new types (`folder`, `RuleModelRow`, action params)
- [x] T034 Run `pnpm build` in `packages/plugins/plugin-gorules-rules-engine` — verify clean build with no esbuild errors (jdm-editor CSS and JS bundle correctly)
- [x] T035 [P] Run `pnpm test` in `packages/plugins/plugin-gorules-rules-engine` — all Vitest tests pass
- [x] T036 Disable and re-enable plugin to verify clean lifecycle: `pnpm paperclipai plugin enable paperclipai.plugin-gorules-rules-engine` → status `ready`
- [x] T037 [P] Update `specs/001-gorules-rules-engine/research.md` with any final implementation notes or surprises (WASM behavior, CSS import path, etc.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001, T002, T003 can all run in parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 (T002 migration must exist before testing DB queries) — **BLOCKS all UI phases**
- **Phase 3 (US1 — Folder Tree)**: Depends on Phase 2 complete (needs `folder` field in API responses)
- **Phase 4 (US2 — JDM Editor)**: Depends on Phase 2 complete (needs `get-rule-content`, `update-rule-content`); can run in parallel with Phase 3
- **Phase 5 (US3 — Simulator)**: Largely independent; can refactor existing code once Phase 3 layout is done
- **Phase 6 (US4 — Agent + Tests)**: Depends on Phases 2–5 complete; tests validate all new backend routes
- **Phase 7 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (Folder Tree)**: Needs `folder` in list-rules response (T004)
- **US2 (JDM Editor)**: Needs `get-rule-content` + `update-rule-content` routes (T005, T006, T009, T010)
- **US3 (Simulator)**: Refactor of existing code — minimal new backend dependency
- **US4 (Agent + Tests)**: Validates all of the above

### Within Each Phase

- All `[P]`-marked tasks can run in parallel within their phase
- T004→T008→T009,T010,T011 must run sequentially (core.ts → index.ts → worker.ts → manifest.ts)
- T013→T014,T015,T016 (hook before component)
- T019→T020,T021 (state before render)

### Parallel Opportunities

```bash
# Phase 1 — all in parallel:
T001: pnpm add @gorules/jdm-editor
T002: write migration SQL
T003: update db-schema.ts types

# Phase 2 — sequential but T005/T006/T007 can be written in parallel:
T004: registerRule + listRules changes  (first)
T005, T006, T007: new core functions   (parallel, after T004)
T008: update index.ts exports          (after T005-T007)
T009, T010: worker.ts handlers         (parallel, after T008)
T011: manifest.ts routes               (parallel with T009/T010)

# Phase 3 + Phase 4 — can run in parallel (different concerns):
Phase 3 team: T013→T014→T015→T016→T017→T018
Phase 4 team: T019→T020→T021→T022→T023→T024
```

---

## Parallel Example: Phase 2 (Backend)

```bash
# After T004 completes:
Task T005: "Add getRuleContent() to src/rules/core.ts"
Task T006: "Add updateRuleContent() to src/rules/core.ts"
Task T007: "Add moveRule() to src/rules/core.ts"
# All three can be written simultaneously in core.ts sections
```

---

## Implementation Strategy

### MVP First (User Story 1 + Folder Tree only)

1. Complete Phase 1: Setup (install jdm-editor, write migration)
2. Complete Phase 2: Foundational backend (new routes, `folder` field)
3. Complete Phase 3: US1 Folder Tree UI
4. **STOP and VALIDATE**: Tree renders, rules appear in folders, move works
5. Ship / demo MVP

### Incremental Delivery

1. Phase 1 + Phase 2 → Backend ready
2. Phase 3 → Folder tree working (US1 ✅)
3. Phase 4 → JDM editor embedded (US2 ✅)
4. Phase 5 → Simulator refactored to sit below editor (US3 ✅)
5. Phase 6 → Agent tests green (US4 ✅)
6. Phase 7 → Polish, typecheck, build clean

---

## Notes

- `[P]` tasks = different files or independent code sections, no blocking dependencies
- Each `[Story]` label maps task to a specific user story for traceability
- The `@gorules/jdm-editor` WASM (expression syntax highlight) is intentionally **not initialized** — basic graph/table editing works without it; degrades gracefully
- The `folder` field is a flat string (virtual folder), not a nested DB table — no recursive SQL needed
- Run `pnpm build` after Phase 2 before beginning UI work to confirm backend bundle is clean
