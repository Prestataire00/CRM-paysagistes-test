import { useState } from 'react'
import { FileText, Loader2, Search, Check } from 'lucide-react'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { useQuoteTemplates } from '../../../queries/useBilling'
import type { QuoteTemplate } from '../../../types'

interface TemplatePickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (template: QuoteTemplate) => void
}

export function TemplatePickerModal({ open, onClose, onSelect }: TemplatePickerModalProps) {
  const { data: templates, isLoading } = useQuoteTemplates()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = (templates ?? []).filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleConfirm = () => {
    const template = templates?.find((t) => t.id === selectedId)
    if (template) {
      onSelect(template)
      onClose()
      setSelectedId(null)
      setSearch('')
    }
  }

  const formatPrice = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title="Choisir un modèle"
        description="Sélectionnez un modèle pour pré-remplir votre devis"
      />

      <div className="px-6 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un modèle..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        {/* Template list */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {search ? 'Aucun modèle trouvé' : 'Aucun modèle disponible'}
              </p>
            </div>
          ) : (
            filtered.map((t) => {
              const isSelected = selectedId === t.id
              const lineTotal = t.lines.reduce((sum, l) => sum + l.quantity * l.unit_price_ht, 0)

              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(isSelected ? null : t.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-800 truncate">{t.name}</h4>
                        {isSelected && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                      </div>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-700 shrink-0 ml-3">
                      {formatPrice(lineTotal)} HT
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <span>{t.lines.length} ligne{t.lines.length > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>TVA {t.tva_rate}%</span>
                    <span>•</span>
                    <span>{t.validity_days}j validité</span>
                    {t.eligible_tax_credit && (
                      <>
                        <span>•</span>
                        <span className="text-green-600">Crédit d'impôt</span>
                      </>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedId}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Utiliser ce modèle
        </button>
      </ModalFooter>
    </Modal>
  )
}
