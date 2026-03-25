import { supabase } from '../lib/supabase'
import type { User, Absence, AbsenceStatus, AbsenceType, Vehicle, Equipment } from '../types'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
export interface AbsenceFilters {
  profile_id?: string
  status?: AbsenceStatus
  absence_type?: AbsenceType
  date_from?: string
  date_to?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// getPersonnel - All active profiles (employees)
// ---------------------------------------------------------------------------
export async function getPersonnel(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      default_team:teams!default_team_id(id, name, color)
    `)
    .eq('is_active', true)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) throw error
  return (data ?? []) as User[]
}

// ---------------------------------------------------------------------------
// getAbsences - List absences with optional filters
// ---------------------------------------------------------------------------
export async function getAbsences(filters: AbsenceFilters = {}): Promise<Absence[]> {
  const { profile_id, status, absence_type, date_from, date_to } = filters

  let query = supabase
    .from('absences')
    .select(`
      *,
      profile:profiles!profile_id(id, first_name, last_name, role, avatar_url),
      approver:profiles!approved_by(id, first_name, last_name)
    `)

  if (profile_id) {
    query = query.eq('profile_id', profile_id)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (absence_type) {
    query = query.eq('absence_type', absence_type)
  }

  if (date_from) {
    query = query.gte('start_date', date_from)
  }

  if (date_to) {
    query = query.lte('end_date', date_to)
  }

  query = query
    .order('start_date', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as Absence[]
}

// ---------------------------------------------------------------------------
// createAbsence - Create a new absence request
// ---------------------------------------------------------------------------
export async function createAbsence(
  absenceData: Omit<Absence, 'id' | 'created_at' | 'updated_at' | 'approved_by' | 'approved_at' | 'rejection_reason'>,
): Promise<Absence> {
  const { data, error } = await supabase
    .from('absences')
    .insert({
      ...absenceData,
      status: 'en_attente', // Always start as pending
    })
    .select()
    .single()

  if (error) throw error
  return data as Absence
}

// ---------------------------------------------------------------------------
// updateAbsenceStatus - Approve or reject an absence request
// ---------------------------------------------------------------------------
export async function updateAbsenceStatus(
  id: string,
  status: AbsenceStatus,
  approvedBy?: string,
  rejectionReason?: string,
): Promise<Absence> {
  const updateData: Record<string, unknown> = { status }

  if (status === 'approuvee' && approvedBy) {
    updateData.approved_by = approvedBy
    updateData.approved_at = new Date().toISOString()
  }

  if (status === 'refusee' && rejectionReason) {
    updateData.rejection_reason = rejectionReason
    if (approvedBy) {
      updateData.approved_by = approvedBy
      updateData.approved_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('absences')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Absence
}

// ---------------------------------------------------------------------------
// getVehicles - All vehicles with maintenance alert info
// ---------------------------------------------------------------------------
export async function getVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      *,
      assigned_team:teams!assigned_team_id(id, name, color)
    `)
    .eq('is_active', true)
    .order('registration_plate', { ascending: true })

  if (error) throw error
  return (data ?? []) as Vehicle[]
}

// ---------------------------------------------------------------------------
// getEquipment - All active equipment
// ---------------------------------------------------------------------------
export async function getEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select(`
      *,
      assigned_team:teams!assigned_team_id(id, name, color)
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Equipment[]
}

// ---------------------------------------------------------------------------
// updateVehicle - Update vehicle information
// ---------------------------------------------------------------------------
export async function updateVehicle(
  id: string,
  vehicleData: Partial<Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update(vehicleData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Vehicle
}

// ---------------------------------------------------------------------------
// createVehicle - Create a new vehicle
// ---------------------------------------------------------------------------
export async function createVehicle(
  vehicleData: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>,
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicleData)
    .select()
    .single()
  if (error) throw error
  return data as Vehicle
}

// ---------------------------------------------------------------------------
// deleteVehicle - Soft delete
// ---------------------------------------------------------------------------
export async function deleteVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Vehicle
}

// ---------------------------------------------------------------------------
// createEquipment - Create new equipment
// ---------------------------------------------------------------------------
export async function createEquipment(
  equipmentData: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>,
): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .insert(equipmentData)
    .select()
    .single()
  if (error) throw error
  return data as Equipment
}

// ---------------------------------------------------------------------------
// updateEquipment - Update equipment information
// ---------------------------------------------------------------------------
export async function updateEquipment(
  id: string,
  equipmentData: Partial<Omit<Equipment, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .update(equipmentData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Equipment
}

// ---------------------------------------------------------------------------
// deleteEquipment - Soft delete
// ---------------------------------------------------------------------------
export async function deleteEquipment(id: string): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Equipment
}
