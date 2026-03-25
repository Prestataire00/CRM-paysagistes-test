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
