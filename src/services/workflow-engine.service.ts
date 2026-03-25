/**
 * Workflow Execution Engine
 * Runs active workflow rules by checking recent data changes and executing configured actions.
 * Called from the follow-up checker every 30 minutes.
 */

import { supabase } from '../lib/supabase'
import { createNotification } from './notification.service'
import type { WorkflowRule, WorkflowCondition, WorkflowAction } from '../types'

// Table name → Supabase table mapping
const TABLE_MAP: Record<string, string> = {
  quotes: 'quotes',
  invoices: 'invoices',
  clients: 'clients',
  prospects: 'prospects',
  chantiers: 'chantiers',
  planning_slots: 'planning_slots',
}

const CHECK_WINDOW_MS = 35 * 60 * 1000 // 35 minutes (slightly > 30min check interval)

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------

function evaluateCondition(condition: WorkflowCondition, record: Record<string, unknown>): boolean {
  const fieldValue = record[condition.field]
  const condValue = condition.value

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condValue)
    case 'not_equals':
      return String(fieldValue) !== String(condValue)
    case 'contains':
      return String(fieldValue ?? '').toLowerCase().includes(String(condValue ?? '').toLowerCase())
    case 'gt':
      return Number(fieldValue) > Number(condValue)
    case 'lt':
      return Number(fieldValue) < Number(condValue)
    case 'changed_to':
      return String(fieldValue) === String(condValue)
    case 'is_empty':
      return fieldValue == null || fieldValue === ''
    case 'is_not_empty':
      return fieldValue != null && fieldValue !== ''
    default:
      return true
  }
}

function evaluateConditions(conditions: WorkflowCondition[], record: Record<string, unknown>): boolean {
  if (conditions.length === 0) return true
  return conditions.every(c => evaluateCondition(c, record))
}

// ---------------------------------------------------------------------------
// Action Executors
// ---------------------------------------------------------------------------

async function executeAction(
  action: WorkflowAction,
  triggerData: Record<string, unknown>,
  userId: string,
): Promise<{ success: boolean; detail: string }> {
  try {
    switch (action.type) {
      case 'create_notification': {
        const title = replaceVars(action.title, triggerData)
        const message = replaceVars(action.message, triggerData)

        await createNotification({
          profile_id: userId,
          notification_type: 'info',
          title,
          message,
          action_url: null,
          action_entity_type: 'workflow',
          action_entity_id: String(triggerData.id ?? ''),
        })
        return { success: true, detail: `Notification: ${title}` }
      }

      case 'send_email': {
        const to = triggerData[action.to] ? String(triggerData[action.to]) : action.to
        if (!to || !to.includes('@')) {
          return { success: false, detail: `Email invalide: ${to}` }
        }

        const subject = replaceVars(action.subject, triggerData)
        const body = replaceVars(action.body, triggerData)

        // Use the send-client-email edge function via direct Brevo call
        const session = await supabase.auth.getSession()
        const accessToken = session.data.session?.access_token

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-client-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              recipient_email: to,
              recipient_name: String(triggerData.first_name ?? '') + ' ' + String(triggerData.last_name ?? ''),
              subject,
              html_content: `<div style="font-family:sans-serif;padding:20px;">${body.replace(/\n/g, '<br/>')}</div>`,
              client_id: triggerData.client_id ?? null,
              email_type: 'generic',
            }),
          },
        )

        if (!res.ok) return { success: false, detail: `Email failed: ${res.status}` }
        return { success: true, detail: `Email envoyé à ${to}` }
      }

      case 'change_status': {
        if (!triggerData.id || !triggerData._table) {
          return { success: false, detail: 'Impossible de changer le statut: pas de table/id' }
        }
        const { error } = await supabase
          .from(String(triggerData._table))
          .update({ status: action.new_status })
          .eq('id', triggerData.id)

        if (error) return { success: false, detail: `Status change failed: ${error.message}` }
        return { success: true, detail: `Statut changé → ${action.new_status}` }
      }

      case 'create_task': {
        const title = replaceVars(action.title, triggerData)
        const description = replaceVars(action.description, triggerData)
        const dueDate = new Date()
        if (action.due_days) dueDate.setDate(dueDate.getDate() + action.due_days)

        const { error } = await supabase.from('commercial_activities').insert({
          activity_type: 'visite',
          subject: title,
          description,
          scheduled_at: dueDate.toISOString(),
          is_completed: false,
          assigned_to: action.assigned_to || userId,
          created_by: userId,
          client_id: triggerData.client_id ?? null,
          prospect_id: triggerData.prospect_id ?? null,
        })

        if (error) return { success: false, detail: `Task creation failed: ${error.message}` }
        return { success: true, detail: `Tâche créée: ${title}` }
      }

      default:
        return { success: false, detail: `Type d'action inconnu` }
    }
  } catch (err: any) {
    return { success: false, detail: err.message }
  }
}

// Replace {{field}} vars in templates
function replaceVars(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    return val != null ? String(val) : ''
  })
}

// ---------------------------------------------------------------------------
// Log Execution
// ---------------------------------------------------------------------------

