import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  X,
  Phone,
  Mail,
  Calendar,
  User,
  FileText,
  UserCheck,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { Input } from '../../../../components/ui/Input'
import { Select } from '../../../../components/ui/Select'
import { Tabs } from '../../../../components/ui/Tabs'
import { ConfirmDialog } from '../../../../components/feedback/ConfirmDialog'
import { ScoringBadge } from './ScoringBadge'
import { RelanceTab } from './RelanceTab'
import { Pencil, Check } from 'lucide-react'
import { useProspectActivities, useCreateProspectActivity, useConvertToClient, useDeleteProspect, useUpdateProspect } from '../../../../queries/useProspects'
import { useRelancesForProspect } from '../../../../queries/useRelance'
import { useToast } from '../../../../components/feedback/ToastProvider'
import { useAuth } from '../../../../contexts/AuthContext'
import { SOURCE_LABELS } from '../../pages/ProspectPipelinePage'
import type { ProspectWithMeta, CommunicationType } from '../../../../types'

interface ProspectDetailPanelProps {
  prospect: ProspectWithMeta
  onClose: () => void
  onDeleted: () => void
  onEdit?: (prospect: ProspectWithMeta) => void
}

const activityTypeOptions = [
  { value: 'appel', label: 'Appel' },
  { value: 'email', label: 'Email' },
  { value: 'visite', label: 'Visite' },
  { value: 'sms', label: 'SMS' },
  { value: 'courrier', label: 'Courrier' },
]

