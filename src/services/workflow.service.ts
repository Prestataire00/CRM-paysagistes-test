import { supabase } from '../lib/supabase'
import type { WorkflowRule, WorkflowRuleExecution } from '../types'

// ---------------------------------------------------------------------------
// Rules CRUD
// ---------------------------------------------------------------------------

export async function getWorkflowRules(): Promise<WorkflowRule[]> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WorkflowRule[]
}

export async function getWorkflowRule(id: string): Promise<WorkflowRule> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as WorkflowRule
}

export async function createWorkflowRule(
  input: Omit<WorkflowRule, 'id' | 'last_run_at' | 'run_count' | 'error_count' | 'created_at' | 'updated_at'>,
): Promise<WorkflowRule> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as WorkflowRule
}

export async function updateWorkflowRule(
  id: string,
  input: Partial<Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at'>>,
): Promise<WorkflowRule> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as WorkflowRule
}

export async function deleteWorkflowRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('workflow_rules')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function toggleWorkflowRule(id: string, active: boolean): Promise<WorkflowRule> {
  return updateWorkflowRule(id, { active })
}

// ---------------------------------------------------------------------------
// Executions (read-only)
// ---------------------------------------------------------------------------

export async function getWorkflowExecutions(
  ruleId: string,
  limit = 50,
): Promise<WorkflowRuleExecution[]> {
  const { data, error } = await supabase
    .from('workflow_rule_executions')
    .select('*')
    .eq('rule_id', ruleId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as WorkflowRuleExecution[]
}
