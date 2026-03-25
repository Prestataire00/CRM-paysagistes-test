import { supabase } from '../lib/supabase'
import type { PlanningSlot, Team, TeamMember, Chantier, ChantierTask, InterventionType, ChantierColorType, InterventionEmargement, SignatureType } from '../types'
import type { Absence, Vehicle, Equipment } from '../types/resource.types'

// ---------------------------------------------------------------------------
// getWeeklyPlanning - All planning slots for a given week
// weekStart should be a Monday date string (YYYY-MM-DD)
// ---------------------------------------------------------------------------
export async function getWeeklyPlanning(weekStart: string): Promise<PlanningSlot[]> {
  // Calculate the Sunday end of the week
  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const weekEnd = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('planning_slots')
    .select(`
      *,
      chantier:chantiers!chantier_id(
        id, reference, title, description, client_id, address_line1, city,
        intervention_type, status, estimated_duration_minutes, contact_status, geographic_zone,
        client:clients!client_id(id, first_name, last_name, company_name, phone, mobile),
        tasks:chantier_tasks(id, title, is_completed)
      ),
      team:teams!team_id(id, name, color)
    `)
    .gte('slot_date', weekStart)
    .lte('slot_date', weekEnd)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data ?? []) as PlanningSlot[]
}

// ---------------------------------------------------------------------------
// getMonthlyPlanning - All planning slots for a given month
// ---------------------------------------------------------------------------
export async function getMonthlyPlanning(year: number, month: number): Promise<PlanningSlot[]> {
  // month is 0-indexed (0 = January)
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const monthStart = firstDay.toISOString().split('T')[0]
  const monthEnd = lastDay.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('planning_slots')
    .select(`
      *,
      chantier:chantiers!chantier_id(
        id, reference, title, description, client_id, address_line1, city,
        intervention_type, status, estimated_duration_minutes, contact_status, geographic_zone,
        client:clients!client_id(id, first_name, last_name, company_name, phone, mobile),
        tasks:chantier_tasks(id, title, is_completed)
      ),
      team:teams!team_id(id, name, color)
    `)
    .gte('slot_date', monthStart)
    .lte('slot_date', monthEnd)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data ?? []) as PlanningSlot[]
}

// ---------------------------------------------------------------------------
// moveIntervention - Reassign a planning slot to a different team and/or date
// ---------------------------------------------------------------------------
export async function moveIntervention(
  slotId: string,
  newTeamId: string,
  newDate: string,
): Promise<PlanningSlot> {
  const { data, error } = await supabase
    .from('planning_slots')
    .update({
      team_id: newTeamId,
      slot_date: newDate,
    })
    .eq('id', slotId)
    .eq('is_locked', false) // Only move unlocked slots
    .select(`
      *,
      chantier:chantiers!chantier_id(id, reference, title, client_id, intervention_type, status),
      team:teams!team_id(id, name, color)
    `)
    .single()

  if (error) throw error
  return data as PlanningSlot
}

// ---------------------------------------------------------------------------
// createPlanningSlot
// ---------------------------------------------------------------------------
export async function createPlanningSlot(
  slotData: Omit<PlanningSlot, 'id' | 'created_at' | 'updated_at' | 'chantier' | 'team'>,
): Promise<PlanningSlot> {
  const { data, error } = await supabase
    .from('planning_slots')
    .insert(slotData)
    .select(`
      *,
      chantier:chantiers!chantier_id(id, reference, title, client_id, intervention_type, status),
      team:teams!team_id(id, name, color)
    `)
    .single()

  if (error) throw error
  return data as PlanningSlot
}

// ---------------------------------------------------------------------------
// deletePlanningSlot
// ---------------------------------------------------------------------------
export async function deletePlanningSlot(id: string): Promise<void> {
  const { error } = await supabase
    .from('planning_slots')
    .delete()
    .eq('id', id)
    .eq('is_locked', false) // Only delete unlocked slots

  if (error) throw error
}

// ---------------------------------------------------------------------------
// getTeams - All active teams with their members
// ---------------------------------------------------------------------------
export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      members:team_members(
        id, is_team_leader, joined_at,
        profile:profiles!profile_id(id, first_name, last_name, role, avatar_url)
      )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Team[]
}

