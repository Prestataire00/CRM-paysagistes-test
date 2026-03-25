export type CommunicationType = 'email' | 'sms' | 'appel' | 'courrier' | 'visite'
export type CommunicationDirection = 'entrant' | 'sortant'
export type DocumentType = 'devis' | 'facture' | 'attestation_fiscale' | 'contrat' | 'photo' | 'signature' | 'rapport' | 'autre'
export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'reminder'

export interface Communication {
  id: string
  client_id: string | null
  prospect_id: string | null
  supplier_id: string | null
  communication_type: CommunicationType
  direction: CommunicationDirection
  subject: string | null
  body: string | null
  recipient_email: string | null
  recipient_phone: string | null
  is_sent: boolean
  sent_at: string | null
  delivery_status: string | null
  created_by: string | null
  created_at: string
}

export interface Document {
  id: string
  client_id: string | null
  chantier_id: string | null
  invoice_id: string | null
  quote_id: string | null
  document_type: DocumentType
  name: string
  description: string | null
  file_url: string
  file_size: number | null
  mime_type: string | null
  is_archived: boolean
  retention_until: string | null
  uploaded_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  profile_id: string
  notification_type: NotificationType
  title: string
  message: string
  action_url: string | null
  action_entity_type: string | null
  action_entity_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  profile_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface Setting {
  id: string
  key: string
  value: unknown
  description: string | null
  category: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface CommercialActivity {
  id: string
  client_id: string | null
  prospect_id: string | null
  activity_type: CommunicationType
  subject: string
  description: string | null
  scheduled_at: string | null
  completed_at: string | null
  is_completed: boolean
  follow_up_date: string | null
  follow_up_notes: string | null
  assigned_to: string
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Pipeline Scoring & Enrichment
// ---------------------------------------------------------------------------

export interface ProspectScoringConfig {
  weights: {
    estimated_value: number
    probability: number
    activity_frequency: number
    recency: number
  }
  thresholds: {
    high_value: number
    high_probability: number
    active_frequency_days: number
    recent_activity_days: number
  }
  inactivity_alert_days: number
  stage_age_reminders: Record<string, number>
}

export interface ProspectWithMeta {
  id: string
  company_name: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  mobile: string | null
  source: string | null
  estimated_value: number | null
  probability: number | null
  pipeline_stage: 'nouveau' | 'qualification' | 'proposition' | 'negociation' | 'gagne' | 'perdu'
  assigned_commercial_id: string | null
  converted_to_client_id: string | null
  converted_at: string | null
  last_activity_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Enriched fields
  activity_count: number
  score: number
  is_inactive: boolean
  reminder_message: string | null
  assigned_commercial: { id: string; first_name: string; last_name: string } | null
}

export interface PipelineStats {
  totalValue: number
  weightedValue: number
  activeCount: number
  conversionRate: number
  inactiveCount: number
}

export interface CommercialWeeklyReport {
  commercial_id: string
  commercial_name: string
  new_prospects: number
  activities_completed: number
  prospects_won: number
  prospects_lost: number
  total_won_value: number
  conversion_rate: number
}

export interface PipelineStageConfig {
  id: string
  name: string
  stage_type: string
  color: string
  sort_order: number
  is_active: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// AI Content Generation
// ---------------------------------------------------------------------------

export type AiContentContext =
  | 'newsletter_subject'
  | 'newsletter_intro'
  | 'newsletter_body'
  | 'newsletter_cta'
  | 'newsletter_section'
  | 'quote_description'
  | 'quote_conditions'
  | 'freeform'

export type AiContentAction = 'generate' | 'improve' | 'shorten' | 'lengthen'

export interface GenerateAiContentResponse {
  generated_text: string
}
