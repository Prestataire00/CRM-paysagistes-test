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
