import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SupplierFilters,
} from '../services/supplier.service'
import type { Supplier } from '../types'

// ---------------------------------------------------------------------------
// Query key factory - centralised keys for cache management
// ---------------------------------------------------------------------------
export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (filters: SupplierFilters) => [...supplierKeys.lists(), filters] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
}

// ---------------------------------------------------------------------------
// useSuppliers - Paginated supplier list
// ---------------------------------------------------------------------------
export function useSuppliers(filters: SupplierFilters = {}) {
  return useQuery({
    queryKey: supplierKeys.list(filters),
    queryFn: () => getSuppliers(filters),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

// ---------------------------------------------------------------------------
// useSupplier - Single supplier detail
// ---------------------------------------------------------------------------
export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: supplierKeys.detail(id!),
    queryFn: () => getSupplier(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateSupplier
// ---------------------------------------------------------------------------
export function useCreateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) =>
      createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateSupplier
// ---------------------------------------------------------------------------
export function useUpdateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>
    }) => updateSupplier(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteSupplier - Soft delete
// ---------------------------------------------------------------------------
export function useDeleteSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
    },
  })
}
