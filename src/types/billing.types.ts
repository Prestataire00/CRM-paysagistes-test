export type QuoteStatus = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire'
export type QuoteRelanceStatus = 'generated' | 'edited' | 'sending' | 'sent' | 'failed' | 'cancelled'
export type QuoteRelanceTone = 'professionnel' | 'amical' | 'urgent' | 'relance_douce'
export type InvoiceStatus = 'brouillon' | 'emise' | 'envoyee' | 'payee' | 'partiellement_payee' | 'en_retard' | 'annulee'
export type PaymentMethod = 'virement' | 'cheque' | 'carte_bancaire' | 'prelevement' | 'especes'

export interface Quote {
  id: string
  reference: string
  client_id: string | null
  prospect_id: string | null
  title: string
  description: string | null
  status: QuoteStatus
  issue_date: string
  validity_date: string | null
  accepted_date: string | null
  subtotal_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  discount_percentage: number
  discount_amount: number
  eligible_tax_credit: boolean
  tax_credit_amount: number
  net_after_credit: number
  payment_terms: string | null
  special_conditions: string | null
  pdf_url: string | null
  created_by: string | null
  assigned_commercial_id: string | null
  converted_to_invoice_id: string | null
  signing_token?: string | null
  signature_url?: string | null
  signed_at?: string | null
  signer_ip?: string | null
  signing_expires_at?: string | null
  acompte_percentage: number
  created_at: string
  updated_at: string
  // Joined data (Supabase relations)
  client?: {
    id: string
    first_name: string
    last_name: string
    company_name: string | null
    siret: string | null
    tva_number: string | null
  }
}

export interface QuoteLine {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  tva_rate: number
  total_ht: number
  total_ttc: number
  is_labor: boolean
  sort_order: number
  created_at: string
}

export interface Invoice {
  id: string
  reference: string
  client_id: string
  quote_id: string | null
  chantier_id: string | null
  title: string
  description: string | null
  status: InvoiceStatus
  issue_date: string
  due_date: string
  paid_date: string | null
  subtotal_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  discount_percentage: number
  discount_amount: number
  amount_paid: number
  payment_method: PaymentMethod | null
  payment_reference: string | null
  eligible_tax_credit: boolean
  labor_amount_ht: number
  tax_credit_amount: number
  net_after_credit: number
  is_archived: boolean
  pdf_url: string | null
  exported_at: string | null
  accounting_reference: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined data (Supabase relations)
  client?: {
    id: string
    first_name: string
    last_name: string
    company_name: string | null
    siret: string | null
    tva_number: string | null
  }
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  tva_rate: number
  total_ht: number
  total_ttc: number
  is_labor: boolean
  sort_order: number
  created_at: string
}

export interface FiscalAttestation {
  id: string
  reference: string
  client_id: string
  fiscal_year: number
  total_amount_ttc: number
  total_labor_ht: number
  tax_credit_amount: number
  invoice_ids: string[]
  company_name: string
  company_siret: string
  company_address: string
  company_agrement: string | null
  is_sent: boolean
  sent_at: string | null
  sent_method: string | null
  pdf_url: string | null
  generated_by: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Quote Templates
// ---------------------------------------------------------------------------

export interface QuoteTemplateLine {
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  tva_rate: number
  is_labor: boolean
  sort_order: number
}

export interface QuoteTemplate {
  id: string
  name: string
  description: string | null
  lines: QuoteTemplateLine[]
  conditions: string | null
  payment_terms: string | null
  validity_days: number
  tva_rate: number
  eligible_tax_credit: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Quote Relance (follow-up emails for unsigned quotes)
// ---------------------------------------------------------------------------

export interface QuoteRelance {
  id: string
  quote_id: string
  client_id: string
  communication_id: string | null
  recipient_email: string
  subject: string
  body_html: string
  body_text: string | null
  ai_prompt_context: Record<string, unknown> | null
  ai_model: string | null
  tone: QuoteRelanceTone
  status: QuoteRelanceStatus
  sent_at: string | null
  brevo_message_id: string | null
  error_message: string | null
  relance_number: number
  generated_by: string
  sent_by: string | null
  created_at: string
  updated_at: string
}

export interface GenerateQuoteRelanceRequest {
  quote_id: string
  tone?: QuoteRelanceTone
  custom_instructions?: string
}

export interface GenerateQuoteRelanceResponse {
  relance: QuoteRelance
}

export interface SendQuoteRelanceRequest {
  relance_id: string
  subject?: string
  body_html?: string
}

export interface SendQuoteRelanceResponse {
  relance: QuoteRelance
  communication_id: string
}
