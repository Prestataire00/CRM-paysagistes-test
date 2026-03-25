import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFieldDefinitions,
  getFieldDefinition,
  createFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  reorderFieldDefinitions,
  getEntityCustomFieldValues,
  upsertCustomFieldValues,
} from '../services/custom-fields.service'
import type { CustomFieldDefinition, CustomFieldEntityType } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const customFieldKeys = {
  all: ['custom-fields'] as const,
  definitions: (entityType?: CustomFieldEntityType) =>
    [...customFieldKeys.all, 'definitions', entityType] as const,
  definition: (id: string) =>
    [...customFieldKeys.all, 'definition', id] as const,
  values: (entityType: CustomFieldEntityType, entityId: string) =>
    [...customFieldKeys.all, 'values', entityType, entityId] as const,
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export function useFieldDefinitions(entityType?: CustomFieldEntityType, includeInactive = false) {
  return useQuery({
    queryKey: customFieldKeys.definitions(entityType),
    queryFn: () => getFieldDefinitions(entityType, includeInactive),
    staleTime: 60 * 1000,
  })
}

export function useFieldDefinition(id: string | undefined) {
  return useQuery({
    queryKey: customFieldKeys.definition(id!),
    queryFn: () => getFieldDefinition(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CustomFieldDefinition, 'id' | 'created_at' | 'updated_at'>) =>
      createFieldDefinition(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all })
    },
  })
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<Omit<CustomFieldDefinition, 'id' | 'created_at' | 'updated_at'>>
    }) => updateFieldDefinition(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all })
    },
  })
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFieldDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all })
    },
  })
}

export function useReorderFieldDefinitions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: { id: string; position: number }[]) =>
      reorderFieldDefinitions(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export function useEntityCustomFieldValues(
  entityType: CustomFieldEntityType,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: customFieldKeys.values(entityType, entityId!),
    queryFn: () => getEntityCustomFieldValues(entityType, entityId!),
    enabled: !!entityId,
    staleTime: 30 * 1000,
  })
}

export function useUpsertCustomFieldValues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      values,
    }: {
      entityType: CustomFieldEntityType
      entityId: string
      values: { field_definition_id: string; value: unknown }[]
    }) => upsertCustomFieldValues(entityType, entityId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customFieldKeys.values(variables.entityType, variables.entityId),
      })
    },
  })
}
