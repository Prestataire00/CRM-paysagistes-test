-- ============================================================================
-- 017 — Events & Newsletter Campaigns
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.event_type AS ENUM (
  'salon', 'portes_ouvertes', 'atelier', 'formation', 'reunion', 'autre'
);

CREATE TYPE public.event_status AS ENUM (
  'brouillon', 'publie', 'annule', 'termine'
);

CREATE TYPE public.participant_status AS ENUM (
  'invite', 'confirme', 'decline', 'present', 'absent'
);

CREATE TYPE public.campaign_status AS ENUM (
  'brouillon', 'programmee', 'en_cours', 'envoyee', 'annulee'
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
CREATE TABLE public.events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  event_type        public.event_type NOT NULL DEFAULT 'autre',
  status            public.event_status NOT NULL DEFAULT 'brouillon',
  location          TEXT,
  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ,
  max_participants  INT,
  notes             TEXT,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Event Participants
-- ---------------------------------------------------------------------------
CREATE TABLE public.event_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status          public.participant_status NOT NULL DEFAULT 'invite',
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  notes           TEXT,
  UNIQUE(event_id, client_id)
);

-- ---------------------------------------------------------------------------
-- Newsletter Campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE public.newsletter_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject           TEXT NOT NULL,
  body_html         TEXT NOT NULL DEFAULT '',
  status            public.campaign_status NOT NULL DEFAULT 'brouillon',
  scheduled_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  recipients_count  INT NOT NULL DEFAULT 0,
  sent_count        INT NOT NULL DEFAULT 0,
  tag_filter        UUID[],
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

-- Events — read/write for admin + commercial roles
CREATE POLICY events_select ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY events_insert ON public.events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY events_update ON public.events FOR UPDATE TO authenticated USING (true);
CREATE POLICY events_delete ON public.events FOR DELETE TO authenticated USING (true);

-- Event Participants
CREATE POLICY event_participants_select ON public.event_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY event_participants_insert ON public.event_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY event_participants_update ON public.event_participants FOR UPDATE TO authenticated USING (true);
CREATE POLICY event_participants_delete ON public.event_participants FOR DELETE TO authenticated USING (true);

-- Newsletter Campaigns
CREATE POLICY newsletter_campaigns_select ON public.newsletter_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY newsletter_campaigns_insert ON public.newsletter_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY newsletter_campaigns_update ON public.newsletter_campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY newsletter_campaigns_delete ON public.newsletter_campaigns FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_events_start_date ON public.events(start_date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_client ON public.event_participants(client_id);
CREATE INDEX idx_newsletter_campaigns_status ON public.newsletter_campaigns(status);

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