// ---------------------------------------------------------------------------
// getUnplannedChantiers - Chantiers that have no planning slots yet
// Only includes chantiers with status 'planifiee' (scheduled but not planned)
// ---------------------------------------------------------------------------
export async function getUnplannedChantiers(): Promise<Chantier[]> {
  // Fetch all planifiee chantiers with their planning_slots relation
  // Then filter client-side (PostgREST .is() on relations is unreliable)
  const { data, error } = await supabase
    .from('chantiers')
    .select(`
      *,
      client:clients!client_id(id, first_name, last_name, company_name),
      planning_slots(id)
    `)
    .eq('status', 'planifiee')
    .order('priority', { ascending: true })
    .order('scheduled_date', { ascending: true })

  if (error) throw error

  // Keep only chantiers with no planning slots
  const unplanned = (data ?? []).filter(
    (ch) => !ch.planning_slots || ch.planning_slots.length === 0,
  )
  return unplanned as unknown as Chantier[]
}

// ---------------------------------------------------------------------------
// searchClients - Search clients by name for autocomplete
// ---------------------------------------------------------------------------
export interface ClientSearchResult {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
  address_line1: string
  postal_code: string
  city: string
  phone: string | null
  mobile: string | null
}

export async function searchClients(query: string): Promise<ClientSearchResult[]> {
  if (!query || query.length < 2) return []

  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, address_line1, postal_code, city, phone, mobile')
    .eq('is_active', true)
    .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,company_name.ilike.%${query}%`)
    .order('last_name', { ascending: true })
    .limit(10)

  if (error) throw error
  return (data ?? []) as ClientSearchResult[]
}

// ---------------------------------------------------------------------------
// createFullIntervention - Create chantier + planning slot in one operation
// ---------------------------------------------------------------------------
export interface CreateInterventionInput {
  title: string
  client_id: string
  address_line1: string
  postal_code: string
  city: string
  intervention_type: InterventionType
  team_id: string
  slot_date: string
  start_time: string
  end_time: string
  priority: number
  estimated_duration_minutes: number | null
  color: ChantierColorType
  description: string | null
}

export async function createFullIntervention(input: CreateInterventionInput): Promise<PlanningSlot> {
  // 1. Create the chantier
  const { data: chantier, error: chantierError } = await supabase
    .from('chantiers')
    .insert({
      title: input.title,
      client_id: input.client_id,
      address_line1: input.address_line1,
      postal_code: input.postal_code,
      city: input.city,
      intervention_type: input.intervention_type,
      status: 'planifiee' as const,
      priority: input.priority,
      estimated_duration_minutes: input.estimated_duration_minutes,
      description: input.description,
      scheduled_date: input.slot_date,
      scheduled_start_time: input.start_time,
      scheduled_end_time: input.end_time,
      assigned_team_id: input.team_id,
    })
    .select('id')
    .single()

  if (chantierError) throw chantierError

  // 2. Create the planning slot
  const { data: slot, error: slotError } = await supabase
    .from('planning_slots')
    .insert({
      chantier_id: chantier.id,
      team_id: input.team_id,
      slot_date: input.slot_date,
      start_time: input.start_time,
      end_time: input.end_time,
      color: input.color,
      is_locked: false,
      planned_by: null,
    })
    .select(`
      *,
      chantier:chantiers!chantier_id(id, reference, title, client_id, intervention_type, status,
        client:clients!client_id(id, first_name, last_name, company_name)
      ),
      team:teams!team_id(id, name, color)
    `)
    .single()

  if (slotError) throw slotError
  return slot as PlanningSlot
}

// ---------------------------------------------------------------------------
// getChantier - Single chantier with tasks
// ---------------------------------------------------------------------------
export async function getChantier(id: string): Promise<Chantier & { tasks: ChantierTask[] }> {
  const { data, error } = await supabase
    .from('chantiers')
    .select(`
      *,
      client:clients!client_id(id, first_name, last_name, company_name, phone, mobile, address_line1, city),
      assigned_team:teams!assigned_team_id(id, name, color),
      tasks:chantier_tasks(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  // Sort tasks by sort_order
  if (data.tasks) {
    data.tasks.sort((a: ChantierTask, b: ChantierTask) => a.sort_order - b.sort_order)
  }

  return data as Chantier & { tasks: ChantierTask[] }
}

// ---------------------------------------------------------------------------
// updateChantierTasks - Batch update task completion status
// ---------------------------------------------------------------------------
export async function updateChantierTasks(
  chantierId: string,
  tasks: Array<{ id: string; is_completed: boolean; completed_by?: string | null }>,
): Promise<ChantierTask[]> {
  // Use Promise.all to update each task individually
  const results = await Promise.all(
    tasks.map(async (task) => {
      const updateData: Record<string, unknown> = {
        is_completed: task.is_completed,
      }

      if (task.is_completed) {
        updateData.completed_at = new Date().toISOString()
        if (task.completed_by) {
          updateData.completed_by = task.completed_by
        }
      } else {
        updateData.completed_at = null
        updateData.completed_by = null
      }

      const { data, error } = await supabase
        .from('chantier_tasks')
        .update(updateData)
        .eq('id', task.id)
        .eq('chantier_id', chantierId)
        .select()
        .single()

      if (error) throw error
      return data
    }),
  )

  return results as ChantierTask[]
}

// ---------------------------------------------------------------------------
// getSlotEmargements - Get all emargements for a planning slot
// ---------------------------------------------------------------------------
export async function getSlotEmargements(slotId: string): Promise<InterventionEmargement[]> {
  const { data, error } = await supabase
    .from('intervention_emargements')
    .select(`
      *,
      profile:profiles!profile_id(id, first_name, last_name, avatar_url)
    `)
    .eq('planning_slot_id', slotId)
    .order('signed_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as InterventionEmargement[]
}

// ---------------------------------------------------------------------------
// signEmargement - Create an emargement entry (arrivee or depart)
// ---------------------------------------------------------------------------
export async function signEmargement(data: {
  planning_slot_id: string
  profile_id: string
  signature_type: SignatureType
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
}): Promise<InterventionEmargement> {
  const { data: emargement, error } = await supabase
    .from('intervention_emargements')
    .insert({
      planning_slot_id: data.planning_slot_id,
      profile_id: data.profile_id,
      signature_type: data.signature_type,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: data.notes ?? null,
    })
    .select(`
      *,
      profile:profiles!profile_id(id, first_name, last_name, avatar_url)
    `)
    .single()

  if (error) throw error
  return emargement as InterventionEmargement
}

// ---------------------------------------------------------------------------
// getWeekAbsences - Approved absences overlapping a given week
// ---------------------------------------------------------------------------
export async function getWeekAbsences(weekStart: string, weekEnd: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from('absences')
    .select(`
      *,
      profile:profiles!profile_id(id, first_name, last_name, avatar_url)
    `)
    .eq('status', 'approuvee')
    .lte('start_date', weekEnd)
    .gte('end_date', weekStart)
    .order('start_date', { ascending: true })

  if (error) throw error
  return (data ?? []) as Absence[]
}

// ---------------------------------------------------------------------------
// getTeamEquipment - Vehicles and equipment assigned to given teams
// ---------------------------------------------------------------------------
export interface TeamEquipmentResult {
  vehicles: Vehicle[]
  equipment: Equipment[]
}

export async function getTeamEquipment(teamIds: string[]): Promise<TeamEquipmentResult> {
  if (teamIds.length === 0) return { vehicles: [], equipment: [] }

  const [vehiclesRes, equipmentRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('*')
      .in('assigned_team_id', teamIds)
      .eq('is_active', true),
    supabase
      .from('equipment')
      .select('*')
      .in('assigned_team_id', teamIds)
      .eq('is_active', true),
  ])

  if (vehiclesRes.error) throw vehiclesRes.error
  if (equipmentRes.error) throw equipmentRes.error

  return {
    vehicles: (vehiclesRes.data ?? []) as Vehicle[],
    equipment: (equipmentRes.data ?? []) as Equipment[],
  }
}

// ---------------------------------------------------------------------------
// getAnnualSlotCounts - Count of planning slots per day for a full year
// ---------------------------------------------------------------------------
export async function getAnnualSlotCounts(year: number): Promise<Record<string, number>> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { data, error } = await supabase
    .from('planning_slots')
    .select('slot_date')
    .gte('slot_date', yearStart)
    .lte('slot_date', yearEnd)

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.slot_date] = (counts[row.slot_date] || 0) + 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// postponeChantier - Push a chantier's scheduled date by N days
// ---------------------------------------------------------------------------
export async function postponeChantier(id: string, days: number): Promise<void> {
  const { data: chantier, error: fetchError } = await supabase
    .from('chantiers')
    .select('scheduled_date')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const current = chantier.scheduled_date ? new Date(chantier.scheduled_date) : new Date()
  current.setDate(current.getDate() + days)
  const newDate = current.toISOString().split('T')[0]

  const { error } = await supabase
    .from('chantiers')
    .update({ scheduled_date: newDate })
    .eq('id', id)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// getPersonnelWithAbsences - All active profiles with today's absence status
// ---------------------------------------------------------------------------
export interface PersonnelWithAbsence {
  id: string
  first_name: string
  last_name: string
  role: string
  avatar_url: string | null
  default_team_id: string | null
  absence_today: Absence | null
}

export async function getPersonnelWithAbsences(date: string): Promise<PersonnelWithAbsence[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, avatar_url, default_team_id')
    .eq('is_active', true)
    .order('last_name', { ascending: true })

  if (profilesError) throw profilesError

  const { data: absences, error: absencesError } = await supabase
    .from('absences')
    .select('*')
    .eq('status', 'approuvee')
    .lte('start_date', date)
    .gte('end_date', date)

  if (absencesError) throw absencesError

  const absenceMap = new Map<string, Absence>()
  for (const a of absences ?? []) {
    absenceMap.set(a.profile_id, a as Absence)
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    absence_today: absenceMap.get(p.id) ?? null,
  })) as PersonnelWithAbsence[]
}