const activityTypeIcons: Record<string, typeof Phone> = {
  appel: Phone,
  email: Mail,
  visite: User,
  sms: Mail,
  courrier: FileText,
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function formatValue(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const stageLabels: Record<string, string> = {
  nouveau: 'Nouveau',
  qualification: 'Qualification',
  proposition: 'Proposition',
  negociation: 'Négociation',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

export function ProspectDetailPanel({ prospect, onClose, onDeleted, onEdit }: ProspectDetailPanelProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { data: activities = [], isLoading: activitiesLoading } = useProspectActivities(prospect.id)
  const createActivityMutation = useCreateProspectActivity()
  const convertMutation = useConvertToClient()
  const deleteMutation = useDeleteProspect()

  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityType, setActivityType] = useState<CommunicationType>('appel')
  const [activitySubject, setActivitySubject] = useState('')
  const [activityDescription, setActivityDescription] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showConvertConfirm, setShowConvertConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('infos')
  const [isEditing, setIsEditing] = useState(false)
  const [editEmail, setEditEmail] = useState(prospect.email || '')
  const [editPhone, setEditPhone] = useState(prospect.phone || '')
  const [editValue, setEditValue] = useState(String(prospect.estimated_value ?? ''))
  const [editProbability, setEditProbability] = useState(String(prospect.probability ?? 0))
  const [editCompany, setEditCompany] = useState(prospect.company_name || '')
  const updateProspectMutation = useUpdateProspect()

  const handleSaveEdit = async () => {
    try {
      await updateProspectMutation.mutateAsync({
        id: prospect.id,
        data: {
          email: editEmail || null,
          phone: editPhone || null,
          estimated_value: editValue ? Number(editValue) : null,
          probability: editProbability ? Number(editProbability) : 0,
          company_name: editCompany || null,
        },
      })
      toast.success('Prospect mis à jour')
      setIsEditing(false)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const { data: relances = [] } = useRelancesForProspect(prospect.id)
  const pendingRelanceCount = relances.filter(
    (r) => r.status === 'generated' || r.status === 'edited',
  ).length

  const handleCreateActivity = useCallback(async () => {
    if (!activitySubject.trim() || !user) return

    try {
      await createActivityMutation.mutateAsync({
        prospect_id: prospect.id,
        activity_type: activityType,
        subject: activitySubject.trim(),
        description: activityDescription.trim() || null,
        is_completed: true,
        assigned_to: user.id,
        created_by: user.id,
      })
      toast.success('Activité ajoutée')
      setActivitySubject('')
      setActivityDescription('')
      setShowActivityForm(false)
    } catch {
      toast.error('Erreur lors de la création')
    }
  }, [activitySubject, activityDescription, activityType, prospect.id, user, createActivityMutation, toast])

  const handleConvert = useCallback(async () => {
    try {
      await convertMutation.mutateAsync(prospect.id)
      toast.success('Prospect converti en client')
      setShowConvertConfirm(false)
      onClose()
    } catch {
      toast.error('Erreur lors de la conversion')
    }
  }, [prospect.id, convertMutation, toast, onClose])

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(prospect.id)
      toast.success('Prospect supprimé')
      setShowDeleteConfirm(false)
      onDeleted()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }, [prospect.id, deleteMutation, toast, onDeleted])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {prospect.company_name || `${prospect.first_name} ${prospect.last_name}`}
              </h2>
              <ScoringBadge score={prospect.score} />
            </div>
            {prospect.company_name && (
              <p className="text-sm text-slate-500">{prospect.first_name} {prospect.last_name}</p>
            )}
            <span
              className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
            >
              {stageLabels[prospect.pipeline_stage] ?? prospect.pipeline_stage}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(prospect)}
                className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                title="Modifier le prospect"
              >
                <Pencil className="w-4 h-4 text-slate-500" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'infos', label: 'Infos & Activités' },
            { id: 'relance', label: 'Relance', count: pendingRelanceCount },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'relance' ? (
            <RelanceTab prospect={prospect} />
          ) : (
          <>
          {/* Prospect info */}
          <div className="px-5 py-4 space-y-2 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Informations</h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Pencil className="w-3 h-3" />
                  Modifier
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateProspectMutation.isPending}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {updateProspectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Sauver
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium ml-2"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400">Entreprise</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Nom entreprise"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">Valeur estimée (€)</label>
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Probabilité (%)</label>
                    <input
                      type="number"
                      value={editProbability}
                      onChange={(e) => setEditProbability(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="email@exemple.fr"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Téléphone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="06 XX XX XX XX"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Valeur estimée</p>
                    <p className="font-semibold text-slate-800">{formatValue(prospect.estimated_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Probabilité</p>
                    <p className="font-semibold text-slate-800">{prospect.probability ?? 0}%</p>
                  </div>
                </div>
                {prospect.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{prospect.email}</span>
                  </div>
                )}
                {prospect.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{prospect.phone}</span>
                  </div>
                )}
                {prospect.assigned_commercial && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{prospect.assigned_commercial.first_name} {prospect.assigned_commercial.last_name}</span>
                  </div>
                )}
                {prospect.source && (
                  <p className="text-xs text-slate-400">
                    Source: <span className="text-slate-600">{SOURCE_LABELS[prospect.source] ?? prospect.source}</span>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Quick actions */}
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowActivityForm(!showActivityForm)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Activité
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/crm/devis/new?prospect_id=${prospect.id}`)}
              >
                <FileText className="w-3.5 h-3.5 mr-1" />
                Devis
              </Button>
              {prospect.pipeline_stage !== 'gagne' && prospect.pipeline_stage !== 'perdu' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowConvertConfirm(true)}
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  Convertir
                </Button>
              )}
            </div>
          </div>

          {/* Quick activity form */}
          {showActivityForm && (
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
              <Select
                label="Type"
                options={activityTypeOptions}
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as CommunicationType)}
              />
              <Input
                label="Sujet"
                value={activitySubject}
                onChange={(e) => setActivitySubject(e.target.value)}
                placeholder="Ex: Appel de suivi"
              />
              <textarea
                value={activityDescription}
                onChange={(e) => setActivityDescription(e.target.value)}
                placeholder="Description (optionnel)..."
                rows={2}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-green-500 focus:ring-green-500/20"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateActivity}
                  loading={createActivityMutation.isPending}
                  disabled={!activitySubject.trim()}
                >
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowActivityForm(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Activity timeline */}
          <div className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Historique ({activities.length})
            </h3>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Aucune activité enregistrée
              </p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => {
                  const Icon = activityTypeIcons[activity.activity_type] ?? Calendar
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{activity.subject}</p>
                        {activity.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{activity.description}</p>
                        )}
                        {activity.follow_up_notes && (
                          <div className="mt-1 bg-amber-50 rounded px-2 py-1">
                            <p className="text-[10px] font-semibold text-amber-700">Préparation IA</p>
                            <p className="text-xs text-amber-800 line-clamp-2">{activity.follow_up_notes}</p>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatDate(activity.completed_at ?? activity.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Supprimer le prospect"
        message={`Voulez-vous vraiment supprimer ${prospect.first_name} ${prospect.last_name} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={showConvertConfirm}
        title="Convertir en client"
        message={`Convertir ${prospect.first_name} ${prospect.last_name} en client ? Un nouveau client sera créé avec les informations du prospect.`}
        confirmLabel="Convertir"
        variant="primary"
        onConfirm={handleConvert}
        onCancel={() => setShowConvertConfirm(false)}
        loading={convertMutation.isPending}
      />
    </>
  )
}
