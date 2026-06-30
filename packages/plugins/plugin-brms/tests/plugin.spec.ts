import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import type { Agent, Issue, PluginManagedRoutineResolution, Project } from "@paperclipai/plugin-sdk";
import manifest, {
  CURSOR_WINDOW_ROUTINE_KEY,
  INDEX_REFRESH_ROUTINE_KEY,
  NIGHTLY_LINT_ROUTINE_KEY,
  PAPERCLIP_DISTILL_SKILL_KEY,
  BRMS_MAINTAINER_AGENT_KEY,
  BRMS_MAINTAINER_SKILL_CANONICAL_KEY,
  BRMS_MAINTAINER_SKILL_KEY,
  BRMS_MANAGED_SKILL_CANONICAL_KEYS,
  BRMS_MANAGED_SKILL_KEYS,
  BRMS_MAINTENANCE_ROUTINE_KEYS,
  BRMS_PROJECT_KEY,
} from "../src/manifest.js";
import {
  DEFAULT_AGENT_INSTRUCTION_FILES,
  DEFAULT_AGENT_INSTRUCTIONS,
  DEFAULT_IDEA,
  DEFAULT_INDEX,
  DEFAULT_LOG,
  DEFAULT_BRMS_SCHEMA,
  KARPATHY_LLM_BRMS_GIST_URL,
  LINT_PROMPT,
  QUERY_PROMPT,
} from "../src/templates.js";
import { SettingsRule, SidebarLink, BRMSRule, BRMSRouteSidebar } from "../src/ui/index.js";
import plugin from "../src/worker.js";
import { OPERATION_ORIGIN_KIND, type BRMSSkillResource } from "../src/brms.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const ORIGINAL_DEPLOYMENT_MODE = process.env.PAPERCLIP_DEPLOYMENT_MODE;
const ORIGINAL_DEPLOYMENT_EXPOSURE = process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE;
type TestBridgeGlobal = typeof globalThis & {
  __paperclipPluginBridge__?: {
    sdkUi?: Record<string, unknown>;
  };
};
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const DEFAULT_MANAGED_SKILL = {
  status: "resolved",
  skillId: "skill-1",
  resourceKey: BRMS_MAINTAINER_SKILL_KEY,
  details: {
    name: "Business Rules Maintainer",
    key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY,
    description: "Use the Business Rules plugin tools to maintain a cited local company brms.",
  },
  skill: {
    id: "skill-1",
    name: "Business Rules Maintainer",
    key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY,
    description: "Use the Business Rules plugin tools to maintain a cited local company brms.",
  },
};
const DEFAULT_MANAGED_SKILLS = BRMS_MANAGED_SKILL_KEYS.map((skillKey, index) => ({
  status: "resolved",
  skillId: `skill-${index + 1}`,
  resourceKey: skillKey,
  details: skillKey === BRMS_MAINTAINER_SKILL_KEY
    ? DEFAULT_MANAGED_SKILL.details
    : {
      name: skillKey.split("-").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" "),
      key: BRMS_MANAGED_SKILL_CANONICAL_KEYS[index],
      description: null,
    },
  skill: skillKey === BRMS_MAINTAINER_SKILL_KEY
    ? DEFAULT_MANAGED_SKILL.skill
    : {
      id: `skill-${index + 1}`,
      name: skillKey.split("-").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" "),
      key: BRMS_MANAGED_SKILL_CANONICAL_KEYS[index],
      description: null,
    },
}));

let mockPathname = "/PAP/brms";
let mockSearch = "";
let mockAutoSelectFile: string | null = null;
let mockNavigatedTo: string | null = null;
let mockOverviewFolder: Record<string, unknown> | null = null;
let mockSettingsFolder: Record<string, unknown> | null = null;
let mockSettingsManagedAgent: Record<string, unknown> | null = null;
let mockSettingsManagedRoutines: Array<Record<string, unknown>> = [];
let mockSettingsManagedSkills: Array<Record<string, unknown>> = [];
let mockDistillationOverviewData: Record<string, unknown> | null = null;
let mockRuleContentsByPath: Record<string, string> = {};
let mockRuleMetadataByPath: Record<string, {
  backlinks?: string[];
  sourceRefs?: Array<Record<string, unknown> | string>;
}> = {};

