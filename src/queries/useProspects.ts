import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProspects,
  getProspectsByStage,
  getProspectsByStageEnriched,
  getProspect,
  createProspect,
  updateProspect,
  moveProspectStage,
  deleteProspect,
  convertToClient,
  getProspectActivities,
  createProspectActivity,
  getScoringConfig,
  type ProspectFilters,
  type EnrichedProspectsByStageResult,
} from '../services/prospect.service'
import { getWeeklyCommercialReport } from '../services/pipeline-report.service'
import type { Prospect, PipelineStage } from '../types'
import { clientKeys } from './useClients'

// ---------------------------------------------------------------------------
// Query key factory - centralised keys for cache management
// ---------------------------------------------------------------------------
export const prospectKeys = {
  all: ['prospects'] as const,
  lists: () => [...prospectKeys.all, 'list'] as const,
  list: (filters: ProspectFilters) => [...prospectKeys.lists(), filters] as const,
  byStage: () => [...prospectKeys.all, 'byStage'] as const,
  byStageEnriched: () => [...prospectKeys.all, 'byStageEnriched'] as const,
  details: () => [...prospectKeys.all, 'detail'] as const,
  detail: (id: string) => [...prospectKeys.details(), id] as const,
  activities: (prospectId: string) => [...prospectKeys.all, 'activities', prospectId] as const,
  scoringConfig: () => [...prospectKeys.all, 'scoringConfig'] as const,
  weeklyReport: (start: string, end: string) => [...prospectKeys.all, 'weeklyReport', start, end] as const,
}

// ---------------------------------------------------------------------------
// useProspects - Paginated prospect list
// ---------------------------------------------------------------------------
export function useProspects(filters: ProspectFilters = {}) {
  return useQuery({
    queryKey: prospectKeys.list(filters),
    queryFn: () => getProspects(filters),
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  })
}

// ---------------------------------------------------------------------------
// useProspectsByStage - Prospects grouped by pipeline stage (limited per column)
// ---------------------------------------------------------------------------
const KANBAN_CARDS_PER_COLUMN = 20

export function useProspectsByStage() {
  return useQuery({
    queryKey: prospectKeys.byStage(),
    queryFn: () => getProspectsByStage(KANBAN_CARDS_PER_COLUMN),
    staleTime: 30 * 1000, // 30 seconds
  })
}

// ---------------------------------------------------------------------------
// useProspect - Single prospect detail
// ---------------------------------------------------------------------------
export function useProspect(id: string | undefined) {
  return useQuery({
    queryKey: prospectKeys.detail(id!),
    queryFn: () => getProspect(id!),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  })
}

// ---------------------------------------------------------------------------
// useCreateProspect
// ---------------------------------------------------------------------------
export function useCreateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>) =>
      createProspect(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStage() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStageEnriched() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateProspect
// ---------------------------------------------------------------------------
export function useUpdateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Prospect, 'id' | 'created_at' | 'updated_at'>>
    }) => updateProspect(id, data),
    onSuccess: (_data, variables) => {
      // Invalidate the specific prospect detail, all lists, and byStage
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStage() })
    },
  })
}

// ---------------------------------------------------------------------------
// useMoveProspectStage
// ---------------------------------------------------------------------------
export function useMoveProspectStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      newStage,
    }: {
      id: string
      newStage: PipelineStage
    }) => moveProspectStage(id, newStage),
    onSuccess: () => {
      // Invalidate byStage and all lists
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStage() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteProspect - Hard delete
// ---------------------------------------------------------------------------
export function useDeleteProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProspect(id),
    onSuccess: () => {
      // Invalidate all prospect lists and byStage
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStage() })
    },
  })
}

// ---------------------------------------------------------------------------
// useConvertToClient - Convert prospect to client
// ---------------------------------------------------------------------------
export function useConvertToClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (prospectId: string) => convertToClient(prospectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStage() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStageEnriched() })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useProspectsByStageEnriched - Enriched Kanban data (commercial + activity count)
// ---------------------------------------------------------------------------
export function useProspectsByStageEnriched() {
  return useQuery({
    queryKey: prospectKeys.byStageEnriched(),
    queryFn: () => getProspectsByStageEnriched(30),
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useProspectActivities - Activity timeline for a specific prospect
// ---------------------------------------------------------------------------
export function useProspectActivities(prospectId: string | undefined) {
  return useQuery({
    queryKey: prospectKeys.activities(prospectId!),
    queryFn: () => getProspectActivities(prospectId!),
    enabled: !!prospectId,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useScoringConfig - Pipeline scoring configuration
// ---------------------------------------------------------------------------
export function useScoringConfig() {
  return useQuery({
    queryKey: prospectKeys.scoringConfig(),
    queryFn: getScoringConfig,
    staleTime: 5 * 60 * 1000, // config changes rarely
  })
}

// ---------------------------------------------------------------------------
// useCreateProspectActivity - Log a commercial activity
// ---------------------------------------------------------------------------
export function useCreateProspectActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createProspectActivity,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStageEnriched() })
      if (variables.prospect_id) {
        queryClient.invalidateQueries({
          queryKey: prospectKeys.activities(variables.prospect_id),
        })
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useMoveProspectStageOptimistic - Drag & drop with optimistic update
// ---------------------------------------------------------------------------
export function useMoveProspectStageOptimistic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, newStage }: { id: string; newStage: PipelineStage }) =>
      moveProspectStage(id, newStage),
    onMutate: async ({ id, newStage }) => {
      await queryClient.cancelQueries({ queryKey: prospectKeys.byStageEnriched() })
      const previous = queryClient.getQueryData<EnrichedProspectsByStageResult>(
        prospectKeys.byStageEnriched(),
      )

      if (previous) {
        const newCards = { ...previous.cards }
        const newCounts = { ...previous.counts }

        // Find and move the card between columns
        for (const stage of Object.keys(newCards) as PipelineStage[]) {
          const idx = newCards[stage].findIndex((p) => p.id === id)
          if (idx !== -1) {
            const [moved] = newCards[stage].splice(idx, 1)
            const updatedCard = { ...moved, pipeline_stage: newStage }
            newCards[stage] = [...newCards[stage]]
            newCards[newStage] = [updatedCard, ...newCards[newStage]]
            newCounts[stage] = Math.max(0, (newCounts[stage] ?? 1) - 1)
            newCounts[newStage] = (newCounts[newStage] ?? 0) + 1
            break
          }
        }

        queryClient.setQueryData(prospectKeys.byStageEnriched(), {
          cards: newCards,
          counts: newCounts,
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(prospectKeys.byStageEnriched(), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.byStageEnriched() })
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useWeeklyCommercialReport - Aggregated report per commercial
// ---------------------------------------------------------------------------
export function useWeeklyCommercialReport(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: prospectKeys.weeklyReport(weekStart, weekEnd),
    queryFn: () => getWeeklyCommercialReport(weekStart, weekEnd),
    staleTime: 5 * 60 * 1000,
    enabled: !!weekStart && !!weekEnd,
  })
}
