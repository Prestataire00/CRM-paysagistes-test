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
