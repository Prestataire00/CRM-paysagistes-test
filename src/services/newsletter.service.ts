import { supabase } from '../lib/supabase'
import type { NewsletterCampaign, CampaignStatus } from '../types'

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
// Filter types
// ---------------------------------------------------------------------------
export interface CampaignFilters {
  status?: CampaignStatus
}

// ---------------------------------------------------------------------------
// getCampaigns
// ---------------------------------------------------------------------------
export async function getCampaigns(filters: CampaignFilters = {}): Promise<NewsletterCampaign[]> {
  let query = supabase
    .from('newsletter_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as NewsletterCampaign[]
}

// ---------------------------------------------------------------------------
// getCampaign
// ---------------------------------------------------------------------------
export async function getCampaign(id: string): Promise<NewsletterCampaign> {
  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as NewsletterCampaign
}

// ---------------------------------------------------------------------------
// createCampaign (resilient: retries without content_json if column missing)
// ---------------------------------------------------------------------------
export async function createCampaign(
  data: Omit<NewsletterCampaign, 'id' | 'created_at' | 'updated_at' | 'recipients_count' | 'sent_count'>,
): Promise<NewsletterCampaign> {
  const { data: campaign, error } = await supabase
    .from('newsletter_campaigns')
    .insert(data)
    .select()
    .single()

  if (error) {
    // Fallback: if content_json column doesn't exist yet, retry without it
    if (error.message?.includes('content_json') || error.code === '42703') {
      const { content_json: _, ...rest } = data
      const { data: c2, error: e2 } = await supabase
        .from('newsletter_campaigns')
        .insert(rest)
        .select()
        .single()
      if (e2) throw e2
      return { ...c2, content_json: null } as NewsletterCampaign
    }
    throw error
  }
  return campaign as NewsletterCampaign
}

// ---------------------------------------------------------------------------
// updateCampaign (resilient: retries without content_json if column missing)
// ---------------------------------------------------------------------------
export async function updateCampaign(
  id: string,
  data: Partial<Omit<NewsletterCampaign, 'id' | 'created_at' | 'updated_at'>>,
): Promise<NewsletterCampaign> {
  const { data: campaign, error } = await supabase
    .from('newsletter_campaigns')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.message?.includes('content_json') || error.code === '42703') {
      const { content_json: _, ...rest } = data as Record<string, unknown>
      const { data: c2, error: e2 } = await supabase
        .from('newsletter_campaigns')
        .update(rest)
        .eq('id', id)
        .select()
        .single()
      if (e2) throw e2
      return { ...c2, content_json: null } as NewsletterCampaign
    }
    throw error
  }
  return campaign as NewsletterCampaign
}

// ---------------------------------------------------------------------------
// deleteCampaign
// ---------------------------------------------------------------------------
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('newsletter_campaigns').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// getNewsletterRecipients — clients with newsletter_consent, optionally filtered by tags
// ---------------------------------------------------------------------------
export interface NewsletterRecipient {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
  email: string | null
}

export async function getNewsletterRecipients(tagIds?: string[]): Promise<NewsletterRecipient[]> {
  if (tagIds && tagIds.length > 0) {
    // Get client IDs with matching tags
    const { data: assignments, error: tagError } = await supabase
      .from('client_tag_assignments')
      .select('client_id')
      .in('tag_id', tagIds)

    if (tagError) throw tagError
    const clientIds = [...new Set((assignments ?? []).map((a) => a.client_id))]
    if (clientIds.length === 0) return []

    const { data, error } = await supabase
      .from('clients')
      .select('id, first_name, last_name, company_name, email')
      .eq('is_active', true)
      .not('email', 'is', null)
      .in('id', clientIds)
      .order('last_name')

    if (error) throw error
    return (data ?? []) as NewsletterRecipient[]
  }

  // All active clients with email
  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, email')
    .eq('is_active', true)
    .not('email', 'is', null)
    .order('last_name')

  if (error) throw error
  return (data ?? []) as NewsletterRecipient[]
}

// ---------------------------------------------------------------------------
// sendCampaign — send via Edge Function (Brevo API + variable replacement)
// ---------------------------------------------------------------------------
export async function sendCampaign(id: string, _recipientCount: number): Promise<NewsletterCampaign> {
  const result = await invokeEdgeFunction<{ campaign: NewsletterCampaign }>('send-newsletter', {
    campaign_id: id,
  })
  return result.campaign
}
