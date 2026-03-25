export type CustomFieldEntityType = 'clients' | 'prospects' | 'chantiers'
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntityType
  field_name: string
  field_label: string
  field_type: CustomFieldType
  options: string[]
  required: boolean
  position: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomFieldValue {
  id: string
  field_definition_id: string
  entity_type: string
  entity_id: string
  value: unknown
  created_at: string
  updated_at: string
}

export interface EntityCustomFieldEntry {
  definition: CustomFieldDefinition
  value: unknown
}
