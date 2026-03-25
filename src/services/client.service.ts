import { supabase } from '../lib/supabase'
import type { Client, ClientTag, Chantier, Invoice } from '../types'
import type { ClientCsvRow } from '../utils/csv'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface ClientFilters {
  search?: string
  geographic_zone?: string
  contract_type?: string
  is_active?: boolean
  sortField?: 'created_at' | 'last_name' | 'city'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// getClients - Paginated list with optional filters
// ---------------------------------------------------------------------------
export async function getClients(
  filters: ClientFilters = {},
): Promise<PaginatedResult<Client>> {
  const { search, geographic_zone, contract_type, is_active, sortField = 'created_at', sortDirection = 'desc', page = 1, pageSize = 25 } = filters

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })

  // Filters
  if (typeof is_active === 'boolean') {
    query = query.eq('is_active', is_active)
  }

  if (geographic_zone) {
    query = query.eq('geographic_zone', geographic_zone)
  }

  if (contract_type) {
    query = query.eq('contract_type', contract_type)
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    )
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query
    .order(sortField, { ascending: sortDirection === 'asc' })
    .range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []) as Client[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

// ---------------------------------------------------------------------------
// getClient - Single client with assigned commercial profile
// ---------------------------------------------------------------------------
export async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .select('*, assigned_commercial:profiles!assigned_commercial_id(id, first_name, last_name, email)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Client
}

// ---------------------------------------------------------------------------
// createClient
// ---------------------------------------------------------------------------
export async function createClient(
  clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>,
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single()

  if (error) throw error
  return data as Client
}

// ---------------------------------------------------------------------------
// updateClient
// ---------------------------------------------------------------------------
export async function updateClient(
  id: string,
  clientData: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(clientData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Client
}

// ---------------------------------------------------------------------------
// deleteClient - Soft delete (set is_active = false)
// ---------------------------------------------------------------------------
export async function deleteClient(id: string): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Client
}

// ---------------------------------------------------------------------------
// getClientInterventions - All chantiers for a given client
// ---------------------------------------------------------------------------
export async function getClientInterventions(clientId: string): Promise<Chantier[]> {
  const { data, error } = await supabase
    .from('chantiers')
    .select('*, assigned_team:teams!assigned_team_id(id, name, color)')
    .eq('client_id', clientId)
    .order('scheduled_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Chantier[]
}

// ---------------------------------------------------------------------------
// getClientInvoices - All invoices for a given client
// ---------------------------------------------------------------------------
export async function getClientInvoices(clientId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .order('issue_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Invoice[]
}

// ---------------------------------------------------------------------------
// checkDuplicateClient - Check for duplicate clients by name / email
// ---------------------------------------------------------------------------
export interface DuplicateCheckResult {
  isDuplicate: boolean
  matches: Pick<Client, 'id' | 'first_name' | 'last_name' | 'email' | 'company_name'>[]
}

export async function checkDuplicateClient(
  firstName: string,
  lastName: string,
  email?: string,
): Promise<DuplicateCheckResult> {
  const nameFilter = `and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%)`
  const orFilter = email
    ? `${nameFilter},email.ilike.%${email}%`
    : nameFilter

  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email, company_name')
    .or(orFilter)
    .eq('is_active', true)
    .limit(5)

  if (error) throw error

  const matches = (data ?? []) as DuplicateCheckResult['matches']
  return { isDuplicate: matches.length > 0, matches }
}

// ---------------------------------------------------------------------------
// Client Tags
// ---------------------------------------------------------------------------
export async function getClientTags(): Promise<ClientTag[]> {
  const { data, error } = await supabase
    .from('client_tags')
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as ClientTag[]
}

export async function createClientTag(
  name: string,
  color: string = '#6366f1',
): Promise<ClientTag> {
  const { data, error } = await supabase
    .from('client_tags')
    .insert({ name, color })
    .select()
    .single()

  if (error) throw error
  return data as ClientTag
}

export async function getClientTagAssignments(clientId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('client_tag_assignments')
    .select('tag_id')
    .eq('client_id', clientId)

  if (error) throw error
  return (data ?? []).map((d: { tag_id: string }) => d.tag_id)
}

export async function setClientTags(
  clientId: string,
  tagIds: string[],
): Promise<void> {
  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from('client_tag_assignments')
    .delete()
    .eq('client_id', clientId)

  if (deleteError) throw deleteError

  // Insert new assignments
  if (tagIds.length > 0) {
    const { error: insertError } = await supabase
      .from('client_tag_assignments')
      .insert(tagIds.map((tag_id) => ({ client_id: clientId, tag_id })))

    if (insertError) throw insertError
  }
}

// ---------------------------------------------------------------------------
// getAllClients - All clients without pagination (for CSV export)
// ---------------------------------------------------------------------------
export async function getAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('last_name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Client[]
}

// ---------------------------------------------------------------------------
// importClients - Bulk insert from CSV
// ---------------------------------------------------------------------------
export async function importClients(
  rows: ClientCsvRow[],
  createdBy: string,
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = []
  let inserted = 0

  // Insert in batches of 50
  const batchSize = 50
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => ({
      first_name: row.first_name,
      last_name: row.last_name,
      company_name: row.company_name || null,
      email: row.email || null,
      phone: row.phone || null,
      mobile: row.mobile || null,
      address_line1: row.address_line1,
      postal_code: row.postal_code,
      city: row.city,
      country: row.country || 'France',
      client_type: row.client_type as Client['client_type'],
      contract_type: row.contract_type as Client['contract_type'],
      notes: row.notes || null,
      is_active: true,
      eligible_tax_credit: true,
      tax_credit_percentage: 50,
      payment_terms_days: 30,
      sms_consent: false,
      newsletter_consent: false,
      extra_phones: [],
      extra_emails: [],
      birthdays: [],
      contract_hours: {},
      created_by: createdBy,
    }))

    const { data: insertedData, error } = await supabase
      .from('clients')
      .insert(batch)
      .select('id')

    if (error) {
      errors.push(`Lot ${Math.floor(i / batchSize) + 1}: ${error.message}`)
    } else {
      inserted += insertedData?.length ?? batch.length
    }
  }

  return { inserted, errors }
}
