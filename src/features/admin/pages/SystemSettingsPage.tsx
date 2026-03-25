import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  CreditCard,
  Calendar,
  Bell,
  Save,
  Mail,
  MapPin,
  Phone,
  Globe,
  FileText,
  Clock,
  Users,
  Smartphone,
  Shield,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useSettingsByCategory, useUpdateSetting } from '../../../queries/useAdmin'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useAuth } from '../../../contexts/AuthContext'
import type { Setting } from '../../../types'

// ---------------------------------------------------------------------------
// Category tabs
// ---------------------------------------------------------------------------
const categories = [
  { id: 'company', dbCategory: 'company', label: 'Entreprise', icon: Building2 },
  { id: 'billing', dbCategory: 'billing', label: 'Facturation', icon: CreditCard },
  { id: 'planning', dbCategory: 'planning', label: 'Planning', icon: Calendar },
  { id: 'notifications', dbCategory: 'notifications', label: 'Notifications', icon: Bell },
] as const

type CategoryId = (typeof categories)[number]['id']

// ---------------------------------------------------------------------------
// Helper: get setting value from DB grouped data, with local override
// ---------------------------------------------------------------------------
function getSettingValue(
  settingsMap: Record<string, Setting[]> | undefined,
  category: string,
  key: string,
  localEdits: Record<string, unknown>,
  fallback: unknown = ''
): unknown {
  // Local edit takes precedence
  if (key in localEdits) return localEdits[key]

  // Then DB value
  if (settingsMap && settingsMap[category]) {
    const setting = settingsMap[category].find((s) => s.key === key)
    if (setting) return setting.value ?? fallback
  }
  return fallback
}

function asString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return fallback
}

function asNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'number') return val
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function asBool(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val
  return fallback
}