// ---------------------------------------------------------------------------
// TEAM MANAGEMENT — CRUD operations
// ---------------------------------------------------------------------------

// createTeam
export async function createTeam(data: {
  name: string
  color: string
  leader_id?: string | null
  default_vehicle_id?: string | null
}): Promise<Team> {
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      name: data.name,
      color: data.color,
      leader_id: data.leader_id ?? null,
      default_vehicle_id: data.default_vehicle_id ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return team as Team
}

// updateTeam
export async function updateTeam(
  id: string,
  data: { name?: string; color?: string; leader_id?: string | null; default_vehicle_id?: string | null },
): Promise<Team> {
  const { data: team, error } = await supabase
    .from('teams')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return team as Team
}

// deleteTeam (soft delete)
export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw error
}

// addTeamMember
export async function addTeamMember(
  teamId: string,
  profileId: string,
  isTeamLeader = false,
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      profile_id: profileId,
      is_team_leader: isTeamLeader,
    })
    .select()
    .single()

  if (error) throw error
  return data as TeamMember
}

// removeTeamMember
export async function removeTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId)

  if (error) throw error
}

// updateTeamMember (toggle leader)
export async function updateTeamMember(
  memberId: string,
  data: { is_team_leader: boolean },
): Promise<TeamMember> {
  const { data: member, error } = await supabase
    .from('team_members')
    .update(data)
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw error
  return member as TeamMember
}

