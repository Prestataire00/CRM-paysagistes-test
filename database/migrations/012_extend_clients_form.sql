-- ============================================================================
-- Migration 012: Extend Clients Table for Full Form
-- CRM Demonfaucon - Supabase PostgreSQL
-- Adds: civility, code_bip, code_interne, consent flags, JSONB columns,
--        client_tags + client_tag_assignments tables
-- ============================================================================

-- ---------------------------------------------------------------------------
-- New simple columns on clients
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS civility TEXT
  CHECK (civility IN ('M', 'Mme', 'Société'));

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS code_bip TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS code_interne TEXT;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS newsletter_consent BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- JSONB columns for flexible nested data
-- ---------------------------------------------------------------------------

-- Extra phone numbers: [{"label": "Bureau", "number": "0612345678"}]
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS extra_phones JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Extra email addresses: [{"label": "Pro", "email": "pro@example.com"}]
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS extra_emails JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Birthdays with labels: [{"label": "Anniversaire client", "date": "1985-03-15"}]
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birthdays JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Contract hours per year: {"2024": 120, "2025": 150, "2026": 0, "2027": 0}
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- client_tags — reusable tag definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_tags IS 'Reusable tags that can be assigned to clients';

-- ---------------------------------------------------------------------------
-- client_tag_assignments — many-to-many link
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_tag_assignments (
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES public.client_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, tag_id)
);

COMMENT ON TABLE public.client_tag_assignments IS 'Associates tags with clients (many-to-many)';

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tags"
  ON public.client_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tags"
  ON public.client_tags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tags"
  ON public.client_tags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tags"
  ON public.client_tags FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read tag assignments"
  ON public.client_tag_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tag assignments"
  ON public.client_tag_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tag assignments"
  ON public.client_tag_assignments FOR DELETE TO authenticated USING (true);
