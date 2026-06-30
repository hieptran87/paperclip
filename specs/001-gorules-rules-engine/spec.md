# Feature Specification: Gorules Business Rules Engine Plugin

**Feature Branch**: `001-gorules-rules-engine`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "Create plugin allow manage business rule engine using gorules.io"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Decision Models (Priority: P1)

As a company operator, I want to upload, list, view, and delete JSON Decision Models (JDMs) for my company, so that the company's business rules are centrally documented and stored in the control plane.

**Why this priority**: Storing and managing decision models is the foundation of the rules engine. Without rules stored in the control plane, agents and simulators have nothing to evaluate.

**Independent Test**: Operators can navigate to the "Gorules Engine" page in the UI, upload a valid Zen JDM file, see it in the list, and view its details.

**Acceptance Scenarios**:

1. **Given** the operator is on the Gorules Engine page, **When** they click "Upload Decision Model" and select a valid Zen JDM JSON file, **Then** the file is successfully validated, stored, and displayed in the decision models list.
2. **Given** a list of uploaded decision models, **When** the operator selects a decision model and clicks "Delete", **Then** the model is removed and is no longer available.

---

### User Story 2 - Decision Simulator (Priority: P2)

As a company operator, I want to run test inputs against my decision models through an interactive simulator UI, so that I can verify that my rules evaluate correctly before agents use them.

**Why this priority**: Testing decision tables in isolation is crucial for rule correctness. It allows operators to debug complex logic branchings before letting agents execute them autonomously.

**Independent Test**: An operator selects a stored decision model, inputs a sample JSON payload, clicks "Simulate", and sees the exact evaluation result structure returned by the Zen Engine.

**Acceptance Scenarios**:

1. **Given** a selected decision model, **When** the operator inputs a valid JSON payload and clicks "Evaluate", **Then** the UI shows the detailed simulation output and execution path.
2. **Given** a selected decision model, **When** the operator inputs an invalid JSON payload, **Then** the simulator displays a descriptive parsing or validation error.

---

### User Story 3 - Agent Rule Evaluation (Priority: P3)

As an AI agent in the company, I want to call a rule evaluation tool with a model key and input context, so that I can automatically apply company policies and rules to my tasks.

**Why this priority**: Integrating the rules engine with agents enables automated governance, automated budget validation, and decision automation within the company workforce.

**Independent Test**: An agent executes the rule evaluation tool specifying `modelKey: "pricing-rules"` and a context payload, receiving the computed decision response back.

**Acceptance Scenarios**:

1. **Given** an agent is executing a task, **When** they call the rule evaluation API with a valid rule key and payload, **Then** the Zen Engine evaluates it locally and returns the decision output.
2. **Given** an agent calls the rule evaluation API with a non-existent rule key, **Then** the system returns a `404 Rule Not Found` error.

---

### Edge Cases

- **Mismatched Input Schema**: How does the system handle evaluations where the input payload is missing keys expected by the decision table?
- **Infinite Evaluation Loops**: What happens if a JDM graph contains circular references? The Zen Engine must enforce a max depth or execution timeout.
- **Malformed JDM Files**: How does the system handle uploaded JSON files that do not conform to the Zen JDM specification?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST expose a custom company-scoped page (`/company/:companyId/rules`) in the Paperclip UI using the plugin `page` slot.
- **FR-002**: The plugin server-side worker MUST store decision models in a database table scoped to the company.
- **FR-003**: The plugin UI MUST allow operators to upload Zen JSON Decision Model (JDM) files.
- **FR-004**: The plugin worker MUST provide an in-process JSON decision model evaluation engine.
- **FR-005**: The plugin MUST expose a rule evaluation interface (API/endpoint) that accepts a model key and an evaluation input, returning the computed JSON response.
- **FR-006**: The simulator UI MUST allow operators to select a model, type/paste input JSON, and display the evaluation output.
- **FR-007**: Every rule evaluation MUST log an activity event in the Paperclip activity log to preserve control-plane visibility.

### Key Entities

- **RuleModel**: Represents a JSON Decision Model stored in the database. Scoped to a company. Contains `id`, `companyId`, `key`, `displayName`, `description`, `content` (JSON decision graph), `version`, `createdAt`, `updatedAt`.
- **RuleEvaluationLog**: Represents a history of rule evaluations. Scoped to a company. Contains `id`, `companyId`, `ruleId`, `actorType` (operator vs agent), `actorId`, `inputContext` (JSON), `outputResult` (JSON), `evaluatedAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can upload and view a decision model in under 1 minute from the UI.
- **SC-002**: Local rule evaluations through the Zen Engine API must complete in under 5 milliseconds (excluding database retrieval latency).
- **SC-003**: 100% of rule evaluation executions must be recorded in the company activity log with matching input and output summaries.
- **SC-004**: Agents can successfully invoke rule evaluation with a single tool call and receive structured JSON responses.

## Assumptions

- **AS-001**: Decision models are authored in Gorules' official external editor (https://gorules.io) and imported into Paperclip as JSON. The visual graph editor itself is out of scope for V1.
- **AS-002**: Zen Engine evaluation runs in-process inside the Paperclip server/worker (using `@gorules/zen-engine` npm package), eliminating any external HTTP latency to a remote rules engine.
- **AS-003**: A company membership is required to access, edit, or evaluate rules, enforcing company boundaries.

## User Review Required

> [!IMPORTANT]
> **Rule Storage Scope**:
> Should the decision models be stored in the primary database (associated with the `Company` entity) or kept strictly on the filesystem (e.g. inside the company's workspace directory)?
>
> **Implications**:
> - **Database Storage (Recommended)**: Follows the "Keep changes company-scoped" rule. Supports multi-tenant cloud deployments, permissions, auditing, and active versioning.
> - **Filesystem Storage**: Easier for local development and direct git integration, but harder to enforce multi-tenant access controls and versioning history.
