import { useQuery } from '@tanstack/react-query'
import { globalSearch, type GlobalSearchResponse } from '../services/search.service'

export const searchKeys = {
  all: ['global-search'] as const,
  query: (term: string) => [...searchKeys.all, term] as const,
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: searchKeys.query(query),
    queryFn: () => globalSearch(query),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
    gcTime: 60_000,
    placeholderData: (prev: GlobalSearchResponse | undefined) => prev,
  })
}
