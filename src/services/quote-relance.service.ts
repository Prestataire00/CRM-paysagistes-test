import { supabase } from '../lib/supabase'
import type {
  QuoteRelance,
  GenerateQuoteRelanceRequest,
  GenerateQuoteRelanceResponse,
  SendQuoteRelanceRequest,
  SendQuoteRelanceResponse,
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
// getRelancesForQuote - All relance emails for a quote
// ---------------------------------------------------------------------------
export async function getRelancesForQuote(
  quoteId: string,
): Promise<QuoteRelance[]> {
  const { data, error } = await supabase
    .from('quote_relances')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as QuoteRelance[]
}

// ---------------------------------------------------------------------------
// generateQuoteRelance - Call Edge Function to generate AI draft
// ---------------------------------------------------------------------------
export async function generateQuoteRelance(
  request: GenerateQuoteRelanceRequest,
): Promise<GenerateQuoteRelanceResponse> {
  return invokeEdgeFunction<GenerateQuoteRelanceResponse>('generate-quote-relance', request)
}

// ---------------------------------------------------------------------------
// sendQuoteRelance - Call Edge Function to send via Brevo
// ---------------------------------------------------------------------------
export async function sendQuoteRelance(
  request: SendQuoteRelanceRequest,
): Promise<SendQuoteRelanceResponse> {
  return invokeEdgeFunction<SendQuoteRelanceResponse>('send-quote-relance', request)
}

// ---------------------------------------------------------------------------
// updateQuoteRelanceDraft - Update subject/body before sending
// ---------------------------------------------------------------------------
export async function updateQuoteRelanceDraft(
  id: string,
  updates: { subject?: string; body_html?: string },
): Promise<QuoteRelance> {
  const { data, error } = await supabase
    .from('quote_relances')
    .update({ ...updates, status: 'edited' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as QuoteRelance
}

// ---------------------------------------------------------------------------
// cancelQuoteRelance - Mark a relance as cancelled
// ---------------------------------------------------------------------------
export async function cancelQuoteRelance(id: string): Promise<void> {
  const { error } = await supabase
    .from('quote_relances')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
}
