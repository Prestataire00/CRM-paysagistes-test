-- ============================================================================
-- Migration 010: Table d'émargement des interventions
-- ============================================================================

-- Table pour les pointages d'arrivée et de départ des membres d'équipe
CREATE TABLE public.intervention_emargements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_slot_id UUID NOT NULL REFERENCES public.planning_slots(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('arrivee', 'depart')),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (planning_slot_id, profile_id, signature_type)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_emargements_slot ON public.intervention_emargements(planning_slot_id);
CREATE INDEX idx_emargements_profile ON public.intervention_emargements(profile_id);
CREATE INDEX idx_emargements_slot_type ON public.intervention_emargements(planning_slot_id, signature_type);

-- RLS
ALTER TABLE public.intervention_emargements ENABLE ROW LEVEL SECURITY;

-- Lecture : admin, conducteur_travaux, super_admin voient tout ; jardinier voit seulement son équipe
CREATE POLICY "emargements_select" ON public.intervention_emargements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'conducteur_travaux')
    )
    OR
    profile_id = auth.uid()
  );

-- Insertion : tout utilisateur authentifié peut pointer (pour soi-même uniquement)
CREATE POLICY "emargements_insert" ON public.intervention_emargements
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'conducteur_travaux')
    )
  );

-- Suppression : admin et super_admin uniquement
CREATE POLICY "emargements_delete" ON public.intervention_emargements
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin')
    )
  );
