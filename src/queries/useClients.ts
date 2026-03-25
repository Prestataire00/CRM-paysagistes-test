import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientInterventions,
  getClientInvoices,
  checkDuplicateClient,
  getClientTags,
  createClientTag,
  getClientTagAssignments,
  setClientTags,
  importClients,
  type ClientFilters,
} from '../services/client.service'
import type { Client } from '../types'
import type { ClientCsvRow } from '../utils/csv'

// ---------------------------------------------------------------------------
// Query key factory - centralised keys for cache management
// ---------------------------------------------------------------------------
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: ClientFilters) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  interventions: (id: string) => [...clientKeys.detail(id), 'interventions'] as const,
  invoices: (id: string) => [...clientKeys.detail(id), 'invoices'] as const,
  duplicate: (firstName: string, lastName: string) =>
    [...clientKeys.all, 'duplicate', firstName, lastName] as const,
  tags: () => [...clientKeys.all, 'tags'] as const,
  tagAssignments: (id: string) => [...clientKeys.detail(id), 'tags'] as const,
}

// ---------------------------------------------------------------------------
// useClients - Paginated client list
// ---------------------------------------------------------------------------
export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: clientKeys.list(filters),
    queryFn: () => getClients(filters),
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  })
}

// ---------------------------------------------------------------------------
// useClient - Single client detail
// ---------------------------------------------------------------------------
export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(id!),
    queryFn: () => getClient(id!),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  })
}

// ---------------------------------------------------------------------------
// useClientInterventions - Chantiers for a given client
// ---------------------------------------------------------------------------
export function useClientInterventions(clientId: string | undefined) {
  return useQuery({
    queryKey: clientKeys.interventions(clientId!),
    queryFn: () => getClientInterventions(clientId!),
    enabled: !!clientId,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useClientInvoices - Invoices for a given client
// ---------------------------------------------------------------------------
export function useClientInvoices(clientId: string | undefined) {
  return useQuery({
    queryKey: clientKeys.invoices(clientId!),
    queryFn: () => getClientInvoices(clientId!),
    enabled: !!clientId,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateClient
// ---------------------------------------------------------------------------
export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) =>
      createClient(data),
    onSuccess: () => {
      // Invalidate all client lists so they refetch with the new entry
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      // Also refresh the contracts page
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateClient
// ---------------------------------------------------------------------------
export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>
    }) => updateClient(id, data),
    onSuccess: (_data, variables) => {
      // Invalidate the specific client detail and all lists
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      // Also refresh the contracts page
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteClient - Soft delete
// ---------------------------------------------------------------------------
export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: (_data, id) => {
      // Invalidate the specific client and all lists
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useCheckDuplicate - Check for name/email duplicates
// ---------------------------------------------------------------------------
export function useCheckDuplicate(firstName: string, lastName: string, email?: string) {
  return useQuery({
    queryKey: clientKeys.duplicate(firstName, lastName),
    queryFn: () => checkDuplicateClient(firstName, lastName, email),
    enabled: firstName.trim().length >= 2 && lastName.trim().length >= 2,
    staleTime: 10_000,
  })
}

// ---------------------------------------------------------------------------
// useClientTags - All available tags
// ---------------------------------------------------------------------------
export function useClientTags() {
  return useQuery({
    queryKey: clientKeys.tags(),
    queryFn: getClientTags,
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// useClientTagAssignments - Tags assigned to a specific client
// ---------------------------------------------------------------------------
export function useClientTagAssignments(clientId: string | undefined) {
  return useQuery({
    queryKey: clientKeys.tagAssignments(clientId!),
    queryFn: () => getClientTagAssignments(clientId!),
    enabled: !!clientId,
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// useCreateClientTag - Create a new tag
// ---------------------------------------------------------------------------
export function useCreateClientTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      createClientTag(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.tags() })
    },
  })
}

// ---------------------------------------------------------------------------
// useSetClientTags - Assign tags to a client
// ---------------------------------------------------------------------------
export function useSetClientTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, tagIds }: { clientId: string; tagIds: string[] }) =>
      setClientTags(clientId, tagIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: clientKeys.tagAssignments(variables.clientId),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useImportClients - Bulk import from CSV
// ---------------------------------------------------------------------------
export function useImportClients() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ rows, createdBy }: { rows: ClientCsvRow[]; createdBy: string }) =>
      importClients(rows, createdBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}