beforeEach(() => {
  if (ORIGINAL_DEPLOYMENT_MODE == null) {
    delete process.env.PAPERCLIP_DEPLOYMENT_MODE;
  } else {
    process.env.PAPERCLIP_DEPLOYMENT_MODE = ORIGINAL_DEPLOYMENT_MODE;
  }
  if (ORIGINAL_DEPLOYMENT_EXPOSURE == null) {
    delete process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE;
  } else {
    process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE = ORIGINAL_DEPLOYMENT_EXPOSURE;
  }
  mockPathname = "/PAP/brms";
  mockSearch = "";
  mockAutoSelectFile = null;
  mockNavigatedTo = null;
  mockOverviewFolder = null;
  mockSettingsFolder = null;
  mockSettingsManagedAgent = null;
  mockSettingsManagedRoutines = [];
  mockSettingsManagedSkills = [];
  mockDistillationOverviewData = null;
  mockRuleContentsByPath = {};
  mockRuleMetadataByPath = {};
  (globalThis as TestBridgeGlobal).__paperclipPluginBridge__ = {
    sdkUi: {
      usePluginData: (key: string, params?: Record<string, unknown>) => {
        if (key === "overview") {
          return {
            data: {
              status: "ok",
              checkedAt: new Date().toISOString(),
              brmsId: "default",
              folder: mockOverviewFolder ?? {
                configured: true,
                path: "/tmp/company-brms",
                realPath: "/tmp/company-brms",
                access: "readWrite",
                readable: true,
                writable: true,
                requiredDirectories: [],
                requiredFiles: [],
                missingDirectories: [],
                missingFiles: [],
                healthy: true,
                problems: [],
                checkedAt: new Date().toISOString(),
              },
              managedAgent: { status: "resolved", source: "managed", agentId: "agent-1", resourceKey: "brms-maintainer", details: { name: "BRMS Maintainer", status: "idle", adapterType: "claude_local", icon: "book-open", urlKey: "brms-maintainer" } },
              managedProject: { status: "resolved", projectId: "project-1", details: { name: "Business Rules", status: "in_progress" } },
              managedSkills: DEFAULT_MANAGED_SKILLS,
              operationCount: 0,
              eventIngestion: {
                enabled: false,
                sources: { issues: false, comments: false, documents: false },
                brmsId: "default",
                maxCharacters: 12000,
              },
              capabilities: [],
              prompts: { query: QUERY_PROMPT, lint: LINT_PROMPT },
            },
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        if (key === "spaces") {
          return {
            data: {
              spaces: [
                {
                  id: "space-default",
                  companyId: COMPANY_ID,
                  brmsId: "default",
                  slug: "default",
                  displayName: "default",
                  spaceType: "managed",
                  folderMode: "managed_subfolder",
                  rootFolderKey: "brms-root",
                  pathPrefix: null,
                  configuredRootPath: null,
                  accessScope: "shared",
                  ownerUserId: null,
                  ownerAgentId: null,
                  teamKey: null,
                  settings: {},
                  status: "active",
                  createdAt: null,
                  updatedAt: null,
                },
              ],
            },
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        if (key === "rules") {
          return {
            data: {
              rules: [
                {
                  path: "brms/concepts/sidebar-navigation.md",
                  title: "Sidebar navigation",
                  ruleType: "concepts",
                  backlinkCount: 0,
                  sourceCount: 0,
                  contentHash: "abc123",
                  updatedAt: new Date().toISOString(),
                },
              ],
              sources: [
                {
                  rawPath: "raw/sidebar-notes.md",
                  title: "Sidebar notes",
                  sourceType: "text",
                  url: null,
                  status: "captured",
                  createdAt: new Date().toISOString(),
                },
              ],
            },
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        if (key === "settings") {
          return {
            data: {
              status: "ok",
              checkedAt: new Date().toISOString(),
              brmsId: "default",
              folder: mockSettingsFolder ?? {
                configured: true,
                path: "/tmp/company-brms",
                realPath: "/tmp/company-brms",
                access: "readWrite",
                readable: true,
                writable: true,
                requiredDirectories: [],
                requiredFiles: [],
                missingDirectories: [],
                missingFiles: [],
                healthy: true,
                problems: [],
                checkedAt: new Date().toISOString(),
              },
              managedAgent: mockSettingsManagedAgent ?? { status: "resolved", source: "managed", agentId: "agent-1", resourceKey: "brms-maintainer", details: { name: "BRMS Maintainer", status: "idle", adapterType: "claude_local", icon: "book-open", urlKey: "brms-maintainer" } },
              managedProject: { status: "resolved", source: "managed", projectId: "project-1", resourceKey: "brms", details: { name: "Business Rules", status: "in_progress" } },
              managedSkills: mockSettingsManagedSkills.length > 0 ? mockSettingsManagedSkills : DEFAULT_MANAGED_SKILLS,
              managedRoutines: mockSettingsManagedRoutines,
              managedRoutine: mockSettingsManagedRoutines[0] ?? null,
              eventIngestion: {
                enabled: false,
                sources: { issues: false, comments: false, documents: false },
                brmsId: "default",
                maxCharacters: 12000,
              },
              agentOptions: [{ id: "agent-1", name: "BRMS Maintainer", status: "idle", icon: "book-open", urlKey: "brms-maintainer" }],
              projectOptions: [{ id: "project-1", name: "Business Rules", status: "in_progress", color: "#2563eb" }],
              capabilities: [],
            },
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        if (key === "space") {
          return {
            data: {
              id: "space-default",
              companyId: COMPANY_ID,
              brmsId: "default",
              slug: "default",
              displayName: "default",
              spaceType: "managed",
              folderMode: "managed_subfolder",
              rootFolderKey: "brms-root",
              pathPrefix: null,
              configuredRootPath: null,
              accessScope: "shared",
              ownerUserId: null,
              ownerAgentId: null,
              teamKey: null,
              settings: {},
              status: "active",
              createdAt: null,
              updatedAt: null,
              relativeRoot: "",
              folder: {
                configured: true,
                path: "/tmp/company-brms",
                realPath: "/tmp/company-brms",
                access: "readWrite",
                readable: true,
                writable: true,
                requiredDirectories: ["raw", "brms"],
                requiredFiles: ["AGENTS.md"],
                missingDirectories: [],
                missingFiles: [],
                healthy: true,
                problems: [],
                checkedAt: new Date().toISOString(),
              },
            },
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        if (key === "distillation-overview") {
          return {
            data: mockDistillationOverviewData,
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        if (key === "rule-content") {
          const path = typeof params?.path === "string" ? params.path : "brms/index.md";
          const contents = mockRuleContentsByPath[path] ?? (path === "AGENTS.md"
            ? DEFAULT_AGENT_INSTRUCTIONS
            : path === "IDEA.md"
              ? DEFAULT_IDEA
              : `# ${path}\n`);
          return {
            data: {
              brmsId: "default",
              path,
              contents,
              title: path === "AGENTS.md" ? "Business Rules Maintainer" : path.replace(/\.md$/, ""),
              ruleType: path === "AGENTS.md" ? null : "index",
              backlinks: mockRuleMetadataByPath[path]?.backlinks ?? [],
              sourceRefs: mockRuleMetadataByPath[path]?.sourceRefs ?? [],
              updatedAt: null,
              hash: "abc123",
            },
            loading: false,
            error: null,
            refresh: () => undefined,
          };
        }
        return { data: null, loading: false, error: null, refresh: () => undefined };
      },
      usePluginAction: () => async () => ({}),
      usePluginToast: () => () => null,
      useHostNavigation: () => ({
        resolveHref: (to: string) => `/PAP${to.startsWith("/") ? to : `/${to}`}`,
        navigate: (to: string) => { mockNavigatedTo = to; },
        linkProps: (to: string) => ({
          href: `/PAP${to.startsWith("/") ? to : `/${to}`}`,
          onClick: () => undefined,
        }),
      }),
      useHostLocation: () => ({
        pathname: mockPathname,
        search: mockSearch,
        hash: "",
      }),
      FileTree: (props: {
        nodes: Array<{ name: string; path: string; kind: string; children?: Array<{ name: string; path: string; kind: string }> }>;
        selectedFile?: string | null;
        ariaLabel?: string;
        wrapLabels?: boolean;
        fileBadges?: Record<string, unknown>;
        onSelectFile?: (path: string) => void;
      }) => {
        if (mockAutoSelectFile) props.onSelectFile?.(mockAutoSelectFile);
        return createElement(
          "div",
          {
            role: "tree",
            "aria-label": props.ariaLabel,
            "data-selected-file": props.selectedFile ?? "",
            "data-wrap-labels": String(props.wrapLabels),
            "data-has-file-badges": String(Boolean(props.fileBadges && Object.keys(props.fileBadges).length > 0)),
          },
          props.nodes.map((node) => createElement("div", { key: node.path }, node.name)),
        );
      },
      IssuesList: (props: {
        projectId?: string | null;
        filters?: { originKindPrefix?: string };
      }) => createElement(
        "div",
        { "data-testid": "plugin-issues-list" },
        `Issues table · ${props.projectId ?? "no-project"} · ${props.filters?.originKindPrefix ?? "no-origin-filter"}`,
      ),
      MarkdownBlock: ({ content }: { content: string }) => createElement("div", { "data-testid": "markdown-block" }, content),
      MarkdownEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => createElement("textarea", {
        "data-testid": "markdown-editor",
        value,
        onChange: (event: { currentTarget: { value: string } }) => onChange(event.currentTarget.value),
      }),
      AssigneePicker: (props: {
        value: string;
        placeholder?: string;
        onChange: (value: string, selection: { assigneeAgentId: string | null; assigneeUserId: string | null }) => void;
      }) => createElement(
        "button",
        {
          type: "button",
          "data-testid": "assignee-picker",
          onClick: () => props.onChange("agent:agent-1", { assigneeAgentId: "agent-1", assigneeUserId: null }),
        },
        props.value === "agent:agent-1" ? "BRMS Maintainer" : (props.placeholder ?? "Select assignee"),
      ),
      ProjectPicker: (props: {
        value: string;
        placeholder?: string;
        onChange: (projectId: string) => void;
      }) => createElement(
        "button",
        {
          type: "button",
          "data-testid": "project-picker",
          onClick: () => props.onChange("project-1"),
        },
        props.value === "project-1" ? "Business Rules" : (props.placeholder ?? "Project"),
      ),
      ManagedRoutinesList: (props: {
        routines: Array<{
          key: string;
          title: string;
          href?: string | null;
          projectId?: string | null;
          assigneeAgentId?: string | null;
          defaultDrift?: { changedFields: string[] } | null;
        }>;
        agents?: Array<{ id: string; name: string }>;
        projects?: Array<{ id: string; name: string }>;
        onReset?: (routine: { key: string; title: string }) => void;
      }) => createElement(
        "div",
        { "data-testid": "managed-routines-list" },
        props.routines.map((routine) => {
          const agent = props.agents?.find((item) => item.id === routine.assigneeAgentId);
          const project = props.projects?.find((item) => item.id === routine.projectId);
          return createElement(
            "div",
            { key: routine.key },
            createElement("span", null, routine.title),
            createElement("button", null, "Run now"),
            createElement("button", { role: "switch" }, "On"),
            routine.href ? createElement("a", { href: `/PAP${routine.href}` }, "Configure") : null,
            routine.defaultDrift?.changedFields.length
              ? createElement("span", null, `Plugin defaults changed: ${routine.defaultDrift.changedFields.join(", ")}`)
              : null,
            routine.defaultDrift?.changedFields.length && props.onReset
              ? createElement("button", null, "Reset")
              : null,
            createElement("span", null, `${project?.name ?? "No project"} · ${agent?.name ?? "No default agent"}`),
          );
        }),
      ),
    },
  };
});

afterEach(() => {
  if (ORIGINAL_DEPLOYMENT_MODE == null) {
    delete process.env.PAPERCLIP_DEPLOYMENT_MODE;
  } else {
    process.env.PAPERCLIP_DEPLOYMENT_MODE = ORIGINAL_DEPLOYMENT_MODE;
  }
  if (ORIGINAL_DEPLOYMENT_EXPOSURE == null) {
    delete process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE;
  } else {
    process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE = ORIGINAL_DEPLOYMENT_EXPOSURE;
  }
  delete (globalThis as TestBridgeGlobal).__paperclipPluginBridge__;
});

function brmsMaintainerAgent(): Agent {
  const now = new Date();
  return {
    id: "22222222-2222-4222-8222-222222222222",
    companyId: COMPANY_ID,
    name: "BRMS Maintainer",
    urlKey: "brms-maintainer",
    role: "general",
    title: "Business Rules Maintainer",
    icon: "book-open",
    status: "idle",
    reportsTo: null,
    capabilities: "Maintains the brms",
    adapterType: "claude_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: {
      paperclipManagedResource: {
        pluginKey: manifest.id,
        resourceKind: "agent",
        resourceKey: "brms-maintainer",
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function existingAgent(): Agent {
  return {
    ...brmsMaintainerAgent(),
    id: "44444444-4444-4444-8444-444444444444",
    name: "Existing Knowledge Agent",
    urlKey: "existing-knowledge-agent",
    title: "Knowledge Agent",
    metadata: {},
  };
}

function existingProject(): Project {
  const now = new Date();
  return {
    id: "55555555-5555-4555-8555-555555555555",
    companyId: COMPANY_ID,
    urlKey: "existing-brms-project",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Existing BRMS Project",
    description: "Existing project selected for brms operations.",
    status: "in_progress",
    leadAgentId: null,
    targetDate: null,
    color: "#0f766e",
    icon: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/existing-brms-project",
      effectiveLocalFolder: "/tmp/existing-brms-project",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
    managedByPlugin: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function paperclipIssue(overrides: Partial<Issue> = {}): Issue {
  const now = new Date();
  return {
    id: "66666666-6666-4666-8666-666666666666",
    companyId: COMPANY_ID,
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Design event ingestion controls",
    description: "Decide which Paperclip issues, comments, and documents can be ingested into the brms.",
    status: "todo",
    workMode: "standard",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 3204,
    identifier: "PAP-3204",
    originId: null,
    originRunId: null,
    originFingerprint: null,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionPolicy: null,
    executionState: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function brmsSpaceRow(space: Record<string, unknown>) {
  return {
    id: space.id,
    company_id: space.companyId ?? COMPANY_ID,
    brms_id: space.brmsId ?? "default",
    slug: space.slug,
    display_name: space.displayName,
    space_type: space.spaceType ?? "local_folder",
    folder_mode: space.folderMode ?? "managed_subfolder",
    root_folder_key: space.rootFolderKey ?? "brms-root",
    path_prefix: space.pathPrefix ?? `spaces/${space.slug}`,
    configured_root_path: space.configuredRootPath ?? null,
    access_scope: space.accessScope ?? "shared",
    owner_user_id: space.ownerUserId ?? null,
    owner_agent_id: space.ownerAgentId ?? null,
    team_key: space.teamKey ?? null,
    settings: space.settings ?? {},
    status: space.status ?? "active",
    created_at: space.createdAt ?? null,
    updated_at: space.updatedAt ?? null,
  };
}

function defaultBRMSSpaceRow() {
  return brmsSpaceRow({
    id: "77777777-7777-4777-8777-7777777777d0",
    companyId: COMPANY_ID,
    brmsId: "default",
    slug: "default",
    displayName: "default",
    pathPrefix: null,
    accessScope: "shared",
    settings: {},
  });
}

function mockPersistedBRMSSpace(harness: ReturnType<typeof createTestHarness>, space: Record<string, unknown>) {
  const row = brmsSpaceRow(space);
  const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
  harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
    if (sql.includes("brms_spaces") && params?.[2] === row.slug) {
      return [row] as T[];
    }
    if (sql.includes("brms_spaces") && sql.includes("ORDER BY CASE WHEN slug = 'default'")) {
      return [defaultBRMSSpaceRow(), row] as T[];
    }
    return originalQuery<T>(sql, params);
  };
}

describe("Business Rules plugin scaffold", () => {
  it("declares standalone plugin surfaces without core brms coupling", () => {
    expect(manifest.id).toBe("paperclipai.plugin-brms");
    expect(manifest.entrypoints.worker).toBe("./dist/worker.js");
    expect(manifest.entrypoints.ui).toBe("./dist/ui");
    expect(manifest.database?.namespaceSlug).toBe("brms");
    expect(manifest.localFolders?.[0]?.requiredDirectories).toContain("brms/projects");
    expect(manifest.localFolders?.[0]?.requiredDirectories).not.toContain("projects");
    expect(manifest.localFolders?.[0]?.requiredFiles).toEqual([
      "AGENTS.md",
      "IDEA.md",
      "brms/index.md",
      "brms/log.md",
    ]);
    expect(manifest.agents?.[0]?.agentKey).toBe("brms-maintainer");
    expect(manifest.agents?.[0]?.adapterType).toBe("claude_local");
    expect(manifest.agents?.[0]?.adapterConfig).toMatchObject({
      dangerouslySkipPermissions: false,
      dangerouslyBypassApprovalsAndSandbox: false,
      sandbox: true,
    });
    expect(manifest.agents?.[0]?.instructions?.entryFile).toBe("AGENTS.md");
    expect(manifest.agents?.[0]?.instructions?.content).toContain("You are the maintainer of this personal brms");
    expect(manifest.agents?.[0]?.instructions?.files?.["AGENTS.md"]).toContain("{{localFolders.brms-root.path}}");
    expect(manifest.agents?.[0]?.instructions?.assetPath).toBe("agents/brms-maintainer");
    expect(manifest.projects?.[0]?.projectKey).toBe("brms");
    expect(manifest.routines?.map((routine) => routine.routineKey)).toEqual([
      CURSOR_WINDOW_ROUTINE_KEY,
      NIGHTLY_LINT_ROUTINE_KEY,
      INDEX_REFRESH_ROUTINE_KEY,
    ]);
    expect(manifest.routines).toEqual(
      BRMS_MAINTENANCE_ROUTINE_KEYS.map((routineKey) => expect.objectContaining({
        routineKey,
        assigneeRef: { resourceKind: "agent", resourceKey: BRMS_MAINTAINER_AGENT_KEY },
        projectRef: { resourceKind: "project", resourceKey: BRMS_PROJECT_KEY },
        concurrencyPolicy: "skip_if_active",
        catchUpPolicy: "skip_missed",
        issueTemplate: expect.objectContaining({
          surfaceVisibility: "plugin_operation",
          billingCode: expect.stringMatching(/^plugin-brms:/),
        }),
      })),
    );
    for (const routine of manifest.routines ?? []) {
      expect(routine.description).toContain("Run procedure:");
      expect(routine.description).toContain("Target space: default (slug: default)");
      expect(routine.description).toContain("spaceSlug `default`");
      expect(routine.description).toContain("AGENTS.md");
      expect(routine.description).toContain("brms/log.md");
    }
    expect(manifest.tools?.map((tool) => tool.name)).toEqual([
      "brms_search",
      "brms_read_rule",
      "brms_write_rule",
      "brms_propose_patch",
      "brms_list_sources",
      "brms_read_source",
      "brms_append_log",
      "brms_update_index",
      "brms_list_backlinks",
      "brms_list_rules",
    ]);
    expect(manifest.ui?.slots?.map((slot) => slot.type)).toEqual([
      "sidebar",
      "page",
      "routeSidebar",
    ]);
    expect(manifest.capabilities).not.toContain("instance.settings.register");
    expect(manifest.instanceConfigSchema).toBeUndefined();
    const routeSidebarSlot = manifest.ui?.slots?.find((slot) => slot.type === "routeSidebar");
    expect(routeSidebarSlot).toMatchObject({
      id: "brms-route-sidebar",
      exportName: "BRMSRouteSidebar",
      routePath: "brms",
    });
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.devDependencies?.react).toBeUndefined();
    expect(packageJson.devDependencies?.["react-dom"]).toBeDefined();
    expect(packageJson.devDependencies?.["@types/react-dom"]).toBeDefined();
    expect(packageJson.peerDependencies?.react).toBe(">=18");
  });

  it("renders a host-aligned sidebar link with an open-book icon", () => {
    const markup = renderToStaticMarkup(createElement(SidebarLink, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain('href="/PAP/brms"');
    expect(markup).toContain("gap-2.5 px-3 py-2 text-[13px] font-medium");
    expect(markup).toContain("hover:bg-accent/50 hover:text-foreground");
    expect(markup).toContain("<svg");
    expect(markup).toContain("M12 7v14");
    expect(markup).not.toContain("BRMS plugin");
    expect(markup).not.toContain("border-radius:999");
    expect(markup).not.toContain("📖");
  });

  it("ships Karpathy-pattern schema and workflow prompts by default", () => {
    expect(DEFAULT_BRMS_SCHEMA).toContain("You are the maintainer of this personal brms");
    expect(DEFAULT_BRMS_SCHEMA).toContain("raw/");
    expect(DEFAULT_BRMS_SCHEMA).toContain("brms/projects/<project-slug>/standup.md");
    expect(DEFAULT_BRMS_SCHEMA).toContain("brms/projects/<project-slug>/index.md");
    expect(DEFAULT_BRMS_SCHEMA).toContain("Do not create a top-level `projects/` directory");
    expect(DEFAULT_BRMS_SCHEMA).not.toContain("\n├── projects/");
    expect(DEFAULT_BRMS_SCHEMA).toContain("brms/");
    expect(DEFAULT_BRMS_SCHEMA).toContain("AGENTS.md");
    expect(DEFAULT_IDEA).toContain("persistent, compounding artifact");
    expect(DEFAULT_AGENT_INSTRUCTIONS).toContain("You are the maintainer of this personal brms");
    expect(DEFAULT_AGENT_INSTRUCTIONS).toContain("ingest, query, lint, index, or maintenance work");
    expect(DEFAULT_AGENT_INSTRUCTIONS).toContain("dedicated Business Rules skill installed on this agent");
    expect(DEFAULT_AGENT_INSTRUCTIONS).not.toContain("skills/<name>/SKILL.md");
    expect(DEFAULT_AGENT_INSTRUCTION_FILES["skills/brms-ingest/SKILL.md"]).toBeUndefined();
    expect(manifest.skills?.map((skill) => skill.skillKey)).toEqual([...BRMS_MANAGED_SKILL_KEYS]);
    expect(manifest.agents?.[0]?.adapterConfig?.paperclipSkillSync).toEqual({
      desiredSkills: BRMS_MANAGED_SKILL_CANONICAL_KEYS,
    });
    expect(QUERY_PROMPT).toContain("brms-query skill");
    expect(QUERY_PROMPT).not.toContain("skills/brms-query/SKILL.md");
    expect(QUERY_PROMPT).toContain("filed back into brms/");
    expect(LINT_PROMPT).toContain("brms-lint skill");
    expect(LINT_PROMPT).not.toContain("skills/brms-lint/SKILL.md");
    expect(LINT_PROMPT).toContain("severity");
  });

  it("renders the route-scoped BRMS sidebar with tool actions, rule navigation, and a back link", () => {
    const markup = renderToStaticMarkup(createElement(BRMSRouteSidebar, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain('href="/PAP/dashboard"');
    expect(markup).toContain("PAP");
    expect(markup).toContain('href="/PAP/brms/query"');
    expect(markup).not.toContain('href="/PAP/brms/lint"');
    expect(markup).toContain('href="/PAP/brms/history"');
    expect(markup).toContain('href="/PAP/brms/settings"');
    expect(markup).not.toContain('href="/PAP/brms/operations"');
    // Add Content reuses the legacy /brms/ingest route so deep links still work.
    expect(markup).toContain('href="/PAP/brms/ingest"');
    expect(markup).toContain('aria-label="BRMS primary"');
    expect(markup).toContain('aria-label="BRMS secondary"');
    for (const label of ["Ask", "Add Content", "History", "Settings", "Shared Spaces", "default", "raw", "brms", "AGENTS.md", "IDEA.md"]) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain(">Lint</span>");
    expect(markup).not.toContain(">Ingest</span>");
    expect(markup).not.toContain(">Operations</span>");
    expect(markup).not.toContain('text-sm font-bold text-foreground">BRMS');
    expect(markup).not.toContain("Browse");
    expect(markup).not.toContain(">Query<");
    expect(markup).toContain('role="tree"');
    expect(markup).toContain('data-selected-file=""');
    expect(markup).toContain('data-wrap-labels="false"');
    expect(markup).toContain('data-has-file-badges="false"');
  });

  it("routes legacy BRMS operations URLs to the History issue table", () => {
    mockPathname = "/PAP/brms/operations";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Issues table · project-1 · plugin:paperclipai.plugin-brms:operation");
    expect(markup).not.toContain("Recent runs");
    expect(markup).not.toContain(">Operations</h2>");
  });

  it("loads AGENTS.md from the BRMS rule and exposes an edit affordance", () => {
    mockPathname = "/PAP/brms/rule/templates/AGENTS.md";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("AGENTS");
    expect(markup).toContain(">AGENTS.md</h1>");
    expect(markup).not.toContain(">Business Rules Maintainer</h1>");
    expect(markup).toContain("You are the maintainer of this personal brms");
    expect(markup).toContain("brms-root `AGENTS.md`");
    expect(markup).toContain("Edit rule");
    expect(markup).toContain("Updated —");
    expect(markup).not.toContain("0 backlinks");
    expect(markup).not.toContain("0 sources");
    expect(markup).not.toContain("abc123");
    expect(markup).not.toContain("+ Ingest");
    expect(markup).not.toContain("Folder healthy");
  });

  it("does not render rule footer sources and backlinks", () => {
    mockPathname = "/PAP/brms/rule/brms/projects/control-plane/index.md";
    mockRuleContentsByPath["brms/projects/control-plane/index.md"] = "# Control plane\n\nCurrent project state.";
    mockRuleMetadataByPath["brms/projects/control-plane/index.md"] = {
      backlinks: ["brms/backlinks/hidden-footer-link.md"],
      sourceRefs: [{ kind: "issue", issueIdentifier: "PAP-FOOTER-1" }],
    };

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Current project state.");
    expect(markup).not.toContain(">Sources</");
    expect(markup).not.toContain(">Backlinks</");
    expect(markup).not.toContain("PAP-FOOTER-1");
    expect(markup).not.toContain("hidden-footer-link");
  });

  it("renders YAML frontmatter as foldable properties without duplicating title", () => {
    mockPathname = "/PAP/brms/rule/brms/concepts/sidebar-navigation.md";
    mockRuleContentsByPath["brms/concepts/sidebar-navigation.md"] = `---
title: Sidebar navigation
type: concept
tags: [paperclip, brms]
sources:
  - raw/sidebar-notes.md
created: 2026-05-04
updated: 2026-05-04
---
# Sidebar navigation

Route sidebar state stays attached to the selected brms rule.
`;

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("<summary");
    expect(markup).toContain("Properties");
    expect(markup).toContain(">type</dt>");
    expect(markup).toContain("concept");
    expect(markup).toContain(">tags</dt>");
    expect(markup).toContain("paperclip");
    expect(markup).toContain("brms");
    expect(markup).toContain(">sources</dt>");
    expect(markup).toContain("raw/sidebar-notes.md");
    expect(markup).toContain("Route sidebar state");
    expect(markup).not.toContain("title: Sidebar navigation");
    expect(markup).not.toContain("title</dt>");
    expect(markup).not.toContain("---");
  });

  it("renders a foldable on-this-rule pane from brms rule headings", () => {
    mockPathname = "/PAP/brms/rule/brms/concepts/sidebar-navigation.md";
    mockRuleContentsByPath["brms/concepts/sidebar-navigation.md"] = `# Sidebar navigation

## Why it matters

Route sidebar state stays attached to the selected brms rule.

### Deep link behavior

BRMS links preserve normal browser navigation.

\`\`\`md
## Ignored code heading
\`\`\`

## Why it matters

Duplicate headings receive stable suffixes.
`;

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain('aria-label="On this rule"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-current="location"');
    expect(markup).toContain('href="#why-it-matters"');
    expect(markup).toContain('href="#deep-link-behavior"');
    expect(markup).toContain('href="#why-it-matters-2"');
    expect(markup).not.toContain('href="#ignored-code-heading"');
    const tocMarkup = markup.slice(
      markup.indexOf('aria-label="On this rule"'),
      markup.indexOf("</aside>", markup.indexOf('aria-label="On this rule"')),
    );
    expect(tocMarkup).toContain("position:sticky");
    expect(tocMarkup).toContain("top:88px");
    expect(tocMarkup).not.toContain("background:color-mix");
    expect(tocMarkup).not.toContain("border-radius");
  });

  it("shows folder repair instead of reading rules when the brms root is stale", () => {
    mockPathname = "/PAP/brms/rule/AGENTS.md";
    mockOverviewFolder = {
      configured: true,
      path: "/tmp/deleted-brms-root",
      realPath: null,
      access: "readWrite",
      readable: false,
      writable: false,
      requiredDirectories: ["raw", "brms"],
      requiredFiles: ["AGENTS.md"],
      missingDirectories: ["raw", "brms"],
      missingFiles: ["AGENTS.md"],
      healthy: false,
      problems: [
        { code: "missing", message: "Configured local folder cannot be inspected.", path: "/tmp/deleted-brms-root" },
      ],
      checkedAt: new Date().toISOString(),
    };

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Repair brms root folder");
    expect(markup).toContain("/tmp/deleted-brms-root");
    expect(markup).toContain("Configured local folder cannot be inspected.");
    expect(markup).toContain("Repair &amp; bootstrap");
    expect(markup).not.toContain("Failed to read AGENTS.md");
    expect(markup).not.toContain(">AGENTS.md</h1>");
  });

  it("serializes root template rules as regular path segments", () => {
    mockAutoSelectFile = "AGENTS.md";
    renderToStaticMarkup(createElement(BRMSRouteSidebar, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(mockNavigatedTo).toBe("/brms/rule/AGENTS.md");
  });

  it("highlights Settings for legacy lint links after lint moved under Settings", () => {
    mockPathname = "/PAP/brms/lint";
    const markup = renderToStaticMarkup(createElement(BRMSRouteSidebar, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).not.toContain('href="/PAP/brms/lint"');
    const settingsAnchor = markup.match(/<a[^>]*href="\/PAP\/brms\/settings"[^>]*>/);
    expect(settingsAnchor?.[0]).toContain('aria-current="page"');
    expect(settingsAnchor?.[0]).toContain("text-foreground");
    expect(settingsAnchor?.[0]).not.toContain("bg-accent");
    const askAnchor = markup.match(/<a[^>]*href="\/PAP\/brms\/query"[^>]*>/);
    expect(askAnchor?.[0]).not.toContain('aria-current="page"');
  });

  it("renders the maintainer settings without plugin metadata or inline AGENTS.md editing", () => {
    mockPathname = "/PAP/brms/settings/maintainer";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("BRMS Maintainer");
    expect(markup).toContain("Adapter: claude local");
    expect(markup).toContain("Maintainer");
    expect(markup).toContain("Repair");
    expect(markup).toContain("Reset to defaults");
    expect(markup).not.toContain("Provided maintainer");
    expect(markup).not.toContain("Managed by Business Rules");
    expect(markup).not.toContain("Suggested default");
    expect(markup).not.toContain("AGENT INSTRUCTIONS");
    expect(markup).not.toContain("Stable key");
    expect(markup).not.toContain("Plugin managed default");
  });

  it("recommends approval when the brms maintainer is pending board approval", () => {
    mockPathname = "/PAP/brms/settings/maintainer";
    mockSettingsManagedAgent = {
      status: "created",
      source: "managed",
      agentId: "agent-1",
      resourceKey: "brms-maintainer",
      details: { name: "BRMS Maintainer", status: "pending_approval", adapterType: "claude_local", icon: "book-open", urlKey: "brms-maintainer" },
    };

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("pending approval");
    expect(markup).toContain("Approve the agent");
    expect(markup).toContain("Adapter: claude local");
  });

  it("renders root settings as a compact health checklist with the shared path picker", () => {
    mockPathname = "/PAP/brms/settings";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain(">Setup</");
    expect(markup).toContain("Base Folder");
    expect(markup).toContain("Managed Agents");
    expect(markup).toContain("Managed Skills");
    expect(markup).toContain("Managed Projects");
    expect(markup).toContain("Managed Routines");
    expect(markup.indexOf(">Managed Agents</h2>")).toBeLessThan(markup.indexOf(">Managed Skills</h2>"));
    expect(markup.indexOf(">Managed Skills</h2>")).toBeLessThan(markup.indexOf(">Managed Projects</h2>"));
    expect(markup.indexOf(">Managed Projects</h2>")).toBeLessThan(markup.indexOf(">Managed Routines</h2>"));
    expect(markup).toContain("Adapter: claude local");
    expect(markup).toContain("Status: in progress");
    expect(markup).toContain("BRMS root health checklist");
    expect(markup).toContain("Health check");
    expect(markup).toContain("BRMS agents health checklist");
    expect(markup).toContain("BRMS routines health checklist");
    expect(markup).toContain("BRMS skills health checklist");
    expect(markup).toContain("BRMS projects health checklist");
    const routineChecklistStart = markup.indexOf('aria-label="BRMS routines health checklist"');
    const routineChecklist = markup.slice(routineChecklistStart);
    expect(routineChecklist).toContain("left:8px");
    expect(routineChecklist).toContain("background:oklch(0.38 0.09 145)");
    expect(routineChecklist).toContain("Process Business Rules updates");
    expect(routineChecklist).toContain("Run Business Rules lint");
    expect(routineChecklist).toContain("Refresh Business Rules index");
    expect(routineChecklist).not.toContain("BRMS Maintainer");
    expect(routineChecklist).not.toContain("Business Rules project");
    const skillChecklistStart = markup.indexOf('aria-label="BRMS skills health checklist"');
    const skillChecklist = markup.slice(skillChecklistStart, markup.indexOf('aria-label="BRMS projects health checklist"'));
    expect(skillChecklist).toContain("left:8px");
    expect(skillChecklist).toContain("background:oklch(0.38 0.09 145)");
    for (const headline of ["Path configured", "Readable", "Writable", "Baseline files", "BRMS folders"]) {
      expect(markup).toContain(headline);
    }
    expect(markup).toContain("Local brms folder");
    expect(markup).toContain("Choose");
    expect(markup).toContain("Apply path");
    expect(markup).not.toContain("AGENTS.md, IDEA.md");
    expect(markup).not.toContain("Ready</span>");
    expect(markup).not.toContain("Needs attention</span>");
    expect(markup).not.toContain("brms/sources/");
    expect(markup).not.toContain("brms/entities/");
    expect(markup).not.toContain("BRMS root folder");
    expect(markup).not.toContain("Provided maintainer");
    expect(markup).not.toContain(">Project</span>");
    expect(markup).toContain("Ingestion Settings");
  });

  it("shows a top-level fix-all banner when settings configuration has errors", () => {
    mockPathname = "/PAP/brms/settings";
    mockSettingsFolder = {
      configured: true,
      path: "/tmp/company-brms",
      realPath: "/tmp/company-brms",
      access: "readWrite",
      readable: true,
      writable: true,
      requiredDirectories: ["raw", "brms"],
      requiredFiles: ["AGENTS.md"],
      missingDirectories: ["raw"],
      missingFiles: ["AGENTS.md"],
      healthy: false,
      problems: [
        { code: "missing_directory", message: "Required directory is missing.", path: "raw" },
        { code: "missing_file", message: "Required file is missing.", path: "AGENTS.md" },
      ],
      checkedAt: new Date().toISOString(),
    };

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("configuration errors detected, fix them all?");
    expect(markup).toContain("BRMS root folder");
    expect(markup).toContain("Managed routines");
    expect(markup).toContain("need attention.");
    expect(markup).toContain("Fix them all");
    expect(markup.indexOf("configuration errors detected")).toBeLessThan(markup.indexOf(">Base Folder</"));
  });

  it("shows missing managed skills in setup health with a re-sync action", () => {
    mockPathname = "/PAP/brms/settings";
    mockSettingsManagedSkills = [{
      status: "missing",
      skillId: null,
      resourceKey: BRMS_MAINTAINER_SKILL_KEY,
      details: {
        name: "Business Rules Maintainer",
        key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY,
        description: null,
      },
    }];

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Managed Skills");
    expect(markup).toContain("skill issue(s) need attention");
    expect(markup).toContain("Business Rules Maintainer is not installed in the company skill library.");
    expect(markup).toContain("Re-sync skills");
  });

  it("shows managed skill default drift in setup health", () => {
    mockPathname = "/PAP/brms/settings";
    mockSettingsManagedSkills = [{
      status: "resolved",
      skillId: "skill-1",
      resourceKey: BRMS_MAINTAINER_SKILL_KEY,
      defaultDrift: { changedFiles: ["SKILL.md"] },
      details: {
        name: "Business Rules Maintainer",
        key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY,
        description: null,
      },
    }];

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("skill issue(s) need attention");
    expect(markup).toContain("Business Rules Maintainer differs from the plugin default: SKILL.md.");
    expect(markup).toContain("Re-sync skills");
  });

  it("renders host settings directly as the Setup rule without an extra plugin heading", () => {
    const markup = renderToStaticMarkup(createElement(SettingsRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain(">Setup</h1>");
    expect(markup).toContain("Base Folder");
    expect(markup).not.toContain("Business Rules Settings");
    expect(markup).not.toContain("These settings live inside the plugin");
  });

  it("renders project settings as a project picker without managed-resource metadata", () => {
    mockPathname = "/PAP/brms/settings/project";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Use existing project");
    expect(markup).toContain("Business Rules");
    expect(markup).toContain("Save project");
    expect(markup).toContain("Open project");
    expect(markup).toContain("Repair / reconcile");
    expect(markup).toContain("Reset to plugin defaults");
    expect(markup).not.toContain("Managed by Business Rules");
    expect(markup).not.toContain("Operations project binding");
    expect(markup).not.toContain("Stable key");
    expect(markup).not.toContain("Resolved project");
    expect(markup).toContain("Status: in progress");
    expect(markup).not.toContain("Plugin managed default");
  });

  it("renders space settings with health line styling and disabled access controls", () => {
    mockPathname = "/PAP/brms/settings/spaces/default";

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Space folder health checklist");
    expect(markup).toContain("left:8px");
    expect(markup).toContain("background:oklch(0.38 0.09 145)");
    expect(markup).toContain("Folder readable");
    expect(markup).toContain("raw/ present");
    expect(markup).toContain("Access");
    expect(markup).toContain("Coming soon");
    expect(markup).not.toContain("Future enforcement");
    expect(markup).not.toContain("stored only");
    expect(markup).not.toContain("Permissions are stored but not enforced");
  });

  it("renders distillation settings with assigned-agent model selection and cheap path without budget controls", () => {
    mockPathname = "/PAP/brms/settings/distillation";
    mockDistillationOverviewData = {
      counts: { cursors: 1, runningRuns: 0, failedRuns24h: 0, reviewRequired: 0 },
      cursors: [{
        id: "cursor-1",
        projectId: "project-1",
        rootIssueId: null,
        projectName: "Existing BRMS Project",
        rootIssueIdentifier: null,
        sourceScope: "project",
        scopeKey: "project-1",
      }],
      runs: [],
    };

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Agent execution");
    expect(markup).toContain("Assigned maintainer");
    expect(markup).toContain("BRMS Maintainer · claude local");
    expect(markup).toContain("Cheap path");
    expect(markup).toContain("assigneeAdapterOverrides.modelProfile = cheap");
    expect(markup).toContain("All sections — apply when source hash matches and confidence");
    expect(markup).not.toContain("Per-task budget");
    expect(markup).not.toContain("Project total budget");
    expect(markup).not.toContain("/task");
    expect(markup).not.toContain("Model lanes");
    expect(markup).not.toContain("Claude Haiku");
    expect(markup).not.toContain("Daily plugin cap");
    expect(markup).not.toContain("Monthly plugin cap");
  });

  it("renders managed routines as normal routine rows with run, toggle, and configure controls", () => {
    mockPathname = "/PAP/brms/settings/routines";
    mockSettingsManagedRoutines = [{
      status: "resolved",
      routineId: "routine-1",
      resourceKey: "nightly-brms-lint",
      routine: {
        id: "routine-1",
        title: "Run Business Rules lint",
        status: "active",
        assigneeAgentId: "agent-1",
        projectId: "project-1",
        lastTriggeredAt: "2026-05-03T12:00:00Z",
        managedByPlugin: { pluginDisplayName: "Business Rules", resourceKey: "nightly-brms-lint" },
      },
      details: { cronExpression: "0 3 * * *" },
    }];
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Run Business Rules lint");
    expect(markup).toContain("Run now");
    expect(markup).toContain("Configure");
    expect(markup).toContain("role=\"switch\"");
    expect(markup).toContain("Business Rules · BRMS Maintainer");
    expect(markup).toContain("href=\"/PAP/routines/routine-1\"");
  });

  it("alerts when managed routine defaults changed and offers a reset path", () => {
    mockPathname = "/PAP/brms/settings/routines";
    mockSettingsManagedRoutines = [{
      status: "resolved",
      routineId: "routine-1",
      resourceKey: "nightly-brms-lint",
      defaultDrift: {
        changedFields: ["description"],
        defaultTitle: "Run Business Rules lint",
        defaultDescription: "Updated instructions",
      },
      routine: {
        id: "routine-1",
        title: "Run Business Rules lint",
        status: "active",
        assigneeAgentId: "agent-1",
        projectId: "project-1",
        managedByPlugin: { pluginDisplayName: "Business Rules", resourceKey: "nightly-brms-lint" },
      },
      details: { cronExpression: "0 3 * * *" },
    }];

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Routine defaults changed");
    expect(markup).toContain("Plugin defaults changed: description");
    expect(markup).toContain(">Reset</button>");
  });

  it("shows managed agent instruction drift in the setup health check", () => {
    mockPathname = "/PAP/brms/settings";
    mockSettingsManagedAgent = {
      status: "resolved",
      source: "managed",
      agentId: "agent-1",
      resourceKey: "brms-maintainer",
      defaultDrift: { entryFile: "AGENTS.md", changedFiles: ["AGENTS.md"] },
      details: { name: "BRMS Maintainer", status: "idle", adapterType: "claude_local", icon: "book-open", urlKey: "brms-maintainer" },
    };

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("BRMS Maintainer instructions differ from the plugin default: AGENTS.md.");
    expect(markup).toContain("BRMS Maintainer instruction defaults changed: AGENTS.md");
  });

  it("shows one routine repair warning instead of per-routine reconcile controls", () => {
    mockPathname = "/PAP/brms/settings/routines";
    mockSettingsManagedRoutines = [{
      status: "resolved",
      routineId: "routine-1",
      resourceKey: "nightly-brms-lint",
      routine: {
        id: "routine-1",
        title: "Run Business Rules lint",
        status: "active",
        assigneeAgentId: "other-agent",
        projectId: "project-1",
        managedByPlugin: { pluginDisplayName: "Business Rules", resourceKey: "nightly-brms-lint" },
      },
      details: { cronExpression: "0 3 * * *" },
    }];

    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Routine setup needs repair");
    expect(markup).toContain("Fix routines");
    expect(markup).toContain("not assigned to the BRMS Maintainer");
    expect(markup).not.toContain("Plugin-managed routine defaults can be reconciled from here");
    expect(markup).not.toContain(">Reconcile</button>");
    expect(markup).not.toContain(">Reset</button>");
  });

  it("renders legacy lint routes inside the BRMS settings section", () => {
    mockPathname = "/PAP/brms/lint";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Run lint now");
    expect(markup).toContain("Recent lint runs");
    expect(markup).toContain("Business Rules settings sections");
  });

  it("does not expose IDEA.md pattern editing as a settings section", () => {
    mockPathname = "/PAP/brms/settings";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Business Rules settings sections");
    expect(markup).not.toContain(">Pattern</span>");
    expect(markup).not.toContain("Pattern · IDEA.md");
    expect(markup).not.toContain("IDEA.md skeleton reference");
  });

  it("does not expose plugin capabilities as a settings section", () => {
    mockPathname = "/PAP/brms/settings";
    const markup = renderToStaticMarkup(createElement(BRMSRule, {
      context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
    } as never));

    expect(markup).toContain("Business Rules settings sections");
    expect(markup).not.toContain("Plugin capabilities");
    expect(markup).not.toContain("api.routes.register");
  });

  it("reconciles managed maintenance routines through stable agent and project refs", async () => {
    const harness = createTestHarness({ manifest });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);

    const missing = await harness.performAction<PluginManagedRoutineResolution>("reconcile-managed-routine", {
      companyId: COMPANY_ID,
      routineKey: NIGHTLY_LINT_ROUTINE_KEY,
    });
    expect(missing.status).toBe("missing_refs");
    expect(missing.missingRefs).toEqual([
      expect.objectContaining({ resourceKind: "agent", resourceKey: BRMS_MAINTAINER_AGENT_KEY }),
      expect.objectContaining({ resourceKind: "project", resourceKey: BRMS_PROJECT_KEY }),
    ]);

    await harness.performAction("bootstrap-root", { companyId: COMPANY_ID, path: "/tmp/company-brms" });
    const reconciled = await Promise.all(
      BRMS_MAINTENANCE_ROUTINE_KEYS.map((routineKey) =>
        harness.performAction<PluginManagedRoutineResolution>("reconcile-managed-routine", {
          companyId: COMPANY_ID,
          routineKey,
        })),
    );

    expect(reconciled.map((routine) => routine.resourceKey)).toEqual([...BRMS_MAINTENANCE_ROUTINE_KEYS]);
    expect(reconciled).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceKey: NIGHTLY_LINT_ROUTINE_KEY,
          routine: expect.objectContaining({
            projectId: expect.any(String),
            assigneeAgentId: expect.any(String),
            managedByPlugin: expect.objectContaining({
              defaultsJson: expect.objectContaining({
                issueTemplate: expect.objectContaining({ surfaceVisibility: "plugin_operation" }),
              }),
            }),
          }),
        }),
        expect.objectContaining({ resourceKey: INDEX_REFRESH_ROUTINE_KEY, routineId: expect.any(String) }),
      ]),
    );
  });

  it("requires an explicit managed routine key for single-routine actions", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await expect(harness.performAction("reconcile-managed-routine", {
      companyId: COMPANY_ID,
    })).rejects.toThrow("routineKey is required");
  });

  it("repairs all managed maintenance routines through one action", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    await harness.performAction("bootstrap-root", { companyId: COMPANY_ID, path: "/tmp/company-brms" });

    const repaired = await harness.performAction<{
      managedRoutines: PluginManagedRoutineResolution[];
    }>("reconcile-managed-routines", { companyId: COMPANY_ID });

    expect(repaired.managedRoutines).toHaveLength(BRMS_MAINTENANCE_ROUTINE_KEYS.length);
    expect(repaired.managedRoutines.map((routine) => routine.resourceKey)).toEqual([...BRMS_MAINTENANCE_ROUTINE_KEYS]);
    for (const routine of repaired.managedRoutines) {
      expect(routine.routine).toEqual(expect.objectContaining({
        assigneeAgentId: expect.any(String),
        projectId: expect.any(String),
      }));
      expect(routine.missingRefs).toEqual([]);
    }
  });

  it("installs and resets managed company skills through setup actions", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const before = await harness.getData<{ managedSkills: BRMSSkillResource[] }>("settings", {
      companyId: COMPANY_ID,
    });
    expect(before.managedSkills.map((skill) => skill.resourceKey)).toEqual([...BRMS_MANAGED_SKILL_KEYS]);
    expect(before.managedSkills[0]).toMatchObject({
      status: "missing",
      skillId: null,
    });

    const repaired = await harness.performAction<{
      managedSkills: BRMSSkillResource[];
    }>("reconcile-managed-skills", { companyId: COMPANY_ID });
    expect(repaired.managedSkills).toHaveLength(BRMS_MANAGED_SKILL_KEYS.length);
    expect(repaired.managedSkills[0]).toMatchObject({
      status: "created",
      skillId: expect.any(String),
      resourceKey: BRMS_MAINTAINER_SKILL_KEY,
      details: {
        name: "Business Rules Maintainer",
        key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY,
      },
    });

    const resolved = await harness.getData<{ managedSkills: BRMSSkillResource[] }>("settings", {
      companyId: COMPANY_ID,
    });
    expect(resolved.managedSkills[0]).toMatchObject({
      status: "resolved",
      resourceKey: BRMS_MAINTAINER_SKILL_KEY,
      details: { key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY },
    });

    const reset = await harness.performAction<{
      managedSkills: BRMSSkillResource[];
    }>("reset-managed-skills", { companyId: COMPANY_ID });
    expect(reset.managedSkills[0]).toMatchObject({
      status: "reset",
      skillId: expect.any(String),
      resourceKey: BRMS_MAINTAINER_SKILL_KEY,
    });
  });

  it("registers worker data, actions, and tools", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const overview = await harness.getData<{ status: string; operationCount: number; eventIngestion: { enabled: boolean } }>("overview", {
      companyId: COMPANY_ID,
    });
    expect(overview.status).toBe("ok");
    expect(overview.operationCount).toBe(0);
    expect(overview.eventIngestion.enabled).toBe(false);

    const rules = await harness.executeTool<{ content?: string }>("brms_list_rules", {
      companyId: COMPANY_ID,
      brmsId: "default",
    });
    expect(rules.content).toBe("No rules indexed yet.");
  });

  it("filters stale rule and raw source rows out of browse data", async () => {
    const harness = createTestHarness({ manifest });
    const files = new Map<string, string>([
      ["brms/concepts/live.md", "# Live Rule\n"],
      ["raw/live-source.md", "# Live Source\n"],
    ]);
    const now = new Date().toISOString();
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const contents = files.get(relativePath);
      if (contents == null) throw new Error(`missing ${relativePath}`);
      return contents;
    };
    harness.ctx.db.query = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      harness.dbQueries.push({ sql, params });
      if (sql.includes("brms_rules")) {
        return [
          {
            path: "brms/concepts/live.md",
            title: "Live Rule",
            rule_type: "concepts",
            backlinks: [],
            source_refs: [],
            content_hash: "live",
            updated_at: now,
          },
          {
            path: "brms/concepts/stale.md",
            title: "Stale Rule",
            rule_type: "concepts",
            backlinks: [],
            source_refs: [],
            content_hash: "stale",
            updated_at: now,
          },
        ] as T[];
      }
      if (sql.includes("brms_sources")) {
        return [
          {
            raw_path: "raw/missing-source.md",
            title: "Missing Source",
            source_type: "text",
            url: null,
            status: "captured",
            created_at: now,
          },
          {
            raw_path: "raw/live-source.md",
            title: "Live Source",
            source_type: "text",
            url: null,
            status: "captured",
            created_at: now,
          },
        ] as T[];
      }
      return [];
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.getData<{
      rules: Array<{ path: string }>;
      sources: Array<{ rawPath: string }>;
    }>("rules", {
      companyId: COMPANY_ID,
      brmsId: "default",
      includeRaw: true,
    });

    expect(result.rules.map((rule) => rule.path)).toEqual(["brms/concepts/live.md"]);
    expect(result.sources.map((source) => source.rawPath)).toEqual(["raw/live-source.md"]);
  });

  it("includes local brms files in browse data before metadata is indexed", async () => {
    const harness = createTestHarness({ manifest });
    const modifiedAt = new Date().toISOString();
    harness.ctx.localFolders.list = async (_companyId, folderKey, options) => ({
      folderKey,
      relativePath: options?.relativePath ?? null,
      truncated: false,
      entries: options?.relativePath === "brms"
        ? [
          { path: "brms/concepts/agent-memory-layer.md", name: "agent-memory-layer.md", kind: "file", size: 12, modifiedAt },
          { path: "brms/entities/paperclip.md", name: "paperclip.md", kind: "file", size: 10, modifiedAt },
          { path: "brms/projects/brms/standup.md", name: "standup.md", kind: "file", size: 16, modifiedAt },
        ]
        : [
          { path: "raw/2026-04-09-thomas-gieselmann-fundraising-call.md", name: "2026-04-09-thomas-gieselmann-fundraising-call.md", kind: "file", size: 14, modifiedAt },
        ],
    });
    harness.ctx.db.query = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      harness.dbQueries.push({ sql, params });
      return [] as T[];
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.getData<{
      rules: Array<{ path: string; title: string | null }>;
      sources: Array<{ rawPath: string; title: string | null }>;
    }>("rules", {
      companyId: COMPANY_ID,
      brmsId: "default",
      includeRaw: true,
    });

    expect(result.rules).toEqual([
      expect.objectContaining({ path: "brms/concepts/agent-memory-layer.md", title: null }),
      expect.objectContaining({ path: "brms/entities/paperclip.md", title: null }),
      expect.objectContaining({ path: "brms/projects/brms/standup.md", title: null }),
    ]);
    expect(result.sources).toEqual([
      expect.objectContaining({ rawPath: "raw/2026-04-09-thomas-gieselmann-fundraising-call.md", title: null }),
    ]);
  });

  it("does not ingest Paperclip events until operator controls enable them", async () => {
    const harness = createTestHarness({ manifest });
    const issue = paperclipIssue();
    harness.seed({ issues: [issue] });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    await harness.emit("issue.created", { identifier: issue.identifier }, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-disabled-issue-created",
    });

    expect(writes).toHaveLength(0);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_sources"))).toBe(false);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_operations"))).toBe(false);
  });

  it("records enabled Paperclip issue events as cursor observations without creating ingest operations", async () => {
    const harness = createTestHarness({ manifest });
    const issue = paperclipIssue();
    harness.seed({ issues: [issue] });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const policy = await harness.performAction<{ enabled: boolean; sources: { issues: boolean; comments: boolean; documents: boolean } }>(
      "update-event-ingestion-settings",
      {
        companyId: COMPANY_ID,
        enabled: true,
        sources: { issues: true, comments: false, documents: false },
      },
    );
    expect(policy).toMatchObject({ enabled: true, sources: { issues: true, comments: false, documents: false } });

    await harness.emit("issue.created", { identifier: issue.identifier }, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-enabled-issue-created",
    });

    expect(writes).toHaveLength(0);
    const operations = await harness.ctx.issues.list({
      companyId: COMPANY_ID,
      originKindPrefix: String(OPERATION_ORIGIN_KIND),
    });
    expect(operations).toHaveLength(0);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_sources"))).toBe(false);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_operations"))).toBe(false);
    const cursorUpsert = harness.dbExecutes.find((execute) => execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorUpsert?.params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "default",
      "company",
      null,
      null,
    ]));
  });

  it("preserves Paperclip event ingestion sources when only enabled changes", async () => {
    const harness = createTestHarness({ manifest });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("update-event-ingestion-settings", {
      companyId: COMPANY_ID,
      enabled: true,
      sources: { issues: true, comments: true, documents: true },
    });

    const disabled = await harness.performAction<{
      enabled: boolean;
      sources: { issues: boolean; comments: boolean; documents: boolean };
    }>("update-event-ingestion-settings", {
      companyId: COMPANY_ID,
      enabled: false,
    });
    expect(disabled).toMatchObject({
      enabled: false,
      sources: { issues: true, comments: true, documents: true },
    });

    const reenabled = await harness.performAction<{
      enabled: boolean;
      sources: { issues: boolean; comments: boolean; documents: boolean };
    }>("update-event-ingestion-settings", {
      companyId: COMPANY_ID,
      enabled: true,
    });
    expect(reenabled).toMatchObject({
      enabled: true,
      sources: { issues: true, comments: true, documents: true },
    });
  });

  it("keeps Paperclip event cursor observations company scoped and ignores plugin-operation issues", async () => {
    const harness = createTestHarness({ manifest });
    const visibleIssue = paperclipIssue({ projectId: "77777777-7777-4777-8777-777777777777" });
    const otherCompanyIssue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777778",
      companyId: OTHER_COMPANY_ID,
      projectId: "77777777-7777-4777-8777-777777777779",
      identifier: "PAP-9999",
    });
    const operationIssue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777780",
      originKind: `${OPERATION_ORIGIN_KIND}:ingest`,
    });
    harness.seed({ issues: [visibleIssue, otherCompanyIssue, operationIssue] });

    await plugin.definition.setup(harness.ctx);
    await harness.performAction("update-event-ingestion-settings", {
      companyId: COMPANY_ID,
      enabled: true,
      sources: { issues: true, comments: true, documents: true },
    });

    await harness.emit("issue.updated", {}, {
      companyId: COMPANY_ID,
      entityId: visibleIssue.id,
      entityType: "issue",
      eventId: "event-visible",
    });
    await harness.emit("issue.updated", {}, {
      companyId: OTHER_COMPANY_ID,
      entityId: otherCompanyIssue.id,
      entityType: "issue",
      eventId: "event-other-company",
    });
    await harness.emit("issue.updated", {}, {
      companyId: COMPANY_ID,
      entityId: operationIssue.id,
      entityType: "issue",
      eventId: "event-plugin-operation",
    });

    const cursorWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorWrites).toHaveLength(1);
    expect(cursorWrites[0].params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "default",
      "project",
      visibleIssue.projectId,
    ]));
  });

  it("routes Paperclip issue, comment, and document event cursors only to the default space", async () => {
    const harness = createTestHarness({ manifest });
    const issue = paperclipIssue({ projectId: "77777777-7777-4777-8777-777777777777" });
    harness.seed({ issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { id: string; slug: string };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Team Research",
    });
    await harness.performAction("update-event-ingestion-settings", {
      companyId: COMPANY_ID,
      enabled: true,
      sources: { issues: true, comments: true, documents: true },
    });

    await harness.emit("issue.created", {}, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-default-issue-created",
    });
    await harness.emit("issue.comment.created", { commentId: "comment-1" }, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-default-comment-created",
    });
    await harness.emit("issue.document.updated", { key: "plan", revisionId: "revision-1" }, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-default-document-updated",
    });

    const cursorWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorWrites).toHaveLength(3);
    expect(cursorWrites.every((execute) => execute.params?.[10] !== created.space.id)).toBe(true);
    expect(cursorWrites.map((execute) => execute.params?.[2])).toEqual(["default", "default", "default"]);
    expect(String(cursorWrites[0].params?.[9])).toContain('"lastSourceKind":"issues"');
    expect(String(cursorWrites[1].params?.[9])).toContain('"lastSourceKind":"comments"');
    expect(String(cursorWrites[2].params?.[9])).toContain('"lastSourceKind":"documents"');
  });

  it("routes Paperclip events into an explicitly enabled shared non-default space", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({ projectId: project.id });
    harness.seed({ projects: [project], issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { id: string; slug: string };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Engineering BRMS",
      accessScope: "shared",
    });
    mockPersistedBRMSSpace(harness, created.space as unknown as Record<string, unknown>);
    const enabledProfile = {
      version: 1,
      enabled: true,
      sourceScopes: [{ kind: "selected_projects", projectIds: [project.id] }],
      sourceKinds: { issues: true, comments: true, documents: true, attachments: "off", workProducts: "off" },
      cursor: { maxWindowCharacters: 60000, maxCharactersPerSource: 12000, minSourceAgeMinutes: 15, maxWindowsPerRun: 6, staleAfterHours: 72 },
      backfill: { requireManualQueue: true },
    };
    await harness.performAction("update-paperclip-ingestion-profile", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
      profile: enabledProfile,
    });
    mockPersistedBRMSSpace(harness, { ...(created.space as unknown as Record<string, unknown>), settings: { paperclipIngestion: enabledProfile } });

    await harness.emit("issue.created", {}, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-non-default-enabled",
    });

    const cursorWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorWrites.some((execute) => execute.params?.[10] === created.space.id)).toBe(true);
  });

  it("stops new non-default observations after the per-space profile is disabled", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({ projectId: project.id });
    harness.seed({ projects: [project], issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { id: string; slug: string };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Support BRMS",
      accessScope: "shared",
    });
    mockPersistedBRMSSpace(harness, created.space as unknown as Record<string, unknown>);
    const enabledProfile = {
      version: 1,
      enabled: true,
      sourceScopes: [{ kind: "selected_projects", projectIds: [project.id] }],
      sourceKinds: { issues: true, comments: false, documents: false, attachments: "off", workProducts: "off" },
      cursor: { maxWindowCharacters: 60000, maxCharactersPerSource: 12000, minSourceAgeMinutes: 15, maxWindowsPerRun: 6, staleAfterHours: 72 },
      backfill: { requireManualQueue: true },
    };
    await harness.performAction("update-paperclip-ingestion-profile", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
      profile: enabledProfile,
    });
    mockPersistedBRMSSpace(harness, { ...(created.space as unknown as Record<string, unknown>), settings: { paperclipIngestion: enabledProfile } });
    await harness.emit("issue.created", {}, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-before-disable",
    });
    await harness.performAction("update-paperclip-ingestion-profile", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
      profile: { ...enabledProfile, enabled: false },
    });
    mockPersistedBRMSSpace(harness, { ...(created.space as unknown as Record<string, unknown>), settings: { paperclipIngestion: { ...enabledProfile, enabled: false } } });
    await harness.emit("issue.updated", {}, {
      companyId: COMPANY_ID,
      entityId: issue.id,
      entityType: "issue",
      eventId: "event-after-disable",
    });

    const nonDefaultCursorWrites = harness.dbExecutes.filter((execute) =>
      execute.sql.includes("paperclip_distillation_cursors") && execute.params?.[10] === created.space.id);
    expect(nonDefaultCursorWrites).toHaveLength(1);
  });

  it("assembles deterministic Paperclip source bundles with issue, document, and comment provenance", async () => {
    const harness = createTestHarness({ manifest });
    const root = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777781",
      identifier: "PAP-4000",
      title: "Root distillation issue",
      projectId: "77777777-7777-4777-8777-777777777777",
      updatedAt: new Date("2026-05-01T10:00:00Z"),
    });
    const child = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777782",
      identifier: "PAP-4001",
      title: "Child source issue",
      parentId: root.id,
      projectId: root.projectId,
      description: "Child issue has a decision and implementation notes.",
      updatedAt: new Date("2026-05-02T10:00:00Z"),
    });
    harness.seed({
      issues: [root, child],
      issueComments: [{
        id: "77777777-7777-4777-8777-777777777783",
        companyId: COMPANY_ID,
        issueId: child.id,
        authorType: "user",
        authorAgentId: null,
        authorUserId: null,
        body: "Comment evidence for the source bundle.",
        presentation: null,
        metadata: null,
        createdAt: new Date("2026-05-03T10:00:00Z"),
        updatedAt: new Date("2026-05-03T10:00:00Z"),
      }],
    });

    await plugin.definition.setup(harness.ctx);
    await harness.ctx.issues.documents.upsert({
      companyId: COMPANY_ID,
      issueId: child.id,
      key: "plan",
      title: "Plan",
      body: "Document evidence for the source bundle.",
    });

    const first = await harness.performAction<{
      markdown: string;
      sourceRefs: Array<{ kind: string; issueIdentifier: string | null; documentKey?: string; commentId?: string }>;
      sourceHash: string;
      sourceWindowEnd: string | null;
    }>("assemble-paperclip-source-bundle", {
      companyId: COMPANY_ID,
      rootIssueId: root.id,
      maxCharacters: 20000,
    });
    const second = await harness.performAction<typeof first>("assemble-paperclip-source-bundle", {
      companyId: COMPANY_ID,
      rootIssueId: root.id,
      maxCharacters: 20000,
    });

    expect(second.sourceHash).toBe(first.sourceHash);
    expect(first.markdown).toContain("Root distillation issue");
    expect(first.markdown).toContain("Child issue has a decision");
    expect(first.markdown).toContain("Document evidence for the source bundle.");
    expect(first.markdown).toContain("Comment evidence for the source bundle.");
    expect(first.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "issue", issueIdentifier: "PAP-4001" }),
      expect.objectContaining({ kind: "document", documentKey: "plan" }),
      expect.objectContaining({ kind: "comment", commentId: "77777777-7777-4777-8777-777777777783" }),
    ]));
    expect(first.sourceWindowEnd).toEqual(expect.any(String));
  });

  it("suppresses secret-like comment and document bodies before storing distillation snapshots", async () => {
    const harness = createTestHarness({ manifest });
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777784",
      identifier: "PAP-4002",
      title: "Sensitive source issue",
      projectId: "77777777-7777-4777-8777-777777777777",
      description: "Keep the project rule current without copying credential material into the brms.",
      updatedAt: new Date("2026-05-04T10:00:00Z"),
    });
    harness.seed({
      issues: [issue],
      issueComments: [{
        id: "77777777-7777-4777-8777-777777777785",
        companyId: COMPANY_ID,
        issueId: issue.id,
        authorType: "user",
        authorAgentId: null,
        authorUserId: null,
        body: "Authorization: Bearer ghp_supersecretcommenttoken1234567890",
        presentation: null,
        metadata: null,
        createdAt: new Date("2026-05-04T11:00:00Z"),
        updatedAt: new Date("2026-05-04T11:00:00Z"),
      }],
    });

    await plugin.definition.setup(harness.ctx);
    await harness.ctx.issues.documents.upsert({
      companyId: COMPANY_ID,
      issueId: issue.id,
      key: "plan",
      title: "Plan",
      body: "OPENAI_API_KEY=sk-supersecretdocumentvalue1234567890",
    });

    const run = await harness.performAction<{
      bundle: {
        markdown: string;
        warnings: string[];
        sourceRefs: Array<Record<string, unknown>>;
      };
    }>("create-paperclip-distillation-run", {
      companyId: COMPANY_ID,
      projectId: issue.projectId,
      maxCharacters: 20000,
    });

    expect(run.bundle.markdown).toContain("Suppressed by Business Rules distillation security policy");
    expect(run.bundle.markdown).not.toContain("ghp_supersecretcommenttoken1234567890");
    expect(run.bundle.markdown).not.toContain("sk-supersecretdocumentvalue1234567890");
    expect(run.bundle.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Suppressed comment content"),
      expect.stringContaining("Suppressed document content"),
    ]));
    expect(run.bundle.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "comment", redactionStatus: "suppressed_sensitive_content" }),
      expect.objectContaining({ kind: "document", redactionStatus: "suppressed_sensitive_content" }),
    ]));

    const snapshotInsert = harness.dbExecutes.find((execute) => execute.sql.includes("paperclip_source_snapshots"));
    const storedSourceRefs = String(snapshotInsert?.params?.[9] ?? "");
    const storedMarkdown = String(snapshotInsert?.params?.[10] ?? "");
    expect(storedSourceRefs).toContain("suppressed_sensitive_content");
    expect(storedMarkdown).toContain("Suppressed by Business Rules distillation security policy");
    expect(storedMarkdown).not.toContain("ghp_supersecretcommenttoken1234567890");
    expect(storedMarkdown).not.toContain("sk-supersecretdocumentvalue1234567890");
  });

  it("creates source snapshots and only advances cursors after successful distillation outcomes", async () => {
    const harness = createTestHarness({ manifest });
    const issue = paperclipIssue({
      projectId: "77777777-7777-4777-8777-777777777777",
      updatedAt: new Date("2026-05-02T10:00:00Z"),
    });
    harness.seed({ issues: [issue] });
    await plugin.definition.setup(harness.ctx);

    const run = await harness.performAction<{
      runId: string;
      cursorId: string;
      snapshotId: string;
      bundle: { sourceHash: string; sourceWindowEnd: string };
    }>("create-paperclip-distillation-run", {
      companyId: COMPANY_ID,
      projectId: issue.projectId,
    });
    expect(run.snapshotId).toEqual(expect.any(String));
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("paperclip_source_snapshots"))).toBe(true);

    const failed = await harness.performAction<{ cursorAdvanced: boolean }>("record-paperclip-distillation-outcome", {
      companyId: COMPANY_ID,
      runId: run.runId,
      cursorId: run.cursorId,
      status: "failed",
      sourceHash: run.bundle.sourceHash,
      sourceWindowEnd: run.bundle.sourceWindowEnd,
      warning: "writer failed",
    });
    expect(failed.cursorAdvanced).toBe(false);
    const cursorUpdatesAfterFailure = harness.dbExecutes.filter((execute) =>
      execute.sql.trim().startsWith("UPDATE") && execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorUpdatesAfterFailure).toHaveLength(0);

    const succeeded = await harness.performAction<{ cursorAdvanced: boolean }>("record-paperclip-distillation-outcome", {
      companyId: COMPANY_ID,
      runId: run.runId,
      cursorId: run.cursorId,
      status: "succeeded",
      sourceHash: run.bundle.sourceHash,
      sourceWindowEnd: run.bundle.sourceWindowEnd,
    });
    expect(succeeded.cursorAdvanced).toBe(true);
    const cursorSuccessUpdate = harness.dbExecutes.find((execute) =>
      execute.sql.trim().startsWith("UPDATE") && execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorSuccessUpdate?.params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "default",
      run.runId,
      run.bundle.sourceWindowEnd,
      run.bundle.sourceHash,
      run.cursorId,
    ]));
  });

  it("uses the existing distillation cursor id after an upsert conflict", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777800",
      identifier: "PAP-4099",
      title: "Existing cursor target",
      projectId: project.id,
      status: "in_progress",
    });
    const existingCursorId = "77777777-7777-4777-8777-777777777899";
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT id") && sql.includes("paperclip_distillation_cursors")) {
        return [{ id: existingCursorId }] as T[];
      }
      return originalQuery<T>(sql, params);
    };
    harness.seed({ projects: [project], issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{ cursorId: string }>("create-paperclip-distillation-run", {
      companyId: COMPANY_ID,
      projectId: project.id,
    });

    expect(result.cursorId).toBe(existingCursorId);
    const runInsert = harness.dbExecutes.find((execute) =>
      execute.sql.includes("paperclip_distillation_runs") && execute.sql.includes("'source_ready'"));
    expect(runInsert?.params?.[3]).toBe(existingCursorId);
  });

  it("creates explicit distillation work items for manual, retry, and backfill lanes", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await harness.performAction("create-paperclip-distillation-work-item", {
      companyId: COMPANY_ID,
      kind: "manual",
      projectId: "77777777-7777-4777-8777-777777777777",
      idempotencyKey: "manual:project:77777777-7777-4777-8777-777777777777",
    });
    await harness.performAction("create-paperclip-distillation-work-item", {
      companyId: COMPANY_ID,
      kind: "retry",
      rootIssueId: "77777777-7777-4777-8777-777777777781",
      priority: "high",
      idempotencyKey: "retry:run:1",
    });
    await harness.performAction("create-paperclip-distillation-work-item", {
      companyId: COMPANY_ID,
      kind: "backfill",
      projectId: "77777777-7777-4777-8777-777777777777",
      priority: "low",
      metadata: { window: "last-30-days" },
      idempotencyKey: "backfill:last-30-days",
    });

    const workItemWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_distillation_work_items"));
    expect(workItemWrites).toHaveLength(3);
    expect(workItemWrites.map((write) => write.params?.[3])).toEqual(["manual", "retry", "backfill"]);
    expect(String(workItemWrites[0].params?.[9])).toContain('"sourceScope":"project"');
    expect(String(workItemWrites[1].params?.[9])).toContain('"sourceScope":"root_issue"');
    expect(String(workItemWrites[2].params?.[9])).toContain('"sourceScope":"project"');

    await expect(harness.performAction("create-paperclip-distillation-work-item", {
      companyId: COMPANY_ID,
      kind: "backfill",
      idempotencyKey: "backfill:company",
    })).rejects.toThrow("whole-company backfill is not allowed");
  });

  it("records estimated Paperclip distillation cost without refusing on legacy cost config", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        maxPaperclipRoutineRunCostCents: 1,
        maxPaperclipDistillationTaskCostCents: 1,
        maxPaperclipDistillationProjectCostCents: 1,
        paperclipCostCentsPerThousandSourceCharacters: 100,
      },
    });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777795",
      identifier: "PAP-4104",
      title: "Large source bundle",
      description: `Accepted plan. ${"Detailed implementation note. ".repeat(160)}`,
      projectId: project.id,
      status: "in_progress",
    });
    harness.seed({ projects: [project], issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      status: string;
      estimatedCostCents: number;
      snapshotId: string | null;
    }>("create-paperclip-distillation-run", {
      companyId: COMPANY_ID,
      projectId: project.id,
      routineRun: true,
    });

    expect(result.status).toBe("source_ready");
    expect(result.estimatedCostCents).toBeGreaterThan(1);
    expect(result.snapshotId).toEqual(expect.any(String));
    const readyRun = harness.dbExecutes.find((execute) =>
      execute.sql.includes("paperclip_distillation_runs") && execute.sql.includes("'source_ready'"));
    expect(readyRun?.params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "default",
      expect.any(String),
      expect.any(String),
      null,
      project.id,
    ]));
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("paperclip_source_snapshots"))).toBe(true);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("refused_cost_cap"))).toBe(false);
  });

  it("queues visible manual distill operation issues for a company-wide stale cursor scan", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777796",
      identifier: "PAP-4105",
      title: "Manual distillation target",
      description: "Implemented enough evidence to manually distill into the brms.",
      status: "done",
      projectId: project.id,
    });
    harness.seed({ agents: [brmsMaintainerAgent()], projects: [project], issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      status: string;
      operation: { issue: { originKind: string; billingCode: string | null; assigneeAgentId: string | null; assigneeAdapterOverrides: { modelProfile?: string } | null; description: string | null } };
      workItem: { kind: string; workItemId: string };
    }>("distill-paperclip-now", {
      companyId: COMPANY_ID,
      autoApply: false,
      useCheapModelProfile: true,
      includeSupportingRules: false,
    });

    expect(result.status).toBe("queued");
    expect(result.workItem.kind).toBe("manual");
    expect(result.operation.issue.originKind).toBe(`${OPERATION_ORIGIN_KIND}:distill`);
    expect(result.operation.issue.billingCode).toBe("plugin-brms:default");
    expect(result.operation.issue.assigneeAgentId).toBe(brmsMaintainerAgent().id);
    expect(result.operation.issue.assigneeAdapterOverrides).toEqual({ modelProfile: "cheap" });
    expect(result.operation.issue.description).toContain("Prompt source: Business Rules plugin action `distill-paperclip-now`");
    expect(result.operation.issue.description).toContain(`Required skill: use the installed \`${PAPERCLIP_DISTILL_SKILL_KEY}\` skill`);
    expect(result.operation.issue.description).toContain("Do not hardcode a single project");
    expect(result.operation.issue.description).not.toContain(`Source project ID: ${project.id}`);
    const workItemInsert = harness.dbExecutes.find((execute) =>
      execute.sql.includes("paperclip_distillation_work_items") && execute.params?.[3] === "manual");
    expect(workItemInsert?.params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "default",
      "manual",
      "medium",
      null,
      null,
    ]));
    const runInsert = harness.dbExecutes.find((execute) =>
      execute.sql.includes("paperclip_distillation_runs") && execute.sql.includes("operation_issue_id"));
    expect(runInsert).toBeUndefined();
  });

  it("enables distillation cursors for the most recently active non-plugin projects", async () => {
    const harness = createTestHarness({ manifest });
    const recentProject = {
      ...existingProject(),
      id: "77777777-7777-4777-8777-777777777801",
      name: "Recent Active Project",
      status: "in_progress" as const,
      updatedAt: new Date("2026-05-04T18:00:00Z"),
    };
    const olderProject = {
      ...existingProject(),
      id: "77777777-7777-4777-8777-777777777802",
      name: "Older Active Project",
      status: "in_progress" as const,
      updatedAt: new Date("2026-05-03T18:00:00Z"),
    };
    const overflowProject = {
      ...existingProject(),
      id: "77777777-7777-4777-8777-777777777803",
      name: "Overflow Active Project",
      status: "in_progress" as const,
      updatedAt: new Date("2026-05-02T18:00:00Z"),
    };
    const completedProject = {
      ...existingProject(),
      id: "77777777-7777-4777-8777-777777777804",
      name: "Completed Project",
      status: "completed" as const,
      updatedAt: new Date("2026-05-04T19:00:00Z"),
    };
    const pluginProject = {
      ...existingProject(),
      id: "77777777-7777-4777-8777-777777777805",
      name: "Business Rules",
      status: "in_progress" as const,
      updatedAt: new Date("2026-05-04T20:00:00Z"),
      managedByPlugin: {
        id: "77777777-7777-4777-8777-777777777806",
        pluginId: "plugin-instance-1",
        pluginKey: manifest.id,
        pluginDisplayName: manifest.displayName,
        resourceKind: "project" as const,
        resourceKey: BRMS_PROJECT_KEY,
        defaultsJson: {},
        createdAt: new Date("2026-05-04T00:00:00Z"),
        updatedAt: new Date("2026-05-04T00:00:00Z"),
      },
    };
    harness.seed({ projects: [recentProject, olderProject, overflowProject, completedProject, pluginProject] });

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      selectedProjects: Array<{ id: string; observedAt: string | null }>;
      eventIngestion: { enabled: boolean; sources: { issues: boolean; comments: boolean; documents: boolean } };
    }>("enable-paperclip-distillation-active-projects", {
      companyId: COMPANY_ID,
      limit: 2,
    });

    expect(result.selectedProjects.map((project) => project.id)).toEqual([recentProject.id, olderProject.id]);
    expect(result.eventIngestion).toMatchObject({
      enabled: true,
      sources: { issues: true, comments: true, documents: true },
    });
    const cursorWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_distillation_cursors"));
    expect(cursorWrites).toHaveLength(2);
    expect(cursorWrites.map((execute) => execute.params?.[5])).toEqual([recentProject.id, olderProject.id]);
    expect(cursorWrites.map((execute) => execute.params?.[8])).toEqual([1, 1]);
    expect(String(cursorWrites[0]?.params?.[9])).toContain('"configuredBy":"enable-active-projects"');
  });

  it("backfills only the selected Paperclip project and date window", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const inWindow = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777797",
      identifier: "PAP-4106",
      title: "Backfill in-window decision",
      description: "Accepted historical decision that should appear in the backfill rule.",
      status: "done",
      projectId: project.id,
      updatedAt: new Date("2026-04-15T12:00:00Z"),
    });
    const outOfWindow = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777798",
      identifier: "PAP-4107",
      title: "Backfill out-of-window decision",
      description: "This old decision must not be included in the selected date window.",
      status: "done",
      projectId: project.id,
      updatedAt: new Date("2026-03-01T12:00:00Z"),
    });
    const otherProject = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777799",
      identifier: "PAP-4108",
      title: "Other project decision",
      description: "This issue belongs to a different project and must not be included.",
      status: "done",
      projectId: "88888888-8888-4888-8888-888888888888",
      updatedAt: new Date("2026-04-16T12:00:00Z"),
    });
    harness.seed({ agents: [brmsMaintainerAgent()], projects: [project], issues: [inWindow, outOfWindow, otherProject] });

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      status: string;
      patches: Array<{ operationType: string; proposedContents: string }>;
      workItem: { kind: string };
      operation: { issue: { originKind: string } };
    }>("backfill-paperclip-distillation", {
      companyId: COMPANY_ID,
      projectId: project.id,
      backfillStartAt: "2026-04-01T00:00:00Z",
      backfillEndAt: "2026-04-30T23:59:59Z",
      autoApply: false,
      includeSupportingRules: false,
    });

    expect(result.status).toBe("review_required");
    expect(result.workItem.kind).toBe("backfill");
    expect(result.operation.issue.originKind).toBe(`${OPERATION_ORIGIN_KIND}:backfill`);
    const projectPatch = result.patches.find((patch) => patch.operationType === "project_rule_distill");
    expect(projectPatch?.proposedContents).toContain("PAP-4106");
    expect(projectPatch?.proposedContents).not.toContain("PAP-4107");
    expect(projectPatch?.proposedContents).not.toContain("PAP-4108");
    const workItemInsert = harness.dbExecutes.find((execute) =>
      execute.sql.includes("paperclip_distillation_work_items") && execute.params?.[3] === "backfill");
    expect(String(workItemInsert?.params?.[9])).toContain('"backfillStartAt":"2026-04-01T00:00:00Z"');
  });

  it("generates review-required Paperclip project rule patches with provenance, index, and log updates", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777791",
      identifier: "PAP-4100",
      title: "Approved project rule distillation plan",
      description: "Accepted plan: write stable project overview sections with source provenance.",
      status: "in_progress",
      projectId: project.id,
      updatedAt: new Date("2026-05-03T10:00:00Z"),
    });
    const files = new Map<string, string>([
      ["brms/index.md", DEFAULT_INDEX],
      ["brms/log.md", DEFAULT_LOG],
    ]);
    const writes: Array<{ path: string; contents: string }> = [];
    harness.seed({ projects: [project], issues: [issue] });
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const contents = files.get(relativePath);
      if (contents == null) throw new Error(`missing ${relativePath}`);
      return contents;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      status: string;
      patches: Array<{ rulePath: string; operationType: string; currentHash: string | null; proposedContents: string; sourceRefs: Array<{ issueIdentifier: string | null }> }>;
      warnings: string[];
    }>("distill-paperclip-project-rule", {
      companyId: COMPANY_ID,
      projectId: project.id,
      autoApply: false,
      maxCharacters: 20000,
      includeSupportingRules: false,
    });

    expect(result.status).toBe("review_required");
    expect(writes).toHaveLength(0);
    expect(result.patches.map((patch) => patch.operationType)).toEqual([
      "standup_update",
      "project_rule_distill",
      "index_refresh",
      "log_append",
    ]);
    const standupPatch = result.patches[0];
    expect(standupPatch.rulePath).toBe("brms/projects/existing-brms-project/standup.md");
    expect(standupPatch.proposedContents).toContain("## Executive Readout");
    expect(standupPatch.proposedContents).toContain("## What Changed");
    const projectPatch = result.patches[1];
    expect(projectPatch.currentHash).toBeNull();
    expect(projectPatch.rulePath).toBe("brms/projects/existing-brms-project/index.md");
    expect(projectPatch.proposedContents).toContain("## Workstreams");
    expect(projectPatch.proposedContents).toContain("PAP-4100");
    expect(projectPatch.sourceRefs).toEqual([expect.objectContaining({ issueIdentifier: "PAP-4100" })]);
    expect(result.patches[2].proposedContents).toContain("[[brms/projects/existing-brms-project/index.md]]");
    expect(result.patches[2].proposedContents).toContain("[[brms/projects/existing-brms-project/standup.md]]");
    expect(result.patches[3].proposedContents).toContain("paperclip-distill | proposed");
    expect(result.warnings).toContain("Auto-apply policy disabled; proposed patches require review.");
  });

  it("keeps suppressed secret-like source content out of generated brms patches", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777796",
      identifier: "PAP-4104",
      title: "Distill sanitized provenance",
      description: "Publish enough project state for a reviewable project rule without leaking credentials.",
      status: "in_progress",
      projectId: project.id,
      updatedAt: new Date("2026-05-04T10:00:00Z"),
    });
    const files = new Map<string, string>([
      ["brms/index.md", DEFAULT_INDEX],
      ["brms/log.md", DEFAULT_LOG],
    ]);
    harness.seed({
      projects: [project],
      issues: [issue],
      issueComments: [{
        id: "77777777-7777-4777-8777-777777777797",
        companyId: COMPANY_ID,
        issueId: issue.id,
        authorType: "user",
        authorAgentId: null,
        authorUserId: null,
        body: "Authorization: Bearer ghp_patchsecretcommenttoken1234567890",
        presentation: null,
        metadata: null,
        createdAt: new Date("2026-05-04T11:00:00Z"),
        updatedAt: new Date("2026-05-04T11:00:00Z"),
      }],
    });
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const contents = files.get(relativePath);
      if (contents == null) throw new Error(`missing ${relativePath}`);
      return contents;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    await harness.ctx.issues.documents.upsert({
      companyId: COMPANY_ID,
      issueId: issue.id,
      key: "plan",
      title: "Plan",
      body: "OPENAI_API_KEY=sk-patchsecretdocumentvalue1234567890",
    });

    const result = await harness.performAction<{
      status: string;
      patches: Array<{ operationType: string; proposedContents: string }>;
    }>("distill-paperclip-project-rule", {
      companyId: COMPANY_ID,
      projectId: project.id,
      maxCharacters: 20000,
      includeSupportingRules: false,
    });

    expect(result.status).toBe("review_required");
    const combinedPatchContents = result.patches.map((patch) => patch.proposedContents).join("\n");
    expect(combinedPatchContents).toContain("redaction=suppressed_sensitive_content");
    expect(combinedPatchContents).toContain("redaction_reasons=secret_like_token");
    expect(combinedPatchContents).not.toContain("ghp_patchsecretcommenttoken1234567890");
    expect(combinedPatchContents).not.toContain("sk-patchsecretdocumentvalue1234567890");
  });

  it("auto-applies Paperclip project rule patches by default when policy allows and records rule bindings", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777792",
      identifier: "PAP-4101",
      title: "Implement project rule writer",
      description: "Implementation completed enough to publish the generated project rule.",
      status: "done",
      projectId: project.id,
      updatedAt: new Date("2026-05-04T10:00:00Z"),
    });
    const files = new Map<string, string>([
      ["brms/index.md", DEFAULT_INDEX],
      ["brms/log.md", DEFAULT_LOG],
    ]);
    harness.seed({ projects: [project], issues: [issue] });
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const contents = files.get(relativePath);
      if (contents == null) throw new Error(`missing ${relativePath}`);
      return contents;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      status: string;
      appliedRules: string[];
      patches: Array<{ rulePath: string; sourceHash: string }>;
    }>("distill-paperclip-project-rule", {
      companyId: COMPANY_ID,
      projectId: project.id,
      autoApply: true,
      maxCharacters: 20000,
      includeSupportingRules: false,
    });

    expect(result.status).toBe("applied");
    expect(result.appliedRules).toEqual([
      "brms/projects/existing-brms-project/standup.md",
      "brms/projects/existing-brms-project/index.md",
      "brms/index.md",
      "brms/log.md",
    ]);
    expect(files.get("brms/projects/existing-brms-project/standup.md")).toContain("## Executive Readout");
    expect(files.get("brms/projects/existing-brms-project/index.md")).toContain("## Current Direction");
    expect(files.get("brms/projects/existing-brms-project/index.md")).toContain("## References");
    expect(files.get("brms/index.md")).toContain("brms/projects/existing-brms-project/index.md");
    expect(files.get("brms/log.md")).toContain("paperclip-distill | proposed");
    const bindingWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_rule_bindings"));
    expect(bindingWrites).toHaveLength(4);
    expect(bindingWrites[0].params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "default",
      project.id,
      null,
      "brms/projects/existing-brms-project/standup.md",
      result.patches[0].sourceHash,
    ]));
  });

  it("refuses auto-apply Paperclip project rule patches in authenticated/public deployments", async () => {
    process.env.PAPERCLIP_DEPLOYMENT_MODE = "authenticated";
    process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE = "public";
    const harness = createTestHarness({ manifest, config: { autoApplyIngestPatches: true } });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-77777777779a",
      identifier: "PAP-4101",
      title: "Implement project rule writer",
      description: "Implementation completed enough to publish the generated project rule.",
      status: "done",
      projectId: project.id,
      updatedAt: new Date("2026-05-04T10:00:00Z"),
    });
    const files = new Map<string, string>([
      ["brms/index.md", DEFAULT_INDEX],
      ["brms/log.md", DEFAULT_LOG],
    ]);
    const writes: string[] = [];
    harness.seed({ projects: [project], issues: [issue] });
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const contents = files.get(relativePath);
      if (contents == null) throw new Error(`missing ${relativePath}`);
      return contents;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push(relativePath);
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      status: string;
      appliedRules: string[];
      warnings: string[];
    }>("distill-paperclip-project-rule", {
      companyId: COMPANY_ID,
      projectId: project.id,
      autoApply: true,
      maxCharacters: 20000,
      includeSupportingRules: false,
    });

    expect(result.status).toBe("review_required");
    expect(result.appliedRules).toEqual([]);
    expect(writes).toHaveLength(0);
    expect(result.warnings).toContain(
      "Authenticated/public deployments always require manual review before brms writes.",
    );
  });

  it("refuses stale project rule hashes before writing generated Paperclip rules", async () => {
    const harness = createTestHarness({ manifest, config: { autoApplyIngestPatches: true } });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777793",
      identifier: "PAP-4102",
      title: "Publish project rule",
      description: "Ready to publish.",
      status: "done",
      projectId: project.id,
    });
    const files = new Map<string, string>([
      ["brms/projects/existing-brms-project/index.md", "# Existing\n"],
      ["brms/index.md", DEFAULT_INDEX],
      ["brms/log.md", DEFAULT_LOG],
    ]);
    const writes: string[] = [];
    harness.seed({ projects: [project], issues: [issue] });
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const contents = files.get(relativePath);
      if (contents == null) throw new Error(`missing ${relativePath}`);
      return contents;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push(relativePath);
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    await expect(harness.performAction("distill-paperclip-project-rule", {
      companyId: COMPANY_ID,
      projectId: project.id,
      autoApply: true,
      expectedProjectRuleHash: "stale",
      includeSupportingRules: false,
    })).rejects.toThrow("Refusing to overwrite");
    expect(writes).toHaveLength(0);
  });

  it("skips low-signal Paperclip source windows without proposing brms writes", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-777777777794",
      identifier: "PAP-4103",
      title: "Routine heartbeat",
      description: "",
      status: "todo",
      projectId: project.id,
    });
    const writes: string[] = [];
    harness.seed({ projects: [project], issues: [issue] });
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push(relativePath);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{ status: string; reason: string; patches: unknown[] }>("distill-paperclip-project-rule", {
      companyId: COMPANY_ID,
      projectId: project.id,
      maxCharacters: 20000,
    });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("low_signal");
    expect(result.patches).toEqual([]);
    expect(writes).toHaveLength(0);
  });

  it("bootstraps required local brms files through the local folder API", async () => {
    const harness = createTestHarness({ manifest });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{ writtenFiles: string[]; managedSkills: BRMSSkillResource[] }>("bootstrap-root", {
      companyId: COMPANY_ID,
      path: "/tmp/company-brms",
    });

    expect(result.writtenFiles).toContain("AGENTS.md");
    expect(result.writtenFiles).toContain("IDEA.md");
    expect(result.managedSkills[0]).toMatchObject({
      status: "created",
      resourceKey: BRMS_MAINTAINER_SKILL_KEY,
      details: { key: BRMS_MAINTAINER_SKILL_CANONICAL_KEY },
    });
    expect(writes.map((write) => write.path)).toEqual([
      ".gitignore",
      "AGENTS.md",
      "IDEA.md",
      "brms/index.md",
      "brms/log.md",
      "raw/.gitkeep",
      "brms/sources/.gitkeep",
      "brms/projects/.gitkeep",
      "brms/entities/.gitkeep",
      "brms/concepts/.gitkeep",
      "brms/synthesis/.gitkeep",
    ]);
    expect(writes.find((write) => write.path === "AGENTS.md")?.contents).toContain("Business Rules Schema");
    expect(writes.find((write) => write.path === "AGENTS.md")?.contents).toContain("brms/projects/<project-slug>/index.md");
    expect(writes.find((write) => write.path === "AGENTS.md")?.contents).toContain("brms/projects/<project-slug>/standup.md");
  });

  it("creates a managed space with an immediately readable baseline skeleton", async () => {
    const harness = createTestHarness({ manifest });
    const files = new Map<string, string>();
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const value = files.get(relativePath);
      if (value == null) throw new Error(`missing ${relativePath}`);
      return value;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { slug: string; pathPrefix: string | null };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "QA Space",
    });

    expect(created.space).toMatchObject({
      slug: "qa-space",
      pathPrefix: "spaces/qa-space",
    });
    await expect(harness.ctx.localFolders.readText(
      COMPANY_ID,
      "brms-root",
      "spaces/qa-space/AGENTS.md",
    )).resolves.toContain("Business Rules Schema");
    expect(files.get("spaces/qa-space/IDEA.md")).toBe(DEFAULT_IDEA);
    expect(files.has("spaces/qa-space/raw/.gitkeep")).toBe(true);
    expect(files.has("spaces/qa-space/projects/.gitkeep")).toBe(false);
    expect(files.has("spaces/qa-space/brms/projects/.gitkeep")).toBe(true);
    expect(files.has("spaces/qa-space/brms/index.md")).toBe(true);
  });

  it("prevents the default space from being archived through update-space", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await expect(harness.performAction("update-space", {
      companyId: COMPANY_ID,
      spaceSlug: "default",
      status: "archived",
    })).rejects.toThrow("The default Business Rules space cannot be archived.");
    const defaultSpaceInsert = harness.dbExecutes.find((execute) =>
      execute.sql.includes("INSERT INTO") && execute.sql.includes("brms_spaces"));
    expect(defaultSpaceInsert?.params?.[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(harness.dbExecutes.some((execute) =>
      execute.sql.includes("UPDATE") &&
      execute.sql.includes("brms_spaces") &&
      execute.params?.includes("archived"))).toBe(false);
  });

  it("archives a non-default space through update-space without re-resolving it as active", async () => {
    const harness = createTestHarness({ manifest });
    const spaceRow = brmsSpaceRow({
      id: "77777777-7777-4777-8777-7777777777b1",
      slug: "qa-space",
      displayName: "QA Space",
      pathPrefix: "spaces/qa-space",
      status: "active",
      settings: { owner: "qa" },
    });
    let archived = false;
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      harness.dbQueries.push({ sql, params });
      if (sql.includes("brms_spaces") && params?.[2] === "qa-space") {
        return archived && sql.includes("status <> 'archived'") ? [] as T[] : [spaceRow] as T[];
      }
      return originalQuery<T>(sql, params);
    };
    const originalExecute = harness.ctx.db.execute.bind(harness.ctx.db);
    harness.ctx.db.execute = async (sql: string, params?: unknown[]) => {
      if (sql.includes("UPDATE") && sql.includes("brms_spaces") && params?.includes("archived")) archived = true;
      return originalExecute(sql, params);
    };

    await plugin.definition.setup(harness.ctx);
    const updated = await harness.performAction<{
      status: string;
      space: { slug: string; displayName: string; status: string; settings: Record<string, unknown> };
    }>("update-space", {
      companyId: COMPANY_ID,
      spaceSlug: "qa-space",
      displayName: "Archived QA",
      settings: { archivedBy: "test" },
      status: "archived",
    });

    expect(updated.status).toBe("ok");
    expect(updated.space).toMatchObject({
      slug: "qa-space",
      displayName: "Archived QA",
      status: "archived",
      settings: { owner: "qa", archivedBy: "test" },
    });
    expect(archived).toBe(true);
  });

  it("restores an archived non-default space through update-space", async () => {
    const harness = createTestHarness({ manifest });
    const spaceRow = brmsSpaceRow({
      id: "77777777-7777-4777-8777-7777777777b2",
      slug: "qa-space",
      displayName: "QA Space",
      pathPrefix: "spaces/qa-space",
      status: "archived",
    });
    let restored = false;
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      harness.dbQueries.push({ sql, params });
      if (sql.includes("brms_spaces") && params?.[2] === "qa-space") {
        if (!restored && sql.includes("status <> 'archived'")) return [] as T[];
        return [{
          ...spaceRow,
          status: restored ? "active" : "archived",
        }] as T[];
      }
      return originalQuery<T>(sql, params);
    };
    const originalExecute = harness.ctx.db.execute.bind(harness.ctx.db);
    harness.ctx.db.execute = async (sql: string, params?: unknown[]) => {
      if (sql.includes("UPDATE") && sql.includes("brms_spaces") && params?.includes("active")) restored = true;
      return originalExecute(sql, params);
    };

    await plugin.definition.setup(harness.ctx);
    const updated = await harness.performAction<{
      status: string;
      space: { slug: string; status: string };
    }>("update-space", {
      companyId: COMPANY_ID,
      spaceSlug: "qa-space",
      status: "active",
    });

    expect(updated.status).toBe("ok");
    expect(updated.space).toMatchObject({
      slug: "qa-space",
      status: "active",
    });
    expect(restored).toBe(true);
  });

  it("rejects unknown space statuses through update-space", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await expect(harness.performAction("update-space", {
      companyId: COMPANY_ID,
      spaceSlug: "default",
      status: "suspended",
    })).rejects.toThrow("Business Rules space status must be active or archived.");
    expect(harness.dbExecutes.some((execute) =>
      execute.sql.includes("UPDATE") &&
      execute.sql.includes("brms_spaces") &&
      execute.params?.includes("suspended"))).toBe(false);
  });

  it("omits archived spaces from the spaces data API", async () => {
    const harness = createTestHarness({ manifest });
    const activeRow = brmsSpaceRow({
      id: "77777777-7777-4777-8777-7777777777a1",
      slug: "team-research",
      displayName: "Team Research",
      pathPrefix: "spaces/team-research",
      status: "active",
    });
    const archivedRow = brmsSpaceRow({
      id: "77777777-7777-4777-8777-7777777777a2",
      slug: "qa-team-lock",
      displayName: "QA Team Lock",
      pathPrefix: "spaces/qa-team-lock",
      status: "archived",
    });
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      harness.dbQueries.push({ sql, params });
      if (sql.includes("brms_spaces") && sql.includes("ORDER BY CASE WHEN slug = 'default'")) {
        const rows = [defaultBRMSSpaceRow(), activeRow];
        if (!sql.includes("status <> 'archived'")) rows.push(archivedRow);
        return rows as T[];
      }
      if (sql.includes("brms_spaces") && sql.includes("slug = 'default'")) {
        return [defaultBRMSSpaceRow()] as T[];
      }
      return [] as T[];
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.getData<{ spaces: Array<{ slug: string }> }>("spaces", {
      companyId: COMPANY_ID,
      brmsId: "default",
    });

    expect(result.spaces.map((space) => space.slug)).toEqual(["default", "team-research"]);
    expect(harness.dbQueries.some((query) => query.sql.includes("status <> 'archived'"))).toBe(true);
  });

  it("captures raw sources into local files and plugin metadata", async () => {
    const harness = createTestHarness({ manifest });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{ rawPath: string; hash: string }>("capture-source", {
      companyId: COMPANY_ID,
      brmsId: "default",
      title: "Plugin Boundaries",
      contents: "# Plugin Boundaries\n\nKeep brms logic in the plugin.",
    });

    expect(result.rawPath).toMatch(/^raw\/\d{4}-\d{2}-\d{2}-plugin-boundaries-/);
    expect(result.hash).toHaveLength(64);
    expect(writes[0]).toMatchObject({ path: result.rawPath });
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_sources"))).toBe(true);
  });

  it("preserves manual source ingest for non-default spaces while refusing Paperclip distillation there", async () => {
    const harness = createTestHarness({ manifest });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };
    harness.seed({
      agents: [brmsMaintainerAgent()],
      projects: [existingProject()],
    });
    const spaces = new Map<string, Record<string, unknown>>();
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      if (sql.includes("brms_spaces")) {
        const slug = typeof params?.[2] === "string" ? params[2] : null;
        if (slug && spaces.has(slug)) return [spaces.get(slug)] as T[];
      }
      return originalQuery<T>(sql, params);
    };

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { id: string; companyId: string; brmsId: string; slug: string; displayName: string; pathPrefix: string | null };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Team Research",
    });
    spaces.set(created.space.slug, {
      id: created.space.id,
      company_id: created.space.companyId,
      brms_id: created.space.brmsId,
      slug: created.space.slug,
      display_name: created.space.displayName,
      space_type: "local_folder",
      folder_mode: "managed_subfolder",
      root_folder_key: "brms-root",
      path_prefix: created.space.pathPrefix,
      configured_root_path: null,
      access_scope: "shared",
      owner_user_id: null,
      owner_agent_id: null,
      team_key: null,
      settings: {},
      status: "active",
      created_at: null,
      updated_at: null,
    });

    const source = await harness.performAction<{ rawPath: string; spaceSlug: string }>("capture-source", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
      title: "Team notes",
      contents: "# Team notes\n\nManual source ingest still belongs to the selected space.",
    });

    expect(source.spaceSlug).toBe(created.space.slug);
    expect(writes.map((write) => write.path)).toContain(`spaces/${created.space.slug}/${source.rawPath}`);
    await expect(harness.performAction("distill-paperclip-now", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
      projectId: existingProject().id,
    })).rejects.toThrow("Paperclip ingestion policy denied queue");
  });

  it("fails closed for direct Paperclip ingestion actions against restricted spaces", async () => {
    const harness = createTestHarness({ manifest });
    harness.seed({
      agents: [brmsMaintainerAgent()],
      projects: [existingProject()],
    });

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { slug: string; accessScope: string };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Private Notes",
      accessScope: "personal",
    });

    expect(created.space.accessScope).toBe("personal");
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      if (sql.includes("brms_spaces") && params?.[2] === created.space.slug) {
        return [{
          id: "77777777-7777-4777-8777-7777777777b2",
          company_id: COMPANY_ID,
          brms_id: "default",
          slug: created.space.slug,
          display_name: "Private Notes",
          space_type: "local_folder",
          folder_mode: "managed_subfolder",
          root_folder_key: "brms-root",
          path_prefix: `spaces/${created.space.slug}`,
          configured_root_path: null,
          access_scope: "personal",
          owner_user_id: null,
          owner_agent_id: null,
          team_key: null,
          settings: {},
          status: "active",
          created_at: null,
          updated_at: null,
        }] as T[];
      }
      return originalQuery<T>(sql, params);
    };
    await expect(harness.performAction("distill-paperclip-now", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
      projectId: existingProject().id,
    })).rejects.toThrow("Paperclip ingestion policy denied queue");

    const operations = await harness.ctx.issues.list({
      companyId: COMPANY_ID,
      originKindPrefix: String(OPERATION_ORIGIN_KIND),
    });
    expect(operations).toHaveLength(0);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("paperclip_distillation_work_items"))).toBe(false);
  });

  it("re-checks Paperclip ingestion policy at execution time for queued work", async () => {
    const harness = createTestHarness({ manifest });
    const project = existingProject();
    const issue = paperclipIssue({
      id: "77777777-7777-4777-8777-7777777777b0",
      identifier: "PAP-4111",
      title: "Queued distillation source",
      description: "Accepted queued work should not run after policy changes.",
      projectId: project.id,
      status: "done",
    });
    harness.seed({ agents: [brmsMaintainerAgent()], projects: [project], issues: [issue] });

    await plugin.definition.setup(harness.ctx);
    const queued = await harness.performAction<{ status: string }>("distill-paperclip-now", {
      companyId: COMPANY_ID,
      projectId: project.id,
    });
    expect(queued.status).toBe("queued");

    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      if (sql.includes("brms_spaces") && sql.includes("slug = 'default'")) {
        return [{
          id: "77777777-7777-4777-8777-7777777777b1",
          company_id: COMPANY_ID,
          brms_id: "default",
          slug: "default",
          display_name: "default",
          space_type: "local_folder",
          folder_mode: "managed_subfolder",
          root_folder_key: "brms-root",
          path_prefix: null,
          configured_root_path: null,
          access_scope: "personal",
          owner_user_id: null,
          owner_agent_id: null,
          team_key: null,
          settings: {},
          status: "active",
          created_at: null,
          updated_at: null,
        }] as T[];
      }
      return originalQuery<T>(sql, params);
    };

    await expect(harness.performAction("create-paperclip-distillation-run", {
      companyId: COMPANY_ID,
      projectId: project.id,
    })).rejects.toThrow("personal spaces cannot ingest Paperclip sources");
    expect(harness.dbExecutes.some((execute) =>
      execute.sql.includes("paperclip_distillation_runs") && execute.sql.includes("'source_ready'"))).toBe(false);
  });

  it("queues Paperclip ingestion backfills for every selected project scope", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const queued = await harness.performAction<{
      status: string;
      workItemId: string;
      issueId: string;
      workItems: Array<{ workItemId: string; issueId: string; projectId: string | null; rootIssueId: string | null }>;
    }>("queue-paperclip-ingestion-backfill", {
      companyId: COMPANY_ID,
      sourceScope: {
        kind: "selected_projects",
        projectIds: [
          "77777777-7777-4777-8777-7777777777a1",
          "77777777-7777-4777-8777-7777777777a2",
        ],
      },
      backfillStartAt: "2026-05-01T00:00:00.000Z",
      backfillEndAt: "2026-05-02T00:00:00.000Z",
    });

    expect(queued.status).toBe("queued");
    expect(queued.workItems).toHaveLength(2);
    expect(queued.workItemId).toBe(queued.workItems[0]?.workItemId);
    expect(queued.issueId).toBe(queued.workItems[0]?.issueId);
    expect(queued.workItems.map((item) => item.projectId)).toEqual([
      "77777777-7777-4777-8777-7777777777a1",
      "77777777-7777-4777-8777-7777777777a2",
    ]);
    expect(harness.dbExecutes.filter((execute) => execute.sql.includes("paperclip_distillation_work_items"))).toHaveLength(2);
  });

  it("rejects oversized Paperclip ingestion profile and source-scope payloads", async () => {
    const harness = createTestHarness({ manifest });

    await plugin.definition.setup(harness.ctx);
    await expect(harness.performAction("update-event-ingestion-settings", {
      companyId: COMPANY_ID,
      enabled: true,
      maxCharacters: 20001,
      sources: { issues: true },
    })).rejects.toThrow("maxCharacters exceeds the hard Paperclip ingestion cap");

    await expect(harness.performAction("enable-paperclip-distillation-active-projects", {
      companyId: COMPANY_ID,
      limit: 26,
    })).rejects.toThrow("fan-out exceeds the hard cap");

    await expect(harness.performAction("assemble-paperclip-source-bundle", {
      companyId: COMPANY_ID,
      projectId: "77777777-7777-4777-8777-777777777777",
      rootIssueId: "77777777-7777-4777-8777-777777777778",
    })).rejects.toThrow("either projectId or rootIssueId");

    await expect(harness.performAction("assemble-paperclip-source-bundle", {
      companyId: COMPANY_ID,
      projectId: "77777777-7777-4777-8777-777777777777",
      maxCharacters: 60001,
    })).rejects.toThrow("maxCharacters exceeds the hard Paperclip ingestion cap");
  });

  it("keeps default-space files at the root and isolates managed spaces under slug prefixes", async () => {
    const harness = createTestHarness({ manifest });
    const files = new Map<string, string>();
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const value = files.get(relativePath);
      if (value == null) throw new Error(`missing ${relativePath}`);
      return value;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };
    const spaces = new Map<string, Record<string, unknown>>();
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      if (sql.includes("brms_spaces")) {
        const slug = typeof params?.[2] === "string" ? params[2] : null;
        if (slug && spaces.has(slug)) return [spaces.get(slug)] as T[];
      }
      return originalQuery<T>(sql, params);
    };

    await plugin.definition.setup(harness.ctx);
    const created = await harness.performAction<{
      space: { id: string; companyId: string; brmsId: string; slug: string; displayName: string; pathPrefix: string | null };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Research Space",
    });
    spaces.set(created.space.slug, {
      id: created.space.id,
      company_id: created.space.companyId,
      brms_id: created.space.brmsId,
      slug: created.space.slug,
      display_name: created.space.displayName,
      space_type: "local_folder",
      folder_mode: "managed_subfolder",
      root_folder_key: "brms-root",
      path_prefix: created.space.pathPrefix,
      configured_root_path: null,
      access_scope: "shared",
      owner_user_id: null,
      owner_agent_id: null,
      team_key: null,
      settings: {},
      status: "active",
      created_at: null,
      updated_at: null,
    });
    await harness.performAction("bootstrap-space", {
      companyId: COMPANY_ID,
      spaceSlug: created.space.slug,
    });
    await harness.performAction("write-rule", {
      companyId: COMPANY_ID,
      brmsId: "default",
      path: "brms/concepts/shared.md",
      contents: "# Default Shared\n",
    });
    await harness.performAction("write-rule", {
      companyId: COMPANY_ID,
      brmsId: "default",
      spaceSlug: created.space.slug,
      path: "brms/concepts/shared.md",
      contents: "# Space Shared\n",
    });
    await harness.performAction("capture-source", {
      companyId: COMPANY_ID,
      brmsId: "default",
      rawPath: "raw/shared.md",
      title: "Shared Source",
      contents: "# Default Raw\n",
    });
    await harness.performAction("capture-source", {
      companyId: COMPANY_ID,
      brmsId: "default",
      spaceSlug: created.space.slug,
      rawPath: "raw/shared.md",
      title: "Shared Source",
      contents: "# Space Raw\n",
    });

    expect(created.space).toMatchObject({
      slug: "research-space",
      pathPrefix: "spaces/research-space",
    });
    expect(files.get("brms/concepts/shared.md")).toBe("# Default Shared\n");
    expect(files.get("spaces/research-space/brms/concepts/shared.md")).toBe("# Space Shared\n");
    expect(files.get("raw/shared.md")).toBe("# Default Raw\n");
    expect(files.get("spaces/research-space/raw/shared.md")).toBe("# Space Raw\n");
    expect(writes.map((write) => write.path)).not.toContain("spaces/default/brms/concepts/shared.md");

    const ruleWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("brms_rules"));
    const sourceWrites = harness.dbExecutes.filter((execute) => execute.sql.includes("brms_sources"));
    expect(ruleWrites.every((write) => write.sql.includes("space_id"))).toBe(true);
    expect(sourceWrites.every((write) => write.sql.includes("space_id"))).toBe(true);
  });

  it("ingests source metadata and creates a hidden plugin-operation issue", async () => {
    const harness = createTestHarness({ manifest });
    harness.seed({ agents: [brmsMaintainerAgent()] });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{
      source: { rawPath: string; title: string; hash: string };
      operation: { operationId: string; issue: { originKind: string; originId: string | null; billingCode: string | null; assigneeAgentId: string | null } };
    }>("ingest-source", {
      companyId: COMPANY_ID,
      brmsId: "engineering",
      sourceType: "url",
      title: "Standalone Plugin Notes",
      url: "https://example.test/brms",
      contents: "# Standalone Plugin Notes\n\nKeep brms behavior in the plugin package.",
      rawPath: "raw/standalone-plugin-notes.md",
      metadata: { importedBy: "alpha-verification" },
    });

    expect(result.source.rawPath).toBe("raw/standalone-plugin-notes.md");
    expect(result.source.title).toBe("Standalone Plugin Notes");
    expect(result.source.hash).toHaveLength(64);
    expect(writes).toEqual([
      expect.objectContaining({
        path: "raw/standalone-plugin-notes.md",
        contents: expect.stringContaining("Keep brms behavior in the plugin package."),
      }),
    ]);
    expect(result.operation.issue.originKind).toBe(`${OPERATION_ORIGIN_KIND}:ingest`);
    expect(result.operation.issue.originId).toBe(`brms:engineering:operation:${result.operation.operationId}`);
    expect(result.operation.issue.billingCode).toBe("plugin-brms:engineering");
    expect(result.operation.issue.assigneeAgentId).toBe(brmsMaintainerAgent().id);

    const sourceInsert = harness.dbExecutes.find((execute) => execute.sql.includes("brms_sources"));
    expect(sourceInsert?.params).toEqual(expect.arrayContaining([
      COMPANY_ID,
      "engineering",
      "url",
      "Standalone Plugin Notes",
      "https://example.test/brms",
      "raw/standalone-plugin-notes.md",
      JSON.stringify({ importedBy: "alpha-verification" }),
    ]));
    const operationInsert = harness.dbExecutes.find((execute) => execute.sql.includes("brms_operations"));
    expect(operationInsert?.params).toEqual(expect.arrayContaining([
      result.operation.operationId,
      COMPANY_ID,
      "engineering",
      "ingest",
      "queued",
    ]));
  });

  it("rejects oversized source capture before raw writes or operation creation", async () => {
    const harness = createTestHarness({ manifest, config: { maxSourceBytes: 16 } });
    harness.seed({ agents: [brmsMaintainerAgent()] });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    await expect(harness.performAction("ingest-source", {
      companyId: COMPANY_ID,
      brmsId: "default",
      sourceType: "text",
      title: "Oversized source",
      contents: "x".repeat(17),
    })).rejects.toThrow("exceeds the configured Business Rules source limit");

    expect(writes).toHaveLength(0);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_sources"))).toBe(false);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_operations"))).toBe(false);
    const operations = await harness.ctx.issues.list({
      companyId: COMPANY_ID,
      originKindPrefix: String(OPERATION_ORIGIN_KIND),
    });
    expect(operations).toHaveLength(0);
  });

  it("writes rules atomically, records metadata, and rejects stale hashes", async () => {
    const harness = createTestHarness({ manifest });
    const files = new Map<string, string>([
      ["brms/concepts/plugin-boundaries.md", "# Old Title\n"],
    ]);
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const value = files.get(relativePath);
      if (value == null) throw new Error("missing");
      return value;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);
    const staleWrite = harness.executeTool("brms_write_rule", {
      companyId: COMPANY_ID,
      brmsId: "default",
      path: "brms/concepts/plugin-boundaries.md",
      contents: "# New Title\n",
      expectedHash: "stale",
    });
    await expect(staleWrite).rejects.toThrow("Refusing to overwrite");

    const result = await harness.executeTool<{ data?: { hash: string } }>("brms_write_rule", {
      companyId: COMPANY_ID,
      brmsId: "default",
      path: "brms/concepts/plugin-boundaries.md",
      contents: "# Plugin Boundaries\n\nSee [Knowledge](brms/areas/knowledge.md).",
    });

    expect(result.data?.hash).toHaveLength(64);
    expect(files.get("brms/concepts/plugin-boundaries.md")).toContain("Plugin Boundaries");
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_rules"))).toBe(true);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_rule_revisions"))).toBe(true);
  });

  it("blocks agent-tool writes to AGENTS.md but allows explicit board edits", async () => {
    const harness = createTestHarness({ manifest });
    const files = new Map<string, string>([
      ["AGENTS.md", "# Business Rules Maintainer\n\nOriginal instructions.\n"],
    ]);
    harness.ctx.localFolders.readText = async (_companyId, _folderKey, relativePath) => {
      const value = files.get(relativePath);
      if (value == null) throw new Error("missing");
      return value;
    };
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      files.set(relativePath, contents);
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };

    await plugin.definition.setup(harness.ctx);

    await expect(harness.executeTool("brms_write_rule", {
      companyId: COMPANY_ID,
      brmsId: "default",
      path: "AGENTS.md",
      contents: "# Business Rules Maintainer\n\nCompromised instructions.\n",
    })).rejects.toThrow("Refusing to overwrite protected brms control file AGENTS.md");

    const result = await harness.performAction<{ hash: string }>("write-rule", {
      companyId: COMPANY_ID,
      brmsId: "default",
      path: "AGENTS.md",
      contents: "# Business Rules Maintainer\n\nBoard-updated instructions.\n",
    });

    expect(result.hash).toHaveLength(64);
    expect(files.get("AGENTS.md")).toContain("Board-updated instructions.");
  });

  it("creates plugin-operation issues for LLM workflows", async () => {
    const harness = createTestHarness({ manifest });
    harness.seed({ agents: [brmsMaintainerAgent()] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{ issue: { originKind: string; billingCode: string | null } }>(
      "create-operation",
      {
        companyId: COMPANY_ID,
        operationType: "query",
        title: "Ask the brms about plugin boundaries",
        prompt: "Which files own brms behavior?",
      },
    );

    expect(result.issue.originKind).toBe(`${OPERATION_ORIGIN_KIND}:query`);
    expect(result.issue.billingCode).toBe("plugin-brms:default");
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_resource_bindings"))).toBe(true);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_operations"))).toBe(true);
  });

  it("stamps resolved space context into hidden operation issues and operation metadata", async () => {
    const harness = createTestHarness({ manifest });
    harness.seed({ agents: [brmsMaintainerAgent()] });
    const spaces = new Map<string, Record<string, unknown>>();
    const originalQuery = harness.ctx.db.query.bind(harness.ctx.db);
    harness.ctx.db.query = async <T,>(sql: string, params?: unknown[]) => {
      if (sql.includes("brms_spaces")) {
        const slug = typeof params?.[2] === "string" ? params[2] : null;
        if (slug && spaces.has(slug)) return [spaces.get(slug)] as T[];
      }
      return originalQuery<T>(sql, params);
    };
    await plugin.definition.setup(harness.ctx);

    const created = await harness.performAction<{
      space: { id: string; companyId: string; brmsId: string; slug: string; displayName: string; pathPrefix: string | null };
    }>("create-space", {
      companyId: COMPANY_ID,
      displayName: "Research Space",
    });
    spaces.set(created.space.slug, {
      id: created.space.id,
      company_id: created.space.companyId,
      brms_id: created.space.brmsId,
      slug: created.space.slug,
      display_name: created.space.displayName,
      space_type: "local_folder",
      folder_mode: "managed_subfolder",
      root_folder_key: "brms-root",
      path_prefix: created.space.pathPrefix,
      configured_root_path: null,
      access_scope: "shared",
      owner_user_id: null,
      owner_agent_id: null,
      team_key: null,
      settings: {},
      status: "active",
      created_at: null,
      updated_at: null,
    });

    const result = await harness.performAction<{
      operationId: string;
      issue: { title: string; description: string | null; billingCode: string | null; originId: string | null };
    }>("create-operation", {
      companyId: COMPANY_ID,
      operationType: "lint",
      title: "Run Business Rules lint",
      prompt: "Audit brms structure.",
      spaceSlug: created.space.slug,
    });

    expect(result.issue.title).toBe("Run Business Rules lint [space: Research Space / research-space]");
    expect(result.issue.description).toContain("Space: Research Space (research-space)");
    expect(result.issue.description).toContain("Space root: brms-root/spaces/research-space");
    expect(result.issue.description).toContain("Pass brmsId `default` and spaceSlug `research-space`");
    expect(result.issue.description).toContain("Manual ingest, query, lint, index, and file-as-rule operations follow the named destination space");
    expect(result.issue.billingCode).toBe("plugin-brms:default:research-space");
    expect(result.issue.originId).toBe(`brms:default:space:research-space:operation:${result.operationId}`);
    const operationInsert = harness.dbExecutes.find((execute) =>
      execute.sql.includes("brms_operations") && execute.params?.[0] === result.operationId);
    const metadata = JSON.parse(String(operationInsert?.params?.[8]));
    expect(metadata).toMatchObject({
      operationType: "lint",
      operationId: result.operationId,
      brmsId: "default",
      spaceId: created.space.id,
      spaceSlug: "research-space",
      spaceName: "Research Space",
      spaceRoot: "brms-root/spaces/research-space",
      billingCode: "plugin-brms:default:research-space",
    });
  });

  it("uses selected existing agent and project bindings for new operations", async () => {
    const harness = createTestHarness({ manifest });
    const agent = existingAgent();
    const project = existingProject();
    harness.seed({ agents: [agent], projects: [project] });
    await plugin.definition.setup(harness.ctx);

    const selectedAgent = await harness.performAction<{ source: string; agentId: string }>("select-managed-agent", {
      companyId: COMPANY_ID,
      agentId: agent.id,
    });
    const selectedProject = await harness.performAction<{ source: string; projectId: string }>("select-managed-project", {
      companyId: COMPANY_ID,
      projectId: project.id,
    });

    expect(selectedAgent).toMatchObject({ source: "selected", agentId: agent.id });
    expect(selectedProject).toMatchObject({ source: "selected", projectId: project.id });
    expect(harness.dbExecutes.filter((execute) => execute.sql.includes("brms_resource_bindings"))).toHaveLength(2);

    harness.ctx.db.query = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      harness.dbQueries.push({ sql, params });
      if (sql.includes("brms_resource_bindings") && params?.[2] === "agent") {
        return [{ resolved_id: agent.id, metadata: { source: "selected-existing" } }] as T[];
      }
      if (sql.includes("brms_resource_bindings") && params?.[2] === "project") {
        return [{ resolved_id: project.id, metadata: { source: "selected-existing" } }] as T[];
      }
      if (sql.includes("brms_operations")) return [{ count: "0" }] as T[];
      return [];
    };

    const result = await harness.performAction<{
      issue: { assigneeAgentId: string | null; projectId: string | null };
    }>("create-operation", {
      companyId: COMPANY_ID,
      operationType: "lint",
      title: "Lint selected brms",
    });

    expect(result.issue.assigneeAgentId).toBe(agent.id);
    expect(result.issue.projectId).toBe(project.id);
  });

  it("starts query sessions, records run ids, and forwards session events to plugin streams", async () => {
    const harness = createTestHarness({ manifest });
    harness.seed({ agents: [brmsMaintainerAgent()] });
    const streamEvents: unknown[] = [];
    harness.ctx.streams.emit = (_channel, event) => {
      streamEvents.push(event);
    };
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{
      operationId: string;
      querySessionId: string;
      sessionId: string;
      runId: string;
      channel: string;
    }>("start-query", {
      companyId: COMPANY_ID,
      question: "Which files own brms behavior?",
    });

    expect(result.querySessionId).toBe(result.operationId);
    expect(result.channel).toBe(`brms:query:${result.operationId}`);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_query_sessions"))).toBe(true);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("run_ids"))).toBe(true);

    harness.simulateSessionEvent(result.sessionId, {
      runId: result.runId,
      seq: 1,
      eventType: "chunk",
      stream: "stdout",
      message: "Keep brms behavior in the plugin.",
      payload: null,
    });
    harness.simulateSessionEvent(result.sessionId, {
      runId: result.runId,
      seq: 2,
      eventType: "done",
      stream: "system",
      message: "Run completed",
      payload: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(streamEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "query.started", operationId: result.operationId }),
      expect.objectContaining({ type: "agent.event", message: "Keep brms behavior in the plugin." }),
      expect.objectContaining({ type: "query.done", answer: "Keep brms behavior in the plugin." }),
    ]));
    expect(harness.dbExecutes.some((execute) =>
      execute.sql.includes("brms_query_sessions") && execute.params?.includes("completed"),
    )).toBe(true);
  });

  it("files a streamed query answer as a rule through a hidden file-as-rule operation", async () => {
    const harness = createTestHarness({ manifest });
    harness.seed({ agents: [brmsMaintainerAgent()] });
    const writes: Array<{ path: string; contents: string }> = [];
    harness.ctx.localFolders.writeTextAtomic = async (_companyId, _folderKey, relativePath, contents) => {
      writes.push({ path: relativePath, contents });
      return harness.ctx.localFolders.status(COMPANY_ID, "brms-root");
    };
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{ path: string; operationId: string; rule: { revisionId: string } }>(
      "file-as-rule",
      {
        companyId: COMPANY_ID,
        querySessionId: "33333333-3333-4333-8333-333333333333",
        question: "Where should brms code live?",
        answer: "BRMS-specific code lives in the standalone plugin package.",
        path: "brms/concepts/plugin-boundaries.md",
        title: "Plugin Boundaries",
      },
    );

    expect(result.path).toBe("brms/concepts/plugin-boundaries.md");
    expect(writes[0]).toMatchObject({ path: "brms/concepts/plugin-boundaries.md" });
    expect(writes[0]?.contents).toContain("BRMS-specific code lives in the standalone plugin package.");
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_operations"))).toBe(true);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("brms_rule_revisions"))).toBe(true);
    expect(harness.dbExecutes.some((execute) => execute.sql.includes("filed_outputs"))).toBe(true);
  });
});
