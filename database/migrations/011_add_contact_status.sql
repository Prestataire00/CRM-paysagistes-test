-- Migration 011: Add contact_status to chantiers
-- Tracks whether the client has been contacted about the intervention

ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS contact_status TEXT DEFAULT 'non_contacte'
  CHECK (contact_status IN ('appele', 'sms_envoye', 'non_contacte'));

COMMENT ON COLUMN public.chantiers.contact_status IS 'Client contact status: appele (called), sms_envoye (SMS sent), non_contacte (not contacted)';
