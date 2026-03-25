-- ============================================================================
-- Migration Part 2B: Billing + Support Tables
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sequences for auto-references
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.quote_ref_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE public.invoice_ref_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- generate_quote_reference() - DEV-2026-00001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_quote_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('public.quote_ref_seq');
  NEW.reference := 'DEV-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- generate_invoice_reference() - FAC-2026-00001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invoice_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('public.invoice_ref_seq');
  NEW.reference := 'FAC-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- quotes (devis)
-- ---------------------------------------------------------------------------
CREATE TABLE public.quotes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               TEXT NOT NULL UNIQUE,
  client_id               UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  prospect_id             UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  status                  public.quote_status NOT NULL DEFAULT 'brouillon',
  issue_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date           DATE,
  accepted_date           DATE,
  subtotal_ht             NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate                NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tva_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percentage     NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  eligible_tax_credit     BOOLEAN NOT NULL DEFAULT FALSE,
  tax_credit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_after_credit        NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_terms           TEXT,
  special_conditions      TEXT,
  pdf_url                 TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_commercial_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_to_invoice_id UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_quotes_amounts CHECK (subtotal_ht >= 0 AND total_ttc >= 0),
  CONSTRAINT chk_quotes_tva CHECK (tva_rate >= 0 AND tva_rate <= 100),
  CONSTRAINT chk_quotes_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT chk_quotes_validity CHECK (validity_date IS NULL OR validity_date >= issue_date),
  CONSTRAINT chk_quotes_client_or_prospect CHECK (
    client_id IS NOT NULL OR prospect_id IS NOT NULL
  )
);

CREATE TRIGGER trg_quotes_auto_reference
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_quote_reference();

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- quote_lines
-- ---------------------------------------------------------------------------
CREATE TABLE public.quote_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'u',
  unit_price_ht   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate        NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  total_ht        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_labor        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_quote_lines_qty CHECK (quantity > 0),
  CONSTRAINT chk_quote_lines_price CHECK (unit_price_ht >= 0),
  CONSTRAINT chk_quote_lines_tva CHECK (tva_rate >= 0 AND tva_rate <= 100)
);

-- ---------------------------------------------------------------------------
-- invoices (factures)
-- ---------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               TEXT NOT NULL UNIQUE,
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  quote_id                UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  chantier_id             UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  status                  public.invoice_status NOT NULL DEFAULT 'brouillon',
  issue_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                DATE NOT NULL,
  paid_date               DATE,
  subtotal_ht             NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate                NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tva_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percentage     NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid             NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method          public.payment_method,
  payment_reference       TEXT,
  eligible_tax_credit     BOOLEAN NOT NULL DEFAULT FALSE,
  labor_amount_ht         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_credit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_after_credit        NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_archived             BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_url                 TEXT,
  exported_at             TIMESTAMPTZ,
  accounting_reference    TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_invoices_amounts CHECK (subtotal_ht >= 0 AND total_ttc >= 0),
  CONSTRAINT chk_invoices_tva CHECK (tva_rate >= 0 AND tva_rate <= 100),
  CONSTRAINT chk_invoices_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT chk_invoices_paid CHECK (amount_paid >= 0),
  CONSTRAINT chk_invoices_due_date CHECK (due_date >= issue_date)
);

CREATE TRIGGER trg_invoices_auto_reference
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_invoice_reference();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_lines
-- ---------------------------------------------------------------------------
CREATE TABLE public.invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'u',
  unit_price_ht   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate        NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  total_ht        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_labor        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_invoice_lines_qty CHECK (quantity > 0),
  CONSTRAINT chk_invoice_lines_price CHECK (unit_price_ht >= 0),
  CONSTRAINT chk_invoice_lines_tva CHECK (tva_rate >= 0 AND tva_rate <= 100)
);

-- ---------------------------------------------------------------------------
-- fiscal_attestations
-- ---------------------------------------------------------------------------
CREATE TABLE public.fiscal_attestations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT NOT NULL UNIQUE,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fiscal_year         INTEGER NOT NULL,
  total_amount_ttc    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_labor_ht      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_credit_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_ids         UUID[] NOT NULL DEFAULT '{}',
  company_name        TEXT NOT NULL,
  company_siret       TEXT NOT NULL,
  company_address     TEXT NOT NULL,
  company_agrement    TEXT,
  is_sent             BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at             TIMESTAMPTZ,
  sent_method         TEXT,
  pdf_url             TEXT,
  generated_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_fiscal_attestation_client_year UNIQUE (client_id, fiscal_year),
  CONSTRAINT chk_fiscal_attestation_year CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
  CONSTRAINT chk_fiscal_attestation_amounts CHECK (
    total_amount_ttc >= 0 AND total_labor_ht >= 0 AND tax_credit_amount >= 0
  )
);

CREATE TRIGGER trg_fiscal_attestations_updated_at
  BEFORE UPDATE ON public.fiscal_attestations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Deferred Foreign Keys (billing cross-references)
