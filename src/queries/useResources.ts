import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPersonnel,
  getAbsences,
  createAbsence,
  updateAbsenceStatus,
  getVehicles,
  getEquipment,
  updateVehicle,
  createVehicle,
  deleteVehicle,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  type AbsenceFilters,
} from '../services/resource.service'
import type { Absence, AbsenceStatus, Vehicle, Equipment } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const resourceKeys = {
  all: ['resources'] as const,
  personnel: () => [...resourceKeys.all, 'personnel'] as const,
  absences: () => [...resourceKeys.all, 'absences'] as const,
  absenceList: (filters: AbsenceFilters) => [...resourceKeys.absences(), 'list', filters] as const,
  vehicles: () => [...resourceKeys.all, 'vehicles'] as const,
  equipment: () => [...resourceKeys.all, 'equipment'] as const,
}

// ---------------------------------------------------------------------------
// usePersonnel - All active employees
// ---------------------------------------------------------------------------
export function usePersonnel() {
  return useQuery({
    queryKey: resourceKeys.personnel(),
    queryFn: getPersonnel,
    staleTime: 5 * 60 * 1000, // 5 minutes - personnel list changes infrequently
  })
}

// ---------------------------------------------------------------------------
// useAbsences - Filtered absence list
// ---------------------------------------------------------------------------
export function useAbsences(filters: AbsenceFilters = {}) {
  return useQuery({
    queryKey: resourceKeys.absenceList(filters),
    queryFn: () => getAbsences(filters),
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateAbsence
// ---------------------------------------------------------------------------
export function useCreateAbsence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      data: Omit<Absence, 'id' | 'created_at' | 'updated_at' | 'approved_by' | 'approved_at' | 'rejection_reason'>,
    ) => createAbsence(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.absences() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateAbsenceStatus - Approve or reject
// ---------------------------------------------------------------------------
export function useUpdateAbsenceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
      approvedBy,
      rejectionReason,
    }: {
      id: string
      status: AbsenceStatus
      approvedBy?: string
      rejectionReason?: string
    }) => updateAbsenceStatus(id, status, approvedBy, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.absences() })
    },
  })
}

// ---------------------------------------------------------------------------
// useVehicles - All active vehicles
// ---------------------------------------------------------------------------
export function useVehicles() {
  return useQuery({
    queryKey: resourceKeys.vehicles(),
    queryFn: getVehicles,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// ---------------------------------------------------------------------------
// useEquipment - All active equipment
// ---------------------------------------------------------------------------
export function useEquipment() {
  return useQuery({
    queryKey: resourceKeys.equipment(),
    queryFn: getEquipment,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// ---------------------------------------------------------------------------
// useUpdateVehicle
// ---------------------------------------------------------------------------
export function useUpdateVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>>
    }) => updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.vehicles() })
    },
  })
}

// ---------------------------------------------------------------------------
// useCreateVehicle
// ---------------------------------------------------------------------------
export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>) => createVehicle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.vehicles() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteVehicle
// ---------------------------------------------------------------------------
export function useDeleteVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.vehicles() })
    },
  })
}

// ---------------------------------------------------------------------------
// useCreateEquipment
// ---------------------------------------------------------------------------
export function useCreateEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>) => createEquipment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.equipment() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateEquipment
// ---------------------------------------------------------------------------
export function useUpdateEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Equipment, 'id' | 'created_at' | 'updated_at'>> }) => updateEquipment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.equipment() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteEquipment
// ---------------------------------------------------------------------------
export function useDeleteEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.equipment() })
    },
  })
}
