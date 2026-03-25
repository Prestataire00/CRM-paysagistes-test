import { supabase } from '../lib/supabase'
import type { Prospect, PipelineStage, Client, CommercialActivity } from '../types'
import type { ProspectScoringConfig } from '../types'
import type { PaginatedResult } from './client.service'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface ProspectFilters {
  search?: string
  pipeline_stage?: PipelineStage
  assigned_commercial_id?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// getProspects - Paginated list with optional filters
// ---------------------------------------------------------------------------
export async function getProspects(
  filters: ProspectFilters = {},
): Promise<PaginatedResult<Prospect>> {
  const { search, pipeline_stage, assigned_commercial_id, page = 1, pageSize = 25 } = filters

  let query = supabase
    .from('prospects')
    .select('*', { count: 'exact' })

  // Filters
  if (pipeline_stage) {
    query = query.eq('pipeline_stage', pipeline_stage)
  }

  if (assigned_commercial_id) {
    query = query.eq('assigned_commercial_id', assigned_commercial_id)
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
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []) as Prospect[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

// ---------------------------------------------------------------------------
// getProspectsByStage - Prospects grouped by pipeline stage with limits
// ---------------------------------------------------------------------------
export interface ProspectsByStageResult {
  cards: Record<PipelineStage, Prospect[]>
  counts: Record<PipelineStage, number>
}

export async function getProspectsByStage(
  limitPerStage: number = 20,
): Promise<ProspectsByStageResult> {
  const stages: PipelineStage[] = ['nouveau', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu']

  // Run one query per stage in parallel: get top N cards + count
  const results = await Promise.all(
    stages.map((stage) =>
      supabase
        .from('prospects')
        .select('*', { count: 'exact' })
        .eq('pipeline_stage', stage)
        .order('created_at', { ascending: false })
        .limit(limitPerStage),
    ),
  )

  const cards = {} as Record<PipelineStage, Prospect[]>
  const counts = {} as Record<PipelineStage, number>

  stages.forEach((stage, i) => {
    if (results[i].error) throw results[i].error
    cards[stage] = (results[i].data ?? []) as Prospect[]
    counts[stage] = results[i].count ?? 0
  })

  return { cards, counts }
}

// ---------------------------------------------------------------------------
// getProspect - Single prospect with assigned commercial profile
// ---------------------------------------------------------------------------
export async function getProspect(id: string): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*, assigned_commercial:profiles!assigned_commercial_id(id, first_name, last_name, email)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Prospect
}

// ---------------------------------------------------------------------------
// createProspect
// ---------------------------------------------------------------------------
export async function createProspect(
  prospectData: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>,
): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .insert(prospectData)
    .select()
    .single()

  if (error) throw error
  return data as Prospect
}

// ---------------------------------------------------------------------------
// updateProspect
// ---------------------------------------------------------------------------
export async function updateProspect(
  id: string,
  prospectData: Partial<Omit<Prospect, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .update(prospectData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Prospect
}

// ---------------------------------------------------------------------------
// moveProspectStage - Update only the pipeline_stage
// ---------------------------------------------------------------------------
export async function moveProspectStage(
  id: string,
  newStage: PipelineStage,
): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .update({ pipeline_stage: newStage })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Prospect
}

// ---------------------------------------------------------------------------
// deleteProspect - Hard delete
// ---------------------------------------------------------------------------
export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// getAllProspects - All prospects without pagination (for Excel export)
// ---------------------------------------------------------------------------
export async function getAllProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*, assigned_commercial:profiles!assigned_commercial_id(id, first_name, last_name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Prospect[]
}

// ---------------------------------------------------------------------------
// importProspects - Bulk insert from CSV
// ---------------------------------------------------------------------------
export interface ProspectCsvRow {
  first_name: string
  last_name: string
  company_name?: string
  email?: string
  phone?: string
  mobile?: string
  client_type?: string
  source?: string
  pipeline_stage?: string
  estimated_value?: string
  probability?: string
  notes?: string
}

export async function importProspects(
  rows: ProspectCsvRow[],
  createdBy: string,
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = []
  let inserted = 0

  const batchSize = 50
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => ({
      first_name: row.first_name,
      last_name: row.last_name,
      company_name: row.company_name || null,
      email: row.email || null,
      phone: row.phone || null,
      mobile: row.mobile || null,
      client_type: (row.client_type || 'particulier') as Prospect['client_type'],
      source: row.source || null,
      pipeline_stage: (row.pipeline_stage || 'nouveau') as PipelineStage,
      estimated_value: row.estimated_value ? parseFloat(row.estimated_value) : null,
      probability: row.probability ? parseInt(row.probability, 10) : null,
      notes: row.notes || null,
      created_by: createdBy,
    }))

    const { data: insertedData, error } = await supabase
      .from('prospects')
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

// ---------------------------------------------------------------------------
// getProspectsByStageEnriched - Enriched Kanban data with commercial + activity count
// ---------------------------------------------------------------------------
export interface EnrichedProspect extends Prospect {
  activity_count: number
  assigned_commercial: { id: string; first_name: string; last_name: string } | null
}

export interface EnrichedProspectsByStageResult {
  cards: Record<PipelineStage, EnrichedProspect[]>
  counts: Record<PipelineStage, number>
}

export async function getProspectsByStageEnriched(
  limitPerStage: number = 30,
): Promise<EnrichedProspectsByStageResult> {
  const stages: PipelineStage[] = ['nouveau', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu']

  const results = await Promise.all(
    stages.map((stage) =>
      supabase
        .from('prospects')
        .select(`
          *,
          assigned_commercial:profiles!assigned_commercial_id(id, first_name, last_name)
        `, { count: 'exact' })
        .eq('pipeline_stage', stage)
        .order('created_at', { ascending: false })
        .limit(limitPerStage),
    ),
  )

  // Collect all prospect IDs for batch activity count
  const allProspectIds: string[] = []
  for (const result of results) {
    if (result.data) {
      for (const prospect of result.data) {
        allProspectIds.push((prospect as { id: string }).id)
      }
    }
  }

  // Fetch activity counts in one query
  const activityCounts: Record<string, number> = {}
  if (allProspectIds.length > 0) {
    const { data: activities } = await supabase
      .from('commercial_activities')
      .select('prospect_id')
      .in('prospect_id', allProspectIds)

    if (activities) {
      for (const act of activities) {
        const pid = (act as { prospect_id: string }).prospect_id
        if (pid) {
          activityCounts[pid] = (activityCounts[pid] ?? 0) + 1
        }
      }
    }
  }

  const cards = {} as Record<PipelineStage, EnrichedProspect[]>
  const counts = {} as Record<PipelineStage, number>

  stages.forEach((stage, i) => {
    if (results[i].error) throw results[i].error
    cards[stage] = (results[i].data ?? []).map((p) => ({
      ...(p as Prospect & { assigned_commercial: EnrichedProspect['assigned_commercial'] }),
      activity_count: activityCounts[(p as { id: string }).id] ?? 0,
    }))
    counts[stage] = results[i].count ?? 0
  })

  return { cards, counts }
}

// ---------------------------------------------------------------------------
// getProspectActivities - Activity timeline for a prospect
// ---------------------------------------------------------------------------
export async function getProspectActivities(
  prospectId: string,
  limit: number = 20,
): Promise<CommercialActivity[]> {
  const { data, error } = await supabase
    .from('commercial_activities')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as CommercialActivity[]
}

// ---------------------------------------------------------------------------
// createProspectActivity - Log a commercial activity on a prospect
// ---------------------------------------------------------------------------
export async function createProspectActivity(
  activityData: {
    prospect_id: string
    activity_type: CommercialActivity['activity_type']
    subject: string
    description?: string | null
    is_completed?: boolean
    assigned_to: string
    created_by: string
  },
): Promise<CommercialActivity> {
  const { data, error } = await supabase
    .from('commercial_activities')
    .insert({
      ...activityData,
      is_completed: activityData.is_completed ?? true,
      completed_at: activityData.is_completed !== false ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) throw error
  return data as CommercialActivity
}

// ---------------------------------------------------------------------------
// getScoringConfig - Pipeline scoring configuration from settings
// ---------------------------------------------------------------------------
export async function getScoringConfig(): Promise<ProspectScoringConfig> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_scoring_config')
    .single()

  if (error) {
    // Return defaults if setting doesn't exist
    return {
      weights: { estimated_value: 25, probability: 25, activity_frequency: 25, recency: 25 },
      thresholds: { high_value: 10000, high_probability: 70, active_frequency_days: 7, recent_activity_days: 3 },
      inactivity_alert_days: 7,
      stage_age_reminders: { nouveau: 3, qualification: 5, proposition: 7, negociation: 10 },
    }
  }
  return data.value as ProspectScoringConfig
}

// ---------------------------------------------------------------------------
// convertToClient - Create a Client from Prospect data, mark as converted
// ---------------------------------------------------------------------------
export async function convertToClient(prospectId: string): Promise<Client> {
  // 1. Fetch the prospect
  const { data: prospect, error: fetchError } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', prospectId)
    .single()

  if (fetchError) throw fetchError
  if (!prospect) throw new Error('Prospect not found')

  const p = prospect as Prospect

  // 2. Create the client from prospect data
  const { data: client, error: insertError } = await supabase
    .from('clients')
    .insert({
      company_name: p.company_name,
      client_type: p.client_type,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      mobile: p.mobile,
      address_line1: p.address_line1 ?? '',
      address_line2: p.address_line2,
      postal_code: p.postal_code ?? '',
      city: p.city ?? '',
      country: p.country ?? 'France',
      latitude: p.latitude,
      longitude: p.longitude,
      geographic_zone: p.geographic_zone,
      notes: p.notes,
      assigned_commercial_id: p.assigned_commercial_id,
      created_by: p.created_by,
      is_active: true,
    })
    .select()
    .single()

  if (insertError) throw insertError

  // 3. Update the prospect with conversion info and set stage to 'gagne'
  const { error: updateError } = await supabase
    .from('prospects')
    .update({
      converted_to_client_id: (client as Client).id,
      converted_at: new Date().toISOString(),
      pipeline_stage: 'gagne' as PipelineStage,
    })
    .eq('id', prospectId)

  if (updateError) throw updateError

  return client as Client
}
