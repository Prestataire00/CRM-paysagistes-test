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
