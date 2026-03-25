-- ============================================================================
-- Migration 015: Quote Relance Emails for Follow-up on Unsigned Quotes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quote_relances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
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
  relance_number    INTEGER NOT NULL DEFAULT 1,

  -- Audit
  generated_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quote_relances
  IS 'Follow-up emails for unsigned quotes. Status: generated|edited|sending|sent|failed|cancelled.';

CREATE TRIGGER trg_quote_relances_updated_at
  BEFORE UPDATE ON public.quote_relances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_quote_relances_quote
  ON public.quote_relances (quote_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_relances_status
  ON public.quote_relances (status)
  WHERE status IN ('generated', 'edited', 'sending');

-- RLS
ALTER TABLE public.quote_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY quote_relances_select ON public.quote_relances
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY quote_relances_insert ON public.quote_relances
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY quote_relances_update ON public.quote_relances
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

CREATE POLICY quote_relances_delete ON public.quote_relances
  FOR DELETE TO authenticated USING (public.is_admin());
