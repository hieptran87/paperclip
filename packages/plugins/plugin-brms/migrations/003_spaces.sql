CREATE TABLE IF NOT EXISTS plugin_brms_0d219e8eaa.brms_spaces (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brms_id text NOT NULL DEFAULT 'default',
  slug text NOT NULL,
  display_name text NOT NULL,
  space_type text NOT NULL DEFAULT 'local_folder',
  folder_mode text NOT NULL DEFAULT 'managed_subfolder',
  root_folder_key text NOT NULL DEFAULT 'brms-root',
  path_prefix text,
  configured_root_path text,
  access_scope text NOT NULL DEFAULT 'shared',
  owner_user_id text,
  owner_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  team_key text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, brms_id, slug)
);

CREATE INDEX IF NOT EXISTS brms_spaces_company_status_idx
  ON plugin_brms_0d219e8eaa.brms_spaces (company_id, brms_id, status);

WITH brms_pairs AS (
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.brms_instances
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.brms_sources
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.brms_rules
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.brms_rule_revisions
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.brms_operations
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.brms_query_sessions
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.paperclip_distillation_cursors
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.paperclip_distillation_work_items
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.paperclip_distillation_runs
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.paperclip_source_snapshots
  UNION
  SELECT company_id, brms_id FROM plugin_brms_0d219e8eaa.paperclip_rule_bindings
)
INSERT INTO plugin_brms_0d219e8eaa.brms_spaces
  (id, company_id, brms_id, slug, display_name, space_type, folder_mode, root_folder_key, path_prefix, access_scope, status)
SELECT (
    substr(md5(company_id::text || ':' || brms_id || ':default'), 1, 8) || '-' ||
    substr(md5(company_id::text || ':' || brms_id || ':default'), 9, 4) || '-' ||
    '4' || substr(md5(company_id::text || ':' || brms_id || ':default'), 14, 3) || '-' ||
    '8' || substr(md5(company_id::text || ':' || brms_id || ':default'), 18, 3) || '-' ||
    substr(md5(company_id::text || ':' || brms_id || ':default'), 21, 12)
  )::uuid,
  company_id,
  brms_id,
  'default',
  'default',
  'local_folder',
  'managed_subfolder',
  'brms-root',
  NULL,
  'shared',
  'active'
FROM brms_pairs
ON CONFLICT (company_id, brms_id, slug) DO NOTHING;

ALTER TABLE plugin_brms_0d219e8eaa.brms_sources ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rules ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rule_revisions ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.brms_operations ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.brms_query_sessions ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_runs ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_source_snapshots ADD COLUMN IF NOT EXISTS space_id uuid;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings ADD COLUMN IF NOT EXISTS space_id uuid;

UPDATE plugin_brms_0d219e8eaa.brms_sources t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.brms_rules t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.brms_rule_revisions t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.brms_operations t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.brms_query_sessions t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.paperclip_distillation_cursors t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.paperclip_distillation_work_items t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.paperclip_distillation_runs t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.paperclip_source_snapshots t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

UPDATE plugin_brms_0d219e8eaa.paperclip_rule_bindings t
SET space_id = s.id
FROM plugin_brms_0d219e8eaa.brms_spaces s
WHERE t.company_id = s.company_id AND t.brms_id = s.brms_id AND s.slug = 'default' AND t.space_id IS NULL;

ALTER TABLE plugin_brms_0d219e8eaa.brms_sources ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rules ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rule_revisions ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.brms_operations ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.brms_query_sessions ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_runs ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_source_snapshots ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings ALTER COLUMN space_id SET NOT NULL;

ALTER TABLE plugin_brms_0d219e8eaa.brms_rules
  DROP CONSTRAINT IF EXISTS brms_rules_company_id_brms_id_path_key;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors
  DROP CONSTRAINT IF EXISTS paperclip_distillation_cursor_company_id_brms_id_source_sco_key;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items
  DROP CONSTRAINT IF EXISTS paperclip_distillation_work_i_company_id_brms_id_idempotenc_key;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings
  DROP CONSTRAINT IF EXISTS paperclip_rule_bindings_company_id_brms_id_rule_path_key;

ALTER TABLE plugin_brms_0d219e8eaa.brms_rules
  DROP CONSTRAINT IF EXISTS brms_rules_company_brms_space_path_key;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rules
  ADD CONSTRAINT brms_rules_company_brms_space_path_key UNIQUE (company_id, brms_id, space_id, path);
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors
  DROP CONSTRAINT IF EXISTS distillation_cursors_company_brms_space_scope_key;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors
  ADD CONSTRAINT distillation_cursors_company_brms_space_scope_key UNIQUE (company_id, brms_id, space_id, source_scope, scope_key, source_kind);
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items
  DROP CONSTRAINT IF EXISTS distillation_work_items_company_brms_space_idempotency_key;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items
  ADD CONSTRAINT distillation_work_items_company_brms_space_idempotency_key UNIQUE (company_id, brms_id, space_id, idempotency_key);
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings
  DROP CONSTRAINT IF EXISTS rule_bindings_company_brms_space_rule_path_key;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings
  ADD CONSTRAINT rule_bindings_company_brms_space_rule_path_key UNIQUE (company_id, brms_id, space_id, rule_path);

ALTER TABLE plugin_brms_0d219e8eaa.brms_sources
  DROP CONSTRAINT IF EXISTS brms_sources_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.brms_sources
  ADD CONSTRAINT brms_sources_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rules
  DROP CONSTRAINT IF EXISTS brms_rules_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rules
  ADD CONSTRAINT brms_rules_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rule_revisions
  DROP CONSTRAINT IF EXISTS brms_rule_revisions_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.brms_rule_revisions
  ADD CONSTRAINT brms_rule_revisions_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.brms_operations
  DROP CONSTRAINT IF EXISTS brms_operations_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.brms_operations
  ADD CONSTRAINT brms_operations_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.brms_query_sessions
  DROP CONSTRAINT IF EXISTS brms_query_sessions_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.brms_query_sessions
  ADD CONSTRAINT brms_query_sessions_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors
  DROP CONSTRAINT IF EXISTS paperclip_distillation_cursors_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_cursors
  ADD CONSTRAINT paperclip_distillation_cursors_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items
  DROP CONSTRAINT IF EXISTS paperclip_distillation_work_items_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_work_items
  ADD CONSTRAINT paperclip_distillation_work_items_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_runs
  DROP CONSTRAINT IF EXISTS paperclip_distillation_runs_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_distillation_runs
  ADD CONSTRAINT paperclip_distillation_runs_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_source_snapshots
  DROP CONSTRAINT IF EXISTS paperclip_source_snapshots_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_source_snapshots
  ADD CONSTRAINT paperclip_source_snapshots_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings
  DROP CONSTRAINT IF EXISTS paperclip_rule_bindings_space_id_fk;
ALTER TABLE plugin_brms_0d219e8eaa.paperclip_rule_bindings
  ADD CONSTRAINT paperclip_rule_bindings_space_id_fk FOREIGN KEY (space_id) REFERENCES plugin_brms_0d219e8eaa.brms_spaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS brms_sources_space_idx ON plugin_brms_0d219e8eaa.brms_sources (company_id, brms_id, space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brms_operations_space_idx ON plugin_brms_0d219e8eaa.brms_operations (company_id, brms_id, space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brms_query_sessions_space_idx ON plugin_brms_0d219e8eaa.brms_query_sessions (company_id, brms_id, space_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS distillation_runs_space_idx ON plugin_brms_0d219e8eaa.paperclip_distillation_runs (company_id, brms_id, space_id, created_at DESC);
