-- ============================================================================
-- Migration 013: Enhance Pipeline for Commercial Optimization
-- ============================================================================
-- Adds denormalized last_activity_at on prospects (trigger-maintained),
-- indexes for activity queries, and scoring configuration in settings.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Denormalized column: last_activity_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill from existing commercial_activities
UPDATE public.prospects p
SET last_activity_at = sub.latest
FROM (
  SELECT prospect_id, MAX(COALESCE(completed_at, created_at)) AS latest
  FROM public.commercial_activities
  WHERE prospect_id IS NOT NULL
  GROUP BY prospect_id
) sub
WHERE p.id = sub.prospect_id;

-- ---------------------------------------------------------------------------
-- 2. Indexes for pipeline performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prospects_last_activity
  ON public.prospects (last_activity_at)
  WHERE last_activity_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_stage_commercial
  ON public.prospects (pipeline_stage, assigned_commercial_id);

CREATE INDEX IF NOT EXISTS idx_activities_prospect_id
  ON public.commercial_activities (prospect_id)
  WHERE prospect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_prospect_created
  ON public.commercial_activities (prospect_id, created_at DESC)
  WHERE prospect_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Trigger: auto-update last_activity_at on activity INSERT/UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_prospect_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.prospect_id IS NOT NULL THEN
    UPDATE public.prospects
    SET last_activity_at = GREATEST(
      COALESCE(last_activity_at, '1970-01-01'::timestamptz),
      COALESCE(NEW.completed_at, NEW.created_at)
    )
    WHERE id = NEW.prospect_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_update_prospect_last_activity
  ON public.commercial_activities;

CREATE TRIGGER trg_activity_update_prospect_last_activity
  AFTER INSERT OR UPDATE ON public.commercial_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_prospect_last_activity();

-- ---------------------------------------------------------------------------
-- 4. Scoring configuration in settings
-- ---------------------------------------------------------------------------
INSERT INTO public.settings (key, value, description, category)
VALUES (
  'pipeline_scoring_config',
  '{
    "weights": {
      "estimated_value": 25,
      "probability": 25,
      "activity_frequency": 25,
      "recency": 25
    },
    "thresholds": {
      "high_value": 10000,
      "high_probability": 70,
      "active_frequency_days": 7,
      "recent_activity_days": 3
    },
    "inactivity_alert_days": 7,
    "stage_age_reminders": {
      "nouveau": 3,
      "qualification": 5,
      "proposition": 7,
      "negociation": 10
    }
  }'::jsonb,
  'Configuration du scoring prospects et alertes pipeline commercial',
  'crm'
)
ON CONFLICT (key) DO NOTHING;
