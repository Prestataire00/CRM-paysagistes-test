// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------
export type EventType = 'salon' | 'portes_ouvertes' | 'atelier' | 'formation' | 'reunion' | 'autre'
export type EventStatus = 'brouillon' | 'publie' | 'annule' | 'termine'
export type ParticipantStatus = 'invite' | 'confirme' | 'decline' | 'present' | 'absent'

export interface CrmEvent {
  id: string
  title: string
  description: string | null
  event_type: EventType
  status: EventStatus
  location: string | null
  start_date: string
  end_date: string | null
  max_participants: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventParticipant {
  id: string
  event_id: string
  client_id: string
  status: ParticipantStatus
  invited_at: string
  responded_at: string | null
  notes: string | null
}

// ---------------------------------------------------------------------------
// Newsletter types
// ---------------------------------------------------------------------------
export type CampaignStatus = 'brouillon' | 'programmee' | 'en_cours' | 'envoyee' | 'annulee'

export type NewsletterTemplate = 'annonce' | 'promotion' | 'actualites' | 'simple'

export interface NewsletterContent {
  template: NewsletterTemplate
  greeting: string
  intro: string
  body: string
  cta_text?: string
  cta_url?: string
  closing?: string
  // Promotion-specific
  highlight_text?: string
  valid_until?: string
  // Actualites-specific
  sections?: Array<{ title: string; content: string }>
}

export interface NewsletterCampaign {
  id: string
  subject: string
  body_html: string
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  recipients_count: number
  sent_count: number
  tag_filter: string[] | null
  content_json: NewsletterContent | null
  created_by: string | null
  created_at: string
  updated_at: string
}
