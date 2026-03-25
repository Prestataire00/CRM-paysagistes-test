-- ============================================================================
-- Migration 001: Create Enum Types
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- User roles within the organization
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'admin',
  'responsable_commercial',
  'commercial',
  'conducteur_travaux',
  'comptabilite',
  'jardinier'
);

-- Client classification
CREATE TYPE public.client_type AS ENUM (
  'particulier',
  'professionnel',
  'copropriete',
  'collectivite'
);

-- Contract duration types
CREATE TYPE public.contract_type AS ENUM (
  'ponctuel',
  'annuel',
  'trimestriel',
  'mensuel'
);

-- Intervention lifecycle status
CREATE TYPE public.intervention_status AS ENUM (
  'planifiee',
  'en_cours',
  'terminee',
  'annulee',
  'reportee'
);

-- Types of garden/landscaping interventions
CREATE TYPE public.intervention_type AS ENUM (
  'entretien',
  'tonte',
  'taille',
  'desherbage',
  'plantation',
  'amenagement',
  'arrosage',
  'debroussaillage',
  'evacuation',
  'autre'
);

-- Quote lifecycle status
CREATE TYPE public.quote_status AS ENUM (
  'brouillon',
  'envoye',
  'accepte',
  'refuse',
  'expire'
);

-- Invoice lifecycle status
CREATE TYPE public.invoice_status AS ENUM (
  'brouillon',
  'emise',
  'envoyee',
  'payee',
  'partiellement_payee',
  'en_retard',
  'annulee'
);

-- Payment methods
CREATE TYPE public.payment_method AS ENUM (
  'virement',
  'cheque',
  'carte_bancaire',
  'prelevement',
  'especes'
);

-- Absence / leave types
CREATE TYPE public.absence_type AS ENUM (
  'conge_paye',
  'maladie',
  'rtt',
  'formation',
  'sans_solde',
  'autre'
);

-- Absence request status
CREATE TYPE public.absence_status AS ENUM (
  'en_attente',
  'approuvee',
  'refusee'
);

-- Fleet vehicle status
CREATE TYPE public.vehicle_status AS ENUM (
  'disponible',
  'en_mission',
  'en_maintenance',
  'hors_service'
);

-- Equipment status
CREATE TYPE public.equipment_status AS ENUM (
  'disponible',
  'en_utilisation',
  'en_reparation',
  'hors_service'
);

-- Commercial pipeline stage types
CREATE TYPE public.pipeline_stage_type AS ENUM (
  'nouveau',
  'qualification',
  'proposition',
  'negociation',
  'gagne',
  'perdu'
);

-- Communication channel types
CREATE TYPE public.communication_type AS ENUM (
  'email',
  'sms',
  'appel',
  'courrier',
  'visite'
);

-- Communication direction
CREATE TYPE public.communication_direction AS ENUM (
  'entrant',
  'sortant'
);

-- Document categories
CREATE TYPE public.document_type AS ENUM (
  'devis',
  'facture',
  'attestation_fiscale',
  'contrat',
  'photo',
  'signature',
  'rapport',
  'autre'
);

-- Notification severity levels
CREATE TYPE public.notification_type AS ENUM (
  'info',
  'warning',
  'error',
  'success',
  'reminder'
);

-- Geographic service zones
CREATE TYPE public.geographic_zone AS ENUM (
  'zone_1',
  'zone_2',
  'zone_3',
  'zone_4',
  'zone_5'
);

-- Recurrence frequency for recurring chantiers
CREATE TYPE public.recurrence_frequency AS ENUM (
  'quotidien',
  'hebdomadaire',
  'bi_hebdomadaire',
  'mensuel',
  'trimestriel',
  'annuel'
);
-- ============================================================================
-- Migration 002: Create Helper Functions & Triggers
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- ---------------------------------------------------------------------------
-- update_updated_at()
-- Generic trigger function to auto-set updated_at on any row modification.
-- Attach to tables via:
--   CREATE TRIGGER ... BEFORE UPDATE ON <table>
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_user_role()
-- Returns the role of the currently authenticated user by looking it up
-- in the profiles table. Returns NULL if no authenticated user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN v_role;
END;
$$;