// ---------------------------------------------------------------------------
// MOBILE — Chantier notes & photos
// ---------------------------------------------------------------------------

export async function updateChantierNotes(chantierId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('chantiers')
    .update({ completion_notes: notes })
    .eq('id', chantierId)

  if (error) throw error
}

export async function uploadChantierPhoto(chantierId: string, file: File, photoType: 'avant' | 'apres' | 'general' = 'general'): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `chantiers/${chantierId}/photos/${photoType}_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type })
  if (uploadError) throw uploadError

  // Append path to completion_photos array
  const { data: chantier, error: fetchError } = await supabase
    .from('chantiers')
    .select('completion_photos')
    .eq('id', chantierId)
    .single()
  if (fetchError) throw fetchError

  const existing: string[] = (chantier?.completion_photos as string[] | null) ?? []
  const { error: updateError } = await supabase
    .from('chantiers')
    .update({ completion_photos: [...existing, path] })
    .eq('id', chantierId)
  if (updateError) throw updateError

  return path
}

export async function uploadClientSignature(chantierId: string, blob: Blob): Promise<string> {
  const path = `chantiers/${chantierId}/signature_${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, blob, { contentType: 'image/png' })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase
    .from('chantiers')
    .update({ client_signature_url: path })
    .eq('id', chantierId)
  if (updateError) throw updateError

  return path
}
