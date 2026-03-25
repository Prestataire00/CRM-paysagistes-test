import { supabase } from '../lib/supabase'
import type {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CustomFieldValue,
} from '../types'

// ---------------------------------------------------------------------------
// Definitions CRUD
// ---------------------------------------------------------------------------

export async function getFieldDefinitions(
  entityType?: CustomFieldEntityType,
  includeInactive = false,
): Promise<CustomFieldDefinition[]> {
  let query = supabase
    .from('custom_field_definitions')
    .select('*')
    .order('position', { ascending: true })

  if (entityType) query = query.eq('entity_type', entityType)
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CustomFieldDefinition[]
}

export async function getFieldDefinition(id: string): Promise<CustomFieldDefinition> {
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as CustomFieldDefinition
}

export async function createFieldDefinition(
  input: Omit<CustomFieldDefinition, 'id' | 'created_at' | 'updated_at'>,
): Promise<CustomFieldDefinition> {
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as CustomFieldDefinition
}

export async function updateFieldDefinition(
  id: string,
  input: Partial<Omit<CustomFieldDefinition, 'id' | 'created_at' | 'updated_at'>>,
): Promise<CustomFieldDefinition> {
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CustomFieldDefinition
}

export async function deleteFieldDefinition(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_field_definitions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reorderFieldDefinitions(
  updates: { id: string; position: number }[],
): Promise<void> {
  // Update each definition's position individually
  for (const u of updates) {
    const { error } = await supabase
      .from('custom_field_definitions')
      .update({ position: u.position, updated_at: new Date().toISOString() })
      .eq('id', u.id)
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Values — read / upsert for a given entity
// ---------------------------------------------------------------------------

export async function getEntityCustomFieldValues(
  entityType: CustomFieldEntityType,
  entityId: string,
): Promise<CustomFieldValue[]> {
  const { data, error } = await supabase
    .from('custom_field_values')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  if (error) throw error
  return (data ?? []) as CustomFieldValue[]
}

export async function upsertCustomFieldValues(
  entityType: CustomFieldEntityType,
  entityId: string,
  values: { field_definition_id: string; value: unknown }[],
): Promise<void> {
  const rows = values.map((v) => ({
    field_definition_id: v.field_definition_id,
    entity_type: entityType,
    entity_id: entityId,
    value: v.value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('custom_field_values')
    .upsert(rows, { onConflict: 'field_definition_id,entity_id' })

  if (error) throw error
}