-- ---------------------------------------------------------------------------
-- has_role(allowed_roles user_role[])
-- Returns TRUE if the current user's role is contained within the given array.
-- Usage in RLS policies:
--   has_role(ARRAY['admin', 'super_admin']::user_role[])
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(allowed_roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_user_role() = ANY(allowed_roles);
END;
$$;

-- ---------------------------------------------------------------------------
-- is_admin()
-- Shorthand: returns TRUE if the current user is super_admin or admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_role(ARRAY['super_admin', 'admin']::public.user_role[]);
END;
$$;

-- ---------------------------------------------------------------------------
-- is_management()
-- Returns TRUE if the current user holds a management-level role:
-- super_admin, admin, responsable_commercial, or conducteur_travaux.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_role(
    ARRAY[
      'super_admin',
      'admin',
      'responsable_commercial',
      'conducteur_travaux'
    ]::public.user_role[]
  );
END;
$$;
-- ============================================================================
-- Migration 003: Create Core Tables
-- CRM Demonfaucon - Supabase PostgreSQL
-- Tables: profiles, clients, prospects, suppliers, teams, team_members
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- Extends Supabase auth.users. One profile per authenticated user.
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT,
  role          public.user_role NOT NULL DEFAULT 'jardinier',
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  hire_date     DATE,
  default_team_id UUID,                      -- FK added in 005 after teams exists
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- handle_new_user()
-- Automatically creates a profile row when a new user signs up via Supabase Auth.
-- Reads optional metadata fields: first_name, last_name, phone, role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'jardinier'::public.user_role
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger on Supabase auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
CREATE TABLE public.clients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name            TEXT,
  client_type             public.client_type NOT NULL DEFAULT 'particulier',
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  mobile                  TEXT,
  address_line1           TEXT NOT NULL,
  address_line2           TEXT,
  postal_code             TEXT NOT NULL,
  city                    TEXT NOT NULL,
  country                 TEXT NOT NULL DEFAULT 'France',
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  geographic_zone         public.geographic_zone,
  contract_type           public.contract_type NOT NULL DEFAULT 'ponctuel',
  contract_start_date     DATE,
  contract_end_date       DATE,
  eligible_tax_credit     BOOLEAN NOT NULL DEFAULT FALSE,
  tax_credit_percentage   NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  siret                   TEXT,
  tva_number              TEXT,
  payment_terms_days      INTEGER NOT NULL DEFAULT 30,
  default_payment_method  public.payment_method,
  notes                   TEXT,
  assigned_commercial_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Business constraints
  CONSTRAINT chk_clients_tax_credit_pct CHECK (tax_credit_percentage >= 0 AND tax_credit_percentage <= 100),
  CONSTRAINT chk_clients_payment_terms CHECK (payment_terms_days >= 0),
  CONSTRAINT chk_clients_contract_dates CHECK (
    contract_end_date IS NULL OR contract_start_date IS NULL OR contract_end_date >= contract_start_date
  )
);

COMMENT ON TABLE public.clients IS 'Customer records for the landscaping CRM';

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- prospects
-- ---------------------------------------------------------------------------
CREATE TABLE public.prospects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name            TEXT,
  client_type             public.client_type NOT NULL DEFAULT 'particulier',
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  mobile                  TEXT,
  address_line1           TEXT,
  address_line2           TEXT,
  postal_code             TEXT,
  city                    TEXT,
  country                 TEXT DEFAULT 'France',
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  geographic_zone         public.geographic_zone,
  source                  TEXT,
  estimated_value         NUMERIC(12,2),
  probability             INTEGER,
  pipeline_stage          public.pipeline_stage_type NOT NULL DEFAULT 'nouveau',
  assigned_commercial_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_to_client_id  UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_at            TIMESTAMPTZ,
  notes                   TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_prospects_probability CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  CONSTRAINT chk_prospects_estimated_value CHECK (estimated_value IS NULL OR estimated_value >= 0)
);

COMMENT ON TABLE public.prospects IS 'Sales pipeline prospects before client conversion';

CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name          TEXT NOT NULL,
  contact_first_name    TEXT,
  contact_last_name     TEXT,
  email                 TEXT,
  phone                 TEXT,
  mobile                TEXT,
  address_line1         TEXT,
  postal_code           TEXT,
  city                  TEXT,
  category              TEXT,
  siret                 TEXT,
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.suppliers IS 'External suppliers and sub-contractors';

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- teams
-- Note: default_vehicle_id FK added in 005 after vehicles table exists.
-- ---------------------------------------------------------------------------
CREATE TABLE public.teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  color               TEXT NOT NULL DEFAULT '#4CAF50',
  leader_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  default_vehicle_id  UUID,                  -- FK added in 005
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.teams IS 'Field teams for chantier assignments';

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- team_members
-- Junction table: which profiles belong to which teams.
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_team_leader  BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A profile can only be an active member of a team once
  CONSTRAINT uq_team_members_active UNIQUE (team_id, profile_id)
);

