import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWorkflowRules,
  getWorkflowRule,
  createWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
  toggleWorkflowRule,
  getWorkflowExecutions,
} from '../services/workflow.service'
import type { WorkflowRule } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const workflowKeys = {
  all: ['workflow'] as const,
  rules: () => [...workflowKeys.all, 'rules'] as const,
  rule: (id: string) => [...workflowKeys.all, 'rule', id] as const,
  executions: (ruleId: string) => [...workflowKeys.all, 'executions', ruleId] as const,
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function useWorkflowRules() {
  return useQuery({
    queryKey: workflowKeys.rules(),
    queryFn: getWorkflowRules,
    staleTime: 30 * 1000,
  })
}

export function useWorkflowRule(id: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.rule(id!),
    queryFn: () => getWorkflowRule(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

export function useCreateWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<WorkflowRule, 'id' | 'last_run_at' | 'run_count' | 'error_count' | 'created_at' | 'updated_at'>) =>
      createWorkflowRule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.rules() })
    },
  })
}

export function useUpdateWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at'>>
    }) => updateWorkflowRule(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.rule(variables.id) })
      queryClient.invalidateQueries({ queryKey: workflowKeys.rules() })
    },
  })
}

export function useDeleteWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkflowRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.rules() })
    },
  })
}

export function useToggleWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleWorkflowRule(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.rules() })
    },
  })
}

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------

export function useWorkflowExecutions(ruleId: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.executions(ruleId!),
    queryFn: () => getWorkflowExecutions(ruleId!),
    enabled: !!ruleId,
    staleTime: 15 * 1000,
  })
}
