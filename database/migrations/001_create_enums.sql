-- ============================================================================
-- Migration 001: Create Enum Types
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- User roles within the organization
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'admin',
  'responsable_commercial',
  'commercial',
  'conducteur_travaux',
  'comptabilite',
  'jardinier'
);

-- Client classification
CREATE TYPE public.client_type AS ENUM (
  'particulier',
  'professionnel',
  'copropriete',
  'collectivite'
);

-- Contract duration types
CREATE TYPE public.contract_type AS ENUM (
  'ponctuel',
  'annuel',
  'trimestriel',
  'mensuel'
);

-- Intervention lifecycle status
CREATE TYPE public.intervention_status AS ENUM (
  'planifiee',
  'en_cours',
  'terminee',
  'annulee',
  'reportee'
);

-- Types of garden/landscaping interventions
CREATE TYPE public.intervention_type AS ENUM (
  'entretien',
  'tonte',
  'taille',
  'desherbage',
  'plantation',
  'amenagement',
  'arrosage',
  'debroussaillage',
  'evacuation',
  'autre'
);

-- Quote lifecycle status
CREATE TYPE public.quote_status AS ENUM (
  'brouillon',
  'envoye',
  'accepte',
  'refuse',
  'expire'
);

-- Invoice lifecycle status
CREATE TYPE public.invoice_status AS ENUM (
  'brouillon',
  'emise',
  'envoyee',
  'payee',
  'partiellement_payee',
  'en_retard',
  'annulee'
);

-- Payment methods
CREATE TYPE public.payment_method AS ENUM (
  'virement',
  'cheque',
  'carte_bancaire',
  'prelevement',
  'especes'
);

-- Absence / leave types
CREATE TYPE public.absence_type AS ENUM (
  'conge_paye',
  'maladie',
  'rtt',
  'formation',
  'sans_solde',
  'autre'
);

-- Absence request status
CREATE TYPE public.absence_status AS ENUM (
  'en_attente',
  'approuvee',
  'refusee'
);

-- Fleet vehicle status
CREATE TYPE public.vehicle_status AS ENUM (
  'disponible',
  'en_mission',
  'en_maintenance',
  'hors_service'
);

-- Equipment status
CREATE TYPE public.equipment_status AS ENUM (
  'disponible',
  'en_utilisation',
  'en_reparation',
  'hors_service'
);

-- Commercial pipeline stage types
CREATE TYPE public.pipeline_stage_type AS ENUM (
  'nouveau',
  'qualification',
  'proposition',
  'negociation',
  'gagne',
  'perdu'
);

-- Communication channel types
CREATE TYPE public.communication_type AS ENUM (
  'email',
  'sms',
  'appel',
  'courrier',
  'visite'
);

-- Communication direction
CREATE TYPE public.communication_direction AS ENUM (
  'entrant',
  'sortant'
);

-- Document categories
CREATE TYPE public.document_type AS ENUM (
  'devis',
  'facture',
  'attestation_fiscale',
  'contrat',
  'photo',
  'signature',
  'rapport',
  'autre'
);

-- Notification severity levels
CREATE TYPE public.notification_type AS ENUM (
  'info',
  'warning',
  'error',
  'success',
  'reminder'
);

-- Geographic service zones
CREATE TYPE public.geographic_zone AS ENUM (
  'zone_1',
  'zone_2',
  'zone_3',
  'zone_4',
  'zone_5'
);

-- Recurrence frequency for recurring chantiers
CREATE TYPE public.recurrence_frequency AS ENUM (
  'quotidien',
  'hebdomadaire',
  'bi_hebdomadaire',
  'mensuel',
  'trimestriel',
  'annuel'
);
