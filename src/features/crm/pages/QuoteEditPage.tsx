import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Calculator,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DEFAULT_TVA_RATE, TAX_CREDIT_RATE } from '../../../utils/constants'
import { useQuote, useUpdateQuote } from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LineItem {
  id: number
  description: string
  quantity: number
  unit: string
  unitPrice: number
  isLabor: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuoteEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: quote, isLoading, error } = useQuote(id)
  const updateQuoteMutation = useUpdateQuote()

  // Form state
  const [title, setTitle] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [eligibleTaxCredit, setEligibleTaxCredit] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [nextId, setNextId] = useState(1)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [specialConditions, setSpecialConditions] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Populate form from existing quote
  useEffect(() => {
    if (!quote || initialized) return

    setTitle(quote.title || '')
    setEligibleTaxCredit(quote.eligible_tax_credit ?? true)
    setDiscount(quote.discount_percentage ?? 0)
    setPaymentTerms(quote.payment_terms || '')
    setSpecialConditions(quote.special_conditions || '')

    const quoteAny = quote as unknown as Record<string, unknown>
    const existingLines = (quoteAny.lines ?? []) as Array<Record<string, unknown>>

    const mappedLines: LineItem[] = existingLines.map((line, idx) => ({
      id: idx + 1,
      description: String(line.description || ''),
      quantity: Number(line.quantity || 1),
      unit: String(line.unit || 'intervention'),
      unitPrice: Number(line.unit_price_ht || 0),
      isLabor: Boolean(line.is_labor),
    }))

    setLines(mappedLines.length > 0 ? mappedLines : [{ id: 1, description: '', quantity: 1, unit: 'intervention', unitPrice: 0, isLabor: true }])
    setNextId(mappedLines.length + 2)
    setInitialized(true)
  }, [quote, initialized])

  // ---------------------------------------------------------------------------
  // Line item management
  // ---------------------------------------------------------------------------
  const addLine = () => {
    setLines([...lines, { id: nextId, description: '', quantity: 1, unit: 'intervention', unitPrice: 0, isLabor: true }])
    setNextId(nextId + 1)
  }

  const removeLine = (lineId: number) => {
    setLines(lines.filter((l) => l.id !== lineId))
  }

  const updateLine = (lineId: number, field: keyof LineItem, value: string | number | boolean) => {
    setLines(lines.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)))
  }

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const discountAmount = subtotal * (discount / 100)
  const afterDiscount = subtotal - discountAmount
  const tva = afterDiscount * (DEFAULT_TVA_RATE / 100)
  const total = afterDiscount + tva
  const creditImpot = eligibleTaxCredit ? total * (TAX_CREDIT_RATE / 100) : 0
  const netAfterCredit = total - creditImpot

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!id || !quote) return

    if (!title.trim()) {
      toast.warning('Titre requis', 'Veuillez saisir un titre pour le devis.')
      return
    }

    const validLines = lines.filter((l) => l.description.trim())
    if (validLines.length === 0) {
      toast.warning('Lignes requises', 'Ajoutez au moins une ligne de devis avec une description.')
      return
    }

    const invalidLines = validLines.filter((l) => l.quantity <= 0 || l.unitPrice <= 0)
    if (invalidLines.length > 0) {
      toast.warning('Lignes invalides', 'La quantité et le prix unitaire doivent être supérieurs à 0.')
      return
    }

    try {
      await updateQuoteMutation.mutateAsync({
        id,
        quote: {
          title: title.trim(),
          subtotal_ht: subtotal,
          tva_rate: DEFAULT_TVA_RATE,
          tva_amount: tva,
          total_ttc: total,
          discount_percentage: discount,
          discount_amount: discountAmount,
          eligible_tax_credit: eligibleTaxCredit,
          tax_credit_amount: creditImpot,
          net_after_credit: netAfterCredit,
          payment_terms: paymentTerms || null,
          special_conditions: specialConditions || null,
        },
        lines: validLines.map((l, index) => {
          const lineTotal = l.quantity * l.unitPrice
          const lineTva = lineTotal * (DEFAULT_TVA_RATE / 100)
          return {
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price_ht: l.unitPrice,
            tva_rate: DEFAULT_TVA_RATE,
            total_ht: lineTotal,
            total_ttc: lineTotal + lineTva,
            is_labor: l.isLabor,
            sort_order: index,
          }
        }),
      })

      toast.success('Devis modifié', 'Les modifications ont été enregistrées.')
      navigate(`/crm/devis/${id}`)
    } catch (err) {
      toast.error('Erreur', (err as Error).message || 'Impossible de sauvegarder le devis.')
    }
  }

  const isSaving = updateQuoteMutation.isPending

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  // Not found or not editable
  if (error || !quote) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-slate-500">Devis introuvable</p>
        <button onClick={() => navigate('/crm/devis')} className="text-sm text-primary-600 hover:underline">
          Retour à la liste
        </button>
      </div>
    )
  }

  if (quote.status !== 'brouillon') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-slate-500">Seuls les devis en brouillon peuvent être modifiés.</p>
        <button onClick={() => navigate(`/crm/devis/${id}`)} className="text-sm text-primary-600 hover:underline">
          Retour au devis
        </button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Modifier — ${quote.reference || 'Devis'}`}
        description={quote.title}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/crm/devis/${id}`)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <label className="block text-sm font-semibold text-slate-900 mb-2">Titre du devis</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Contrat annuel entretien jardin..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-400" />
                Lignes de devis
              </h2>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[40%]">Description</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[12%]">Qté</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[15%]">Unité</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[15%]">PU HT</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[13%]">Total HT</th>
                    <th className="w-[5%] pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="group">
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="Description de la prestation..."
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                          min={1}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="intervention">Intervention</option>
                          <option value="heure">Heure</option>
                          <option value="forfait">Forfait</option>
                          <option value="m2">m²</option>
                          <option value="ml">ml</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.id, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                          min={0}
                          step={5}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <span className="text-sm font-medium text-slate-900">
                          {(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Notes et conditions</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Conditions de paiement</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Ex : Paiement à 30 jours"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Conditions particulières</label>
                <textarea
                  rows={3}
                  value={specialConditions}
                  onChange={(e) => setSpecialConditions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Totals Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Récapitulatif</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Sous-total HT</span>
                <span className="font-medium text-slate-900">
                  {subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 flex-shrink-0">Remise</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-slate-500">%</span>
                <span className="ml-auto text-sm font-medium text-red-600">
                  -{discountAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">TVA ({DEFAULT_TVA_RATE}%)</span>
                <span className="font-medium text-slate-900">
                  {tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">Total TTC</span>
                <span className="text-lg font-bold text-slate-900">
                  {total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              {eligibleTaxCredit && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2">
                  <p className="text-xs text-emerald-700 font-medium">Crédit d'impôt ({TAX_CREDIT_RATE}%)</p>
                  <p className="text-sm font-bold text-emerald-800 mt-0.5">
                    -{creditImpot.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-1">
                    Coût réel pour le client : {netAfterCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </p>
                </div>
              )}
            </div>

            {/* Credit toggle */}
            <div className="mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eligibleTaxCredit}
                  onChange={(e) => setEligibleTaxCredit(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Éligible au crédit d'impôt</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
