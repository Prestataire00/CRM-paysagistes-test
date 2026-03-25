import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInterventions,
  updateInterventionStatus,
  updateInterventionTeam,
  type InterventionFilters,
} from '../services/intervention.service'
import type { InterventionStatus } from '../types'
import { planningKeys } from './usePlanning'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const interventionKeys = {
  all: ['interventions'] as const,
  list: (filters: InterventionFilters) =>
    [...interventionKeys.all, 'list', filters] as const,
}

// ---------------------------------------------------------------------------
// useInterventions - List with filters
// ---------------------------------------------------------------------------
export function useInterventions(filters: InterventionFilters = {}) {
  return useQuery({
    queryKey: interventionKeys.list(filters),
    queryFn: () => getInterventions(filters),
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useUpdateInterventionStatus
// ---------------------------------------------------------------------------
export function useUpdateInterventionStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InterventionStatus }) =>
      updateInterventionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.all })
      queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateInterventionTeam
// ---------------------------------------------------------------------------
export function useUpdateInterventionTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, teamId }: { id: string; teamId: string | null }) =>
      updateInterventionTeam(id, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.all })
      queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}
