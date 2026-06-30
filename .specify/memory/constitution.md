<!--
Sync Impact Report:
- Version Change: 0.0.0 (Uninitialized) -> 1.0.0
- List of Modified Principles:
  * [PRINCIPLE_1] -> I. Code Quality & Scope Isolation (New)
  * [PRINCIPLE_2] -> II. Strict Testing Discipline (New)
  * [PRINCIPLE_3] -> III. User Experience Consistency (New)
  * [PRINCIPLE_4] -> IV. Performance & Resource Efficiency (New)
  * [PRINCIPLE_5] -> V. Control-Plane Invariants (New)
- Added Sections:
  * Development & Database Change Standards
  * PR & Branching Policy
- Removed Sections: None
- Templates Requiring Updates:
  * .specify/templates/plan-template.md (✅ updated)
  * .specify/templates/spec-template.md (✅ updated)
  * .specify/templates/tasks-template.md (✅ updated)
  * .specify/templates/checklist-template.md (✅ updated)
- Follow-up TODOs: None (all placeholders resolved)
-->

# Paperclip Constitution

## Core Principles

### I. Code Quality & Scope Isolation
Every backend service and frontend interaction MUST be scoped to a specific company. Strict boundaries must be enforced in all routes and business services. Contracts and schemas must remain synchronized across packages/db, packages/shared, server, and ui layers.

### II. Strict Testing Discipline
Testing is mandatory. Every bug fix or new feature must be verified via the relevant test suites (e.g. Vitest for unit/integration). The browser-based suites (e.g. Playwright e2e/smoke) should run when changing user interface or e2e flows. Prior to final hand-off, workspace verification commands (typecheck, tests, and build) MUST complete successfully.

### III. User Experience Consistency
UI routes and navigation MUST stay strictly aligned with the available API surface. Company selection context must be preserved on company-scoped pages. Transaction errors, network issues, and validation failures MUST be surfaced clearly to the user, not swallowed or ignored.

### IV. Performance & Resource Efficiency
Compilations, builds, and test runs must remain fast and resource-efficient. Developers must keep execution-control bounds active to prevent infinite loops and runaway token burn. Local development should favor embedded PGlite for rapid database provisioning with zero external dependencies.

### V. Control-Plane Invariants
All mutating operations MUST maintain the core control-plane invariants: single-assignee tasks, atomic issue checkout semantics, budget hard-stops, approval gates for governed actions, and activity logging for mutating actions.

## Development & Database Change Standards
- Codebase Structure: Maintain separation of concerns among server/ (REST API), ui/ (React/Vite), packages/db (Drizzle ORM), and packages/shared (types/validators).
- DB Schema Modifications: Any changes to database models MUST be implemented in packages/db/src/schema/*.ts, exported from index.ts, and migrated via 'pnpm db:generate', followed by workspace typechecks.

## PR & Branching Policy
- Branch Naming: Use standardized feature branches.
- Pull Request Templates: All contributions must use and fill in the official .github/PULL_REQUEST_TEMPLATE.md, including a thinking path, change detail, verification proof, and details of the AI model used.

## Governance
This Constitution governs all engineering activities in Paperclip. Amendments require documenting the rationale, upgrading the constitution version, and propagating updates to all templates. The version follows semantic versioning rules: Major bumps for redefinitions or removals of core principles, Minor bumps for additions or major expansions, and Patch bumps for clarifications or typos.

**Version**: 1.0.0 | **Ratified**: 2026-06-29 | **Last Amended**: 2026-06-29
