CREATE TABLE plugin_brms_0d219e8eaa.brms_instances (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  root_folder_key text NOT NULL DEFAULT 'brms-root',
  configured_root_path text,
  schema_version integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  managed_agent_key text,
  managed_project_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, brms_id)
);

CREATE TABLE plugin_brms_0d219e8eaa.brms_sources (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  source_type text NOT NULL,
  title text,
  url text,
  raw_path text NOT NULL,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'captured',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plugin_brms_0d219e8eaa.brms_rules (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  path text NOT NULL,
  title text,
  rule_type text,
  frontmatter jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  backlinks jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  current_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, brms_id, path)
);

CREATE TABLE plugin_brms_0d219e8eaa.brms_rule_revisions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  rule_id uuid REFERENCES plugin_brms_0d219e8eaa.brms_rules(id) ON DELETE CASCADE,
  operation_id uuid,
  path text NOT NULL,
  content_hash text NOT NULL,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plugin_brms_0d219e8eaa.brms_operations (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  operation_type text NOT NULL,
  status text NOT NULL,
  hidden_issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_cents integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plugin_brms_0d219e8eaa.brms_query_sessions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  hidden_issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  agent_session_id text,
  status text NOT NULL DEFAULT 'active',
  filed_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plugin_brms_0d219e8eaa.brms_resource_bindings (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL,
  resource_kind text NOT NULL,
  resource_key text NOT NULL,
  resolved_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, brms_id, resource_kind, resource_key)
);