COMMENT ON TABLE public.team_members IS 'Team membership junction table';
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

-- Immutable helper for exclusion constraint
CREATE OR REPLACE FUNCTION public.make_tsrange(d DATE, t1 TIME, t2 TIME)
RETURNS tsrange LANGUAGE sql IMMUTABLE AS $$
  SELECT tsrange((d + t1), (d + t2));
$$;

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
      public.make_tsrange(slot_date, start_time, end_time) WITH &&
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
-- ============================================================================
-- Migration 008: Row Level Security (RLS) Policies
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantiers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_slots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_attestations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings             ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES
-- - SELECT: all authenticated users can read all profiles
-- - UPDATE: own profile or admin
-- - INSERT: super_admin only (profiles are auto-created by handle_new_user)
-- - DELETE: super_admin only
-- ============================================================================
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY['super_admin']::public.user_role[])
  );

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.has_role(ARRAY['super_admin']::public.user_role[])
  );

-- ============================================================================
-- CLIENTS
-- - SELECT: all roles except jardiniers see all clients.
--   Jardiniers only see clients who have chantiers assigned to their team.
-- - INSERT/UPDATE: admin, responsable_commercial, commercial
-- - DELETE: admin only
-- ============================================================================
CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    -- Non-jardiniers see all clients
    public.get_user_role() != 'jardinier'::public.user_role
    OR
    -- Jardiniers only see clients whose chantiers are assigned to their team
    id IN (
      SELECT c.client_id
      FROM public.chantiers c
      JOIN public.team_members tm ON tm.team_id = c.assigned_team_id
      WHERE tm.profile_id = auth.uid()
        AND tm.left_at IS NULL
    )
  );

CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY clients_update ON public.clients
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

CREATE POLICY clients_delete ON public.clients
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
  );

-- ============================================================================
-- PROSPECTS
-- - Access restricted to commercial and admin roles only
-- ============================================================================
CREATE POLICY prospects_select ON public.prospects
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY prospects_insert ON public.prospects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY prospects_update ON public.prospects
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

CREATE POLICY prospects_delete ON public.prospects
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
  );

-- ============================================================================
-- SUPPLIERS
-- - SELECT: all authenticated
-- - MODIFY: admin only
-- ============================================================================
CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY suppliers_delete ON public.suppliers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- TEAMS
-- - SELECT: all authenticated
-- - MODIFY: admin, conducteur_travaux
-- ============================================================================
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- TEAM_MEMBERS
-- - SELECT: all authenticated
-- - MODIFY: admin, conducteur_travaux
-- ============================================================================
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY team_members_update ON public.team_members
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

-- ============================================================================
-- CHANTIERS
-- - SELECT: all authenticated (jardiniers only see their team's chantiers)
-- - MODIFY: admin, conducteur_travaux, responsable_commercial
-- ============================================================================
CREATE POLICY chantiers_select ON public.chantiers
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'jardinier'::public.user_role
    OR
    assigned_team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.profile_id = auth.uid()
        AND tm.left_at IS NULL
    )
  );

CREATE POLICY chantiers_insert ON public.chantiers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux', 'responsable_commercial'
    ]::public.user_role[])
  );

CREATE POLICY chantiers_update ON public.chantiers
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux', 'responsable_commercial'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux', 'responsable_commercial'
    ]::public.user_role[])
  );

CREATE POLICY chantiers_delete ON public.chantiers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- CHANTIER_TASKS
-- - SELECT: same as chantiers (via chantier visibility)
-- - MODIFY: admin, conducteur_travaux + jardiniers can complete their own tasks
-- ============================================================================
CREATE POLICY chantier_tasks_select ON public.chantier_tasks
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers  -- relies on chantiers RLS
    )
  );

CREATE POLICY chantier_tasks_insert ON public.chantier_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY chantier_tasks_update ON public.chantier_tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux', 'jardinier'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux', 'jardinier'
    ]::public.user_role[])
  );

CREATE POLICY chantier_tasks_delete ON public.chantier_tasks
  FOR DELETE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

