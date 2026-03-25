-- ============================================================================
-- 024 — Table des modèles de devis
-- ============================================================================

CREATE TABLE public.quote_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  description          TEXT,
  lines                JSONB NOT NULL DEFAULT '[]'::JSONB,
  conditions           TEXT,
  payment_terms        TEXT,
  validity_days        INTEGER NOT NULL DEFAULT 30,
  tva_rate             NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  eligible_tax_credit  BOOLEAN NOT NULL DEFAULT TRUE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_quote_templates_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les rôles sauf jardinier
CREATE POLICY quote_templates_select ON public.quote_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin','admin','responsable_commercial',
      'commercial','comptabilite','facturation'
    ]::public.user_role[])
  );

-- Écriture pour admin + commerciaux
CREATE POLICY quote_templates_insert ON public.quote_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(ARRAY['super_admin','admin','responsable_commercial','commercial']::public.user_role[]));

CREATE POLICY quote_templates_update ON public.quote_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['super_admin','admin','responsable_commercial','commercial']::public.user_role[]));

CREATE POLICY quote_templates_delete ON public.quote_templates
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_quote_templates_active ON public.quote_templates (is_active, name);
