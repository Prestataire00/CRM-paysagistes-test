// ---------------------------------------------------------------------------
// Relance Email Types
// ---------------------------------------------------------------------------

export type RelanceStatus = 'generated' | 'edited' | 'sending' | 'sent' | 'failed' | 'cancelled'
export type RelanceTone = 'professionnel' | 'amical' | 'urgent' | 'relance_douce'

export interface RelanceEmail {
  id: string
  prospect_id: string
  communication_id: string | null
  recipient_email: string
  subject: string
  body_html: string
  body_text: string | null
  ai_prompt_context: Record<string, unknown> | null
  ai_model: string | null
  tone: RelanceTone
  status: RelanceStatus
  sent_at: string | null
  brevo_message_id: string | null
  error_message: string | null
  generated_by: string
  sent_by: string | null
  created_at: string
  updated_at: string
}

export interface RelanceConfig {
  default_tone: RelanceTone
  sender_name: string
  sender_email: string
  auto_log_activity: boolean
  company_description: string
}

export interface GenerateRelanceRequest {
  prospect_id: string
  tone?: RelanceTone
  custom_instructions?: string
}

export interface GenerateRelanceResponse {
  relance: RelanceEmail
}

export interface SendRelanceRequest {
  relance_id: string
  subject?: string
  body_html?: string
}

export interface SendRelanceResponse {
  relance: RelanceEmail
  communication_id: string
}
