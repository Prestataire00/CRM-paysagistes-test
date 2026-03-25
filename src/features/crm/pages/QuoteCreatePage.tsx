import { brand } from '../../../config/brand'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  Search,
  User,
  Calculator,
  Loader2,
  X,
  Calendar,
  Clock,
  Mail,
  Phone,
  MapPin,
  Building2,
  Package,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { AiAssistButton } from '../../../components/ui/AiAssistButton'
import { DEFAULT_TVA_RATE, TAX_CREDIT_RATE } from '../../../utils/constants'
import { useClients } from '../../../queries/useClients'
import { useCreateQuote } from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import { TemplatePickerModal } from '../../billing/components/TemplatePickerModal'
import { CatalogPickerModal } from '../../catalog/components/CatalogPickerModal'
import type { QuoteStatus, QuoteTemplate } from '../../../types'
import type { CatalogItem } from '../../../services/catalog.service'

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
export function QuoteCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createQuoteMutation = useCreateQuote()

  // Form state
  const [title, setTitle] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClientLabel, setSelectedClientLabel] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([
    { id: 1, description: '', quantity: 1, unit: 'intervention', unitPrice: 0, isLabor: true },
  ])
  const [eligibleTaxCredit, setEligibleTaxCredit] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [acompte, setAcompte] = useState(0)
  const [nextId, setNextId] = useState(2)
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [validityDays, setValidityDays] = useState(30)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [specialConditions, setSpecialConditions] = useState(
    "Devis valable 30 jours. Services de jardinage \u00e9ligibles au cr\u00e9dit d'imp\u00f4t de 50% (article 199 sexdecies du CGI)."
  )

  const clientDropdownRef = useRef<HTMLDivElement>(null)

  // Debounce client search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearch(clientSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [clientSearch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch clients for autocomplete
  const { data: clientsData, isLoading: isLoadingClients } = useClients({
    search: debouncedClientSearch || undefined,
    pageSize: 50,
  })
  const clientOptions = clientsData?.data ?? []

  // ---------------------------------------------------------------------------
  // Line item management
  // ---------------------------------------------------------------------------
  const addLine = () => {
    setLines([...lines, { id: nextId, description: '', quantity: 1, unit: 'intervention', unitPrice: 0, isLabor: true }])
    setNextId(nextId + 1)
  }

  const removeLine = (id: number) => {
    setLines(lines.filter((l) => l.id !== id))
  }

  const updateLine = (id: number, field: keyof LineItem, value: string | number | boolean) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
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
  const acompteAmount = acompte > 0 ? total * (acompte / 100) : 0

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSubmit = async (status: QuoteStatus) => {
    // Validation
    if (!selectedClientId) {
      toast.warning('Client requis', 'Veuillez s\u00e9lectionner un client avant de continuer.')
      return
    }

    if (lines.length === 0 || lines.every((l) => !l.description.trim())) {
      toast.warning('Lignes requises', 'Ajoutez au moins une ligne de devis avec une description.')
      return
    }

    if (!title.trim()) {
      toast.warning('Titre requis', 'Veuillez saisir un titre pour le devis.')
      return
    }

    const invalidLines = lines.filter((l) => l.description.trim() && (l.quantity <= 0 || l.unitPrice <= 0))
    if (invalidLines.length > 0) {
      toast.warning('Lignes invalides', 'La quantité et le prix unitaire doivent être supérieurs à 0.')
      return
    }

    // Compute validity_date
    const validityDate = new Date(issueDate)
    validityDate.setDate(validityDate.getDate() + validityDays)

    // Map the form data to the shape expected by createQuote
    const quotePayload = {
      quote: {
        title: title.trim(),
        client_id: selectedClientId,
        prospect_id: null,
        status,
        description: null,
        issue_date: issueDate,
        validity_date: validityDate.toISOString().split('T')[0],
        accepted_date: null,
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
        acompte_percentage: acompte > 0 ? acompte : 0,
        pdf_url: null,
        created_by: null,
        assigned_commercial_id: null,
        converted_to_invoice_id: null,
      },
      lines: lines
        .filter((l) => l.description.trim())
        .map((l, index) => {
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
    }

    try {
      await createQuoteMutation.mutateAsync(quotePayload)

      if (status === 'envoye') {
        toast.success('Devis créé', 'Le devis a été créé et marqué comme envoyé.')
      } else {
        toast.success('Brouillon enregistré', 'Le devis a été sauvegardé en brouillon.')
      }
      navigate('/crm/devis')
    } catch (err) {
      toast.error(
        'Échec de la création',
        (err as Error).message || 'Une erreur est survenue lors de la création du devis.',
      )
    }
  }

  const isSaving = createQuoteMutation.isPending

  // ---------------------------------------------------------------------------
  // Preview modal state
  // ---------------------------------------------------------------------------
  const [showPreview, setShowPreview] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showCatalogPicker, setShowCatalogPicker] = useState(false)

  const handleInsertCatalogItem = useCallback((item: CatalogItem) => {
    setLines(prev => [...prev, {
      id: nextId,
      description: item.description ? `${item.name} — ${item.description}` : item.name,
      quantity: 1,
      unit: item.unit,
      unitPrice: item.unit_price_ht,
      isLabor: item.is_labor,
    }])
    setNextId(n => n + 1)
  }, [nextId])

  const handleApplyTemplate = (template: QuoteTemplate) => {
    if (template.lines.length > 0) {
      let counter = nextId
      const newLines = template.lines.map((l) => ({
        id: counter++,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unit_price_ht,
        isLabor: l.is_labor,
      }))
      setLines(newLines)
      setNextId(counter)
    }
    if (template.conditions) setSpecialConditions(template.conditions)
    if (template.payment_terms) setPaymentTerms(template.payment_terms)
    if (template.validity_days) setValidityDays(template.validity_days)
    setEligibleTaxCredit(template.eligible_tax_credit)
    toast.success('Modèle appliqué', `Le modèle "${template.name}" a été chargé.`)
  }

  // Find the selected client object for the preview
  const selectedClient = clientOptions.find((c) => c.id === selectedClientId) as unknown as Record<string, unknown> | undefined

  // ---------------------------------------------------------------------------
  // Client display helpers
  // ---------------------------------------------------------------------------
  function getClientDisplayName(client: Record<string, unknown>): string {
    const companyName = client.company_name ? String(client.company_name) : ''
    const firstName = client.first_name && client.first_name !== 'N/A' ? String(client.first_name) : ''
    const lastName = client.last_name && client.last_name !== 'N/A' ? String(client.last_name) : ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ')

    if (companyName) {
      return fullName ? `${companyName} — ${fullName}` : companyName
    }
    return fullName || '—'
  }

  function getClientSubline(client: Record<string, unknown>): string {
    const parts = [client.address_line1, client.postal_code, client.city].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : ''
  }

  return (
    <div>
      <PageHeader
        title="Nouveau devis"
        description="Création d'un devis client"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/crm/devis')}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Aperçu
            </button>
            <button
              onClick={() => handleSubmit('brouillon')}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Brouillon
            </button>
            <button
              onClick={() => handleSubmit('envoye')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form area */}
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

          {/* Client Selector */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              Client
            </h2>
            <div className="relative" ref={clientDropdownRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={selectedClientId ? selectedClientLabel : clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  if (selectedClientId) {
                    setSelectedClientId(null)
                    setSelectedClientLabel('')
                  }
                  setShowClientDropdown(true)
                }}
                onFocus={() => {
                  if (!selectedClientId) setShowClientDropdown(true)
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />

              {/* Dropdown */}
              {showClientDropdown && !selectedClientId && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {isLoadingClients && (
                    <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Chargement...
                    </div>
                  )}
                  {!isLoadingClients && clientOptions.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      Aucun client trouv&eacute;
                    </div>
                  )}
                  {clientOptions.map((client) => {
                    const raw = client as unknown as Record<string, unknown>
                    const name = getClientDisplayName(raw)
                    const sub = getClientSubline(raw)
                    return (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id)
                          setSelectedClientLabel(name)
                          setClientSearch('')
                          setShowClientDropdown(false)

                          // Auto-fill from client data
                          const isTaxCreditEligible = raw.eligible_tax_credit === true
                          setEligibleTaxCredit(isTaxCreditEligible)

                          const clientPaymentDays = Number(raw.payment_terms_days) || 30
                          setPaymentTerms(`Paiement à ${clientPaymentDays} jours`)

                          if (isTaxCreditEligible) {
                            setSpecialConditions(
                              "Devis valable 30 jours. Services de jardinage éligibles au crédit d'impôt de 50% (article 199 sexdecies du CGI)."
                            )
                          } else {
                            setSpecialConditions("Devis valable 30 jours.")
                          }
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        <p className="font-medium">{name}</p>
                        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected client display */}
            {selectedClientId && (
              <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary-900">{selectedClientLabel}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedClientId(null)
                    setSelectedClientLabel('')
                    setClientSearch('')
                  }}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  Changer
                </button>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-400" />
                Lignes de devis
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Depuis un modèle
                </button>
                <button
                  onClick={() => setShowCatalogPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  Catalogue
                </button>
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une ligne
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[40%]">Description</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[12%]">Qt&eacute;</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[15%]">Unit&eacute;</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[15%]">PU HT</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2 pr-3 w-[13%]">Total HT</th>
                    <th className="w-[5%] pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="group">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                            className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="Description de la prestation..."
                          />
                          <AiAssistButton
                            context="quote_description"
                            currentValue={line.description}
                            onApply={(text) => updateLine(line.id, 'description', text)}
                          />
                        </div>
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
                          <option value="m2">m&sup2;</option>
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
                          {(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;
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
                  placeholder="Ex : Paiement \u00e0 30 jours"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-medium text-slate-500">Conditions particuli&egrave;res</label>
                  <AiAssistButton
                    context="quote_conditions"
                    currentValue={specialConditions}
                    onApply={(text) => setSpecialConditions(text)}
                  />
                </div>
                <textarea
                  rows={3}
                  value={specialConditions}
                  onChange={(e) => setSpecialConditions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Conditions particuli\u00e8res, d\u00e9lais, informations compl\u00e9mentaires..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Totals Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">R&eacute;capitulatif</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Sous-total HT</span>
                <span className="font-medium text-slate-900">
                  {subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 flex-shrink-0">Remise</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-slate-500">%</span>
                <span className="ml-auto text-sm font-medium text-red-600">
                  -{discountAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Total HT apr&egrave;s remise</span>
                <span className="font-medium text-slate-900">
                  {afterDiscount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">TVA ({DEFAULT_TVA_RATE}%)</span>
                <span className="font-medium text-slate-900">
                  {tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">Total TTC</span>
                <span className="text-lg font-bold text-slate-900">
                  {total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;
                </span>
              </div>

              {/* Acompte */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm text-slate-600 flex-shrink-0">Acompte</span>
                <input
                  type="number"
                  value={acompte}
                  onChange={(e) => setAcompte(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-slate-500">%</span>
                {acompteAmount > 0 && (
                  <span className="ml-auto text-sm font-medium text-amber-700">
                    {acompteAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </span>
                )}
              </div>
              {acompteAmount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                  <p className="text-amber-700 font-medium">Acompte à la commande : {acompteAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                  <p className="text-amber-600 mt-0.5">Solde restant : {(total - acompteAmount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
              )}

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

            {/* Quote info */}
            <div className="mt-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date du devis</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Validit&eacute;</label>
                <select
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value={15}>15 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={60}>60 jours</option>
                  <option value={90}>90 jours</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="relative w-full max-w-4xl mx-4 bg-white rounded-xl shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white shadow-md hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>

            {/* Preview content — same layout as QuoteDetailPage print view */}
            <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {/* Company header band */}
              <div className="bg-primary-600 text-white px-8 py-6 rounded-t-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
                    <p className="text-primary-200 text-sm mt-1">Petits travaux de jardinage</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tracking-tight">DEVIS</p>
                    <p className="text-primary-200 text-sm mt-1">Aperçu — non enregistré</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 space-y-6">
                {/* Status + Dates row */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                    Brouillon
                  </span>
                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Émis le {new Date(issueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Valide {validityDays} jours
                    </span>
                  </div>
                </div>

                {/* Client info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Émetteur</h3>
                    <p className="text-sm font-bold text-slate-900">{brand.name}</p>
                    <p className="text-sm text-slate-500 mt-1">Petits travaux de jardinage</p>
                    <p className="flex items-center gap-2 text-sm text-slate-500 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      5 La Boisselière RD 751, 37700 La Ville-aux-Dames
                    </p>
                    <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      SIRET : 489 090 779 00013
                    </p>
                    <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {brand.email}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      02 47 44 41 12
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Destinataire</h3>
                    <div className="space-y-1.5">
                      {selectedClient ? (
                        <>
                          {selectedClient.company_name && (
                            <p className="text-sm font-bold text-slate-900">{String(selectedClient.company_name)}</p>
                          )}
                          {(() => {
                            const fn = selectedClient.first_name && selectedClient.first_name !== 'N/A' ? String(selectedClient.first_name) : ''
                            const ln = selectedClient.last_name && selectedClient.last_name !== 'N/A' ? String(selectedClient.last_name) : ''
                            const name = [fn, ln].filter(Boolean).join(' ')
                            return name ? (
                              <p className="flex items-center gap-2 text-sm text-slate-700">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {name}
                              </p>
                            ) : null
                          })()}
                          {(selectedClient.address_line1 || selectedClient.city) && (
                            <p className="flex items-center gap-2 text-sm text-slate-500">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {[selectedClient.address_line1, selectedClient.postal_code, selectedClient.city].filter(Boolean).join(', ')}
                            </p>
                          )}
                          {selectedClient.email && (
                            <p className="flex items-center gap-2 text-sm text-slate-500">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {String(selectedClient.email)}
                            </p>
                          )}
                          {selectedClient.phone && (
                            <p className="flex items-center gap-2 text-sm text-slate-500">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {String(selectedClient.phone)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Aucun client sélectionné</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Title */}
                {title && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Objet</h3>
                    <p className="text-sm font-medium text-slate-700">{title}</p>
                  </div>
                )}

                {/* Lines table */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Prestations</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Qté</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Unité</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Prix unit. HT</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">TVA</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.filter((l) => l.description.trim()).map((line, idx) => {
                          const lineTotal = line.quantity * line.unitPrice
                          return (
                            <tr key={line.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                <div className="flex items-center gap-2">
                                  {line.description}
                                  {line.isLabor && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">MO</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600 text-center">{line.quantity}</td>
                              <td className="px-3 py-3 text-sm text-slate-500 text-center">{line.unit}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">
                                {line.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500 text-right">{DEFAULT_TVA_RATE}%</td>
                              <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">
                                {lineTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              </td>
                            </tr>
                          )
                        })}
                        {lines.filter((l) => l.description.trim()).length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-sm text-slate-400 text-center">
                              Aucune ligne de prestation
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Sous-total HT</span>
                      <span className="font-medium">{subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Remise ({discount}%)</span>
                        <span className="font-medium">-{discountAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>TVA ({DEFAULT_TVA_RATE}%)</span>
                      <span className="font-medium">{tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Total TTC</span>
                      <span>{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                    </div>
                    {eligibleTaxCredit && creditImpot > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-emerald-600 pt-2 border-t border-dashed border-emerald-200">
                          <span>Crédit d'impôt ({TAX_CREDIT_RATE}%)</span>
                          <span className="font-medium">-{creditImpot.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between text-base font-bold text-emerald-700">
                          <span>Net après crédit</span>
                          <span>{netAfterCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Conditions */}
                {(paymentTerms || specialConditions) && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    {paymentTerms && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Conditions de paiement</h3>
                        <p className="text-sm text-slate-600">{paymentTerms}</p>
                      </div>
                    )}
                    {specialConditions && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Conditions particulières</h3>
                        <p className="text-sm text-slate-600">{specialConditions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tax credit legal mention */}
                {eligibleTaxCredit && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-700">
                      Services de jardinage éligibles au crédit d'impôt de 50% au titre de l'article 199 sexdecies du Code Général des Impôts
                      (plafond de 5 000 € de dépenses par an et par foyer fiscal).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-8 py-4 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl bg-slate-50">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setShowPreview(false)
                  handleSubmit('brouillon')
                }}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                Enregistrer en brouillon
              </button>
              <button
                onClick={() => {
                  setShowPreview(false)
                  handleSubmit('envoye')
                }}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Picker Modal */}
      <TemplatePickerModal
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleApplyTemplate}
      />

      {/* Catalog Picker Modal */}
      {showCatalogPicker && (
        <CatalogPickerModal
          onSelect={handleInsertCatalogItem}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}
    </div>
  )
}
