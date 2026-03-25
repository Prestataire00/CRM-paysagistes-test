import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  type CatalogItemCreate,
  type CatalogItemUpdate,
} from '../services/catalog.service'

const catalogKeys = {
  all: ['catalog'] as const,
  items: () => [...catalogKeys.all, 'items'] as const,
}

export function useCatalogItems() {
  return useQuery({
    queryKey: catalogKeys.items(),
    queryFn: getCatalogItems,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: CatalogItemCreate) => createCatalogItem(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.items() }),
  })
}

export function useUpdateCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CatalogItemUpdate }) =>
      updateCatalogItem(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.items() }),
  })
}

export function useDeleteCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCatalogItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.items() }),
  })
}
