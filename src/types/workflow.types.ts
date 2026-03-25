export type WorkflowTriggerEvent = 'INSERT' | 'UPDATE' | 'DELETE' | 'SCHEDULE'

export interface WorkflowCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'changed_to' | 'is_empty' | 'is_not_empty'
  value: unknown
}

export type WorkflowActionType = 'send_email' | 'create_notification' | 'change_status' | 'create_task'

export interface WorkflowActionSendEmail {
  type: 'send_email'
  to: string   // field name or literal email
  subject: string
  body: string
}

export interface WorkflowActionCreateNotification {
  type: 'create_notification'
  title: string
  message: string
  target_role?: string
}

export interface WorkflowActionChangeStatus {
  type: 'change_status'
  new_status: string
}

export interface WorkflowActionCreateTask {
  type: 'create_task'
  title: string
  description: string
  assigned_to?: string
  due_days?: number
}

export type WorkflowAction =
  | WorkflowActionSendEmail
  | WorkflowActionCreateNotification
  | WorkflowActionChangeStatus
  | WorkflowActionCreateTask

export interface WorkflowRule {
  id: string
  name: string
  description: string | null
  trigger_table: string
  trigger_event: WorkflowTriggerEvent
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  active: boolean
  last_run_at: string | null
  run_count: number
  error_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRuleExecution {
  id: string
  rule_id: string
  status: 'success' | 'error' | 'skipped'
  trigger_data: unknown
  actions_executed: unknown[]
  error_message: string | null
  execution_time_ms: number | null
  created_at: string
}
