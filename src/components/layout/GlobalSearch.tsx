import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useNavigate } from 'react-router'
import { Search, X, Building2, Wrench, Receipt, Loader2 } from 'lucide-react'
import { useGlobalSearch } from '../../queries/useGlobalSearch'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { SearchResultCategory, SearchResult } from '../../services/search.service'
import type { LucideIcon } from 'lucide-react'

const CATEGORY_CONFIG: Record<SearchResultCategory, { label: string; icon: LucideIcon; color: string }> = {
  client: { label: 'Clients', icon: Building2, color: 'text-blue-500' },
  chantier: { label: 'Chantiers', icon: Wrench, color: 'text-amber-500' },
  facture: { label: 'Factures', icon: Receipt, color: 'text-emerald-500' },
}

export const GlobalSearch = memo(function GlobalSearch() {
  const [inputValue, setInputValue] = useState('')
  const [debouncedValue, setDebouncedValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(inputValue), 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const { data, isLoading } = useGlobalSearch(debouncedValue)
  const results = data?.results ?? []

  // Group results by category
  const grouped = useMemo(() => {
    const g: Record<string, SearchResult[]> = {}
    for (const r of results) {
      if (!g[r.category]) g[r.category] = []
      g[r.category].push(r)
    }
    return g
  }, [results])

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => Object.values(grouped).flat(), [grouped])

  useClickOutside(containerRef, () => setIsOpen(false))

  const handleSelect = useCallback(
    (url: string) => {
      setIsOpen(false)
      setInputValue('')
      setDebouncedValue('')
      navigate(url)
    },
    [navigate],
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1))
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
      e.preventDefault()
      handleSelect(flatResults[activeIndex].url)
    }
  }, [activeIndex, flatResults, handleSelect])

  const showDropdown = isOpen && debouncedValue.length >= 2

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => {
            if (debouncedValue.length >= 2) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher clients, chantiers, factures..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:bg-white transition-all"
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue('')
              setDebouncedValue('')
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Recherche en cours...
            </div>
          )}

          {!isLoading && results.length === 0 && debouncedValue.length >= 2 && (
            <div className="px-4 py-3 text-sm text-slate-400">
              Aucun résultat pour « {debouncedValue} »
            </div>
          )}

          {!isLoading &&
            (Object.entries(grouped) as [string, SearchResult[]][]).map(([category, items]) => {
              const config = CATEGORY_CONFIG[category as SearchResultCategory]
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {config.label}
                    </span>
                  </div>
                  {items.map((result: SearchResult) => {
                    const flatIdx = flatResults.indexOf(result)
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result.url)}
                        className={`flex flex-col gap-0.5 w-full px-4 py-2.5 text-left transition-colors ${
                          flatIdx === activeIndex ? 'bg-primary-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-sm font-medium text-slate-800">{result.title}</span>
                        <span className="text-xs text-slate-400">{result.subtitle}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
})
