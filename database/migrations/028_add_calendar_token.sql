-- ============================================================================
-- 028 — Token de synchronisation calendrier iCal
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_calendar_token
  ON public.profiles (calendar_token)
  WHERE calendar_token IS NOT NULL;
