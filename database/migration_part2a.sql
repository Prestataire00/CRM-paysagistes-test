-- ============================================================================
-- Migration Part 2A: Planning + Resource Tables
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sequence for chantier auto-reference CHT-YYYY-XXXXX
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.chantier_ref_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- generate_chantier_reference()
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
  quote_id                    UUID,
  invoice_id                  UUID,
  created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_chantiers_priority CHECK (priority >= 1 AND priority <= 5),
  CONSTRAINT chk_chantiers_duration CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0),
  CONSTRAINT chk_chantiers_schedule CHECK (
    scheduled_end_time IS NULL OR scheduled_start_time IS NULL OR scheduled_end_time > scheduled_start_time
  )
);

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

-- ---------------------------------------------------------------------------
-- task_templates
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

CREATE TRIGGER trg_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- planning_slots (WITHOUT exclusion constraint - overlap check via trigger)
-- ---------------------------------------------------------------------------
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

  CONSTRAINT chk_planning_slots_times CHECK (end_time > start_time)
);

-- Trigger-based overlap prevention (replaces EXCLUDE constraint for compatibility)
CREATE OR REPLACE FUNCTION public.check_planning_slot_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.planning_slots
    WHERE team_id = NEW.team_id
      AND slot_date = NEW.slot_date
      AND id IS DISTINCT FROM NEW.id
      AND start_time < NEW.end_time
      AND end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'Planning slot overlaps with an existing slot for the same team on the same day';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_planning_slots_no_overlap
  BEFORE INSERT OR UPDATE ON public.planning_slots
  FOR EACH ROW EXECUTE FUNCTION public.check_planning_slot_overlap();

CREATE TRIGGER trg_planning_slots_updated_at
  BEFORE UPDATE ON public.planning_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- time_entries
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

-- ---------------------------------------------------------------------------
-- absences
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

CREATE TRIGGER trg_absences_updated_at
  BEFORE UPDATE ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- vehicles
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

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- equipment
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

CREATE TRIGGER trg_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Deferred Foreign Keys (cross-references)
-- ---------------------------------------------------------------------------

-- teams.default_vehicle_id -> vehicles
ALTER TABLE public.teams
  ADD CONSTRAINT fk_teams_default_vehicle
  FOREIGN KEY (default_vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- profiles.default_team_id -> teams
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_default_team
  FOREIGN KEY (default_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
