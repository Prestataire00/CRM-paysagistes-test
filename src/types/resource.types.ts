export type AbsenceType = 'conge_paye' | 'maladie' | 'rtt' | 'formation' | 'sans_solde' | 'autre'
export type AbsenceStatus = 'en_attente' | 'approuvee' | 'refusee'
export type VehicleStatus = 'disponible' | 'en_mission' | 'en_maintenance' | 'hors_service'
export type EquipmentStatus = 'disponible' | 'en_utilisation' | 'en_reparation' | 'hors_service'

export interface Absence {
  id: string
  profile_id: string
  absence_type: AbsenceType
  status: AbsenceStatus
  start_date: string
  end_date: string
  is_half_day_start: boolean
  is_half_day_end: boolean
  reason: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  document_url: string | null
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  registration_plate: string
  brand: string
  model: string
  vehicle_type: string | null
  status: VehicleStatus
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  mileage: number | null
  insurance_expiry: string | null
  insurance_provider: string | null
  assigned_team_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Equipment {
  id: string
  name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  category: string | null
  status: EquipmentStatus
  purchase_date: string | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  assigned_team_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
