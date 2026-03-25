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