-- ---------------------------------------------------------------------------

ALTER TABLE public.chantiers
  ADD CONSTRAINT fk_chantiers_quote
  FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;

ALTER TABLE public.chantiers
  ADD CONSTRAINT fk_chantiers_invoice
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.quotes
  ADD CONSTRAINT fk_quotes_converted_invoice
  FOREIGN KEY (converted_to_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- pipeline_stages (with seed data)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  stage_type  public.pipeline_stage_type NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#9E9E9E',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.pipeline_stages (name, stage_type, color, sort_order) VALUES
  ('Nouveau',        'nouveau',        '#2196F3', 1),
  ('Qualification',  'qualification',  '#FF9800', 2),
  ('Proposition',    'proposition',    '#9C27B0', 3),
  ('Negociation',    'negociation',    '#F44336', 4),
  ('Gagne',          'gagne',          '#4CAF50', 5),
  ('Perdu',          'perdu',          '#607D8B', 6);

-- ---------------------------------------------------------------------------
-- commercial_activities
-- ---------------------------------------------------------------------------
CREATE TABLE public.commercial_activities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  prospect_id       UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  activity_type     public.communication_type NOT NULL,
  subject           TEXT NOT NULL,
  description       TEXT,
  scheduled_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  is_completed      BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_date    DATE,
  follow_up_notes   TEXT,
  assigned_to       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_commercial_activities_target CHECK (
    client_id IS NOT NULL OR prospect_id IS NOT NULL
  )
);

CREATE TRIGGER trg_commercial_activities_updated_at
  BEFORE UPDATE ON public.commercial_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- communications
-- ---------------------------------------------------------------------------
CREATE TABLE public.communications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  prospect_id         UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  supplier_id         UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  communication_type  public.communication_type NOT NULL,
  direction           public.communication_direction NOT NULL DEFAULT 'sortant',
  subject             TEXT,
  body                TEXT,
  recipient_email     TEXT,
  recipient_phone     TEXT,
  is_sent             BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at             TIMESTAMPTZ,
  delivery_status     TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
CREATE TABLE public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  chantier_id     UUID REFERENCES public.chantiers(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  quote_id        UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  document_type   public.document_type NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_size       BIGINT,
  mime_type       TEXT,
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  retention_until DATE,
  uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type   public.notification_type NOT NULL DEFAULT 'info',
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  action_url          TEXT,
  action_entity_type  TEXT,
  action_entity_id    TEXT,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- generic_audit_trigger()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generic_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_action TEXT;
  v_record_id TEXT;
BEGIN
  v_action := TG_OP;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := OLD.id::TEXT;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;
  END IF;

  INSERT INTO public.audit_logs (
    profile_id, action, table_name, record_id, old_values, new_values
  ) VALUES (
    auth.uid(), v_action, TG_TABLE_NAME, v_record_id, v_old, v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach audit triggers
CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.generic_audit_trigger();

CREATE TRIGGER trg_audit_prospects
  AFTER INSERT OR UPDATE OR DELETE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.generic_audit_trigger();

CREATE TRIGGER trg_audit_chantiers
  AFTER INSERT OR UPDATE OR DELETE ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.generic_audit_trigger();

CREATE TRIGGER trg_audit_quotes
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.generic_audit_trigger();

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generic_audit_trigger();

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generic_audit_trigger();

-- ---------------------------------------------------------------------------
-- settings (with seed data)
-- ---------------------------------------------------------------------------
CREATE TABLE public.settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL DEFAULT '""'::JSONB,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.settings (key, value, description, category) VALUES
  ('company_name',      '"Demonfaucon Paysage"',    'Nom de la societe',                       'company'),
  ('company_siret',     '""',                        'Numero SIRET',                            'company'),
  ('company_address',   '""',                        'Adresse du siege social',                 'company'),
  ('company_phone',     '""',                        'Telephone principal',                     'company'),
  ('company_email',     '""',                        'Email de contact principal',               'company'),
  ('company_tva_number','""',                        'Numero de TVA intracommunautaire',        'company'),
  ('company_agrement',  '""',                        'Numero d''agrement services a la personne','company'),
  ('default_tva_rate',  '20.00',                     'Taux de TVA par defaut (%)',              'billing'),
  ('quote_validity_days','30',                       'Duree de validite des devis (jours)',     'billing'),
  ('payment_terms_days','30',                        'Delai de paiement par defaut (jours)',    'billing'),
  ('tax_credit_rate',   '50.00',                     'Taux du credit d''impot (%)',             'billing'),
  ('working_hours_start','"08:00"',                  'Heure de debut de journee',               'planning'),
  ('working_hours_end',  '"17:00"',                  'Heure de fin de journee',                 'planning'),
  ('break_duration_minutes','60',                    'Duree de pause dejeuner (minutes)',       'planning'),
  ('fiscal_year_start_month','1',                    'Mois de debut de l''exercice fiscal',     'billing');
