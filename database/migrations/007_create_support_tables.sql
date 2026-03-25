-- ============================================================================
-- Migration 007: Create Support Tables
-- CRM Demonfaucon - Supabase PostgreSQL
-- Tables: pipeline_stages, commercial_activities, communications, documents,
--         notifications, audit_logs, settings
-- ============================================================================

-- ---------------------------------------------------------------------------
-- pipeline_stages
-- Configurable sales pipeline stages. Seeded with 6 default stages.
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

COMMENT ON TABLE public.pipeline_stages IS 'Configurable sales pipeline stage definitions';

-- Seed the 6 default pipeline stages
INSERT INTO public.pipeline_stages (name, stage_type, color, sort_order) VALUES
  ('Nouveau',        'nouveau',        '#2196F3', 1),
  ('Qualification',  'qualification',  '#FF9800', 2),
  ('Proposition',    'proposition',    '#9C27B0', 3),
  ('Negociation',    'negociation',    '#F44336', 4),
  ('Gagne',          'gagne',          '#4CAF50', 5),
  ('Perdu',          'perdu',          '#607D8B', 6);

-- ---------------------------------------------------------------------------
-- commercial_activities
-- Tracks commercial follow-ups, calls, meetings, etc.
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

COMMENT ON TABLE public.commercial_activities IS 'Commercial follow-up activities and tasks';

CREATE TRIGGER trg_commercial_activities_updated_at
  BEFORE UPDATE ON public.commercial_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- communications
-- Inbound and outbound communications log.
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

COMMENT ON TABLE public.communications IS 'Communication log (emails, SMS, calls, etc.)';

-- ---------------------------------------------------------------------------
-- documents
-- File attachments linked to clients, chantiers, invoices, or quotes.
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

COMMENT ON TABLE public.documents IS 'Document and file attachments';

-- ---------------------------------------------------------------------------
-- notifications
-- In-app notifications per user.
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

COMMENT ON TABLE public.notifications IS 'In-app user notifications';

-- ---------------------------------------------------------------------------
-- audit_logs
-- Generic audit trail for data changes across all tables.
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

COMMENT ON TABLE public.audit_logs IS 'Audit trail for data modifications';

-- ---------------------------------------------------------------------------
-- generic_audit_trigger()
-- Captures INSERT / UPDATE / DELETE on any table into audit_logs.
-- Attach via:
--   CREATE TRIGGER trg_audit_<table>
--     AFTER INSERT OR UPDATE OR DELETE ON <table>
--     FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();
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
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;
  END IF;

  INSERT INTO public.audit_logs (
    profile_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach audit triggers to key tables
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
-- settings
-- Key-value application settings, categorized.
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

COMMENT ON TABLE public.settings IS 'Application configuration key-value store';

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default company settings
INSERT INTO public.settings (key, value, description, category) VALUES
  ('company_name',      '"Demonfaucon Paysage"',                          'Nom de la societe',                       'company'),
  ('company_siret',     '""',                                              'Numero SIRET',                            'company'),
  ('company_address',   '""',                                              'Adresse du siege social',                 'company'),
  ('company_phone',     '""',                                              'Telephone principal',                     'company'),
  ('company_email',     '""',                                              'Email de contact principal',               'company'),
  ('company_tva_number','""',                                              'Numero de TVA intracommunautaire',        'company'),
  ('company_agrement',  '""',                                              'Numero d''agrement services a la personne','company'),
  ('default_tva_rate',  '20.00',                                           'Taux de TVA par defaut (%)',              'billing'),
  ('quote_validity_days','30',                                             'Duree de validite des devis (jours)',     'billing'),
  ('payment_terms_days','30',                                              'Delai de paiement par defaut (jours)',    'billing'),
  ('tax_credit_rate',   '50.00',                                           'Taux du credit d''impot (%)',             'billing'),
  ('working_hours_start','"08:00"',                                        'Heure de debut de journee',               'planning'),
  ('working_hours_end',  '"17:00"',                                        'Heure de fin de journee',                 'planning'),
  ('break_duration_minutes','60',                                          'Duree de pause dejeuner (minutes)',       'planning'),
  ('fiscal_year_start_month','1',                                          'Mois de debut de l''exercice fiscal',     'billing');