// ---------------------------------------------------------------------------
// Skeleton for loading
// ---------------------------------------------------------------------------
function SettingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
            <div className="h-10 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SystemSettingsPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('company')
  const [localEdits, setLocalEdits] = useState<Record<string, unknown>>({})
  const [isSaving, setIsSaving] = useState(false)

  const toast = useToast()
  const { user } = useAuth()
  const { data: settingsMap, isLoading, isError } = useSettingsByCategory()
  const updateSettingMutation = useUpdateSetting()

  // Reset local edits when switching categories
  useEffect(() => {
    setLocalEdits({})
  }, [activeCategory])

  const setValue = useCallback((key: string, value: unknown) => {
    setLocalEdits((prev) => ({ ...prev, [key]: value }))
  }, [])

  const get = useCallback(
    (category: string, key: string, fallback: unknown = '') =>
      getSettingValue(settingsMap, category, key, localEdits, fallback),
    [settingsMap, localEdits]
  )

  // Batch save all local edits
  const handleSave = async () => {
    const keys = Object.keys(localEdits)
    if (keys.length === 0) {
      toast.info('Rien a sauvegarder', 'Aucune modification detectee.')
      return
    }

    setIsSaving(true)
    try {
      const updatedBy = user?.id ?? ''
      await Promise.all(
        keys.map((key) =>
          updateSettingMutation.mutateAsync({ key, value: localEdits[key], updatedBy })
        )
      )
      toast.success('Paramètres sauvegardés', `${keys.length} paramètre(s) mis à jour.`)
      setLocalEdits({})
    } catch {
      toast.error('Erreur lors de la sauvegarde', 'Impossible de sauvegarder les paramètres.')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = Object.keys(localEdits).length > 0

  return (
    <div>
      <PageHeader
        title="Parametres systeme"
        description="Configuration generale de l'application"
        actions={
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={() => setLocalEdits({})}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Réinitialiser
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                hasChanges
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Sidebar */}
        <div className="lg:col-span-1">
          <nav className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors border-b border-slate-100 last:border-b-0 ${
                  activeCategory === cat.id
                    ? 'bg-primary-50 text-primary-700 border-l-2 border-l-primary-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {isLoading && <SettingSkeleton />}

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-sm text-red-600 font-medium">Erreur lors du chargement des parametres.</p>
            </div>
          )}

          {!isLoading && !isError && activeCategory === 'company' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Informations de l'entreprise
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    { key: 'company_name', label: 'Raison sociale', icon: Building2 },
                    { key: 'company_siret', label: 'SIRET', icon: FileText },
                    { key: 'company_phone', label: 'Telephone', icon: Phone },
                    { key: 'company_email', label: 'Email', icon: Mail },
                    { key: 'company_website', label: 'Site web', icon: Globe },
                    { key: 'company_tva_number', label: 'N. TVA', icon: FileText },
                  ] as const).map((field) => (
                    <div key={field.key}>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                        <field.icon className="w-3 h-3" />
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={asString(get('company', field.key))}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <MapPin className="w-3 h-3" />
                    Adresse
                  </label>
                  <textarea
                    rows={3}
                    value={asString(get('company', 'company_address'))}
                    onChange={(e) => setValue('company_address', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-400" />
                  Agrements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">N. agrement SAP</label>
                    <input
                      type="text"
                      value={asString(get('company', 'company_sap_number'))}
                      onChange={(e) => setValue('company_sap_number', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Date d'expiration</label>
                    <input
                      type="date"
                      value={asString(get('company', 'company_sap_expiry'))}
                      onChange={(e) => setValue('company_sap_expiry', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !isError && activeCategory === 'billing' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-400" />
                Parametres de facturation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Taux de TVA par defaut (%)</label>
                  <input
                    type="number"
                    value={asNumber(get('billing', 'default_tva_rate', 20))}
                    onChange={(e) => setValue('default_tva_rate', Math.max(0, Math.min(100, Number(e.target.value))))}
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Taux credit d'impot (%)</label>
                  <input
                    type="number"
                    value={asNumber(get('billing', 'tax_credit_rate', 50))}
                    onChange={(e) => setValue('tax_credit_rate', Math.max(0, Math.min(100, Number(e.target.value))))}
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Prefixe factures</label>
                  <input
                    type="text"
                    value={asString(get('billing', 'invoice_prefix', 'FA-'))}
                    onChange={(e) => setValue('invoice_prefix', e.target.value)}
                    maxLength={10}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Prefixe devis</label>
                  <input
                    type="text"
                    value={asString(get('billing', 'quote_prefix', 'D-'))}
                    onChange={(e) => setValue('quote_prefix', e.target.value)}
                    maxLength={10}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Delai de paiement (jours)</label>
                  <input
                    type="number"
                    value={asNumber(get('billing', 'payment_delay_days', 30))}
                    onChange={(e) => setValue('payment_delay_days', Math.max(1, Math.min(365, Number(e.target.value))))}
                    min={1}
                    max={365}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Validite devis (jours)</label>
                  <input
                    type="number"
                    value={asNumber(get('billing', 'quote_validity_days', 30))}
                    onChange={(e) => setValue('quote_validity_days', Math.max(1, Math.min(365, Number(e.target.value))))}
                    min={1}
                    max={365}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mentions legales (pied de facture)</label>
                <textarea
                  rows={3}
                  value={asString(get('billing', 'invoice_legal_mentions'))}
                  onChange={(e) => setValue('invoice_legal_mentions', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
          )}

          {!isLoading && !isError && activeCategory === 'planning' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-400" />
                Parametres du planning
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <Users className="w-3 h-3" />
                    Nombre d'equipes max
                  </label>
                  <input
                    type="number"
                    value={asNumber(get('planning', 'max_teams', 16))}
                    onChange={(e) => setValue('max_teams', Math.max(1, Math.min(50, Number(e.target.value))))}
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <Clock className="w-3 h-3" />
                    Heure de debut journee
                  </label>
                  <input
                    type="time"
                    value={asString(get('planning', 'day_start_time', '07:00'))}
                    onChange={(e) => setValue('day_start_time', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <Clock className="w-3 h-3" />
                    Heure de fin journee
                  </label>
                  <input
                    type="time"
                    value={asString(get('planning', 'day_end_time', '18:00'))}
                    onChange={(e) => setValue('day_end_time', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <Calendar className="w-3 h-3" />
                    Jours travailles
                  </label>
                  <div className="flex items-center gap-1">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => {
                      const workDays = (get('planning', 'work_days', [1, 2, 3, 4, 5]) as number[])
                      const isActive = Array.isArray(workDays) && workDays.includes(i + 1)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const current = Array.isArray(workDays) ? [...workDays] : [1, 2, 3, 4, 5]
                            const dayNum = i + 1
                            if (current.includes(dayNum)) {
                              setValue('work_days', current.filter((d) => d !== dayNum))
                            } else {
                              setValue('work_days', [...current, dayNum].sort())
                            }
                          }}
                          className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-primary-100 text-primary-700 border border-primary-200'
                              : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Durees par defaut</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([
                    { key: 'default_travel_time', label: 'Temps de trajet (min)', fallback: 30 },
                    { key: 'default_lunch_break', label: 'Pause dejeuner (min)', fallback: 60 },
                    { key: 'default_unload_time', label: 'Dechargement depot (min)', fallback: 15 },
                  ] as const).map((field) => (
                    <div key={field.key}>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{field.label}</label>
                      <input
                        type="number"
                        value={asNumber(get('planning', field.key, field.fallback))}
                        onChange={(e) => setValue(field.key, Math.max(0, Math.min(480, Number(e.target.value))))}
                        min={0}
                        max={480}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isLoading && !isError && activeCategory === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-400" />
                Parametres de notifications
              </h3>

              <div className="space-y-4">
                {([
                  { key: 'notif_email', icon: Mail, label: 'Notifications par email', desc: 'Recevoir les notifications par email' },
                  { key: 'notif_push', icon: Smartphone, label: 'Notifications push (mobile)', desc: "Notifications sur l'application mobile" },
                  { key: 'notif_intervention_reminder', icon: Bell, label: 'Rappel interventions', desc: 'Rappel 1h avant chaque intervention' },
                  { key: 'notif_unpaid_invoices', icon: CreditCard, label: 'Alertes factures impayees', desc: "Notification quand une facture depasse l'echeance" },
                  { key: 'notif_weekly_summary', icon: Calendar, label: 'Resume hebdomadaire', desc: 'Email recapitulatif chaque lundi' },
                  { key: 'notif_team_absences', icon: Users, label: 'Absences equipes', desc: "Notification lors d'une demande d'absence" },
                ] as const).map((notif) => {
                  const enabled = asBool(get('notifications', notif.key, false))
                  return (
                    <div key={notif.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                          <notif.icon className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{notif.label}</p>
                          <p className="text-xs text-slate-500">{notif.desc}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setValue(notif.key, !enabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? 'bg-primary-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            enabled ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
