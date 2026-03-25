import { useState, useMemo } from 'react'
import { Search, X, Package, ChevronRight } from 'lucide-react'
import { useCatalogItems } from '../../../queries/useCatalog'
import type { CatalogItem } from '../../../services/catalog.service'

interface CatalogPickerModalProps {
  onSelect: (item: CatalogItem) => void
  onClose: () => void
}

export function CatalogPickerModal({ onSelect, onClose }: CatalogPickerModalProps) {
  const [search, setSearch] = useState('')
  const { data: items = [], isLoading } = useCatalogItems()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.category ?? '').toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q)
    ) : items
  }, [items, search])

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>()
    for (const item of filtered) {
      const cat = item.category ?? 'Autres'
      const arr = map.get(cat) ?? []
      arr.push(item)
      map.set(cat, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-semibold text-slate-900">Catalogue prestations</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une prestation..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
          ) : grouped.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              {search ? 'Aucune prestation trouvée' : 'Catalogue vide — ajoutez des prestations dans les paramètres'}
            </div>
          ) : (
            grouped.map(([category, categoryItems]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{category}</span>
                </div>
                {categoryItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item); onClose() }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary-50 transition-colors border-b border-slate-50 text-left"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.unit_price_ht.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} HT / {item.unit}
                        {item.is_labor && <span className="ml-2 text-primary-600">Main-d'œuvre</span>}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