-- ============================================================================
-- TASK_TEMPLATES
-- - SELECT: all authenticated
-- - MODIFY: admin, conducteur_travaux
-- ============================================================================
CREATE POLICY task_templates_select ON public.task_templates
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY task_templates_insert ON public.task_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY task_templates_update ON public.task_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY task_templates_delete ON public.task_templates
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- PLANNING_SLOTS
-- - SELECT: all authenticated
-- - MODIFY: admin, conducteur_travaux
-- ============================================================================
CREATE POLICY planning_slots_select ON public.planning_slots
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY planning_slots_insert ON public.planning_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY planning_slots_update ON public.planning_slots
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY planning_slots_delete ON public.planning_slots
  FOR DELETE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

-- ============================================================================
-- TIME_ENTRIES
-- - SELECT: jardiniers see only their own; admin/conducteur_travaux see all
-- - INSERT: all authenticated (employees clock in themselves)
-- - UPDATE: own entries or admin/conducteur_travaux
-- - DELETE: admin only
-- ============================================================================
CREATE POLICY time_entries_select ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux', 'responsable_commercial'
    ]::public.user_role[])
  );

CREATE POLICY time_entries_insert ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY time_entries_update ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY time_entries_delete ON public.time_entries
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ABSENCES
-- - SELECT: own entries or admin/management
-- - INSERT: all authenticated (request their own absence)
-- - UPDATE: own pending entries or admin (for approval)
-- - DELETE: admin only
-- ============================================================================
CREATE POLICY absences_select ON public.absences
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_management()
  );

CREATE POLICY absences_insert ON public.absences
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY absences_update ON public.absences
  FOR UPDATE TO authenticated
  USING (
    (profile_id = auth.uid() AND status = 'en_attente'::public.absence_status)
    OR public.is_management()
  )
  WITH CHECK (
    (profile_id = auth.uid() AND status = 'en_attente'::public.absence_status)
    OR public.is_management()
  );

CREATE POLICY absences_delete ON public.absences
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- VEHICLES
-- - SELECT: all authenticated
-- - MODIFY: admin, conducteur_travaux
-- ============================================================================
CREATE POLICY vehicles_select ON public.vehicles
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY vehicles_insert ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY vehicles_update ON public.vehicles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY vehicles_delete ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- EQUIPMENT
-- - SELECT: all authenticated
-- - MODIFY: admin, conducteur_travaux
-- ============================================================================
CREATE POLICY equipment_select ON public.equipment
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY equipment_insert ON public.equipment
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY equipment_update ON public.equipment
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'conducteur_travaux'
    ]::public.user_role[])
  );

CREATE POLICY equipment_delete ON public.equipment
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- QUOTES
-- - SELECT/MODIFY: admin, comptabilite, responsable_commercial, commercial
-- - DELETE: admin only
-- ============================================================================
CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- QUOTE_LINES
-- - Same access as quotes (via quote visibility)
-- ============================================================================
CREATE POLICY quote_lines_select ON public.quote_lines
  FOR SELECT TO authenticated
  USING (
    quote_id IN (SELECT id FROM public.quotes)  -- relies on quotes RLS
  );

CREATE POLICY quote_lines_insert ON public.quote_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY quote_lines_update ON public.quote_lines
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY quote_lines_delete ON public.quote_lines
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- INVOICES
-- - SELECT/MODIFY: admin, comptabilite
-- - DELETE: admin only
-- ============================================================================
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- INVOICE_LINES
-- - Same access as invoices (via invoice visibility)
-- ============================================================================
CREATE POLICY invoice_lines_select ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (SELECT id FROM public.invoices)  -- relies on invoices RLS
  );

CREATE POLICY invoice_lines_insert ON public.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY invoice_lines_update ON public.invoice_lines
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY invoice_lines_delete ON public.invoice_lines
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- FISCAL_ATTESTATIONS
-- - Same access as invoices: admin, comptabilite
-- ============================================================================
CREATE POLICY fiscal_attestations_select ON public.fiscal_attestations
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY fiscal_attestations_insert ON public.fiscal_attestations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY fiscal_attestations_update ON public.fiscal_attestations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  )
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'comptabilite'
    ]::public.user_role[])
  );

