import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWeeklyPlanning,
  getMonthlyPlanning,
  moveIntervention,
  createPlanningSlot,
  deletePlanningSlot,
  getTeams,
  getUnplannedChantiers,
  getChantier,
  updateChantierTasks,
  searchClients,
  createFullIntervention,
  getSlotEmargements,
  signEmargement,
  getWeekAbsences,
  getTeamEquipment,
  getAnnualSlotCounts,
  postponeChantier,
  getPersonnelWithAbsences,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMember,
  updateChantierNotes,
  uploadChantierPhoto,
  uploadClientSignature,
} from '../services/planning.service'
import type { CreateInterventionInput } from '../services/planning.service'
import type { PlanningSlot, SignatureType } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const planningKeys = {
  all: ['planning'] as const,
  weekly: (weekStart: string) => [...planningKeys.all, 'weekly', weekStart] as const,
  monthly: (year: number, month: number) => [...planningKeys.all, 'monthly', year, month] as const,
  teams: () => [...planningKeys.all, 'teams'] as const,
  unplanned: () => [...planningKeys.all, 'unplanned'] as const,
  chantier: (id: string) => [...planningKeys.all, 'chantier', id] as const,
  clientSearch: (query: string) => [...planningKeys.all, 'clientSearch', query] as const,
  emargements: (slotId: string) => [...planningKeys.all, 'emargements', slotId] as const,
  weekAbsences: (weekStart: string) => [...planningKeys.all, 'weekAbsences', weekStart] as const,
  teamEquipment: (teamIds: string[]) => [...planningKeys.all, 'teamEquipment', ...teamIds] as const,
  annualCounts: (year: number) => [...planningKeys.all, 'annualCounts', year] as const,
  personnel: (date: string) => [...planningKeys.all, 'personnel', date] as const,
}

// ---------------------------------------------------------------------------
// useWeeklyPlanning - All planning slots for a given week
// ---------------------------------------------------------------------------
export function useWeeklyPlanning(weekStart: string) {
  return useQuery({
    queryKey: planningKeys.weekly(weekStart),
    queryFn: () => getWeeklyPlanning(weekStart),
    enabled: !!weekStart,
    staleTime: 15 * 1000, // 15 seconds - planning data changes frequently
    retry: 1,
  })
}

// ---------------------------------------------------------------------------
// useMonthlyPlanning - All planning slots for a given month
// ---------------------------------------------------------------------------
export function useMonthlyPlanning(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: planningKeys.monthly(year, month),
    queryFn: () => getMonthlyPlanning(year, month),
    staleTime: 30 * 1000,
    enabled,
  })
}

