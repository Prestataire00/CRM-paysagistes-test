import { supabase } from '../lib/supabase'
import type { Chantier, InterventionStatus, InterventionType } from '../types'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface InterventionFilters {
  status?: InterventionStatus
  intervention_type?: InterventionType
  assigned_team_id?: string
  date_from?: string
  date_to?: string
  search?: string
}

// ---------------------------------------------------------------------------
// Enriched chantier with joined data for list display
// ---------------------------------------------------------------------------
export interface InterventionListItem extends Omit<Chantier, 'client' | 'assigned_team' | 'tasks'> {
  client?: {
    id: string
    first_name: string
    last_name: string
    company_name: string | null
  } | null
  assigned_team?: {
    id: string
    name: string
    color: string
  } | null
  tasks?: Array<{ id: string; is_completed: boolean }>
}

// ---------------------------------------------------------------------------
// getInterventions - Fetch chantiers with filters + joined data
// ---------------------------------------------------------------------------
export async function getInterventions(
  filters: InterventionFilters = {},
): Promise<InterventionListItem[]> {
  let query = supabase
    .from('chantiers')
    .select(`
      *,
      client:clients!client_id(id, first_name, last_name, company_name),
      assigned_team:teams!assigned_team_id(id, name, color),
      tasks:chantier_tasks(id, is_completed)
    `)
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.intervention_type) {
    query = query.eq('intervention_type', filters.intervention_type)
  }

  if (filters.assigned_team_id) {
    query = query.eq('assigned_team_id', filters.assigned_team_id)
  }

  if (filters.date_from) {
    query = query.gte('scheduled_date', filters.date_from)
  }

  if (filters.date_to) {
    query = query.lte('scheduled_date', filters.date_to)
  }

  if (filters.search) {
    const s = filters.search.trim()
    query = query.or(
      `reference.ilike.%${s}%,title.ilike.%${s}%,city.ilike.%${s}%,address_line1.ilike.%${s}%`,
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as InterventionListItem[]
}

// ---------------------------------------------------------------------------
// updateInterventionStatus - Quick status change
// ---------------------------------------------------------------------------
export async function updateInterventionStatus(
  id: string,
  status: InterventionStatus,
): Promise<Chantier> {
  const updates: Record<string, unknown> = { status }
  if (status === 'terminee') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('chantiers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Lock associated planning slots when intervention is completed
  if (status === 'terminee') {
    await supabase
      .from('planning_slots')
      .update({ is_locked: true })
      .eq('chantier_id', id)
  }

  return data as Chantier
}

// ---------------------------------------------------------------------------
// updateInterventionTeam - Quick team assignment
// ---------------------------------------------------------------------------
export async function updateInterventionTeam(
  id: string,
  teamId: string | null,
): Promise<Chantier> {
  const { data, error } = await supabase
    .from('chantiers')
    .update({ assigned_team_id: teamId })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Chantier
}
