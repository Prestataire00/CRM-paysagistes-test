import { useState, useRef, useEffect } from 'react'
import { Search, Building2, Loader2 } from 'lucide-react'
import { usePappersSearch } from '../../queries/usePappers'
import type { PappersCompanyResult } from '../../services/pappers.service'

interface CompanySearchProps {
  onSelect: (company: PappersCompanyResult) => void
}

export function CompanySearch({ onSelect }: CompanySearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Debounce 400ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timer)
  }, [query])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: results = [], isLoading, isError } = usePappersSearch(debouncedQuery)

  const showDropdown = open && debouncedQuery.length >= 3

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Recherche entreprise (Pappers)
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Nom d'entreprise ou SIRET..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              Recherche en cours...
            </div>
          ) : isError ? (
            <div className="px-4 py-3 text-sm text-red-600 text-center">
              Erreur de recherche Pappers
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              Aucun résultat
            </div>
          ) : (
            results.map((company) => (
              <button
                key={company.siret || company.siren}
                type="button"
                onClick={() => {
                  onSelect(company)
                  setQuery(company.nom_entreprise)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {company.nom_entreprise}
                    </p>
                    <p className="text-xs text-slate-500">
                      SIRET: {company.siret || company.siren}
                      {company.ville && ` · ${company.code_postal} ${company.ville}`}
                    </p>
                    {company.forme_juridique && (
                      <p className="text-xs text-slate-400">{company.forme_juridique}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
