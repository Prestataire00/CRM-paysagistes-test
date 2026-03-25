-- ============================================================================
-- 027 — Règles d'automatisation workflow
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table : workflow_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_table   TEXT NOT NULL,  -- 'quotes', 'invoices', 'clients', etc.
  trigger_event   TEXT NOT NULL CHECK (trigger_event IN ('INSERT', 'UPDATE', 'DELETE', 'SCHEDULE')),
  conditions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  active          BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  run_count       INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table : workflow_rule_executions (historique d'exécution)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_rule_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID NOT NULL REFERENCES public.workflow_rules(id) ON DELETE CASCADE,
  status            TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  trigger_data      JSONB,
  actions_executed  JSONB DEFAULT '[]'::jsonb,
  error_message     TEXT,
  execution_time_ms INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workflow_rules_active
  ON public.workflow_rules (active, trigger_table, trigger_event);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_rule
  ON public.workflow_rule_executions (rule_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — admin uniquement
-- ---------------------------------------------------------------------------
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_rule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_rules_admin" ON public.workflow_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "workflow_executions_admin" ON public.workflow_rule_executions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );
