-- ============================================================================
-- Migration 004: Create Planning Tables
-- CRM Demonfaucon - Supabase PostgreSQL
-- Tables: chantiers, chantier_tasks, task_templates, planning_slots, time_entries
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sequence for chantier auto-reference CHT-YYYY-XXXXX
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.chantier_ref_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- generate_chantier_reference()
-- Produces references like CHT-2026-00001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_chantier_reference()
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
  v_seq  := nextval('public.chantier_ref_seq');
  NEW.reference := 'CHT-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- chantiers
-- Note: quote_id and invoice_id FKs are added in 006 after billing tables exist.
-- ---------------------------------------------------------------------------
CREATE TABLE public.chantiers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference                   TEXT NOT NULL UNIQUE,
  title                       TEXT NOT NULL,
  description                 TEXT,
  client_id                   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  address_line1               TEXT NOT NULL,
  address_line2               TEXT,
  postal_code                 TEXT NOT NULL,
  city                        TEXT NOT NULL,
  latitude                    DOUBLE PRECISION,
  longitude                   DOUBLE PRECISION,
  geographic_zone             public.geographic_zone,
  intervention_type           public.intervention_type NOT NULL DEFAULT 'entretien',
  status                      public.intervention_status NOT NULL DEFAULT 'planifiee',
  priority                    INTEGER NOT NULL DEFAULT 3,
  estimated_duration_minutes  INTEGER,
  actual_duration_minutes     INTEGER,
  scheduled_date              DATE,
  scheduled_start_time        TIME,
  scheduled_end_time          TIME,
  completed_at                TIMESTAMPTZ,
  is_recurring                BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_frequency        public.recurrence_frequency,
  recurrence_end_date         DATE,
  parent_template_id          UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
  assigned_team_id            UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  completion_notes            TEXT,
  client_signature_url        TEXT,
  completion_photos           TEXT[],
  quote_id                    UUID,          -- FK added in 006
  invoice_id                  UUID,          -- FK added in 006
  created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_chantiers_priority CHECK (priority >= 1 AND priority <= 5),
  CONSTRAINT chk_chantiers_duration CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0),
  CONSTRAINT chk_chantiers_schedule CHECK (
    scheduled_end_time IS NULL OR scheduled_start_time IS NULL OR scheduled_end_time > scheduled_start_time
  )
);

COMMENT ON TABLE public.chantiers IS 'Work sites / interventions for clients';

-- Auto-generate reference on insert
CREATE TRIGGER trg_chantiers_auto_reference
  BEFORE INSERT ON public.chantiers
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_chantier_reference();

CREATE TRIGGER trg_chantiers_updated_at
  BEFORE UPDATE ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- chantier_tasks
-- Checklist items for a specific chantier.
-- ---------------------------------------------------------------------------
CREATE TABLE public.chantier_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id   UUID NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at  TIMESTAMPTZ,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chantier_tasks IS 'Task checklist items within a chantier';

-- ---------------------------------------------------------------------------
-- task_templates
-- Reusable task sets per intervention type.
-- ---------------------------------------------------------------------------
CREATE TABLE public.task_templates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  description                 TEXT,
  intervention_type           public.intervention_type NOT NULL,
  default_tasks               JSONB NOT NULL DEFAULT '[]'::JSONB,
  estimated_duration_minutes  INTEGER,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_task_templates_duration CHECK (
    estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
  )
);

COMMENT ON TABLE public.task_templates IS 'Reusable chantier task templates by intervention type';

CREATE TRIGGER trg_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- planning_slots
-- Scheduled time blocks assigning a team to a chantier on a given day.
-- Includes an exclusion constraint preventing overlapping slots per team/day.
-- ---------------------------------------------------------------------------

-- Required for exclusion constraints with ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.planning_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id   UUID NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  slot_date     DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  color         TEXT,
  is_locked     BOOLEAN NOT NULL DEFAULT FALSE,
  planned_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_planning_slots_times CHECK (end_time > start_time),

  -- Prevent overlapping slots for the same team on the same day
  CONSTRAINT excl_planning_slots_no_overlap
    EXCLUDE USING gist (
      team_id WITH =,
      slot_date WITH =,
      tsrange(
        (slot_date || ' ' || start_time)::TIMESTAMP,
        (slot_date || ' ' || end_time)::TIMESTAMP
      ) WITH &&
    )
);

COMMENT ON TABLE public.planning_slots IS 'Scheduled planning slots linking teams to chantiers';

CREATE TRIGGER trg_planning_slots_updated_at
  BEFORE UPDATE ON public.planning_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- time_entries
-- Clock-in / clock-out records per employee per day.
-- ---------------------------------------------------------------------------
CREATE TABLE public.time_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chantier_id           UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
  planning_slot_id      UUID REFERENCES public.planning_slots(id) ON DELETE SET NULL,
  entry_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in              TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out             TIMESTAMPTZ,
  break_duration_minutes INTEGER NOT NULL DEFAULT 0,
  total_minutes         INTEGER,
  clock_in_latitude     DOUBLE PRECISION,
  clock_in_longitude    DOUBLE PRECISION,
  clock_out_latitude    DOUBLE PRECISION,
  clock_out_longitude   DOUBLE PRECISION,
  notes                 TEXT,
  validated_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_time_entries_clock CHECK (clock_out IS NULL OR clock_out > clock_in),
  CONSTRAINT chk_time_entries_break CHECK (break_duration_minutes >= 0)
);

COMMENT ON TABLE public.time_entries IS 'Employee time tracking with GPS coordinates';

-- ---------------------------------------------------------------------------
-- calculate_total_minutes()
-- Auto-calculate total_minutes when clock_out is set.
-- total_minutes = (clock_out - clock_in) in minutes - break_duration_minutes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_total_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_minutes := GREATEST(
      0,
      EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in))::INTEGER / 60
      - COALESCE(NEW.break_duration_minutes, 0)
    );
  ELSE
    NEW.total_minutes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_time_entries_calc_total
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.calculate_total_minutes();

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- ============================================================================
-- Migration 005: Create Resource Tables & Deferred FKs
-- CRM Demonfaucon - Supabase PostgreSQL
-- Tables: absences, vehicles, equipment
-- Also adds deferred FKs: profiles.default_team_id -> teams, teams.default_vehicle_id -> vehicles
-- ============================================================================

-- ---------------------------------------------------------------------------
-- absences
-- Employee leave / absence requests.
-- ---------------------------------------------------------------------------
CREATE TABLE public.absences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  absence_type      public.absence_type NOT NULL,
  status            public.absence_status NOT NULL DEFAULT 'en_attente',
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  is_half_day_start BOOLEAN NOT NULL DEFAULT FALSE,
  is_half_day_end   BOOLEAN NOT NULL DEFAULT FALSE,
  reason            TEXT,
  approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  document_url      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_absences_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.absences IS 'Employee absence and leave requests';

CREATE TRIGGER trg_absences_updated_at
  BEFORE UPDATE ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- vehicles
-- Fleet management.
-- ---------------------------------------------------------------------------
CREATE TABLE public.vehicles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_plate      TEXT NOT NULL UNIQUE,
  brand                   TEXT NOT NULL,
  model                   TEXT NOT NULL,
  vehicle_type            TEXT,
  status                  public.vehicle_status NOT NULL DEFAULT 'disponible',
  last_maintenance_date   DATE,
  next_maintenance_date   DATE,
  mileage                 INTEGER,
  insurance_expiry        DATE,
  insurance_provider      TEXT,
  assigned_team_id        UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  notes                   TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_vehicles_mileage CHECK (mileage IS NULL OR mileage >= 0),
  CONSTRAINT chk_vehicles_maintenance CHECK (
    next_maintenance_date IS NULL OR last_maintenance_date IS NULL
    OR next_maintenance_date >= last_maintenance_date
  )
);

COMMENT ON TABLE public.vehicles IS 'Company fleet vehicles';

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- equipment
-- Tools and machinery inventory.
-- ---------------------------------------------------------------------------
CREATE TABLE public.equipment (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  brand                   TEXT,
  model                   TEXT,
  serial_number           TEXT,
  category                TEXT,
  status                  public.equipment_status NOT NULL DEFAULT 'disponible',
  purchase_date           DATE,
  last_maintenance_date   DATE,
  next_maintenance_date   DATE,
  assigned_team_id        UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  notes                   TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.equipment IS 'Tools and machinery inventory';

CREATE TRIGGER trg_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Deferred Foreign Keys
-- Now that vehicles and teams both exist, add the cross-reference FKs.
-- ---------------------------------------------------------------------------

-- teams.default_vehicle_id -> vehicles
ALTER TABLE public.teams
  ADD CONSTRAINT fk_teams_default_vehicle
  FOREIGN KEY (default_vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- profiles.default_team_id -> teams
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_default_team
  FOREIGN KEY (default_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
-- ============================================================================
-- Migration 006: Create Billing Tables & Deferred FKs
-- CRM Demonfaucon - Supabase PostgreSQL
-- Tables: quotes, quote_lines, invoices, invoice_lines, fiscal_attestations
-- Also adds deferred FKs: chantiers.quote_id -> quotes, chantiers.invoice_id -> invoices
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sequences for auto-references
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.quote_ref_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE public.invoice_ref_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- generate_quote_reference()
-- Produces references like DEV-2026-00001
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
-- generate_invoice_reference()
-- Produces references like FAC-2026-00001
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
  converted_to_invoice_id UUID,              -- FK added below after invoices table
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

COMMENT ON TABLE public.quotes IS 'Commercial quotes (devis)';

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

COMMENT ON TABLE public.quote_lines IS 'Individual line items within a quote';

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

COMMENT ON TABLE public.invoices IS 'Client invoices (factures)';

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

COMMENT ON TABLE public.invoice_lines IS 'Individual line items within an invoice';

-- ---------------------------------------------------------------------------
-- fiscal_attestations
-- Annual fiscal attestation for tax credit eligible clients (unique per client+year).
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

  -- One attestation per client per fiscal year
  CONSTRAINT uq_fiscal_attestation_client_year UNIQUE (client_id, fiscal_year),
  CONSTRAINT chk_fiscal_attestation_year CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
  CONSTRAINT chk_fiscal_attestation_amounts CHECK (
    total_amount_ttc >= 0 AND total_labor_ht >= 0 AND tax_credit_amount >= 0
  )
);

COMMENT ON TABLE public.fiscal_attestations IS 'Annual fiscal attestations for tax-credit-eligible clients';

CREATE TRIGGER trg_fiscal_attestations_updated_at
  BEFORE UPDATE ON public.fiscal_attestations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Deferred Foreign Keys
-- Now that quotes and invoices exist, link them back to chantiers and quotes.
-- ---------------------------------------------------------------------------

-- chantiers.quote_id -> quotes
ALTER TABLE public.chantiers
  ADD CONSTRAINT fk_chantiers_quote
  FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;

-- chantiers.invoice_id -> invoices
ALTER TABLE public.chantiers
  ADD CONSTRAINT fk_chantiers_invoice
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- quotes.converted_to_invoice_id -> invoices
ALTER TABLE public.quotes
  ADD CONSTRAINT fk_quotes_converted_invoice
  FOREIGN KEY (converted_to_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
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
