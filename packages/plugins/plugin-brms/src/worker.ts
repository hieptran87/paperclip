import {
  definePlugin,
  runWorker,
  type PluginApiRequestInput,
  type PluginContext,
  type PluginManagedRoutineDeclaration,
  type PluginManagedRoutineResolution,
} from "@paperclipai/plugin-sdk";
import {
  PAPERCLIP_DISTILL_SKILL_KEY,
  BRMS_MAINTENANCE_ROUTINE_KEYS,
  BRMS_ROOT_FOLDER_KEY,
} from "./manifest.js";
import {
  bootstrapBRMSRoot,
  bootstrapSpace,
  assemblePaperclipSourceBundle,
  archiveSpace,
  captureBRMSSource,
  createSpace,
  createPaperclipDistillationRun,
  createPaperclipDistillationWorkItem,
  createOperationIssue,
  distillPaperclipProjectRule,
  enableActiveProjectDistillation,
  fileQueryAnswerAsRule,
  getDistillationOverview,
  getDistillationRuleProvenance,
  getDistillationAutoApplyRestriction,
  getEventIngestionSettings,
  listPaperclipIngestionCandidates,
  getPaperclipIngestionProfile,
  getOverview,
  listSpaces,
  handlePaperclipEventIngestion,
  listBRMSAgentOptions,
  listBRMSProjectOptions,
  listOperations,
  listRules,
  listSources,
  readCompanyIdFromParams,
  readTemplate,
  readBRMSRule,
  recordPaperclipDistillationOutcome,
  reconcileBRMSAgentResource,
  reconcileBRMSProjectResource,
  reconcileBRMSRoutineResources,
  reconcileBRMSSkillResources,
  registerBRMSTools,
  resetBRMSSkillResources,
  resetBRMSAgentResource,
  resetBRMSProjectResource,
  selectBRMSAgentResource,
  selectBRMSProjectResource,
  startBRMSQuerySession,
  spaceFolderStatus,
  updateEventIngestionSettings,
  updatePaperclipIngestionProfile,
  updateSpace,
  writeTemplate,
  writeBRMSRule,
} from "./brms.js";

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function routineKeyField(value: unknown): (typeof BRMS_MAINTENANCE_ROUTINE_KEYS)[number] {
  const routineKey = stringField(value);
  if (!routineKey) {
    throw new Error(`routineKey is required; valid values: ${BRMS_MAINTENANCE_ROUTINE_KEYS.join(", ")}`);
  }
  if (!BRMS_MAINTENANCE_ROUTINE_KEYS.includes(routineKey as (typeof BRMS_MAINTENANCE_ROUTINE_KEYS)[number])) {
    throw new Error(`Unknown managed routine: ${routineKey}`);
  }
  return routineKey as (typeof BRMS_MAINTENANCE_ROUTINE_KEYS)[number];
}

function routineOverridesFromParams(params: Record<string, unknown>) {
  const overrides: { assigneeAgentId?: string; projectId?: string } = {};
  const assigneeAgentId = stringField(params.assigneeAgentId);
  const projectId = stringField(params.projectId);
  if (assigneeAgentId) overrides.assigneeAgentId = assigneeAgentId;
  if (projectId) overrides.projectId = projectId;
  return overrides;
}

let activeContext: PluginContext | null = null;
const PAPERCLIP_EVENT_INGESTION_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.comment.created",
  "issue.document.created",
  "issue.document.updated",
] as const;

type ManagedRoutineDefaultDrift = {
  changedFields: string[];
  defaultTitle: string;
  defaultDescription: string | null;
};

type ManagedRoutineSettingsResolution = PluginManagedRoutineResolution & {
  defaultDrift: ManagedRoutineDefaultDrift | null;
};

function requireContext(): PluginContext {
  if (!activeContext) throw new Error("Business Rules plugin has not been set up");
  return activeContext;
}

function normalizeRoutineTemplateText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : null;
}

function manualDistillScopeLabel(input: { projectId?: string | null; rootIssueId?: string | null }) {
  if (input.rootIssueId) return "selected root issue";
  if (input.projectId) return "selected project";
  return "company-wide stale cursor scan";
}

