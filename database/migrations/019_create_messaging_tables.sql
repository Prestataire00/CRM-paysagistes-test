-- ============================================================================
-- Migration 019 : Messagerie interne
-- ============================================================================

-- Conversations (1:1 ou groupe)
CREATE TABLE public.internal_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT,
  is_group   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membres d'une conversation
CREATE TABLE public.conversation_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, profile_id)
);

-- Messages
CREATE TABLE public.internal_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_messages_conversation ON public.internal_messages (conversation_id, created_at DESC);
CREATE INDEX idx_conv_members_profile ON public.conversation_members (profile_id);
CREATE INDEX idx_conv_updated ON public.internal_conversations (updated_at DESC);

-- RLS
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Policies: membres de la conversation uniquement
CREATE POLICY conv_select ON public.internal_conversations FOR SELECT
  USING (id IN (SELECT conversation_id FROM public.conversation_members WHERE profile_id = auth.uid()));
CREATE POLICY conv_insert ON public.internal_conversations FOR INSERT
  WITH CHECK (TRUE);
CREATE POLICY conv_update ON public.internal_conversations FOR UPDATE
  USING (id IN (SELECT conversation_id FROM public.conversation_members WHERE profile_id = auth.uid()));

CREATE POLICY members_select ON public.conversation_members FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE profile_id = auth.uid()));
CREATE POLICY members_insert ON public.conversation_members FOR INSERT
  WITH CHECK (TRUE);
CREATE POLICY members_update ON public.conversation_members FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY messages_select ON public.internal_messages FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE profile_id = auth.uid()));
CREATE POLICY messages_insert ON public.internal_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