// ---------------------------------------------------------------------------
// useMoveIntervention - Drag & drop slot reassignment with optimistic updates
// ---------------------------------------------------------------------------
export function useMoveIntervention() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      slotId,
      newTeamId,
      newDate,
    }: {
      slotId: string
      newTeamId: string
      newDate: string
      weekStart: string // Used for cache key identification
    }) => moveIntervention(slotId, newTeamId, newDate),

    // Optimistic update: immediately update the local cache before the server responds
    onMutate: async (variables) => {
      const { slotId, newTeamId, newDate, weekStart } = variables

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: planningKeys.weekly(weekStart) })

      // Snapshot the previous value for rollback
      const previousSlots = queryClient.getQueryData<PlanningSlot[]>(
        planningKeys.weekly(weekStart),
      )

      // Optimistically update the slot in cache
      if (previousSlots) {
        const updatedSlots = previousSlots.map((slot) => {
          if (slot.id === slotId) {
            return {
              ...slot,
              team_id: newTeamId,
              slot_date: newDate,
            }
          }
          return slot
        })
        queryClient.setQueryData(planningKeys.weekly(weekStart), updatedSlots)
      }

      return { previousSlots, weekStart }
    },

    // If the mutation fails, roll back to the previous value
    onError: (_error, _variables, context) => {
      if (context?.previousSlots) {
        queryClient.setQueryData(
          planningKeys.weekly(context.weekStart),
          context.previousSlots,
        )
      }
    },

    // Always refetch after error or success to ensure cache is in sync
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: planningKeys.weekly(variables.weekStart),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useCreatePlanningSlot
// ---------------------------------------------------------------------------
export function useCreatePlanningSlot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      data: Omit<PlanningSlot, 'id' | 'created_at' | 'updated_at' | 'chantier' | 'team'>,
    ) => createPlanningSlot(data),
    onSuccess: () => {
      // Invalidate all planning queries and unplanned list
      queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeletePlanningSlot
// ---------------------------------------------------------------------------
export function useDeletePlanningSlot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deletePlanningSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useTeams - All active teams with members
// ---------------------------------------------------------------------------
export function useTeams() {
  return useQuery({
    queryKey: planningKeys.teams(),
    queryFn: getTeams,
    staleTime: 5 * 60 * 1000, // 5 minutes - teams change infrequently
    retry: 1,
  })
}

// ---------------------------------------------------------------------------
// useUnplannedChantiers - Chantiers not yet assigned to a planning slot
// ---------------------------------------------------------------------------
export function useUnplannedChantiers() {
  return useQuery({
    queryKey: planningKeys.unplanned(),
    queryFn: getUnplannedChantiers,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useSearchClients - Client autocomplete search
// ---------------------------------------------------------------------------
export function useSearchClients(query: string) {
  return useQuery({
    queryKey: planningKeys.clientSearch(query),
    queryFn: () => searchClients(query),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

// ---------------------------------------------------------------------------
// useCreateFullIntervention - Create chantier + planning slot
// ---------------------------------------------------------------------------
export function useCreateFullIntervention() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateInterventionInput) => createFullIntervention(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useChantier - Single chantier with tasks
// ---------------------------------------------------------------------------
export function useChantier(id: string | undefined) {
  return useQuery({
    queryKey: planningKeys.chantier(id!),
    queryFn: () => getChantier(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useUpdateChantierTasks - Batch update task completion
// ---------------------------------------------------------------------------
export function useUpdateChantierTasks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      chantierId,
      tasks,
    }: {
      chantierId: string
      tasks: Array<{ id: string; is_completed: boolean; completed_by?: string | null }>
    }) => updateChantierTasks(chantierId, tasks),
    onSuccess: (_data, variables) => {
      // Invalidate the specific chantier detail
      queryClient.invalidateQueries({
        queryKey: planningKeys.chantier(variables.chantierId),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useSlotEmargements - Emargements for a planning slot
// ---------------------------------------------------------------------------
export function useSlotEmargements(slotId: string | undefined) {
  return useQuery({
    queryKey: planningKeys.emargements(slotId!),
    queryFn: () => getSlotEmargements(slotId!),
    enabled: !!slotId,
    staleTime: 15 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useSignEmargement - Sign arrival or departure
// ---------------------------------------------------------------------------
export function useSignEmargement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      planning_slot_id: string
      profile_id: string
      signature_type: SignatureType
      latitude?: number | null
      longitude?: number | null
      notes?: string | null
    }) => signEmargement(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: planningKeys.emargements(variables.planning_slot_id),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useWeekAbsences - Approved absences for a given week
// ---------------------------------------------------------------------------
export function useWeekAbsences(weekStart: string) {
  const weekEnd = (() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  })()

  return useQuery({
    queryKey: planningKeys.weekAbsences(weekStart),
    queryFn: () => getWeekAbsences(weekStart, weekEnd),
    enabled: !!weekStart,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useTeamEquipment - Vehicles and equipment for given teams
// ---------------------------------------------------------------------------
export function useTeamEquipment(teamIds: string[]) {
  return useQuery({
    queryKey: planningKeys.teamEquipment(teamIds),
    queryFn: () => getTeamEquipment(teamIds),
    enabled: teamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useAnnualSlotCounts - Slot counts per day for a full year
// ---------------------------------------------------------------------------
export function useAnnualSlotCounts(year: number) {
  return useQuery({
    queryKey: planningKeys.annualCounts(year),
    queryFn: () => getAnnualSlotCounts(year),
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// usePostponeChantier - Push a chantier's date forward
// ---------------------------------------------------------------------------
export function usePostponeChantier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => postponeChantier(id, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.unplanned() })
      queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// usePersonnelWithAbsences - Staff list with today's absence status
// ---------------------------------------------------------------------------
export function usePersonnelWithAbsences(date: string) {
  return useQuery({
    queryKey: planningKeys.personnel(date),
    queryFn: () => getPersonnelWithAbsences(date),
    enabled: !!date,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// TEAM MANAGEMENT — Mutations
// ---------------------------------------------------------------------------

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; color: string; leader_id?: string | null; default_vehicle_id?: string | null }) =>
      createTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.teams() })
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string; leader_id?: string | null; default_vehicle_id?: string | null } }) =>
      updateTeam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.teams() })
    },
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.teams() })
    },
  })
}

export function useAddTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, profileId, isTeamLeader }: { teamId: string; profileId: string; isTeamLeader?: boolean }) =>
      addTeamMember(teamId, profileId, isTeamLeader),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.teams() })
    },
  })
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeTeamMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.teams() })
    },
  })
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { is_team_leader: boolean } }) =>
      updateTeamMember(memberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.teams() })
    },
  })
}

// ---------------------------------------------------------------------------
// MOBILE — Chantier notes, photos, signature
// ---------------------------------------------------------------------------

export function useUpdateChantierNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ chantierId, notes }: { chantierId: string; notes: string }) =>
      updateChantierNotes(chantierId, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.chantier(variables.chantierId) })
    },
  })
}

export function useUploadChantierPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ chantierId, file, photoType }: { chantierId: string; file: File; photoType?: 'avant' | 'apres' | 'general' }) =>
      uploadChantierPhoto(chantierId, file, photoType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.chantier(variables.chantierId) })
    },
  })
}

export function useUploadClientSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ chantierId, blob }: { chantierId: string; blob: Blob }) =>
      uploadClientSignature(chantierId, blob),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.chantier(variables.chantierId) })
    },
  })
}
