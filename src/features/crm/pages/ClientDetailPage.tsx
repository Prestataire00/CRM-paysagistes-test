import { Fragment, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CalendarCheck,
  CreditCard,
  MessageSquare,
  Paperclip,
  Edit,
  ArrowLeft,
  Clock,
  Euro,
  Shield,
  Calendar,
  BarChart2,
  Video,
  CheckCircle2,
  Camera,
  PenTool,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { supabase } from '../../../lib/supabase'
import { DocumentManager } from '../components/DocumentManager'
import { RecordHistory } from '../../../components/data/RecordHistory'
import { CustomFieldsSection } from '../../../components/form/CustomFieldsSection'
import {
  useClient,
  useClientInterventions,
  useClientInvoices,
} from '../../../queries/useClients'
import { useDocumentsForClient, useUploadDocument, useDeleteDocument } from '../../../queries/useDocuments'
import type { Client, DocumentType } from '../../../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tabs = [
  { id: 'informations', label: 'Informations', icon: User },
  { id: 'contrats', label: 'Contrats', icon: FileText },
  { id: 'interventions', label: 'Interventions', icon: CalendarCheck },
  { id: 'facturation', label: 'Facturation', icon: CreditCard },
  { id: 'documents', label: 'Documents', icon: Paperclip },
  { id: 'communications', label: 'Communications', icon: MessageSquare },
  { id: 'champs', label: 'Champs perso.', icon: Edit },
  { id: 'historique', label: 'Historique', icon: Clock },
] as const

type TabId = (typeof tabs)[number]['id']

const clientTypeLabels: Record<string, string> = {
  particulier: 'Particulier',
  professionnel: 'Professionnel',
  copropriete: 'Copropriete',
  collectivite: 'Collectivite',
}

const contractTypeLabels: Record<string, string> = {
  ponctuel: 'Ponctuel',
  annuel: 'Annuel',
  trimestriel: 'Trimestriel',
  mensuel: 'Mensuel',
}

const interventionStatusConfig: Record<string, { label: string; className: string }> = {
  planifiee: { label: 'Planifiee', className: 'bg-blue-100 text-blue-700' },
  en_cours: { label: 'En cours', className: 'bg-amber-100 text-amber-700' },
  terminee: { label: 'Terminee', className: 'bg-emerald-100 text-emerald-700' },
  annulee: { label: 'Annulee', className: 'bg-red-100 text-red-700' },
  reportee: { label: 'Reportee', className: 'bg-orange-100 text-orange-700' },
}

const interventionTypeLabels: Record<string, string> = {
  entretien: 'Entretien',
  tonte: 'Tonte',
  taille: 'Taille',
  desherbage: 'Desherbage',
  plantation: 'Plantation',
  amenagement: 'Amenagement',
  arrosage: 'Arrosage',
  debroussaillage: 'Debroussaillage',
  evacuation: 'Evacuation',
  autre: 'Autre',
}

const invoiceStatusConfig: Record<string, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600' },
  emise: { label: 'Emise', className: 'bg-blue-100 text-blue-700' },
  envoyee: { label: 'Envoyee', className: 'bg-indigo-100 text-indigo-700' },
  payee: { label: 'Payee', className: 'bg-emerald-100 text-emerald-700' },
  partiellement_payee: { label: 'Partielle', className: 'bg-amber-100 text-amber-700' },
  en_retard: { label: 'En retard', className: 'bg-red-100 text-red-700' },
  annulee: { label: 'Annulee', className: 'bg-slate-100 text-slate-500' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR')
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

function clientDisplayName(client: Client): string {
  if (client.company_name) {
    return client.company_name
  }
  return `${client.first_name} ${client.last_name}`
}

function clientFullAddress(client: Client): string {
  const parts = [client.address_line1]
  if (client.address_line2) parts.push(client.address_line2)
  parts.push(`${client.postal_code} ${client.city}`)
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function SummaryBarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-3">
        <Skeleton width={48} height={48} rounded="full" />
        <div className="space-y-2">
          <Skeleton width={160} height={16} />
          <Skeleton width={120} height={12} />
        </div>
      </div>
      <div className="hidden sm:block w-px h-8 bg-slate-200" />
      <Skeleton width={120} height={14} />
      <Skeleton width={160} height={14} />
      <Skeleton width={180} height={14} />
      <div className="ml-auto">
        <Skeleton width={80} height={20} />
      </div>
    </div>
  )
}

function InfoTabSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Skeleton width={120} height={14} />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton width={16} height={16} rounded="sm" />
              <div className="space-y-1">
                <Skeleton width={60} height={12} />
                <Skeleton width={180} height={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton width={80} height={14} />
        <Skeleton width="100%" height={80} />
        <Skeleton width={100} height={14} className="mt-4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={60} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton width={200} height={16} />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 p-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} width={`${100 / cols}%`} height={14} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Client Activity Timeline — shows all RDVs and commercial activities
// ---------------------------------------------------------------------------
const activityIcons: Record<string, typeof Phone> = {
  appel: Phone,
  email: Mail,
  visite: MapPin,
  visio: Video,
  reunion: Building2,
  sms: MessageSquare,
  courrier: FileText,
}

const activityColors: Record<string, { bg: string; text: string }> = {
  appel: { bg: 'bg-blue-100', text: 'text-blue-600' },
  email: { bg: 'bg-slate-100', text: 'text-slate-600' },
  visite: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  visio: { bg: 'bg-violet-100', text: 'text-violet-600' },
  reunion: { bg: 'bg-amber-100', text: 'text-amber-600' },
  sms: { bg: 'bg-pink-100', text: 'text-pink-600' },
  courrier: { bg: 'bg-orange-100', text: 'text-orange-600' },
}

function ClientActivityTimeline({ clientId }: { clientId: string }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['client-activities', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_activities')
        .select('id, activity_type, subject, description, scheduled_at, completed_at, is_completed, follow_up_notes, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-100">
        <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune activité commerciale enregistrée</p>
        <p className="text-xs text-slate-400 mt-1">Les RDV et interactions apparaîtront ici</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Historique des interactions ({activities.length})</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

        <div className="space-y-0">
          {activities.map((act) => {
            const Icon = activityIcons[act.activity_type] || MessageSquare
            const colors = activityColors[act.activity_type] || { bg: 'bg-slate-100', text: 'text-slate-600' }
            const date = act.scheduled_at || act.created_at
            const isRdv = !!act.scheduled_at

            return (
              <div key={act.id} className="relative flex gap-3 pb-4 pl-0">
                {/* Icon on timeline */}
                <div className={`relative z-10 w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{act.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">
                          {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {act.scheduled_at && ` à ${new Date(act.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        {isRdv && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            act.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {act.is_completed ? <><CheckCircle2 className="w-2.5 h-2.5" />Effectué</> : <><Clock className="w-2.5 h-2.5" />Planifié</>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description / CR */}
                  {act.description && (
                    <div className="mt-2 bg-slate-50 rounded p-2">
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{act.description}</p>
                    </div>
                  )}

                  {/* Prep notes */}
                  {act.follow_up_notes && (
                    <div className="mt-2 bg-amber-50 rounded p-2">
                      <p className="text-[10px] font-semibold text-amber-700 uppercase mb-0.5">Notes de préparation</p>
                      <p className="text-xs text-amber-800 whitespace-pre-wrap">{act.follow_up_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabId>('informations')
  const [expandedInterventionId, setExpandedInterventionId] = useState<string | null>(null)

  // --- Data fetching ---
  const { data: client, isLoading: clientLoading } = useClient(id)
  const { data: interventions, isLoading: interventionsLoading } = useClientInterventions(id)
  const { data: invoicesData, isLoading: invoicesLoading } = useClientInvoices(id)
  const { data: documents = [], isLoading: documentsLoading } = useDocumentsForClient(id)
  const uploadDocumentMutation = useUploadDocument()
  const deleteDocumentMutation = useDeleteDocument()

  // --- Computed values ---
  const displayName = client ? clientDisplayName(client) : ''
  const totalInvoiced = invoicesData?.reduce((sum, inv) => sum + inv.total_ttc, 0) ?? 0
  const totalPaid = invoicesData?.reduce((sum, inv) => sum + inv.amount_paid, 0) ?? 0
  const interventionCount = interventions?.length ?? 0

  // --- Render ---
  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title={clientLoading ? 'Chargement...' : displayName}
        description={
          clientLoading
            ? undefined
            : client
              ? `Client depuis le ${formatDate(client.created_at)} — Fiche #${id?.slice(0, 8)}`
              : 'Client introuvable'
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/crm/clients')}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <button
              onClick={() => id && navigate(`/crm/clients/${id}/bilan`)}
              disabled={clientLoading || !client}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <BarChart2 className="w-4 h-4" />
              Bilan annuel
            </button>
            <button
              onClick={() => id && navigate(`/crm/clients/${id}/edit`)}
              disabled={clientLoading || !client}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </button>
          </div>
        }
      />

      {/* Client Summary Bar */}
      {clientLoading ? (
        <SummaryBarSkeleton />
      ) : client ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              {client.company_name ? (
                <Building2 className="w-6 h-6 text-primary-600" />
              ) : (
                <User className="w-6 h-6 text-primary-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500">
                {clientTypeLabels[client.client_type] ?? client.client_type} — {contractTypeLabels[client.contract_type] ?? client.contract_type}
              </p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          {(client.phone || client.mobile) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {client.mobile ?? client.phone}
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {client.email}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {clientFullAddress(client)}
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Euro className="w-4 h-4 text-emerald-500" />
            {formatCurrency(totalInvoiced)}
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {/* ---- INFORMATIONS ---- */}
        {activeTab === 'informations' && (
          clientLoading ? (
            <InfoTabSkeleton />
          ) : client ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Coordonnees</h3>
                <div className="space-y-3">
                  {[
                    { icon: User, label: 'Nom', value: `${client.first_name} ${client.last_name}` },
                    { icon: Building2, label: 'Entreprise', value: client.company_name || '-' },
                    { icon: Building2, label: 'Type', value: clientTypeLabels[client.client_type] ?? client.client_type },
                    { icon: Mail, label: 'Email', value: client.email || '-' },
                    { icon: Phone, label: 'Telephone', value: client.phone || '-' },
                    { icon: Phone, label: 'Mobile', value: client.mobile || '-' },
                    { icon: MapPin, label: 'Adresse', value: clientFullAddress(client) },
                  ].map((field) => (
                    <div key={field.label} className="flex items-start gap-3">
                      <field.icon className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500">{field.label}</p>
                        <p className="text-sm text-slate-900">{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Notes</h3>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 border border-slate-100">
                  {client.notes || 'Aucune note.'}
                </p>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mt-6">Statistiques</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total facture', value: formatCurrency(totalInvoiced) },
                    { label: 'Formule', value: contractTypeLabels[client.contract_type] ?? client.contract_type },
                    { label: 'Interventions', value: String(interventionCount) },
                    { label: 'Client depuis', value: formatDate(client.created_at) },
                    { label: 'Credit impot', value: client.eligible_tax_credit ? 'Oui' : 'Non' },
                    { label: 'Statut', value: client.is_active ? 'Actif' : 'Inactif' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="text-xs text-slate-500">{stat.label}</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Client introuvable.</p>
          )
        )}

        {/* ---- CONTRATS ---- */}
        {activeTab === 'contrats' && (
          clientLoading ? (
            <TableSkeleton rows={2} cols={4} />
          ) : client ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Contrat actuel</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {contractTypeLabels[client.contract_type] ?? client.contract_type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {client.contract_start_date ? formatDate(client.contract_start_date) : '-'}
                        {' au '}
                        {client.contract_end_date ? formatDate(client.contract_end_date) : 'Indetermine'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      Depuis {formatDate(client.contract_start_date)}
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        client.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {client.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
              {client.eligible_tax_credit && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <Shield className="w-4 h-4" />
                  Ce client est eligible au credit d'impot ({client.tax_credit_percentage}%)
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Client introuvable.</p>
          )
        )}

        {/* ---- INTERVENTIONS ---- */}
        {activeTab === 'interventions' && (
          interventionsLoading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Historique des interventions ({interventions?.length ?? 0})
              </h3>
              {interventions && interventions.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Ref.</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Date</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Type</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Equipe</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Duree</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Statut</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Notes</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interventions.map((intervention) => {
                      const team = intervention.assigned_team
                      const statusCfg = interventionStatusConfig[intervention.status] ?? {
                        label: intervention.status,
                        className: 'bg-slate-100 text-slate-600',
                      }
                      const isExpanded = expandedInterventionId === intervention.id
                      const photoCount = (intervention as any).completion_photos?.length ?? 0
                      const hasNotes = !!(intervention as any).completion_notes
                      const hasSignature = !!(intervention as any).client_signature_url
                      const satisfactionRating = (intervention as any).satisfaction_rating as number | undefined
                      return (
                        <Fragment key={intervention.id}>
                        <tr
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() =>
                            setExpandedInterventionId(isExpanded ? null : intervention.id)
                          }
                        >
                          <td className="py-3 pr-4 text-sm font-medium text-primary-600">
                            {intervention.reference}
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-700">
                            {formatDate(intervention.scheduled_date)}
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-700">
                            {intervention.title || interventionTypeLabels[intervention.intervention_type] || intervention.intervention_type}
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-700">
                            {team ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: team.color }}
                                />
                                {team.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">Non assignee</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-700">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatDuration(intervention.estimated_duration_minutes)}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}
                            >
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span title={hasNotes ? 'Notes de complétion présentes' : 'Aucune note'}>
                                <FileText className={`w-3.5 h-3.5 ${hasNotes ? 'text-emerald-500' : 'text-slate-300'}`} />
                              </span>
                              {photoCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-slate-600">
                                  <Camera className="w-3.5 h-3.5 text-blue-500" />
                                  {photoCount}
                                </span>
                              )}
                              {hasSignature && (
                                <span title="Signature client"><PenTool className="w-3.5 h-3.5 text-violet-500" /></span>
                              )}
                            </span>
                          </td>
                          <td className="py-3">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${intervention.id}-detail`}>
                            <td colSpan={8} className="px-4 py-4 bg-slate-50">
                              <div className="space-y-4">
                                {/* Completion notes */}
                                {hasNotes && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes de completion</h4>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                      {(intervention as any).completion_notes}
                                    </p>
                                  </div>
                                )}

                                {/* Photo thumbnails */}
                                {photoCount > 0 && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Photos ({photoCount})</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {((intervention as any).completion_photos as string[]).map((photo: string, idx: number) => {
                                        const url = supabase.storage.from('documents').getPublicUrl(photo).data.publicUrl
                                        return (
                                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                            <img
                                              src={url}
                                              alt={`Photo ${idx + 1}`}
                                              className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:border-primary-400 transition-colors"
                                            />
                                          </a>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Satisfaction rating */}
                                {satisfactionRating != null && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Satisfaction client</h4>
                                    <div className="flex items-center gap-0.5">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`w-4 h-4 ${
                                            i < satisfactionRating
                                              ? 'text-amber-400 fill-amber-400'
                                              : 'text-slate-300'
                                          }`}
                                        />
                                      ))}
                                      <span className="ml-1.5 text-sm text-slate-600">{satisfactionRating}/5</span>
                                    </div>
                                  </div>
                                )}

                                {/* Signature */}
                                {hasSignature && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Signature client</h4>
                                    <img
                                      src={(intervention as any).client_signature_url}
                                      alt="Signature client"
                                      className="h-16 border border-slate-200 rounded bg-white p-1"
                                    />
                                  </div>
                                )}

                                {!hasNotes && photoCount === 0 && satisfactionRating == null && !hasSignature && (
                                  <p className="text-sm text-slate-400 italic">Aucune donnee de completion disponible.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">Aucune intervention enregistree.</p>
              )}
            </div>
          )
        )}

        {/* ---- FACTURATION ---- */}
        {activeTab === 'facturation' && (
          invoicesLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : (
            <div>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Total facture</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(totalInvoiced)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-600">Total paye</p>
                  <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <p className="text-xs text-amber-600">Reste du</p>
                  <p className="text-lg font-bold text-amber-700 mt-1">
                    {formatCurrency(totalInvoiced - totalPaid)}
                  </p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Factures ({invoicesData?.length ?? 0})
              </h3>
              {invoicesData && invoicesData.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">N. Facture</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Date emission</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Echeance</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Montant TTC</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3 pr-4">Paye</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoicesData.map((invoice) => {
                      const statusCfg = invoiceStatusConfig[invoice.status] ?? {
                        label: invoice.status,
                        className: 'bg-slate-100 text-slate-600',
                      }
                      return (
                        <tr key={invoice.id} className="hover:bg-slate-50">
                          <td className="py-3 pr-4 text-sm font-medium text-primary-600">{invoice.reference}</td>
                          <td className="py-3 pr-4 text-sm text-slate-700">{formatDate(invoice.issue_date)}</td>
                          <td className="py-3 pr-4 text-sm text-slate-700">{formatDate(invoice.due_date)}</td>
                          <td className="py-3 pr-4 text-sm font-semibold text-slate-900">
                            {formatCurrency(invoice.total_ttc)}
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-700">{formatCurrency(invoice.amount_paid)}</td>
                          <td className="py-3">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}
                            >
                              {statusCfg.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">Aucune facture enregistree.</p>
              )}
            </div>
          )
        )}

        {/* ---- DOCUMENTS ---- */}
        {activeTab === 'documents' && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Documents ({documents.length})
            </h3>
            <DocumentManager
              documents={documents}
              isLoading={documentsLoading}
              uploading={uploadDocumentMutation.isPending}
              onUpload={async (file: File, type: DocumentType) => {
                await uploadDocumentMutation.mutateAsync({
                  file,
                  document_type: type,
                  client_id: id,
                })
              }}
              onDelete={(docId: string) => {
                deleteDocumentMutation.mutate(docId)
              }}
            />
          </div>
        )}

        {/* ---- COMMUNICATIONS (RDV & Activities Timeline) ---- */}
        {activeTab === 'communications' && id && (
          <ClientActivityTimeline clientId={id} />
        )}

        {/* ---- CHAMPS PERSONNALISÉS ---- */}
        {activeTab === 'champs' && id && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Champs personnalisés</h2>
            <CustomFieldsSection entityType="clients" entityId={id} />
          </div>
        )}

        {/* ---- HISTORIQUE ---- */}
        {activeTab === 'historique' && id && (
          <RecordHistory tableName="clients" recordId={id} defaultOpen />
        )}
      </div>

    </div>
  )
}
