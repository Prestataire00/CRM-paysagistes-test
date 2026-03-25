export type InterventionStatus = 'planifiee' | 'en_cours' | 'terminee' | 'annulee' | 'reportee'

export type InterventionType =
  | 'entretien' | 'tonte' | 'taille' | 'desherbage' | 'plantation'
  | 'amenagement' | 'arrosage' | 'debroussaillage' | 'evacuation' | 'autre'

export type ChantierColorType = 'contrat' | 'ponctuel' | 'suspendu' | 'extra' | 'ancien' | 'fournisseur'

export type RecurrenceFrequency = 'quotidien' | 'hebdomadaire' | 'bi_hebdomadaire' | 'mensuel' | 'trimestriel' | 'annuel'

export type ContactStatus = 'appele' | 'sms_envoye' | 'non_contacte'

export interface TeamMemberWithProfile {
  id: string
  team_id: string
  profile_id: string
  is_team_leader: boolean
  joined_at: string
  left_at: string | null
  created_at: string
  profile?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    avatar_url: string | null
    role: string
  }
}

export interface Team {
  id: string
  name: string
  color: string
  leader_id: string | null
  default_vehicle_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined data (Supabase relations)
  members?: TeamMemberWithProfile[]
}

export interface TeamMember {
  id: string
  team_id: string
  profile_id: string
  is_team_leader: boolean
  joined_at: string
  left_at: string | null
  created_at: string
}

export interface Chantier {
  id: string
  reference: string
  title: string
  description: string | null
  client_id: string
  address_line1: string
  address_line2: string | null
  postal_code: string
  city: string
  latitude: number | null
  longitude: number | null
  geographic_zone: string | null
  intervention_type: InterventionType
  status: InterventionStatus
  priority: number
  estimated_duration_minutes: number | null
  actual_duration_minutes: number | null
  scheduled_date: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  completed_at: string | null
  is_recurring: boolean
  recurrence_frequency: RecurrenceFrequency | null
  recurrence_end_date: string | null
  parent_template_id: string | null
  assigned_team_id: string | null
  completion_notes: string | null
  client_signature_url: string | null
  completion_photos: string[] | null
  contact_status: ContactStatus
  quote_id: string | null
  invoice_id: string | null
  satisfaction_rating: number | null
  satisfaction_comment: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined data (Supabase relations)
  client?: {
    id: string
    first_name: string
    last_name: string
    company_name: string | null
    email: string | null
    phone: string | null
    mobile: string | null
    address_line1: string
    postal_code: string
    city: string
    geographic_zone: string | null
    siret: string | null
    tva_number: string | null
  }
  assigned_team?: { id: string; name: string; color: string }
  tasks?: ChantierTask[]
}

export interface ChantierTask {
  id: string
  chantier_id: string
  title: string
  description: string | null
  is_completed: boolean
  completed_by: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
}

export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  intervention_type: InterventionType
  default_tasks: Array<{ title: string; description?: string; sort_order: number }>
  estimated_duration_minutes: number | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlanningSlot {
  id: string
  chantier_id: string
  team_id: string
  slot_date: string
  start_time: string
  end_time: string
  color: string | null
  is_locked: boolean
  planned_by: string | null
  created_at: string
  updated_at: string
  // Joined data
  chantier?: Chantier
  team?: Team
}

export type SignatureType = 'arrivee' | 'depart'

export interface InterventionEmargement {
  id: string
  planning_slot_id: string
  profile_id: string
  signature_type: SignatureType
  signed_at: string
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
  // Joined data
  profile?: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

export interface TimeEntry {
  id: string
  profile_id: string
  chantier_id: string | null
  planning_slot_id: string | null
  entry_date: string
  clock_in: string
  clock_out: string | null
  break_duration_minutes: number
  total_minutes: number | null
  clock_in_latitude: number | null
  clock_in_longitude: number | null
  clock_out_latitude: number | null
  clock_out_longitude: number | null
  notes: string | null
  validated_by: string | null
  validated_at: string | null
  created_at: string
  updated_at: string
}
