import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getRelancesForProspect,
  generateRelance,
  sendRelance,
  updateRelanceDraft,
  cancelRelance,
  getRelanceConfig,
} from '../services/relance.service'
import type { GenerateRelanceRequest, SendRelanceRequest } from '../types'
import { prospectKeys } from './useProspects'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const relanceKeys = {
  all: ['relances'] as const,
  forProspect: (prospectId: string) =>
    [...relanceKeys.all, 'prospect', prospectId] as const,
  config: () => [...relanceKeys.all, 'config'] as const,
}

// ---------------------------------------------------------------------------
// useRelancesForProspect - All relances for a specific prospect
// ---------------------------------------------------------------------------
export function useRelancesForProspect(prospectId: string | undefined) {
  return useQuery({
    queryKey: relanceKeys.forProspect(prospectId!),
    queryFn: () => getRelancesForProspect(prospectId!),
    enabled: !!prospectId,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useGenerateRelance - Trigger AI generation via Edge Function
// ---------------------------------------------------------------------------
export function useGenerateRelance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: GenerateRelanceRequest) => generateRelance(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relanceKeys.forProspect(variables.prospect_id),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useSendRelance - Send the email via Brevo Edge Function
// ---------------------------------------------------------------------------
export function useSendRelance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SendRelanceRequest) => sendRelance(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: relanceKeys.all })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStageEnriched() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateRelanceDraft - Edit subject/body locally
// ---------------------------------------------------------------------------
export function useUpdateRelanceDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: { subject?: string; body_html?: string }
    }) => updateRelanceDraft(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: relanceKeys.forProspect(data.prospect_id),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useCancelRelance - Mark a relance as cancelled
// ---------------------------------------------------------------------------
export function useCancelRelance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cancelRelance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: relanceKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// useRelanceConfig - Relance settings
// ---------------------------------------------------------------------------
export function useRelanceConfig() {
  return useQuery({
    queryKey: relanceKeys.config(),
    queryFn: getRelanceConfig,
    staleTime: 5 * 60 * 1000,
  })
}
