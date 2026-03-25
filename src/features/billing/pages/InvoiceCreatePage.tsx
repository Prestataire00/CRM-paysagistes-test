import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Search,
  User,
  X,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DEFAULT_TVA_RATE, TAX_CREDIT_RATE } from '../../../utils/constants'
import { useClients } from '../../../queries/useClients'
import { useCreateInvoice } from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useAuth } from '../../../contexts/AuthContext'
import type { InvoiceStatus } from '../../../types'

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

const unitOptions = [
  { value: 'Intervention', label: 'Intervention' },
  { value: 'Heure', label: 'Heure' },
  { value: 'Forfait', label: 'Forfait' },
  { value: 'M²', label: 'M²' },
  { value: 'ML', label: 'ML' },
  { value: 'Unité', label: 'Unité' },
]

const statusOptions: { value: InvoiceStatus; label: string }[] = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'emise', label: 'Émise' },
  { value: 'envoyee', label: 'Envoyée (en attente)' },
  { value: 'payee', label: 'Payée' },
  { value: 'en_retard', label: 'En retard' },
]

const currencyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function InvoiceCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const createInvoice = useCreateInvoice()

  // Form state
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<InvoiceStatus>('brouillon')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [tvaRate, setTvaRate] = useState(DEFAULT_TVA_RATE)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('Paiement à 30 jours')
  const [description, setDescription] = useState('')

  // Client search
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; eligible_tax_credit?: boolean } | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const { data: clientsResult } = useClients({ search: clientSearch, pageSize: 10 })
  const clientResults = clientsResult?.data ?? []

  // Lines
  const [lines, setLines] = useState<LineItem[]>([
    { id: 1, description: '', quantity: 1, unit: 'Intervention', unitPrice: 0, isLabor: true },
  ])
  let nextId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1

  const addLine = useCallback(() => {
    setLines(prev => [...prev, { id: nextId, description: '', quantity: 1, unit: 'Intervention', unitPrice: 0, isLabor: true }])
  }, [nextId])

  const removeLine = useCallback((id: number) => {
    setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev)
  }, [])

  const updateLine = useCallback((id: number, field: keyof LineItem, value: string | number | boolean) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }, [])

  // Calculations
  const calculations = useMemo(() => {
    const subtotalHt = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    const discountAmount = subtotalHt * discountPercent / 100
    const totalHtAfterDiscount = subtotalHt - discountAmount
    const tvaAmount = totalHtAfterDiscount * tvaRate / 100
    const totalTtc = totalHtAfterDiscount + tvaAmount
    const laborHt = lines.filter(l => l.isLabor).reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    const taxCreditEligible = selectedClient?.eligible_tax_credit ?? false
    const taxCreditAmount = taxCreditEligible ? laborHt * TAX_CREDIT_RATE / 100 : 0
    const netAfterCredit = totalTtc - taxCreditAmount
    return { subtotalHt, discountAmount, totalHtAfterDiscount, tvaAmount, totalTtc, laborHt, taxCreditAmount, netAfterCredit, taxCreditEligible }
  }, [lines, discountPercent, tvaRate, selectedClient])

  // Submit
  const handleSave = useCallback(async () => {
    if (!selectedClient) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    if (!title.trim()) {
      toast.error('Veuillez saisir un titre')
      return
    }
    if (lines.every(l => !l.description.trim())) {
      toast.error('Veuillez ajouter au moins une ligne')
      return
    }

    const invoiceData = {
      client_id: selectedClient.id,
      quote_id: null,
      chantier_id: null,
      title,
      description: description || null,
      status,
      issue_date: issueDate,
      due_date: dueDate,
      paid_date: status === 'payee' ? issueDate : null,
      subtotal_ht: calculations.subtotalHt,
      tva_rate: tvaRate,
      tva_amount: calculations.tvaAmount,
      total_ttc: calculations.totalTtc,
      discount_percentage: discountPercent,
      discount_amount: calculations.discountAmount,
      amount_paid: status === 'payee' ? calculations.totalTtc : 0,
      payment_method: null,
      payment_reference: null,
      eligible_tax_credit: calculations.taxCreditEligible,
      labor_amount_ht: calculations.laborHt,
      tax_credit_amount: calculations.taxCreditAmount,
      net_after_credit: calculations.netAfterCredit,
      is_archived: false,
      pdf_url: null,
      exported_at: null,
      accounting_reference: null,
      created_by: user?.id ?? null,
    }

    const invoiceLines = lines
      .filter(l => l.description.trim())
      .map((l, i) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price_ht: l.unitPrice,
        tva_rate: tvaRate,
        total_ht: l.quantity * l.unitPrice,
        total_ttc: l.quantity * l.unitPrice * (1 + tvaRate / 100),
        is_labor: l.isLabor,
        sort_order: i,
      }))

    try {
      const created = await createInvoice.mutateAsync({ invoice: invoiceData as never, lines: invoiceLines })
      toast.success('Facture créée avec succès')
      navigate(`/billing/invoices/${created.id}`)
    } catch (err) {
      toast.error('Erreur lors de la création', (err as Error).message)
    }
  }, [selectedClient, title, description, status, issueDate, dueDate, lines, calculations, tvaRate, discountPercent, user, createInvoice, toast, navigate])

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Nouvelle facture"
        description="Création d'une facture client"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/billing/invoices')}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Titre de la facture</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Entretien jardin mars 2026"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Client */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Client</h3>
            </div>

            {!selectedClient ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true) }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Rechercher un client..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {showClientDropdown && clientResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clientResults.map(c => {
                      const name = c.company_name || `${c.first_name} ${c.last_name}`
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedClient({ id: c.id, name: `${name} — ${c.first_name} ${c.last_name}`, eligible_tax_credit: c.eligible_tax_credit })
                            setShowClientDropdown(false)
                            setClientSearch('')
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium">{name}</span>
                          {c.company_name && <span className="text-slate-400"> — {c.first_name} {c.last_name}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{selectedClient.name}</span>
                <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Lignes de facture</h3>
              <button onClick={addLine} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Plus className="w-4 h-4" />
                Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-500 uppercase px-1">
                <div className="col-span-4">Description</div>
                <div className="col-span-1">Qté</div>
                <div className="col-span-2">Unité</div>
                <div className="col-span-2">PU HT</div>
                <div className="col-span-2">Total HT</div>
                <div className="col-span-1" />
              </div>

              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-4 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Description"
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                  />
                  <input
                    className="col-span-1 px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={e => updateLine(line.id, 'quantity', Number(e.target.value) || 1)}
                  />
                  <select
                    className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={line.unit}
                    onChange={e => updateLine(line.id, 'unit', e.target.value)}
                  >
                    {unitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.unitPrice}
                    onChange={e => updateLine(line.id, 'unitPrice', Number(e.target.value) || 0)}
                  />
                  <div className="col-span-2 text-sm font-medium text-slate-700 text-right">
                    {currencyFmt.format(line.quantity * line.unitPrice)}
                  </div>
                  <button
                    onClick={() => removeLine(line.id)}
                    className="col-span-1 p-1 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Notes et conditions</h3>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Conditions de paiement</label>
            <input
              type="text"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description / Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes complémentaires..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-4">
            <h3 className="font-semibold text-slate-900 mb-4">Récapitulatif</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total HT</span>
                <span className="font-medium">{currencyFmt.format(calculations.subtotalHt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Remise</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={e => setDiscountPercent(Number(e.target.value) || 0)}
                    className="w-14 px-2 py-1 border border-slate-200 rounded text-sm text-right"
                  />
                  <span className="text-slate-400">%</span>
                  <span className="ml-2 text-red-500 font-medium">-{currencyFmt.format(calculations.discountAmount)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total HT après remise</span>
                <span className="font-medium">{currencyFmt.format(calculations.totalHtAfterDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA ({tvaRate}%)</span>
                <span>{currencyFmt.format(calculations.tvaAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2">
                <span>Total TTC</span>
                <span>{currencyFmt.format(calculations.totalTtc)}</span>
              </div>

              {calculations.taxCreditEligible && (
                <div className="mt-2 p-2.5 bg-emerald-50 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700">Crédit d'impôt ({TAX_CREDIT_RATE}%)</p>
                  <p className="text-sm font-bold text-emerald-700">-{currencyFmt.format(calculations.taxCreditAmount)}</p>
                  <p className="text-xs text-emerald-600">Coût réel pour le client : {currencyFmt.format(calculations.netAfterCredit)}</p>
                </div>
              )}
            </div>

            {/* Dates & Status */}
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Statut</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as InvoiceStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date de facture</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date d'échéance</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Taux TVA (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tvaRate}
                  onChange={e => setTvaRate(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={createInvoice.isPending}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {createInvoice.isPending ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Enregistrer la facture
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
