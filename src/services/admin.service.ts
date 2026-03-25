import { supabase } from '../lib/supabase'
import type { User, Role, AuditLog, Setting } from '../types'
import type { PaginatedResult } from './client.service'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface CreateUserInput {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  role: Role
}

export interface AuditLogFilters {
  profile_id?: string
  action?: string
  table_name?: string
  record_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// createUser - Create a new user via Edge Function
// ---------------------------------------------------------------------------
export async function createUser(input: CreateUserInput): Promise<User> {
  // Call edge function via raw fetch for better error handling
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(input),
    },
  )

  const body = await res.json()

  if (!res.ok) {
    throw new Error(body?.error || `Erreur ${res.status}`)
  }

  // Poll for the newly created profile (DB trigger creates it asynchronously)
  let profile = null
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 1000))
    const { data } = await supabase
      .from('profiles')
      .select('*, default_team:teams!default_team_id(id, name, color)')
      .eq('email', input.email)
      .maybeSingle()
    if (data) { profile = data; break }
  }

  if (!profile) throw new Error('Le profil n\'a pas pu être créé. Veuillez rafraîchir la page.')
  return profile as User
}

// ---------------------------------------------------------------------------
// getUsers - All users with their default team
// ---------------------------------------------------------------------------
export async function getUsers(): Promise<User[]> {
  // Try with team join first
  const { data, error } = await supabase
    .from('profiles')
    .select('*, default_team:teams!default_team_id(id, name, color)')
    .order('last_name', { ascending: true })

  if (!error && data) {
    return data as User[]
  }

  console.warn('[getUsers] Join query failed, trying without join:', error?.message)

  // Fallback without join
  const { data: fallback, error: fallbackError } = await supabase
    .from('profiles')
    .select('*')
    .order('last_name', { ascending: true })

  if (fallbackError) {
    console.error('[getUsers] Fallback also failed:', fallbackError.message)
    throw fallbackError
  }

  return (fallback ?? []) as User[]
}

// ---------------------------------------------------------------------------
// getUser - Single user with default team
// ---------------------------------------------------------------------------
export async function getUser(id: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, default_team:teams!default_team_id(id, name, color)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as User
}

// ---------------------------------------------------------------------------
// updateUserRole - Update a user's role
// ---------------------------------------------------------------------------
export async function updateUserRole(id: string, role: Role): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as User
}

// ---------------------------------------------------------------------------
// updateProfileTeam - Assign a user to a default team
// ---------------------------------------------------------------------------
export async function updateProfileTeam(profileId: string, defaultTeamId: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ default_team_id: defaultTeamId })
    .eq('id', profileId)
    .select('*, default_team:teams!default_team_id(id, name, color)')
    .single()

  if (error) throw error
  return data as User
}

// ---------------------------------------------------------------------------
// updateUserProfile - Update user profile fields (name, email, phone)
// ---------------------------------------------------------------------------
export async function updateUserProfile(
  id: string,
  fields: { first_name?: string; last_name?: string; email?: string; phone?: string | null },
): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', id)
    .select('*, default_team:teams!default_team_id(id, name, color)')
    .single()

  if (error) throw error
  return data as User
}

// ---------------------------------------------------------------------------
// deactivateUser - Soft deactivate (set is_active = false)
// ---------------------------------------------------------------------------
export async function deactivateUser(id: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as User
}

// ---------------------------------------------------------------------------
// getSettings - All settings, optional category filter
// ---------------------------------------------------------------------------
export async function getSettings(category?: string): Promise<Setting[]> {
  let query = supabase
    .from('settings')
    .select('*')

  if (category) {
    query = query.eq('category', category)
  }

  query = query
    .order('category', { ascending: true })
    .order('key', { ascending: true })

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as Setting[]
}

// ---------------------------------------------------------------------------
// getSettingsByCategory - All settings grouped by category
// ---------------------------------------------------------------------------
export async function getSettingsByCategory(): Promise<Record<string, Setting[]>> {
  const settings = await getSettings()

  return settings.reduce<Record<string, Setting[]>>((acc, setting) => {
    const cat = setting.category
    if (!acc[cat]) {
      acc[cat] = []
    }
    acc[cat].push(setting)
    return acc
  }, {})
}

// ---------------------------------------------------------------------------
// updateSetting - Update a single setting by key
// ---------------------------------------------------------------------------
export async function updateSetting(
  key: string,
  value: unknown,
  updatedBy: string,
): Promise<Setting> {
  const { data, error } = await supabase
    .from('settings')
    .update({ value, updated_by: updatedBy })
    .eq('key', key)
    .select()
    .single()

  if (error) throw error
  return data as Setting
}

// ---------------------------------------------------------------------------
// getAuditLogs - Paginated audit logs with profile join
// ---------------------------------------------------------------------------
export async function getAuditLogs(
  filters: AuditLogFilters = {},
): Promise<PaginatedResult<AuditLog>> {
  const { profile_id, action, table_name, record_id, date_from, date_to, search, page = 1, pageSize = 25 } = filters

  let query = supabase
    .from('audit_logs')
    .select('*, profile:profiles!profile_id(id, first_name, last_name, email)', { count: 'exact' })

  // Filters
  if (profile_id) {
    query = query.eq('profile_id', profile_id)
  }

  if (action) {
    query = query.eq('action', action)
  }

  if (table_name) {
    query = query.eq('table_name', table_name)
  }

  if (record_id) {
    query = query.eq('record_id', record_id)
  }

  if (search) {
    query = query.or(
      `table_name.ilike.%${search}%,action.ilike.%${search}%,record_id.ilike.%${search}%`
    )
  }

  if (date_from) {
    query = query.gte('created_at', date_from)
  }

  if (date_to) {
    query = query.lte('created_at', date_to)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []) as AuditLog[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

// ---------------------------------------------------------------------------
// getRecordHistory - All audit entries for a specific record
// ---------------------------------------------------------------------------
export async function getRecordHistory(
  tableName: string,
  recordId: string,
  limit: number = 50,
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, profile:profiles!profile_id(id, first_name, last_name, email)')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as AuditLog[]
}
