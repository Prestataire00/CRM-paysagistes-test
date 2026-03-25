-- ============================================================================
-- Migration 014: Relance Emails for Prospect Follow-up
-- ============================================================================
-- Adds relance_emails table for AI-generated follow-up emails,
-- with lifecycle tracking (generated → edited → sent/failed/cancelled).
-- Sent emails are logged as communications + commercial_activities.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: relance_emails
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relance_emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id       UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  communication_id  UUID REFERENCES public.communications(id) ON DELETE SET NULL,

  -- Email content
  recipient_email   TEXT NOT NULL,
  subject           TEXT NOT NULL,
  body_html         TEXT NOT NULL,
  body_text         TEXT,

  -- AI generation metadata
  ai_prompt_context JSONB,
  ai_model          TEXT,
  tone              TEXT NOT NULL DEFAULT 'professionnel',

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'generated',
  sent_at           TIMESTAMPTZ,
  brevo_message_id  TEXT,
  error_message     TEXT,

  -- Audit
  generated_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.relance_emails
  IS 'AI-generated relance emails for inactive prospects. Status: generated|edited|sending|sent|failed|cancelled. Tone: professionnel|amical|urgent|relance_douce.';

-- ---------------------------------------------------------------------------
-- 2. Trigger: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_relance_emails_updated_at
  BEFORE UPDATE ON public.relance_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_relance_emails_prospect
  ON public.relance_emails (prospect_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relance_emails_status
  ON public.relance_emails (status)
  WHERE status IN ('generated', 'edited', 'sending');

-- ---------------------------------------------------------------------------
-- 4. RLS (same pattern as communications)
-- ---------------------------------------------------------------------------
ALTER TABLE public.relance_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY relance_emails_select ON public.relance_emails
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY relance_emails_insert ON public.relance_emails
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY relance_emails_update ON public.relance_emails
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY relance_emails_delete ON public.relance_emails
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Relance config in settings
-- ---------------------------------------------------------------------------
INSERT INTO public.settings (key, value, description, category)
VALUES (
  'relance_config',
  '{
    "default_tone": "professionnel",
    "sender_name": "Demonfaucon Paysage",
    "sender_email": "commercial@demonfaucon.fr",
    "auto_log_activity": true,
    "company_description": "Demonfaucon Paysage - Entreprise de paysagisme et entretien de jardins"
  }'::jsonb,
  'Configuration des relances automatiques par email (ton, expediteur, etc.)',
  'crm'
)
ON CONFLICT (key) DO NOTHING;