function buildManualDistillPrompt(input: { companyId: string; projectId?: string | null; rootIssueId?: string | null }) {
  const scopeLabel = manualDistillScopeLabel(input);
  return [
    "Manual Business Rules distillation requested outside recurring cadence.",
    "",
    "Prompt source: Business Rules plugin action `distill-paperclip-now` (`packages/plugins/plugin-brms/src/worker.ts`).",
    `Required skill: use the installed \`${PAPERCLIP_DISTILL_SKILL_KEY}\` skill before changing brms files.`,
    "",
    "Scope:",
    `- Company ID: ${input.companyId}`,
    `- Requested scope: ${scopeLabel}`,
    input.projectId ? `- Source project ID: ${input.projectId}` : null,
    input.rootIssueId ? `- Source root issue ID: ${input.rootIssueId}` : null,
    !input.projectId && !input.rootIssueId
      ? "- Do not hardcode a single project. Find non-plugin Paperclip issues/comments/documents that changed in any project after the last processed cursor and are old enough for the stale/debounce threshold."
      : null,
    "",
    "Process:",
    "1. Read the brms root AGENTS.md, brms/index.md, and recent brms/log.md entries.",
    "2. Assemble bounded Paperclip source bundles for every eligible project or root issue, excluding Business Rules plugin-operation issues.",
    "3. Turn durable signal into project standups, brms-insightful project rules, decisions, history, index, and log updates per the paperclip-distill skill.",
    "4. Surface clipped, low-signal, stale-hash, or source-window warnings instead of hiding them.",
  ].filter((line): line is string => line !== null).join("\n");
}

