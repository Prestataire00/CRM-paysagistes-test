import { useState, useEffect, useCallback, type RefObject } from 'react'
import { Search, X } from 'lucide-react'
import type { PlanningSlot } from '../../../types'

interface PlanningSearchProps {
  slots: PlanningSlot[]
  onHighlightChange: (slotIds: Set<string>) => void
  inputRef?: RefObject<HTMLInputElement | null>
}

export function PlanningSearch({ slots, onHighlightChange, inputRef }: PlanningSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Compute matching slot IDs
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      onHighlightChange(new Set())
      return
    }

    const q = debouncedQuery.toLowerCase()
    const matchingIds = new Set<string>()

    for (const slot of slots) {
      const chantier = slot.chantier
      if (!chantier) continue

      // Match on title
      if (chantier.title?.toLowerCase().includes(q)) {
        matchingIds.add(slot.id)
        continue
      }

      // Match on client name
      const client = (chantier as (typeof chantier & { client?: { first_name?: string; last_name?: string; company_name?: string | null } | null }))?.client
      if (client) {
        const fullName = `${client.first_name ?? ''} ${client.last_name ?? ''} ${client.company_name ?? ''}`.toLowerCase()
        if (fullName.includes(q)) {
          matchingIds.add(slot.id)
          continue
        }
      }

      // Match on city / address
      if (chantier.city?.toLowerCase().includes(q) || chantier.address_line1?.toLowerCase().includes(q)) {
        matchingIds.add(slot.id)
      }
    }

    onHighlightChange(matchingIds)
  }, [debouncedQuery, slots, onHighlightChange])

  const handleClear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    onHighlightChange(new Set())
  }, [onHighlightChange])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher client, chantier, ville..."
        className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-all"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}
    </div>
  )
}
