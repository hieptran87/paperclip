import { readFileSync } from "node:fs";
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DEFAULT_AGENT_INSTRUCTION_FILES, DEFAULT_AGENT_INSTRUCTIONS } from "./templates.js";

export const PLUGIN_ID = "paperclipai.plugin-brms";
export const BRMS_ROOT_FOLDER_KEY = "brms-root";
export const BRMS_MAINTAINER_AGENT_KEY = "brms-maintainer";
export const BRMS_MAINTAINER_SKILL_KEY = "brms-maintainer";
export const BRMS_INGEST_SKILL_KEY = "brms-ingest";
export const BRMS_QUERY_SKILL_KEY = "brms-query";
export const BRMS_LINT_SKILL_KEY = "brms-lint";
export const PAPERCLIP_DISTILL_SKILL_KEY = "paperclip-distill";
export const INDEX_REFRESH_SKILL_KEY = "index-refresh";
export const BRMS_PROJECT_KEY = "brms";
export const CURSOR_WINDOW_ROUTINE_KEY = "cursor-window-processing";
export const NIGHTLY_LINT_ROUTINE_KEY = "nightly-brms-lint";
export const INDEX_REFRESH_ROUTINE_KEY = "index-refresh";
export const DEFAULT_MAX_SOURCE_BYTES = 250000;
export const DEFAULT_MAX_PAPERCLIP_ISSUE_SOURCE_CHARS = 12000;
export const DEFAULT_MAX_PAPERCLIP_CURSOR_WINDOW_CHARS = 60000;
export const DEFAULT_MAX_PAPERCLIP_ROUTINE_RUN_CHARS = 120000;
export const DEFAULT_PAPERCLIP_COST_CENTS_PER_1K_CHARS = 1;
export const BRMS_MAINTENANCE_ROUTINE_KEYS = [
  CURSOR_WINDOW_ROUTINE_KEY,
  NIGHTLY_LINT_ROUTINE_KEY,
  INDEX_REFRESH_ROUTINE_KEY,
] as const;
export const BRMS_MANAGED_SKILL_KEYS = [
  BRMS_MAINTAINER_SKILL_KEY,
  BRMS_INGEST_SKILL_KEY,
  BRMS_QUERY_SKILL_KEY,
  BRMS_LINT_SKILL_KEY,
  PAPERCLIP_DISTILL_SKILL_KEY,
  INDEX_REFRESH_SKILL_KEY,
] as const;

function canonicalSkillKey(skillKey: string) {
  return `plugin/paperclipai-plugin-brms/${skillKey}`;
}

function skillMarkdown(skillKey: (typeof BRMS_MANAGED_SKILL_KEYS)[number]) {
  return readFileSync(new URL(`../skills/${skillKey}/SKILL.md`, import.meta.url), "utf8");
}

export const BRMS_MAINTAINER_SKILL_CANONICAL_KEY = canonicalSkillKey(BRMS_MAINTAINER_SKILL_KEY);
export const BRMS_MANAGED_SKILL_CANONICAL_KEYS = BRMS_MANAGED_SKILL_KEYS.map(canonicalSkillKey);

const CURSOR_WINDOW_ROUTINE_DESCRIPTION = `Process bounded Paperclip issue-history windows into the Business Rules.

Run procedure:
Target space: default (slug: default). Paperclip-derived indexing currently writes only into the default space, so this routine never sweeps other spaces. Per-space Paperclip ingestion profiles are a later phase; until they ship, treat any prompt to operate on a non-default space here as a bug and stop.
1. Resolve the configured brms root, then read the default space AGENTS.md, brms/index.md, and the recent entries in brms/log.md.
2. Review recent Paperclip issue, comment, and document activity for non-plugin-operation work. Skip Business Rules operation issues so routine output does not feed back into itself.
3. Synthesize Paperclip project state into brms/projects/<slug>/standup.md for the executive current-state view, then durable project or root-issue knowledge into focused rules under brms/projects/<slug>/index.md, brms/concepts/, or brms/synthesis/. Keep transient run logs out of durable rules unless they change the project's state or decisions.
4. Write project material as concept-grouped executive synthesis. Link readable issue identifiers when useful, but do not turn project rules into issue-ID lists, UUID dumps, date ledgers, or metadata reports. Always pass brmsId \`default\` and spaceSlug \`default\` to Business Rules tools.
5. Refresh brms/index.md and append a short brms/log.md entry listing the source window, affected rules, skipped windows, warnings, and any follow-up issue needed.
6. If there is no new durable signal, record that in brms/log.md and close the routine issue with a concise note.`;