function withManagedRoutineDefaultDrift(
  routine: PluginManagedRoutineResolution,
  declaration: PluginManagedRoutineDeclaration | undefined,
): ManagedRoutineSettingsResolution {
  if (!routine.routine || !declaration) {
    return { ...routine, defaultDrift: null };
  }

  const changedFields: string[] = [];
  if (normalizeRoutineTemplateText(routine.routine.title) !== normalizeRoutineTemplateText(declaration.title)) {
    changedFields.push("title");
  }
  if (normalizeRoutineTemplateText(routine.routine.description) !== normalizeRoutineTemplateText(declaration.description ?? null)) {
    changedFields.push("description");
  }
  if (routine.routine.priority !== (declaration.priority ?? "medium")) {
    changedFields.push("priority");
  }
  if (routine.routine.concurrencyPolicy !== (declaration.concurrencyPolicy ?? "coalesce_if_active")) {
    changedFields.push("concurrency policy");
  }
  if (routine.routine.catchUpPolicy !== (declaration.catchUpPolicy ?? "skip_missed")) {
    changedFields.push("catch-up policy");
  }

  return {
    ...routine,
    defaultDrift: changedFields.length > 0
      ? {
        changedFields,
        defaultTitle: declaration.title,
        defaultDescription: declaration.description ?? null,
      }
      : null,
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    activeContext = ctx;
    await registerBRMSTools(ctx);

    for (const eventName of PAPERCLIP_EVENT_INGESTION_EVENTS) {
      ctx.events.on(eventName, async (event) => {
        const result = await handlePaperclipEventIngestion(ctx, event);
        if (result.status === "recorded") {
          ctx.logger.info("Business Rules recorded Paperclip event for cursor discovery", {
            eventType: event.eventType,
            companyId: event.companyId,
            sourceKind: result.sourceKind,
            sourceId: result.sourceId,
            cursorId: result.cursorId,
          });
        }
      });
    }

    ctx.data.register("overview", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      return getOverview(ctx, companyId);
    });

    ctx.data.register("health", async (params) => {
      const companyId = stringField(params.companyId);
      return companyId
        ? getOverview(ctx, companyId)
        : { status: "ok", checkedAt: new Date().toISOString(), message: "Business Rules worker is running" };
    });

    ctx.actions.register("bootstrap-root", async (params) => {
      return bootstrapBRMSRoot(ctx, {
        companyId: readCompanyIdFromParams(params),
        path: stringField(params.path),
      });
    });

    ctx.data.register("spaces", async (params) => {
      return listSpaces(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
      });
    });

    ctx.data.register("space", async (params) => {
      return spaceFolderStatus(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
      });
    });

    ctx.actions.register("create-space", async (params) => {
      return createSpace(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        slug: stringField(params.slug),
        displayName: stringField(params.displayName),
        folderMode: stringField(params.folderMode) as "managed_subfolder" | "existing_local_folder" | null,
        accessScope: stringField(params.accessScope) as "shared" | "personal" | "team" | null,
        settings: typeof params.settings === "object" && params.settings != null ? params.settings as Record<string, unknown> : null,
      });
    });

    ctx.actions.register("update-space", async (params) => {
      return updateSpace(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        displayName: stringField(params.displayName),
        status: stringField(params.status) as "active" | "archived" | null,
        settings: typeof params.settings === "object" && params.settings != null ? params.settings as Record<string, unknown> : null,
      });
    });

    ctx.actions.register("bootstrap-space", async (params) => {
      return bootstrapSpace(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
      });
    });

    ctx.actions.register("archive-space", async (params) => {
      return archiveSpace(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
      });
    });

    ctx.actions.register("create-operation", async (params) => {
      const operationType = stringField(params.operationType);
      if (
        operationType !== "ingest" &&
        operationType !== "query" &&
        operationType !== "lint" &&
        operationType !== "file-as-rule" &&
        operationType !== "index" &&
        operationType !== "distill" &&
        operationType !== "backfill"
      ) {
        throw new Error("operationType must be ingest, query, lint, file-as-rule, index, distill, or backfill");
      }
      return createOperationIssue(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        operationType,
        title: stringField(params.title),
        prompt: stringField(params.prompt),
        useCheapModelProfile: params.useCheapModelProfile === true,
      });
    });

    ctx.actions.register("capture-source", async (params) => {
      return captureBRMSSource(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        sourceType: stringField(params.sourceType),
        title: stringField(params.title),
        url: stringField(params.url),
        contents: typeof params.contents === "string" ? params.contents : "",
        rawPath: stringField(params.rawPath),
        metadata: typeof params.metadata === "object" && params.metadata != null ? params.metadata as Record<string, unknown> : null,
      });
    });

    ctx.actions.register("write-rule", async (params) => {
      return writeBRMSRule(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        path: stringField(params.path) ?? "",
        contents: typeof params.contents === "string" ? params.contents : "",
        expectedHash: stringField(params.expectedHash),
        summary: stringField(params.summary),
        sourceRefs: params.sourceRefs,
        writer: "board_ui",
      });
    });

    ctx.actions.register("write-template", async (params) => {
      return writeTemplate(ctx, {
        companyId: readCompanyIdFromParams(params),
        path: stringField(params.path) ?? "",
        contents: typeof params.contents === "string" ? params.contents : "",
      });
    });

    ctx.actions.register("update-event-ingestion-settings", async (params) => {
      const requestedSources = typeof params.sources === "object" && params.sources != null && !Array.isArray(params.sources)
        ? params.sources as Record<string, unknown>
        : null;
      const sources: { issues?: boolean; comments?: boolean; documents?: boolean } = {};
      if (requestedSources && Object.prototype.hasOwnProperty.call(requestedSources, "issues")) {
        sources.issues = requestedSources.issues === true;
      }
      if (requestedSources && Object.prototype.hasOwnProperty.call(requestedSources, "comments")) {
        sources.comments = requestedSources.comments === true;
      }
      if (requestedSources && Object.prototype.hasOwnProperty.call(requestedSources, "documents")) {
        sources.documents = requestedSources.documents === true;
      }
      const settings: {
        enabled?: boolean;
        brmsId?: string;
        maxCharacters?: number;
        sources?: typeof sources;
      } = {
        brmsId: stringField(params.brmsId) ?? undefined,
        maxCharacters: typeof params.maxCharacters === "number" ? params.maxCharacters : undefined,
      };
      if (typeof params.enabled === "boolean") {
        settings.enabled = params.enabled;
      }
      if (Object.keys(sources).length > 0) {
        settings.sources = sources;
      }
      return updateEventIngestionSettings(ctx, {
        companyId: readCompanyIdFromParams(params),
        settings,
      });
    });

    ctx.data.register("paperclip-ingestion-profile", async (params) => {
      return getPaperclipIngestionProfile(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
      });
    });

    ctx.data.register("paperclip-ingestion-candidates", async (params) => {
      return listPaperclipIngestionCandidates(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        query: stringField(params.query),
      });
    });

    ctx.actions.register("update-paperclip-ingestion-profile", async (params) => {
      return updatePaperclipIngestionProfile(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        profile: params.profile,
      });
    });

    ctx.actions.register("queue-paperclip-ingestion-backfill", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const sourceScope = typeof params.sourceScope === "object" && params.sourceScope != null && !Array.isArray(params.sourceScope)
        ? params.sourceScope as Record<string, unknown>
        : {};
      const sourceScopeKind = stringField(sourceScope.kind);
      const projectIds = Array.isArray(sourceScope.projectIds) ? sourceScope.projectIds.map(stringField).filter((id): id is string => Boolean(id)) : [];
      const issueIds = Array.isArray(sourceScope.issueIds) ? sourceScope.issueIds.map(stringField).filter((id): id is string => Boolean(id)) : [];
      const scopes = sourceScopeKind === "selected_projects"
        ? projectIds.map((projectId) => ({ projectId, rootIssueId: null as string | null }))
        : sourceScopeKind === "root_issues"
          ? issueIds.map((rootIssueId) => ({ projectId: null as string | null, rootIssueId }))
          : [];
      if (scopes.length === 0) {
        return {
          status: "refused_policy",
          brmsId: stringField(params.brmsId) ?? "default",
          spaceSlug: stringField(params.spaceSlug) ?? "default",
          warnings: ["Backfill requires a selected project or root issue scope in Phase 4."],
        };
      }
      const backfillStartAt = stringField(params.backfillStartAt);
      const backfillEndAt = stringField(params.backfillEndAt);
      const brmsId = stringField(params.brmsId);
      const spaceSlug = stringField(params.spaceSlug);
      const requestedByIssueId = stringField(params.requestedByIssueId);
      const idempotencyKey = stringField(params.idempotencyKey);
      const queued: Array<{ workItemId: string; issueId: string; projectId: string | null; rootIssueId: string | null }> = [];
      for (const scope of scopes) {
        const idempotencyScope = scope.rootIssueId ? `root:${scope.rootIssueId}` : `project:${scope.projectId}`;
        const workItem = await createPaperclipDistillationWorkItem(ctx, {
          companyId,
          brmsId,
          spaceSlug,
          kind: "backfill",
          projectId: scope.projectId,
          rootIssueId: scope.rootIssueId,
          requestedByIssueId,
          priority: "low",
          idempotencyKey: idempotencyKey && scopes.length === 1
            ? idempotencyKey
            : `${idempotencyKey ?? "profile-backfill"}:${idempotencyScope}:${backfillStartAt ?? "begin"}:${backfillEndAt ?? "now"}`,
          metadata: { backfillStartAt, backfillEndAt, requestedFrom: "queue-paperclip-ingestion-backfill" },
        });
        const operation = await createOperationIssue(ctx, {
          companyId,
          brmsId,
          spaceSlug,
          operationType: "backfill",
          title: scope.rootIssueId ? "Backfill Paperclip root issue brms history" : "Backfill Paperclip project brms history",
          useCheapModelProfile: params.useCheapModelProfile === true,
          prompt: [
            "Backfill Business Rules distillation was queued from a per-space Paperclip ingestion profile.",
            scope.projectId ? `Project ID: ${scope.projectId}` : null,
            scope.rootIssueId ? `Root issue ID: ${scope.rootIssueId}` : null,
            backfillStartAt ? `Start: ${backfillStartAt}` : null,
            backfillEndAt ? `End: ${backfillEndAt}` : null,
            "Process this bounded window through the profile destination space only.",
          ].filter(Boolean).join("\n"),
        });
        queued.push({
          workItemId: workItem.workItemId,
          issueId: operation.issue.id,
          projectId: scope.projectId,
          rootIssueId: scope.rootIssueId,
        });
      }
      const primary = queued[0];
      return {
        status: "queued",
        brmsId: stringField(params.brmsId) ?? "default",
        spaceSlug: stringField(params.spaceSlug) ?? "default",
        workItemId: primary?.workItemId ?? null,
        issueId: primary?.issueId ?? null,
        workItems: queued,
        warnings: [],
      };
    });

    ctx.actions.register("ingest-source", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const brmsId = stringField(params.brmsId);
      const spaceSlug = stringField(params.spaceSlug);
      const sourceType = stringField(params.sourceType) ?? "text";
      const title = stringField(params.title) ?? sourceType.toUpperCase();
      const contents = typeof params.contents === "string" ? params.contents : "";
      const url = stringField(params.url);
      const captured = await captureBRMSSource(ctx, {
        companyId,
        brmsId,
        spaceSlug,
        sourceType,
        title,
        url,
        contents,
        rawPath: stringField(params.rawPath),
        metadata: typeof params.metadata === "object" && params.metadata != null ? params.metadata as Record<string, unknown> : null,
      });
      const op = await createOperationIssue(ctx, {
        companyId,
        brmsId,
        spaceSlug,
        operationType: "ingest",
        title: `Ingest ${sourceType}: ${title}`,
        prompt: [
          `Ingest a captured source from raw/${captured.rawPath.replace(/^raw\//, "")}.`,
          url ? `Source URL: ${url}` : null,
          "Follow the installed brms-ingest skill: read the raw file end to end, summarise into brms/sources/<slug>.md, update related entity/concept/synthesis rules, refresh brms/index.md, and append brms/log.md.",
        ].filter(Boolean).join("\n"),
      });
      return { status: "ok", source: captured, operation: op };
    });

    ctx.actions.register("assemble-paperclip-source-bundle", async (params) => {
      return assemblePaperclipSourceBundle(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        projectId: stringField(params.projectId),
        rootIssueId: stringField(params.rootIssueId),
        maxCharacters: typeof params.maxCharacters === "number" ? params.maxCharacters : null,
        maxCharactersPerSource: typeof params.maxCharactersPerSource === "number" ? params.maxCharactersPerSource : null,
        backfillStartAt: stringField(params.backfillStartAt),
        backfillEndAt: stringField(params.backfillEndAt),
        routineRun: params.routineRun === true,
        includeComments: params.includeComments !== false,
        includeDocuments: params.includeDocuments !== false,
      });
    });

    ctx.actions.register("create-paperclip-distillation-run", async (params) => {
      return createPaperclipDistillationRun(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        projectId: stringField(params.projectId),
        rootIssueId: stringField(params.rootIssueId),
        maxCharacters: typeof params.maxCharacters === "number" ? params.maxCharacters : null,
        maxCharactersPerSource: typeof params.maxCharactersPerSource === "number" ? params.maxCharactersPerSource : null,
        backfillStartAt: stringField(params.backfillStartAt),
        backfillEndAt: stringField(params.backfillEndAt),
        routineRun: params.routineRun === true,
        includeComments: params.includeComments !== false,
        includeDocuments: params.includeDocuments !== false,
        workItemId: stringField(params.workItemId),
        operationIssueId: stringField(params.operationIssueId),
      });
    });

    ctx.actions.register("record-paperclip-distillation-outcome", async (params) => {
      const status = stringField(params.status);
      if (status !== "succeeded" && status !== "failed" && status !== "review_required") {
        throw new Error("status must be succeeded, failed, or review_required");
      }
      const runId = stringField(params.runId);
      if (!runId) throw new Error("runId is required");
      return recordPaperclipDistillationOutcome(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        runId,
        cursorId: stringField(params.cursorId),
        status,
        sourceHash: stringField(params.sourceHash),
        sourceWindowEnd: stringField(params.sourceWindowEnd),
        warning: stringField(params.warning),
        costCents: typeof params.costCents === "number" ? params.costCents : null,
        retryCount: typeof params.retryCount === "number" ? params.retryCount : null,
      });
    });

    ctx.actions.register("distill-paperclip-project-rule", async (params) => {
      return distillPaperclipProjectRule(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        projectId: stringField(params.projectId),
        rootIssueId: stringField(params.rootIssueId),
        maxCharacters: typeof params.maxCharacters === "number" ? params.maxCharacters : null,
        maxCharactersPerSource: typeof params.maxCharactersPerSource === "number" ? params.maxCharactersPerSource : null,
        backfillStartAt: stringField(params.backfillStartAt),
        backfillEndAt: stringField(params.backfillEndAt),
        routineRun: params.routineRun === true,
        includeComments: params.includeComments !== false,
        includeDocuments: params.includeDocuments !== false,
        workItemId: stringField(params.workItemId),
        operationIssueId: stringField(params.operationIssueId),
        autoApply: params.autoApply === true ? true : params.autoApply === false ? false : undefined,
        expectedProjectRuleHash: stringField(params.expectedProjectRuleHash),
        includeSupportingRules: params.includeSupportingRules !== false,
      });
    });

    ctx.actions.register("distill-paperclip-now", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const spaceSlug = stringField(params.spaceSlug);
      const projectId = stringField(params.projectId);
      const rootIssueId = stringField(params.rootIssueId);
      const idempotencyScope = rootIssueId ? `root:${rootIssueId}` : projectId ? `project:${projectId}` : "company";
      const workItem = await createPaperclipDistillationWorkItem(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug,
        kind: "manual",
        projectId,
        rootIssueId,
        requestedByIssueId: stringField(params.requestedByIssueId),
        priority: "medium",
        idempotencyKey: stringField(params.idempotencyKey) ?? `manual:${idempotencyScope}`,
        metadata: { requestedFrom: "distill-paperclip-now" },
      });
      const operation = await createOperationIssue(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug,
        operationType: "distill",
        title: rootIssueId
          ? "Distill Paperclip root issue into brms"
          : projectId
            ? "Distill Paperclip project into brms"
            : "Distill Paperclip changes into brms",
        useCheapModelProfile: params.useCheapModelProfile === true,
        prompt: buildManualDistillPrompt({ companyId, projectId, rootIssueId }),
      });
      return { status: "queued", workItem, operation };
    });

    ctx.actions.register("enable-paperclip-distillation-active-projects", async (params) => {
      return enableActiveProjectDistillation(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        limit: typeof params.limit === "number" ? params.limit : null,
      });
    });

    ctx.actions.register("backfill-paperclip-distillation", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const spaceSlug = stringField(params.spaceSlug);
      const projectId = stringField(params.projectId);
      const rootIssueId = stringField(params.rootIssueId);
      if (!projectId && !rootIssueId) throw new Error("projectId or rootIssueId is required");
      const backfillStartAt = stringField(params.backfillStartAt);
      const backfillEndAt = stringField(params.backfillEndAt);
      const idempotencyScope = rootIssueId ? `root:${rootIssueId}` : `project:${projectId}`;
      const workItem = await createPaperclipDistillationWorkItem(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug,
        kind: "backfill",
        projectId,
        rootIssueId,
        requestedByIssueId: stringField(params.requestedByIssueId),
        priority: "low",
        idempotencyKey: stringField(params.idempotencyKey) ?? `backfill:${idempotencyScope}:${backfillStartAt ?? "begin"}:${backfillEndAt ?? "now"}`,
        metadata: { backfillStartAt, backfillEndAt, requestedFrom: "backfill-paperclip-distillation" },
      });
      const operation = await createOperationIssue(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug,
        operationType: "backfill",
        title: rootIssueId ? "Backfill Paperclip root issue brms history" : "Backfill Paperclip project brms history",
        useCheapModelProfile: params.useCheapModelProfile === true,
        prompt: [
          "Backfill Business Rules distillation requested for a bounded Paperclip source window.",
          projectId ? `Project ID: ${projectId}` : null,
          rootIssueId ? `Root issue ID: ${rootIssueId}` : null,
          backfillStartAt ? `Start: ${backfillStartAt}` : null,
          backfillEndAt ? `End: ${backfillEndAt}` : null,
          "Do not process whole-company history; stay within the selected project/root issue and date window.",
        ].filter(Boolean).join("\n"),
      });
      const result = await distillPaperclipProjectRule(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug,
        projectId,
        rootIssueId,
        maxCharacters: typeof params.maxCharacters === "number" ? params.maxCharacters : null,
        maxCharactersPerSource: typeof params.maxCharactersPerSource === "number" ? params.maxCharactersPerSource : null,
        backfillStartAt,
        backfillEndAt,
        routineRun: params.routineRun === true,
        includeComments: params.includeComments !== false,
        includeDocuments: params.includeDocuments !== false,
        autoApply: params.autoApply === true ? true : params.autoApply === false ? false : undefined,
        expectedProjectRuleHash: stringField(params.expectedProjectRuleHash),
        includeSupportingRules: params.includeSupportingRules !== false,
        workItemId: workItem.workItemId,
        operationIssueId: operation.issue.id,
      });
      return { ...result, workItem, operation };
    });

    ctx.actions.register("create-paperclip-distillation-work-item", async (params) => {
      const kind = stringField(params.kind);
      if (
        kind !== "manual" &&
        kind !== "retry" &&
        kind !== "backfill" &&
        kind !== "priority_override" &&
        kind !== "review_patch"
      ) {
        throw new Error("kind must be manual, retry, backfill, priority_override, or review_patch");
      }
      const priority = stringField(params.priority);
      if (priority && priority !== "critical" && priority !== "high" && priority !== "medium" && priority !== "low") {
        throw new Error("priority must be critical, high, medium, or low");
      }
      return createPaperclipDistillationWorkItem(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        kind,
        projectId: stringField(params.projectId),
        rootIssueId: stringField(params.rootIssueId),
        requestedByIssueId: stringField(params.requestedByIssueId),
        priority: priority as "critical" | "high" | "medium" | "low" | null,
        idempotencyKey: stringField(params.idempotencyKey),
        metadata: typeof params.metadata === "object" && params.metadata != null ? params.metadata as Record<string, unknown> : null,
      });
    });

    ctx.actions.register("file-as-rule", async (params) => {
      return fileQueryAnswerAsRule(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        querySessionId: stringField(params.querySessionId),
        question: stringField(params.question),
        answer: stringField(params.answer),
        path: stringField(params.path) ?? "",
        title: stringField(params.title),
        contents: stringField(params.contents),
        expectedHash: stringField(params.expectedHash),
      });
    });

    ctx.actions.register("start-query", async (params) => {
      return startBRMSQuerySession(ctx, {
        companyId: readCompanyIdFromParams(params),
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        question: stringField(params.question) ?? "",
        title: stringField(params.title),
      });
    });

    ctx.actions.register("reset-managed-agent", async (params) => {
      return resetBRMSAgentResource(ctx, readCompanyIdFromParams(params));
    });

    ctx.actions.register("reset-managed-project", async (params) => {
      return resetBRMSProjectResource(ctx, readCompanyIdFromParams(params));
    });

    ctx.actions.register("reconcile-managed-agent", async (params) => {
      return reconcileBRMSAgentResource(ctx, readCompanyIdFromParams(params));
    });

    ctx.actions.register("reconcile-managed-project", async (params) => {
      return reconcileBRMSProjectResource(ctx, readCompanyIdFromParams(params));
    });

    ctx.actions.register("reconcile-managed-skills", async (params) => {
      return { managedSkills: await reconcileBRMSSkillResources(ctx, readCompanyIdFromParams(params)) };
    });

    ctx.actions.register("reset-managed-skills", async (params) => {
      return { managedSkills: await resetBRMSSkillResources(ctx, readCompanyIdFromParams(params)) };
    });

    ctx.actions.register("select-managed-agent", async (params) => {
      const agentId = stringField(params.agentId);
      if (!agentId) throw new Error("agentId is required");
      return selectBRMSAgentResource(ctx, {
        companyId: readCompanyIdFromParams(params),
        agentId,
      });
    });

    ctx.actions.register("select-managed-project", async (params) => {
      const projectId = stringField(params.projectId);
      if (!projectId) throw new Error("projectId is required");
      return selectBRMSProjectResource(ctx, {
        companyId: readCompanyIdFromParams(params),
        projectId,
      });
    });

    ctx.actions.register("reset-managed-routine", async (params) => {
      return ctx.routines.managed.reset(
        routineKeyField(params.routineKey),
        readCompanyIdFromParams(params),
        routineOverridesFromParams(params),
      );
    });

    ctx.actions.register("reconcile-managed-routine", async (params) => {
      return ctx.routines.managed.reconcile(
        routineKeyField(params.routineKey),
        readCompanyIdFromParams(params),
        routineOverridesFromParams(params),
      );
    });

    ctx.actions.register("reconcile-managed-routines", async (params) => {
      return reconcileBRMSRoutineResources(ctx, readCompanyIdFromParams(params));
    });

    ctx.actions.register("update-managed-routine-status", async (params) => {
      const status = stringField(params.status);
      if (!status) throw new Error("status is required");
      return ctx.routines.managed.update(routineKeyField(params.routineKey), readCompanyIdFromParams(params), {
        status,
      });
    });

    ctx.actions.register("run-managed-routine", async (params) => {
      return ctx.routines.managed.run(
        routineKeyField(params.routineKey),
        readCompanyIdFromParams(params),
        routineOverridesFromParams(params),
      );
    });

    ctx.data.register("rules", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      return listRules(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        ruleType: stringField(params.ruleType),
        includeRaw: params.includeRaw === true || params.includeRaw === "true",
        limit: typeof params.limit === "number" ? params.limit : null,
      });
    });

    ctx.data.register("sources", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      return listSources(ctx, { companyId, brmsId: stringField(params.brmsId), spaceSlug: stringField(params.spaceSlug), limit: typeof params.limit === "number" ? params.limit : null });
    });

    ctx.data.register("rule-content", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const path = stringField(params.path);
      if (!path) throw new Error("path is required");
      return readBRMSRule(ctx, { companyId, brmsId: stringField(params.brmsId), spaceSlug: stringField(params.spaceSlug), path });
    });

    ctx.data.register("template", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const path = stringField(params.path) ?? "AGENTS.md";
      return readTemplate(ctx, { companyId, path });
    });

    ctx.data.register("operations", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      return listOperations(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        operationType: stringField(params.operationType),
        status: stringField(params.status),
        limit: typeof params.limit === "number" ? params.limit : null,
      });
    });

    ctx.data.register("distillation-overview", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      return getDistillationOverview(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        limit: typeof params.limit === "number" ? params.limit : null,
      });
    });

    ctx.data.register("distillation-rule-provenance", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const rulePath = stringField(params.rulePath);
      if (!rulePath) {
        return { binding: null, runs: [], snapshot: null, cursor: null };
      }
      return getDistillationRuleProvenance(ctx, {
        companyId,
        brmsId: stringField(params.brmsId),
        spaceSlug: stringField(params.spaceSlug),
        rulePath,
      });
    });

    ctx.data.register("settings", async (params) => {
      const companyId = readCompanyIdFromParams(params);
      const folder = await ctx.localFolders.status(companyId, BRMS_ROOT_FOLDER_KEY);
      const overview = await getOverview(ctx, companyId);
      const managedRoutines = await Promise.all(
        BRMS_MAINTENANCE_ROUTINE_KEYS.map((routineKey) => ctx.routines.managed.get(routineKey, companyId)),
      );
      const managedRoutinesWithDefaultDrift = managedRoutines.map((routine) =>
        withManagedRoutineDefaultDrift(
          routine,
          ctx.manifest.routines?.find((declaration) => declaration.routineKey === routine.resourceKey),
        ),
      );
      return {
        folder,
        spaces: await listSpaces(ctx, { companyId }),
        managedAgent: overview.managedAgent,
        managedProject: overview.managedProject,
        managedSkills: overview.managedSkills,
        managedRoutine: managedRoutinesWithDefaultDrift[0],
        managedRoutines: managedRoutinesWithDefaultDrift,
        distillationPolicy: getDistillationAutoApplyRestriction(),
        eventIngestion: await getEventIngestionSettings(ctx, companyId),
        agentOptions: await listBRMSAgentOptions(ctx, companyId),
        projectOptions: await listBRMSProjectOptions(ctx, companyId),
        capabilities: ctx.manifest.capabilities,
      };
    });
  },

  async onApiRequest(input: PluginApiRequestInput) {
    const ctx = requireContext();
    if (input.routeKey === "overview") {
      return { body: await getOverview(ctx, input.companyId) };
    }

    if (input.routeKey === "bootstrap") {
      const body = input.body as Record<string, unknown> | null;
      return {
        status: 201,
        body: await bootstrapBRMSRoot(ctx, {
          companyId: input.companyId,
          path: stringField(body?.path),
        }),
      };
    }

    if (input.routeKey === "spaces") {
      return {
        body: await listSpaces(ctx, {
          companyId: input.companyId,
          brmsId: stringField(input.query.brmsId),
        }),
      };
    }

    if (input.routeKey === "create-space") {
      const body = input.body as Record<string, unknown> | null;
      return {
        status: 201,
        body: await createSpace(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          slug: stringField(body?.slug),
          displayName: stringField(body?.displayName),
          folderMode: stringField(body?.folderMode) as "managed_subfolder" | "existing_local_folder" | null,
          accessScope: stringField(body?.accessScope) as "shared" | "personal" | "team" | null,
          settings: typeof body?.settings === "object" && body.settings != null ? body.settings as Record<string, unknown> : null,
        }),
      };
    }

    if (input.routeKey === "update-space") {
      const body = input.body as Record<string, unknown> | null;
      return {
        body: await updateSpace(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          spaceSlug: input.params.spaceSlug,
          displayName: stringField(body?.displayName),
          status: stringField(body?.status) as "active" | "archived" | null,
          settings: typeof body?.settings === "object" && body.settings != null ? body.settings as Record<string, unknown> : null,
        }),
      };
    }

    if (input.routeKey === "bootstrap-space") {
      const body = input.body as Record<string, unknown> | null;
      return {
        status: 201,
        body: await bootstrapSpace(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          spaceSlug: input.params.spaceSlug,
        }),
      };
    }

    if (input.routeKey === "archive-space") {
      const body = input.body as Record<string, unknown> | null;
      return {
        body: await archiveSpace(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          spaceSlug: input.params.spaceSlug,
        }),
      };
    }

    if (input.routeKey === "capture-source") {
      const body = input.body as Record<string, unknown> | null;
      return {
        status: 201,
        body: await captureBRMSSource(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          spaceSlug: stringField(body?.spaceSlug),
          sourceType: stringField(body?.sourceType),
          title: stringField(body?.title),
          url: stringField(body?.url),
          contents: typeof body?.contents === "string" ? body.contents : "",
          rawPath: stringField(body?.rawPath),
          metadata: typeof body?.metadata === "object" && body.metadata != null ? body.metadata as Record<string, unknown> : null,
        }),
      };
    }

    if (input.routeKey === "operations") {
      return {
        body: await listOperations(ctx, {
          companyId: input.companyId,
          brmsId: stringField(input.query.brmsId),
          spaceSlug: stringField(input.query.spaceSlug),
          operationType: stringField(input.query.operationType),
          status: stringField(input.query.status),
          limit: typeof input.query.limit === "string" ? Number(input.query.limit) : null,
        }),
      };
    }

    if (input.routeKey === "start-query") {
      const body = input.body as Record<string, unknown> | null;
      return {
        status: 201,
        body: await startBRMSQuerySession(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          spaceSlug: stringField(body?.spaceSlug),
          question: stringField(body?.question) ?? "",
          title: stringField(body?.title),
        }),
      };
    }

    if (input.routeKey === "file-as-rule") {
      const body = input.body as Record<string, unknown> | null;
      return {
        status: 201,
        body: await fileQueryAnswerAsRule(ctx, {
          companyId: input.companyId,
          brmsId: stringField(body?.brmsId),
          spaceSlug: stringField(body?.spaceSlug),
          querySessionId: stringField(body?.querySessionId),
          question: stringField(body?.question),
          answer: stringField(body?.answer),
          path: stringField(body?.path) ?? "",
          title: stringField(body?.title),
          contents: stringField(body?.contents),
          expectedHash: stringField(body?.expectedHash),
        }),
      };
    }

    return { status: 404, body: { error: `Unknown Business Rules route: ${input.routeKey}` } };
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Business Rules plugin worker is running",
      details: {
        surfaces: ["rule", "sidebar", "settings", "tools", "database", "local-folder"],
      },
    };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
