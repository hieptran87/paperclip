import { readdirSync, readFileSync, statSync } from "node:fs";

export const REQUIRED_BRMS_DIRECTORIES = [
  "raw",
  "brms",
  "brms/sources",
  "brms/projects",
  "brms/entities",
  "brms/concepts",
  "brms/synthesis",
] as const;

export const REQUIRED_BRMS_FILES = ["AGENTS.md", "IDEA.md", "brms/index.md", "brms/log.md"] as const;
export const KARPATHY_LLM_BRMS_GIST_URL = "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f";

function templateFile(path: string): string {
  return readFileSync(new URL(`../templates/${path}`, import.meta.url), "utf8");
}

function agentInstructionFiles(agentKey: string): Record<string, string> {
  const root = new URL(`../agents/${agentKey}/`, import.meta.url);
  const files: Record<string, string> = {};

  function walk(relativeDir: string) {
    const dirUrl = new URL(relativeDir ? `${relativeDir}/` : "./", root);
    for (const entry of readdirSync(dirUrl)) {
      if (entry === ".DS_Store") continue;
      const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
      const entryUrl = new URL(relativePath, root);
      const stat = statSync(entryUrl);
      if (stat.isDirectory()) {
        walk(relativePath);
      } else if (stat.isFile()) {
        files[relativePath] = readFileSync(entryUrl, "utf8");
      }
    }
  }

  walk("");
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

export const DEFAULT_BRMS_SCHEMA = templateFile("AGENTS.md");
export const DEFAULT_AGENT_INSTRUCTION_FILES = agentInstructionFiles("brms-maintainer");
export const DEFAULT_AGENT_INSTRUCTIONS = DEFAULT_AGENT_INSTRUCTION_FILES["AGENTS.md"] ?? "";
export const DEFAULT_IDEA = templateFile("IDEA.md");
export const DEFAULT_INDEX = templateFile("brms/index.md");
export const DEFAULT_LOG = templateFile("brms/log.md");
export const DEFAULT_GITIGNORE = templateFile("gitignore.template");

export const QUERY_PROMPT = `Answer from the Business Rules using the installed brms-query skill.

Read the target space's brms/index.md first, inspect relevant rules and raw/source references in that same space, cite the brms rule paths and raw source paths used, and say when the brms does not contain enough evidence. Useful durable synthesis should be filed back into brms/synthesis/ inside that same space. Always pass the operation issue's brmsId and spaceSlug to Business Rules tools.
`;

export const LINT_PROMPT = `Lint the Business Rules using the installed brms-lint skill.

Audit the target space only for contradictions, stale claims, orphan rules, missing backlinks, weak provenance, and brms/index.md / brms/log.md drift. Also look for important concepts mentioned without rules and answers that should have been filed back into brms/. Return findings grouped by severity with concrete file paths, evidence, and suggested fixes — do not auto-apply edits. Always pass the operation issue's brmsId and spaceSlug to Business Rules tools.
`;

export const BOOTSTRAP_FILES: ReadonlyArray<{ path: string; contents: string }> = [
  { path: ".gitignore", contents: DEFAULT_GITIGNORE },
  { path: "AGENTS.md", contents: DEFAULT_BRMS_SCHEMA },
  { path: "IDEA.md", contents: DEFAULT_IDEA },
  { path: "brms/index.md", contents: DEFAULT_INDEX },
  { path: "brms/log.md", contents: DEFAULT_LOG },
  { path: "raw/.gitkeep", contents: "" },
  { path: "brms/sources/.gitkeep", contents: "" },
  { path: "brms/projects/.gitkeep", contents: "" },
  { path: "brms/entities/.gitkeep", contents: "" },
  { path: "brms/concepts/.gitkeep", contents: "" },
  { path: "brms/synthesis/.gitkeep", contents: "" },
];
