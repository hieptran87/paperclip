# Quickstart Validation Guide: Gorules Rules Engine Plugin

This guide provides step-by-step instructions to verify that the Gorules rules engine plugin functions correctly from installation to rule evaluation.

## Prerequisites
- A running local Paperclip development server (`pnpm dev` on port 3100 or 3101).
- The package compiled successfully using `pnpm build` under the plugin folder.

## Setup & Installation

1. Navigate to the plugin folder:
   ```bash
   cd packages/plugins/plugin-gorules-rules-engine
   ```
2. Install dependencies (adds `@gorules/jdm-editor`):
   ```bash
   pnpm install
   ```
3. Build the plugin:
   ```bash
   pnpm build
   ```
4. Enable the plugin (if already installed):
   ```bash
   pnpm paperclipai plugin enable paperclipai.plugin-gorules-rules-engine
   ```
   Or install fresh:
   ```bash
   pnpm paperclipai plugin install packages/plugins/plugin-gorules-rules-engine
   ```
5. Verify the plugin is ready:
   ```bash
   pnpm paperclipai plugin inspect paperclipai.plugin-gorules-rules-engine
   ```
   *Expected outcome*: status is `ready`.

## Validation Scenarios

### Scenario 1: Create a Folder and Register a Rule
Verify that rules can be created inside virtual folders and appear in the folder tree.

1. Navigate to **Rules Engine** in the Paperclip sidebar.
2. Click **+ New Rule** and fill in:
   - Key: `discount-rules`
   - Display Name: `Discount Rules`
   - Folder: `pricing`
   - Content: `{ "nodes": [], "edges": [] }`
3. Confirm the rule appears in the tree under the `pricing` folder.
4. *Expected outcome*: Tree shows `📁 pricing → 📄 discount-rules`.

### Scenario 2: Visual JDM Editor — Open and Save
Verify the `@gorules/jdm-editor` loads and saves content correctly.

1. Click on `discount-rules` in the tree.
2. The `DecisionGraph` editor opens in the right panel.
3. Add a Decision Table node via the editor toolbar.
4. Click **Save**.
5. Navigate away and come back — the Decision Table should still be there.
6. *Expected outcome*: Content is persisted; version badge increments (e.g. `1.0.0` → `1.0.1`).

### Scenario 3: Move Rule to Different Folder
Verify the folder move operation works.

1. Right-click (or use the "⋯" menu) on `discount-rules` in the tree.
2. Select **Move to folder** → type `compliance`.
3. *Expected outcome*: Rule moves from `pricing` to `compliance` in the tree.

### Scenario 4: Evaluate a Decision Table
Verify that the Zen Engine correctly evaluates rules.

1. Register a rule with a working JDM (discount table: `customer.tier = premium` → `discount = 0.15`).
2. Click the rule in the tree → editor opens.
3. Scroll down to the **Simulator** panel.
4. Input:
   ```json
   { "customer": { "tier": "premium" } }
   ```
5. Click **Evaluate Decision Table**.
6. *Expected outcome*: Result shows `{ "discount": 0.15 }` and execution time in ms.

### Scenario 5: Verify Automated Test Suite
Run the plugin unit test suite:
```bash
cd packages/plugins/plugin-gorules-rules-engine
pnpm test
```
*Expected outcome*: All Vitest assertions pass, including new tests for `get-rule-content`, `update-rule-content`, and `move-rule`.