CREATE POLICY fiscal_attestations_delete ON public.fiscal_attestations
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- PIPELINE_STAGES
-- - SELECT: all authenticated
-- - MODIFY: admin only
-- ============================================================================
CREATE POLICY pipeline_stages_select ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY pipeline_stages_insert ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY pipeline_stages_update ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY pipeline_stages_delete ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- COMMERCIAL_ACTIVITIES
-- - SELECT/MODIFY: admin, commercial roles
-- ============================================================================
CREATE POLICY commercial_activities_select ON public.commercial_activities
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY commercial_activities_insert ON public.commercial_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY commercial_activities_update ON public.commercial_activities
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

CREATE POLICY commercial_activities_delete ON public.commercial_activities
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- COMMUNICATIONS
-- - SELECT: all authenticated
-- - MODIFY: admin, commercial roles
-- ============================================================================
CREATE POLICY communications_select ON public.communications
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY communications_insert ON public.communications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY[
      'super_admin', 'admin', 'responsable_commercial', 'commercial'
    ]::public.user_role[])
  );

CREATE POLICY communications_update ON public.communications
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

CREATE POLICY communications_delete ON public.communications
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- DOCUMENTS
-- - SELECT: all authenticated
-- - INSERT: all authenticated (employees upload photos, signatures, etc.)
-- - UPDATE/DELETE: admin only
-- ============================================================================
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY documents_delete ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- NOTIFICATIONS
-- - Users can only see and manage their own notifications
-- ============================================================================
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);  -- System/triggers can create notifications for any user

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- ============================================================================
-- AUDIT_LOGS
-- - SELECT: admin only (read-only audit trail)
-- - No INSERT/UPDATE/DELETE via API; only via SECURITY DEFINER triggers
-- ============================================================================
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Deny direct modifications via API (audit logs are trigger-only)
CREATE POLICY audit_logs_no_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY audit_logs_no_update ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY audit_logs_no_delete ON public.audit_logs
  FOR DELETE TO authenticated
  USING (FALSE);

-- ============================================================================
-- SETTINGS
-- - SELECT: all authenticated
-- - MODIFY: admin only
-- ============================================================================
CREATE POLICY settings_select ON public.settings
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY settings_insert ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY settings_update ON public.settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY settings_delete ON public.settings
  FOR DELETE TO authenticated
  USING (
    public.has_role(ARRAY['super_admin']::public.user_role[])
  );
-- ============================================================================
-- Migration 009: Create Performance Indexes
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CLIENTS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_clients_assigned_commercial
  ON public.clients (assigned_commercial_id)
  WHERE assigned_commercial_id IS NOT NULL;

CREATE INDEX idx_clients_geographic_zone
  ON public.clients (geographic_zone)
  WHERE geographic_zone IS NOT NULL;

CREATE INDEX idx_clients_is_active
  ON public.clients (is_active);

-- ---------------------------------------------------------------------------
-- PROSPECTS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_prospects_pipeline_stage
  ON public.prospects (pipeline_stage);

CREATE INDEX idx_prospects_assigned_commercial
  ON public.prospects (assigned_commercial_id)
  WHERE assigned_commercial_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CHANTIERS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_chantiers_client
  ON public.chantiers (client_id);

CREATE INDEX idx_chantiers_assigned_team
  ON public.chantiers (assigned_team_id)
  WHERE assigned_team_id IS NOT NULL;

CREATE INDEX idx_chantiers_status
  ON public.chantiers (status);

-- ---------------------------------------------------------------------------
-- PLANNING_SLOTS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_planning_slots_team_date
  ON public.planning_slots (team_id, slot_date);

CREATE INDEX idx_planning_slots_date
  ON public.planning_slots (slot_date);

-- ---------------------------------------------------------------------------
-- TIME_ENTRIES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_time_entries_profile_date
  ON public.time_entries (profile_id, entry_date);

-- ---------------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_invoices_client
  ON public.invoices (client_id);

CREATE INDEX idx_invoices_status
  ON public.invoices (status);

CREATE INDEX idx_invoices_due_date
  ON public.invoices (due_date);

-- ---------------------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_quotes_client
  ON public.quotes (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX idx_quotes_status
  ON public.quotes (status);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_notifications_profile_read
  ON public.notifications (profile_id, is_read);

-- ---------------------------------------------------------------------------
-- AUDIT_LOGS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_audit_logs_created_at
  ON public.audit_logs (created_at);

CREATE INDEX idx_audit_logs_table_name
  ON public.audit_logs (table_name)
  WHERE table_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ABSENCES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_absences_profile_start
  ON public.absences (profile_id, start_date);
