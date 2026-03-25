import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import {
  useQuoteTemplate,
  useCreateQuoteTemplate,
  useUpdateQuoteTemplate,
} from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import { DEFAULT_TVA_RATE } from '../../../utils/constants'
import type { QuoteTemplateLine } from '../../../types'

interface FormLine extends QuoteTemplateLine {
  _key: number
}

let lineKeyCounter = 0
function nextKey() {
  return ++lineKeyCounter
}

function emptyLine(): FormLine {
  return {
    _key: nextKey(),
    description: '',
    quantity: 1,
    unit: 'intervention',
    unit_price_ht: 0,
    tva_rate: DEFAULT_TVA_RATE,
    is_labor: true,
    sort_order: 0,
  }
}

export function QuoteTemplateFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const fromId = searchParams.get('from')
  const isEdit = !!id

  const { data: existingTemplate, isLoading: isLoadingExisting } = useQuoteTemplate(id)
  const { data: sourceTemplate, isLoading: isLoadingSource } = useQuoteTemplate(fromId ?? undefined)
  const createMutation = useCreateQuoteTemplate()
  const updateMutation = useUpdateQuoteTemplate()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<FormLine[]>([emptyLine()])
  const [conditions, setConditions] = useState(
    "Devis valable 30 jours. Services de jardinage éligibles au crédit d'impôt de 50% (article 199 sexdecies du CGI)."
  )
  const [paymentTerms, setPaymentTerms] = useState('')
  const [validityDays, setValidityDays] = useState(30)
  const [tvaRate, setTvaRate] = useState(DEFAULT_TVA_RATE)
  const [eligibleTaxCredit, setEligibleTaxCredit] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Populate form from existing template (edit) or source template (duplicate)
  useEffect(() => {
    const source = isEdit ? existingTemplate : sourceTemplate
    if (!source || initialized) return

    setName(isEdit ? source.name : `${source.name} (copie)`)
    setDescription(source.description ?? '')
    setLines(
      source.lines.length > 0
        ? source.lines.map((l) => ({ ...l, _key: nextKey() }))
        : [emptyLine()]
    )
    setConditions(source.conditions ?? '')
    setPaymentTerms(source.payment_terms ?? '')
    setValidityDays(source.validity_days)
    setTvaRate(source.tva_rate)
    setEligibleTaxCredit(source.eligible_tax_credit)
    setInitialized(true)
  }, [existingTemplate, sourceTemplate, isEdit, initialized])

  // Line management
  const addLine = () => setLines([...lines, emptyLine()])
  const removeLine = (key: number) => setLines(lines.filter((l) => l._key !== key))
  const updateLine = (key: number, field: keyof FormLine, value: string | number | boolean) => {
    setLines(lines.map((l) => (l._key === key ? { ...l, [field]: value } : l)))
  }

  // Submit
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Nom requis', 'Veuillez donner un nom au modèle.')
      return
    }

    const validLines = lines.filter((l) => l.description.trim())
    if (validLines.length === 0) {
      toast.warning('Lignes requises', 'Ajoutez au moins une ligne avec une description.')
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      lines: validLines.map((l, i) => ({
        description: l.description.trim(),
        quantity: l.quantity,
        unit: l.unit,
        unit_price_ht: l.unit_price_ht,
        tva_rate: l.tva_rate,
        is_labor: l.is_labor,
        sort_order: i,
      })),
      conditions: conditions.trim() || null,
      payment_terms: paymentTerms.trim() || null,
      validity_days: validityDays,
      tva_rate: tvaRate,
      eligible_tax_credit: eligibleTaxCredit,
      is_active: true,
      created_by: null,
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: id!, input: payload })
        toast.success('Modèle mis à jour', `Le modèle "${name}" a été enregistré.`)
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Modèle créé', `Le modèle "${name}" est prêt à l'emploi.`)
      }
      navigate('/billing/templates')
    } catch {
      toast.error('Erreur', "Impossible d'enregistrer le modèle.")
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const isLoading = isLoadingExisting || isLoadingSource

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  const formatPrice = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price_ht, 0)
  const tvaAmount = subtotal * (tvaRate / 100)
  const total = subtotal + tvaAmount

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Modifier le modèle' : 'Nouveau modèle de devis'}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/billing/templates')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Enregistrer' : 'Créer le modèle'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Informations générales</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Nom du modèle *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Entretien jardin standard"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description courte du modèle..."
                rows={2}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Lignes de prestation</h2>
              <button
                onClick={addLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line._key}
                  className="flex items-start gap-2 bg-slate-50 rounded-xl p-3"
                >
                  <GripVertical className="w-4 h-4 text-slate-300 mt-2.5 shrink-0 cursor-grab" />

                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line._key, 'description', e.target.value)}
                        placeholder="Description"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(line._key, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Qté"
                        min={0}
                        step={0.5}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white text-right"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <select
                        value={line.unit}
                        onChange={(e) => updateLine(line._key, 'unit', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                      >
                        <option value="intervention">Intervention</option>
                        <option value="heure">Heure</option>
                        <option value="jour">Jour</option>
                        <option value="m2">m²</option>
                        <option value="ml">ml</option>
                        <option value="forfait">Forfait</option>
                        <option value="unite">Unité</option>
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        value={line.unit_price_ht}
                        onChange={(e) => updateLine(line._key, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                        placeholder="Prix HT"
                        min={0}
                        step={0.01}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white text-right"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-1 flex items-center justify-end">
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={line.is_labor}
                          onChange={(e) => updateLine(line._key, 'is_labor', e.target.checked)}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        MO
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={() => removeLine(line._key)}
                    disabled={lines.length === 1}
                    className="mt-2 p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Conditions</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Conditions particulières</label>
              <textarea
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Modalités de paiement</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ex: Paiement à réception"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Paramètres</h2>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Validité (jours)</label>
              <input
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                min={1}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Taux TVA (%)</label>
              <select
                value={tvaRate}
                onChange={(e) => setTvaRate(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value={20}>20%</option>
                <option value={10}>10%</option>
                <option value={5.5}>5.5%</option>
                <option value={0}>0%</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={eligibleTaxCredit}
                onChange={(e) => setEligibleTaxCredit(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Éligible crédit d'impôt</span>
            </label>
          </div>

          {/* Preview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Récapitulatif</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total HT</span>
                <span className="font-medium text-slate-800">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA ({tvaRate}%)</span>
                <span className="font-medium text-slate-800">{formatPrice(tvaAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-medium text-slate-700">Total TTC</span>
                <span className="font-bold text-slate-900">{formatPrice(total)}</span>
              </div>
              {eligibleTaxCredit && (
                <div className="flex justify-between text-green-600">
                  <span className="text-xs">Après crédit d'impôt (50%)</span>
                  <span className="font-medium">{formatPrice(total / 2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