const NIGHTLY_LINT_ROUTINE_DESCRIPTION = `Lint the Business Rules for structure, provenance, and stale synthesis.

Run procedure:
Target space: default (slug: default). Paperclip-derived indexing currently writes only into the default space, so this routine never sweeps other spaces. Per-space Paperclip ingestion profiles are a later phase; until they ship, treat any prompt to operate on a non-default space here as a bug and stop.
1. Resolve the configured brms root, then read the default space AGENTS.md, brms/index.md, brms/log.md, and the current rule list.
2. Check for orphan rules, missing backlinks, stale source provenance, weak citations, duplicate concepts, contradictory claims, and index/log drift.
3. Inspect the relevant brms rules and raw sources before changing content. Do not invent missing provenance.
4. Apply low-risk fixes directly: refresh backlinks, repair index entries, add missing source links, and append a brms/log.md lint entry. Always pass brmsId \`default\` and spaceSlug \`default\` to Business Rules tools.
5. For ambiguous contradictions or major rewrites, leave the rules unchanged and create or comment a follow-up Paperclip issue with the exact files and evidence.
6. Close the routine issue with counts by severity, files changed, and unresolved findings.`;

const INDEX_REFRESH_ROUTINE_DESCRIPTION = `Refresh the Business Rules navigation and change log.

Run procedure:
Target space: default (slug: default). Paperclip-derived indexing currently writes only into the default space, so this routine never sweeps other spaces. Per-space Paperclip ingestion profiles are a later phase; until they ship, treat any prompt to operate on a non-default space here as a bug and stop.
1. Resolve the configured brms root, then read the default space AGENTS.md, brms/index.md, brms/log.md, and the current rule list.
2. Rebuild brms/index.md so it lists current brms rules by category with concise summaries and valid brmslinks, and attaches brms/projects/<slug>/standup.md links to matching project entries.
3. Verify recently changed brms rules and project standups are present in the index and that removed or renamed rules no longer appear.
4. Do not rewrite content rules unless a broken title or link prevents the index from being accurate. Always pass brmsId \`default\` and spaceSlug \`default\` to Business Rules tools.
5. Append a brms/log.md entry with the index refresh time, rule counts by category, and any unresolved indexing problems.
6. Close the routine issue with the index changes and any follow-up needed.`;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Business Rules",
  description: "Local-file Business Rules plugin for source ingestion, brms browsing, query, lint, and maintenance workflows.",
  author: "Paperclip",
  categories: ["automation", "ui"],
  capabilities: [
    "events.subscribe",
    "api.routes.register",
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "companies.read",
    "projects.read",
    "projects.managed",
    "skills.managed",
    "issues.read",
    "issue.subtree.read",
    "issues.create",
    "issues.update",
    "issues.wakeup",
    "issues.orchestration.read",
    "issue.comments.read",
    "issue.comments.create",
    "issue.documents.read",
    "issue.documents.write",
    "agents.read",
    "agents.managed",
    "agent.sessions.create",
    "agent.sessions.list",
    "agent.sessions.send",
    "agent.sessions.close",
    "routines.managed",
    "local.folders",
    "agent.tools.register",
    "metrics.write",
    "activity.log.write",
    "plugin.state.read",
    "plugin.state.write",
    "ui.sidebar.register",
    "ui.page.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  database: {
    namespaceSlug: "brms",
    migrationsDir: "migrations",
    coreReadTables: ["companies", "issues", "projects", "agents"]
  },
  localFolders: [
    {
      folderKey: BRMS_ROOT_FOLDER_KEY,
      displayName: "BRMS root",
      description: "Company-scoped local folder that stores raw sources, brms rules, Paperclip project standups under brms/projects/, AGENTS.md, IDEA.md, brms/index.md, and brms/log.md.",
      access: "readWrite",
      requiredDirectories: [
        "raw",
        "brms",
        "brms/sources",
        "brms/projects",
        "brms/entities",
        "brms/concepts",
        "brms/synthesis"
      ],
      requiredFiles: ["AGENTS.md", "IDEA.md", "brms/index.md", "brms/log.md"]
    }
  ],
  agents: [
    {
      agentKey: BRMS_MAINTAINER_AGENT_KEY,
      displayName: "BRMS Maintainer",
      role: "knowledge-maintainer",
      title: "Business Rules Maintainer",
      icon: "book-open",
      capabilities: "Ingests source material, maintains local brms rules, answers cited questions, and runs brms lint/maintenance through plugin tools.",
      adapterType: "claude_local",
      adapterPreference: ["claude_local", "codex_local", "gemini_local", "opencode_local", "cursor", "pi_local"],
      adapterConfig: {
        dangerouslySkipPermissions: false,
        dangerouslyBypassApprovalsAndSandbox: false,
        sandbox: true,
        paperclipSkillSync: {
          desiredSkills: BRMS_MANAGED_SKILL_CANONICAL_KEYS
        }
      },
      runtimeConfig: {
        modelProfiles: {
          cheap: {
            purpose: "classification, lint planning, index maintenance"
          }
        }
      },
      permissions: {
        pluginTools: [PLUGIN_ID]
      },
      status: "paused",
      budgetMonthlyCents: 0,
      instructions: {
        entryFile: "AGENTS.md",
        content: DEFAULT_AGENT_INSTRUCTIONS,
        files: DEFAULT_AGENT_INSTRUCTION_FILES,
        assetPath: "agents/brms-maintainer"
      }
    }
  ],
  projects: [
    {
      projectKey: BRMS_PROJECT_KEY,
      displayName: "Business Rules",
      description: "Plugin-managed inspection area for Business Rules ingest, query, lint, and maintenance operation issues.",
      status: "in_progress",
      color: "#2563eb"
    }
  ],
  skills: [
    {
      skillKey: BRMS_MAINTAINER_SKILL_KEY,
      displayName: "Business Rules Maintainer",
      slug: "brms-maintainer",
      description: "Use the Business Rules plugin tools to maintain a cited local company brms.",
      markdown: skillMarkdown(BRMS_MAINTAINER_SKILL_KEY)
    },
    {
      skillKey: BRMS_INGEST_SKILL_KEY,
      displayName: "BRMS Ingest",
      slug: BRMS_INGEST_SKILL_KEY,
      description: "Turn captured raw source material into cited durable Business Rules rules.",
      markdown: skillMarkdown(BRMS_INGEST_SKILL_KEY)
    },
    {
      skillKey: BRMS_QUERY_SKILL_KEY,
      displayName: "BRMS Query",
      slug: BRMS_QUERY_SKILL_KEY,
      description: "Answer questions from the Business Rules with citations and optional durable synthesis.",
      markdown: skillMarkdown(BRMS_QUERY_SKILL_KEY)
    },
    {
      skillKey: BRMS_LINT_SKILL_KEY,
      displayName: "BRMS Lint",
      slug: BRMS_LINT_SKILL_KEY,
      description: "Audit the Business Rules for contradictions, orphan rules, weak provenance, broken links, and missing concepts.",
      markdown: skillMarkdown(BRMS_LINT_SKILL_KEY)
    },
    {
      skillKey: PAPERCLIP_DISTILL_SKILL_KEY,
      displayName: "Paperclip Distill",
      slug: PAPERCLIP_DISTILL_SKILL_KEY,
      description: "Turn Paperclip cursor-window, distill, or backfill source bundles into brms-insightful project knowledge.",
      markdown: skillMarkdown(PAPERCLIP_DISTILL_SKILL_KEY)
    },
    {
      skillKey: INDEX_REFRESH_SKILL_KEY,
      displayName: "Index Refresh",
      slug: INDEX_REFRESH_SKILL_KEY,
      description: "Refresh brms/index.md so it accurately catalogs current brms rules.",
      markdown: skillMarkdown(INDEX_REFRESH_SKILL_KEY)
    }
  ],
  routines: [
    {
      routineKey: CURSOR_WINDOW_ROUTINE_KEY,
      title: "Process Business Rules updates",
      description: CURSOR_WINDOW_ROUTINE_DESCRIPTION,
      status: "paused",
      priority: "low",
      assigneeRef: { resourceKind: "agent", resourceKey: BRMS_MAINTAINER_AGENT_KEY },
      projectRef: { resourceKind: "project", resourceKey: BRMS_PROJECT_KEY },
      concurrencyPolicy: "skip_if_active",
      catchUpPolicy: "skip_missed",
      triggers: [
        {
          kind: "schedule",
          label: "Every 6 hours",
          enabled: false,
          cronExpression: "0 */6 * * *",
          timezone: "UTC",
          signingMode: null,
          replayWindowSec: null
        }
      ],
      issueTemplate: {
        surfaceVisibility: "plugin_operation",
        originId: "routine:cursor-window-processing",
        billingCode: "plugin-brms:distillation"
      }
    },
    {
      routineKey: NIGHTLY_LINT_ROUTINE_KEY,
      title: "Run Business Rules lint",
      description: NIGHTLY_LINT_ROUTINE_DESCRIPTION,
      status: "paused",
      priority: "low",
      assigneeRef: { resourceKind: "agent", resourceKey: BRMS_MAINTAINER_AGENT_KEY },
      projectRef: { resourceKind: "project", resourceKey: BRMS_PROJECT_KEY },
      concurrencyPolicy: "skip_if_active",
      catchUpPolicy: "skip_missed",
      triggers: [
        {
          kind: "schedule",
          label: "Nightly",
          enabled: false,
          cronExpression: "0 3 * * *",
          timezone: "UTC",
          signingMode: null,
          replayWindowSec: null
        }
      ],
      issueTemplate: {
        surfaceVisibility: "plugin_operation",
        originId: "routine:nightly-brms-lint",
        billingCode: "plugin-brms:maintenance"
      }
    },
    {
      routineKey: INDEX_REFRESH_ROUTINE_KEY,
      title: "Refresh Business Rules index",
      description: INDEX_REFRESH_ROUTINE_DESCRIPTION,
      status: "paused",
      priority: "low",
      assigneeRef: { resourceKind: "agent", resourceKey: BRMS_MAINTAINER_AGENT_KEY },
      projectRef: { resourceKind: "project", resourceKey: BRMS_PROJECT_KEY },
      concurrencyPolicy: "skip_if_active",
      catchUpPolicy: "skip_missed",
      triggers: [
        {
          kind: "schedule",
          label: "Hourly",
          enabled: false,
          cronExpression: "0 * * * *",
          timezone: "UTC",
          signingMode: null,
          replayWindowSec: null
        }
      ],
      issueTemplate: {
        surfaceVisibility: "plugin_operation",
        originId: "routine:index-refresh",
        billingCode: "plugin-brms:maintenance"
      }
    }
  ],
  tools: [
    {
      name: "brms_search",
      displayName: "Search BRMS",
      description: "Search indexed brms rule and source metadata for one brms space. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          query: { type: "string" },
          limit: { type: "number" }
        },
        required: ["companyId", "brmsId", "query"]
      }
    },
    {
      name: "brms_read_rule",
      displayName: "Read BRMS Rule",
      description: "Read a markdown brms rule from one brms space. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          path: { type: "string" }
        },
        required: ["companyId", "brmsId", "path"]
      }
    },
    {
      name: "brms_write_rule",
      displayName: "Write BRMS Rule",
      description: "Atomically write a markdown brms rule in one brms space after plugin path validation and optional hash conflict checks. Operation agents should pass the issue's spaceSlug; omitting it uses the default space. Protected control files such as AGENTS.md and IDEA.md are excluded from agent-tool writes.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          path: { type: "string" },
          contents: { type: "string" },
          expectedHash: { type: "string" },
          summary: { type: "string" }
        },
        required: ["companyId", "brmsId", "path", "contents"]
      }
    },
    {
      name: "brms_propose_patch",
      displayName: "Propose BRMS Patch",
      description: "Return a structured proposed rule write for one brms space without changing files. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          path: { type: "string" },
          contents: { type: "string" },
          summary: { type: "string" }
        },
        required: ["companyId", "brmsId", "path", "contents"]
      }
    },
    {
      name: "brms_list_sources",
      displayName: "List BRMS Sources",
      description: "Return captured raw source metadata from one brms space. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          limit: { type: "number" }
        },
        required: ["companyId", "brmsId"]
      }
    },
    {
      name: "brms_read_source",
      displayName: "Read BRMS Source",
      description: "Read a captured raw source from one brms space. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          rawPath: { type: "string" }
        },
        required: ["companyId", "brmsId", "rawPath"]
      }
    },
    {
      name: "brms_append_log",
      displayName: "Append BRMS Log",
      description: "Append a maintenance note to one brms space's brms/log.md. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          entry: { type: "string" }
        },
        required: ["companyId", "brmsId", "entry"]
      }
    },
    {
      name: "brms_update_index",
      displayName: "Update BRMS Index",
      description: "Atomically replace one brms space's brms/index.md with optional hash conflict checks. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          contents: { type: "string" },
          expectedHash: { type: "string" }
        },
        required: ["companyId", "brmsId", "contents"]
      }
    },
    {
      name: "brms_list_backlinks",
      displayName: "List BRMS Backlinks",
      description: "Return indexed backlinks for a brms rule in one brms space. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" },
          path: { type: "string" }
        },
        required: ["companyId", "brmsId", "path"]
      }
    },
    {
      name: "brms_list_rules",
      displayName: "List BRMS Rules",
      description: "Return the known rule index from one brms space's plugin metadata. Operation agents should pass the issue's spaceSlug; omitting it uses the default space.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string" },
          brmsId: { type: "string" },
          spaceSlug: { type: "string" }
        },
        required: ["companyId", "brmsId"]
      }
    }
  ],
  apiRoutes: [
    {
      routeKey: "overview",
      method: "GET",
      path: "/overview",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" }
    },
    {
      routeKey: "bootstrap",
      method: "POST",
      path: "/bootstrap",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "capture-source",
      method: "POST",
      path: "/sources",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "spaces",
      method: "GET",
      path: "/spaces",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" }
    },
    {
      routeKey: "create-space",
      method: "POST",
      path: "/spaces",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "update-space",
      method: "PATCH",
      path: "/spaces/:spaceSlug",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "bootstrap-space",
      method: "POST",
      path: "/spaces/:spaceSlug/bootstrap",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "archive-space",
      method: "POST",
      path: "/spaces/:spaceSlug/archive",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "operations",
      method: "GET",
      path: "/operations",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" }
    },
    {
      routeKey: "start-query",
      method: "POST",
      path: "/query-sessions",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    },
    {
      routeKey: "file-as-rule",
      method: "POST",
      path: "/file-as-rule",
      auth: "board",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" }
    }
  ],
  ui: {
    slots: [
      {
        type: "sidebar",
        id: "brms-sidebar",
        displayName: "BRMS",
        exportName: "SidebarLink",
        order: 35
      },
      {
        type: "page",
        id: "brms-page",
        displayName: "BRMS",
        exportName: "BRMSRule",
        routePath: "brms"
      },
      {
        type: "routeSidebar",
        id: "brms-route-sidebar",
        displayName: "BRMS",
        exportName: "BRMSRouteSidebar",
        routePath: "brms"
      }
    ]
  }
};

export default manifest;
