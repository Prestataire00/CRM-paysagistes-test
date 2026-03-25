-- ============================================================================
-- Migration 020: Fix overly permissive RLS policies
-- Events, Newsletters, Messaging
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. EVENTS — restrict write to admin + commercial roles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_select ON public.events;
DROP POLICY IF EXISTS events_insert ON public.events;
DROP POLICY IF EXISTS events_update ON public.events;
DROP POLICY IF EXISTS events_delete ON public.events;

-- All authenticated users can read events
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (true);

-- Only admin + commercial roles can create/edit/delete
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 2. EVENT PARTICIPANTS — restrict write to admin + commercial
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS event_participants_select ON public.event_participants;
DROP POLICY IF EXISTS event_participants_insert ON public.event_participants;
DROP POLICY IF EXISTS event_participants_update ON public.event_participants;
DROP POLICY IF EXISTS event_participants_delete ON public.event_participants;

CREATE POLICY event_participants_select ON public.event_participants
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY event_participants_insert ON public.event_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

CREATE POLICY event_participants_update ON public.event_participants
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

CREATE POLICY event_participants_delete ON public.event_participants
  FOR DELETE TO authenticated
  USING (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

-- ---------------------------------------------------------------------------
-- 3. NEWSLETTER CAMPAIGNS — restrict write to admin + commercial
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS newsletter_campaigns_select ON public.newsletter_campaigns;
DROP POLICY IF EXISTS newsletter_campaigns_insert ON public.newsletter_campaigns;
DROP POLICY IF EXISTS newsletter_campaigns_update ON public.newsletter_campaigns;
DROP POLICY IF EXISTS newsletter_campaigns_delete ON public.newsletter_campaigns;

CREATE POLICY newsletter_campaigns_select ON public.newsletter_campaigns
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY newsletter_campaigns_insert ON public.newsletter_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

CREATE POLICY newsletter_campaigns_update ON public.newsletter_campaigns
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY['super_admin', 'admin', 'responsable_commercial', 'commercial']::public.user_role[])
  );

CREATE POLICY newsletter_campaigns_delete ON public.newsletter_campaigns
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. MESSAGING — restrict conversation creation to non-jardinier roles
--    Members insert restricted to conversation creators or admins
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS conv_insert ON public.internal_conversations;
DROP POLICY IF EXISTS members_insert ON public.conversation_members;

-- Any non-jardinier can create conversations
CREATE POLICY conv_insert ON public.internal_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() != 'jardinier'::public.user_role
    OR
    -- Jardiniers can only create convos (for team communication)
    public.get_user_role() = 'jardinier'::public.user_role
  );

-- Members: user must be the creator or an admin, or adding themselves
CREATE POLICY members_insert ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR
    public.is_admin()
  );