async function logExecution(
  ruleId: string,
  status: 'success' | 'error' | 'skipped',
  triggerData: unknown,
  actionsExecuted: unknown[],
  errorMessage: string | null,
  durationMs: number,
): Promise<void> {
  await supabase.from('workflow_rule_executions').insert({
    rule_id: ruleId,
    status,
    trigger_data: triggerData,
    actions_executed: actionsExecuted,
    error_message: errorMessage,
    execution_time_ms: durationMs,
  })

  // Update rule counters
  const updates: Record<string, unknown> = {
    last_run_at: new Date().toISOString(),
  }

  if (status === 'success') {
    // Increment run_count via RPC or manual fetch+update
    const { data: rule } = await supabase.from('workflow_rules').select('run_count').eq('id', ruleId).single()
    if (rule) updates.run_count = (rule.run_count ?? 0) + 1
  } else if (status === 'error') {
    const { data: rule } = await supabase.from('workflow_rules').select('error_count').eq('id', ruleId).single()
    if (rule) updates.error_count = (rule.error_count ?? 0) + 1
  }

  await supabase.from('workflow_rules').update(updates).eq('id', ruleId)
}

// ---------------------------------------------------------------------------
// Main Engine
// ---------------------------------------------------------------------------

export async function runWorkflowEngine(userId: string): Promise<number> {
  // 1. Fetch active rules
  const { data: rules, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .eq('active', true)

  if (error || !rules || rules.length === 0) return 0

  const cutoff = new Date(Date.now() - CHECK_WINDOW_MS).toISOString()
  let totalExecutions = 0

  for (const rule of rules as WorkflowRule[]) {
    const startTime = Date.now()
    const tableName = TABLE_MAP[rule.trigger_table]
    if (!tableName && rule.trigger_event !== 'SCHEDULE') continue

    try {
      let records: Record<string, unknown>[] = []

      if (rule.trigger_event === 'INSERT' && tableName) {
        const { data } = await supabase
          .from(tableName)
          .select('*')
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(50)
        records = (data ?? []) as Record<string, unknown>[]

      } else if (rule.trigger_event === 'UPDATE' && tableName) {
        const { data } = await supabase
          .from(tableName)
          .select('*')
          .gte('updated_at', cutoff)
          .order('updated_at', { ascending: false })
          .limit(50)
        // Filter out records where updated_at === created_at (not actual updates)
        records = ((data ?? []) as Record<string, unknown>[]).filter(
          r => String(r.updated_at) !== String(r.created_at)
        )

      } else if (rule.trigger_event === 'SCHEDULE') {
        // Schedule rules run on a dummy record
        records = [{ id: 'schedule', _scheduled: true }]
      }

      if (records.length === 0) {
        await logExecution(rule.id, 'skipped', null, [], null, Date.now() - startTime)
        continue
      }

      // Evaluate conditions and execute actions for each matching record
      for (const record of records) {
        if (!evaluateConditions(rule.conditions, record)) continue

        // Add table reference for change_status action
        const enrichedRecord = { ...record, _table: tableName }

        const results: unknown[] = []
        let hasError = false

        for (const action of rule.actions) {
          const result = await executeAction(action, enrichedRecord, userId)
          results.push(result)
          if (!result.success) hasError = true
        }

        await logExecution(
          rule.id,
          hasError ? 'error' : 'success',
          { id: record.id, table: tableName },
          results,
          hasError ? results.filter((r: any) => !r.success).map((r: any) => r.detail).join('; ') : null,
          Date.now() - startTime,
        )

        totalExecutions++
      }
    } catch (err: any) {
      await logExecution(rule.id, 'error', null, [], err.message, Date.now() - startTime)
    }
  }

  return totalExecutions
}

// ---------------------------------------------------------------------------
// Manual test execution for a single rule
// ---------------------------------------------------------------------------
export async function testWorkflowRule(ruleId: string, userId: string): Promise<{
  status: 'success' | 'error' | 'no_match'
  message: string
  results: unknown[]
}> {
  const { data: rule, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .eq('id', ruleId)
    .single()

  if (error || !rule) return { status: 'error', message: 'Règle introuvable', results: [] }

  const tableName = TABLE_MAP[rule.trigger_table]

  // Get the most recent record from the table
  let testRecord: Record<string, unknown> | null = null

  if (rule.trigger_event === 'SCHEDULE') {
    testRecord = { id: 'test-schedule', _scheduled: true }
  } else if (tableName) {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    testRecord = (data?.[0] as Record<string, unknown>) ?? null
  }

  if (!testRecord) return { status: 'no_match', message: 'Aucun enregistrement trouvé pour tester', results: [] }

  // Evaluate conditions
  if (!evaluateConditions((rule as WorkflowRule).conditions, testRecord)) {
    return { status: 'no_match', message: 'Conditions non remplies sur le dernier enregistrement', results: [] }
  }

  // Execute actions
  const enrichedRecord = { ...testRecord, _table: tableName }
  const results: unknown[] = []
  let hasError = false

  for (const action of (rule as WorkflowRule).actions) {
    const result = await executeAction(action, enrichedRecord, userId)
    results.push(result)
    if (!result.success) hasError = true
  }

  return {
    status: hasError ? 'error' : 'success',
    message: hasError ? 'Exécution avec erreurs' : 'Exécution réussie',
    results,
  }
}
