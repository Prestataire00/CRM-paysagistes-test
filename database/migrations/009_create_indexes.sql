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
