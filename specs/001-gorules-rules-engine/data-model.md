# Data Model: Gorules Business Rules Engine

This document defines the database schema for the Gorules rules engine plugin, isolated within the plugin's dedicated database namespace.

## Database Entities

### 1. `RuleModel` (Table: `plugin_gorules_rule_models`)
Represents an indexed JDM rule file.

| Field | Type | Description |
|---|---|---|
| `id` | UUID (Primary Key) | Unique identifier |
| `companyId` | UUID (Indexed) | Scoped to a specific Paperclip company |
| `key` | VARCHAR(255) | Unique alphanumeric slug/key for rule evaluation (e.g. `discount-logic`) |
| `displayName` | VARCHAR(255) | User-facing display name |
| `description` | TEXT | Description of the rule logic |
| `folder` | TEXT (DEFAULT `''`) | **NEW** Virtual folder path (e.g. `"pricing"`, `"compliance"`, `""` = root). Used to organize rules in the tree UI without nested DB tables. |
| `filePath` | TEXT | Workspace-relative path to the JDM file (e.g., `rules/discount-logic.json`) |
| `version` | VARCHAR(50) | Semantic version of the JDM configuration (bumped on content save) |
| `createdAt` | TIMESTAMP | Record creation date |
| `updatedAt` | TIMESTAMP | Record last modification date |

**Index / Constraints**:
- Unique constraint on `(companyId, key)` to guarantee uniqueness of rule slugs within a company.
- Index on `companyId` for scope boundaries.
- Index on `(companyId, folder)` for efficient tree listing queries.

> [!IMPORTANT]
> The `folder` field is a **flat string** (not a recursive parent_id relationship). Virtual folder nesting is resolved client-side by splitting on `/`. This keeps migration simple and avoids recursive SQL.

---

### 2. `RuleEvaluationLog` (Table: `plugin_gorules_evaluation_logs`)
Represents a historical record of rule evaluations.

| Field | Type | Description |
|---|---|---|
| `id` | UUID (Primary Key) | Unique identifier |
| `companyId` | UUID (Indexed) | Scoped to a specific Paperclip company |
| `ruleId` | UUID (Foreign Key) | Reference to `RuleModel.id` |
| `actorType` | VARCHAR(50) | `operator` (human user) or `agent` (AI agent) |
| `actorId` | UUID | ID of the human operator or AI agent employee |
| `inputContext` | JSONB | Input JSON payload evaluated against the JDM |
| `outputResult` | JSONB | Output JSON payload returned by Zen Engine |
| `evaluatedAt` | TIMESTAMP | Timestamp when evaluation completed |

**Index / Constraints**:
- Foreign key relationship from `ruleId` to `RuleModel.id` (ON DELETE CASCADE).
- Index on `companyId` for scope isolation.
- Index on `ruleId` for logging retrieval.

## File System Entities

Rule files are stored in the local workspace directory:
- Folder path: `rules/`
- File naming: `<rule-key>.json`
- File format: Standard Zen JSON Decision Model (JDM) graph structure containing input nodes, decision tables, output nodes, etc.

## Migration Plan

A new SQL migration adds the `folder` column to `rule_models`:

```sql
-- Migration: 0002_add_folder_to_rule_models.sql
ALTER TABLE rule_models ADD COLUMN folder TEXT NOT NULL DEFAULT '';
CREATE INDEX ON rule_models (company_id, folder);
```
