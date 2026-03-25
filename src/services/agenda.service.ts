import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AgendaRdv {
  id: string
  activity_type: string
  subject: string
  description: string | null
  scheduled_at: string
  is_completed: boolean
  completed_at: string | null
  follow_up_notes: string | null
  assigned_to: string
  prospect_id: string | null
  client_id: string | null
  created_at: string
  // Joined
  prospect: { id: string; first_name: string; last_name: string; company_name: string | null; phone: string | null; email: string | null; city: string | null } | null
  client: { id: string; first_name: string; last_name: string; company_name: string | null; phone: string | null; email: string | null; city: string | null } | null
  assigned_user: { id: string; first_name: string; last_name: string } | null
}

export interface CreateRdvInput {
  activity_type: string
  subject: string
  description: string | null
  scheduled_at: string
  follow_up_notes: string | null
  assigned_to: string
  created_by: string
  prospect_id: string | null
  client_id: string | null
  is_completed: boolean
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAgendaRdvs(monthStart: string, monthEnd: string): Promise<AgendaRdv[]> {
  const { data, error } = await supabase
    .from('commercial_activities')
    .select(`
      id, activity_type, subject, description, scheduled_at, is_completed, completed_at,
      follow_up_notes, assigned_to, prospect_id, client_id, created_at,
      prospect:prospects!prospect_id(id, first_name, last_name, company_name, phone, email, city),
      client:clients!client_id(id, first_name, last_name, company_name, phone, email, city),
      assigned_user:profiles!assigned_to(id, first_name, last_name)
    `)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', monthStart)
    .lte('scheduled_at', monthEnd)
    .order('scheduled_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    prospect: Array.isArray(row.prospect) ? row.prospect[0] ?? null : row.prospect,
    client: Array.isArray(row.client) ? row.client[0] ?? null : row.client,
    assigned_user: Array.isArray(row.assigned_user) ? row.assigned_user[0] ?? null : row.assigned_user,
  })) as AgendaRdv[]
}

export async function getUpcomingRdvs(limit = 10): Promise<AgendaRdv[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('commercial_activities')
    .select(`
      id, activity_type, subject, description, scheduled_at, is_completed, completed_at,
      follow_up_notes, assigned_to, prospect_id, client_id, created_at,
      prospect:prospects!prospect_id(id, first_name, last_name, company_name, phone, email, city),
      client:clients!client_id(id, first_name, last_name, company_name, phone, email, city),
      assigned_user:profiles!assigned_to(id, first_name, last_name)
    `)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', now)
    .eq('is_completed', false)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    prospect: Array.isArray(row.prospect) ? row.prospect[0] ?? null : row.prospect,
    client: Array.isArray(row.client) ? row.client[0] ?? null : row.client,
    assigned_user: Array.isArray(row.assigned_user) ? row.assigned_user[0] ?? null : row.assigned_user,
  })) as AgendaRdv[]
}

export async function createRdv(input: CreateRdvInput): Promise<void> {
  const { error } = await supabase.from('commercial_activities').insert(input)
  if (error) throw error
}

export async function completeRdv(id: string, description: string | null): Promise<void> {
  const { error } = await supabase
    .from('commercial_activities')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      description: description || undefined,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteRdv(id: string): Promise<void> {
  const { error } = await supabase.from('commercial_activities').delete().eq('id', id)
  if (error) throw error
}

// For the RDV reminder check
export async function getTomorrowRdvs(userId: string): Promise<AgendaRdv[]> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStart = tomorrow.toISOString().split('T')[0] + 'T00:00:00'
  const tomorrowEnd = tomorrow.toISOString().split('T')[0] + 'T23:59:59'

  const { data, error } = await supabase
    .from('commercial_activities')
    .select('id, activity_type, subject, scheduled_at, prospect_id, client_id, assigned_to, is_completed, description, follow_up_notes, completed_at, created_at')
    .eq('assigned_to', userId)
    .eq('is_completed', false)
    .gte('scheduled_at', tomorrowStart)
    .lte('scheduled_at', tomorrowEnd)

  if (error) throw error
  return (data ?? []).map(r => ({ ...r, prospect: null, client: null, assigned_user: null })) as AgendaRdv[]
}

// ---------------------------------------------------------------------------
// getRdvContext — gather rich context for AI preparation
// ---------------------------------------------------------------------------
export interface RdvContext {
  contactName: string
  contactType: string
  contactCity: string | null
  contactPhone: string | null
  contactEmail: string | null
  clientSince: string | null
  contractType: string | null
  contractEndDate: string | null
  totalInvoiced: number
  lastQuote: { reference: string; title: string; total_ttc: number; status: string } | null
  recentActivities: { type: string; subject: string; date: string }[]
  rdvSubject: string
  rdvType: string
}

export async function getRdvContext(rdv: AgendaRdv): Promise<RdvContext> {
  const contactId = rdv.client_id || rdv.prospect_id
  const isClient = !!rdv.client_id
  const table = isClient ? 'clients' : 'prospects'

  // Fetch contact details
  const { data: contact } = await supabase
    .from(table)
    .select('first_name, last_name, company_name, city, phone, email, created_at, contract_type, contract_end_date, client_type')
    .eq('id', contactId!)
    .maybeSingle()

  // Fetch invoices total (client only)
  let totalInvoiced = 0
  if (isClient) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total_ttc')
      .eq('client_id', contactId!)
      .eq('status', 'payee')
    totalInvoiced = (invoices ?? []).reduce((s, i) => s + Number(i.total_ttc), 0)
  }

  // Last quote
  let lastQuote: RdvContext['lastQuote'] = null
  const quoteFilter = isClient ? { client_id: contactId } : { prospect_id: contactId }
  const { data: quotes } = await supabase
    .from('quotes')
    .select('reference, title, total_ttc, status')
    .match(quoteFilter)
    .order('created_at', { ascending: false })
    .limit(1)
  if (quotes && quotes.length > 0) {
    lastQuote = quotes[0]
  }

  // Recent activities
  const actFilter = isClient ? { client_id: contactId } : { prospect_id: contactId }
  const { data: activities } = await supabase
    .from('commercial_activities')
    .select('activity_type, subject, created_at')
    .match(actFilter)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    contactName: contact?.company_name || `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim() || '—',
    contactType: isClient ? (contact?.client_type ?? 'particulier') : 'prospect',
    contactCity: contact?.city ?? null,
    contactPhone: contact?.phone ?? null,
    contactEmail: contact?.email ?? null,
    clientSince: contact?.created_at ?? null,
    contractType: contact?.contract_type ?? null,
    contractEndDate: contact?.contract_end_date ?? null,
    totalInvoiced,
    lastQuote,
    recentActivities: (activities ?? []).map(a => ({
      type: a.activity_type,
      subject: a.subject,
      date: a.created_at,
    })),
    rdvSubject: rdv.subject,
    rdvType: rdv.activity_type,
  }
}
