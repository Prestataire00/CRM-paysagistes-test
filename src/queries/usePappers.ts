import { useQuery } from '@tanstack/react-query'
import { searchCompanies } from '../services/pappers.service'

// ---------------------------------------------------------------------------
// usePappersSearch — debounced company name search
// ---------------------------------------------------------------------------
export function usePappersSearch(query: string) {
  return useQuery({
    queryKey: ['pappers', 'search', query],
    queryFn: () => searchCompanies(query),
    enabled: query.length >= 3,
    staleTime: 5 * 60 * 1000, // Cache 5 min to save API credits
    retry: false,
  })
}

