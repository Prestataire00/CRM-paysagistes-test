import { brand } from '../config/brand'
import { supabase } from '../lib/supabase'
import type {
  RelanceEmail,
  RelanceConfig,
  GenerateRelanceRequest,
  GenerateRelanceResponse,
  SendRelanceRequest,
  SendRelanceResponse,
} from '../types'

// ---------------------------------------------------------------------------
// Helper: call Edge Function via raw fetch (better error handling)
// ---------------------------------------------------------------------------
async function invokeEdgeFunction<T>(functionName: string, body: unknown): Promise<T> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) throw new Error('Non authentifié')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    },
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`)
  return data as T
}

// ---------------------------------------------------------------------------
// getRelancesForProspect - All relance emails for a prospect
// ---------------------------------------------------------------------------
export async function getRelancesForProspect(
  prospectId: string,
): Promise<RelanceEmail[]> {
  const { data, error } = await supabase
    .from('relance_emails')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as RelanceEmail[]
}

// ---------------------------------------------------------------------------
// generateRelance - Call Edge Function to generate AI draft
// ---------------------------------------------------------------------------
export async function generateRelance(
  request: GenerateRelanceRequest,
): Promise<GenerateRelanceResponse> {
  return invokeEdgeFunction<GenerateRelanceResponse>('generate-relance', request)
}

// ---------------------------------------------------------------------------
// sendRelance - Call Edge Function to send via Brevo
// ---------------------------------------------------------------------------
export async function sendRelance(
  request: SendRelanceRequest,
): Promise<SendRelanceResponse> {
  return invokeEdgeFunction<SendRelanceResponse>('send-relance', request)
}

// ---------------------------------------------------------------------------
// updateRelanceDraft - Update subject/body before sending
// ---------------------------------------------------------------------------
export async function updateRelanceDraft(
  id: string,
  updates: { subject?: string; body_html?: string },
): Promise<RelanceEmail> {
  const { data, error } = await supabase
    .from('relance_emails')
    .update({ ...updates, status: 'edited' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as RelanceEmail
}

// ---------------------------------------------------------------------------
// cancelRelance - Mark a relance as cancelled
// ---------------------------------------------------------------------------
export async function cancelRelance(id: string): Promise<void> {
  const { error } = await supabase
    .from('relance_emails')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
}

// ---------------------------------------------------------------------------
// getRelanceConfig - Fetch relance settings
// ---------------------------------------------------------------------------
export async function getRelanceConfig(): Promise<RelanceConfig> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'relance_config')
    .single()

  if (error) {
    return {
      default_tone: 'professionnel',
      sender_name: brand.name,
      sender_email: brand.email,
      auto_log_activity: true,
      company_description: 'Petits travaux de jardinage',
    }
  }
  return data.value as RelanceConfig
}
