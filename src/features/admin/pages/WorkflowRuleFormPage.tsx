import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useWorkflowRule, useCreateWorkflowRule, useUpdateWorkflowRule } from '../../../queries/useWorkflow'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useAuth } from '../../../contexts/AuthContext'
import type { WorkflowCondition, WorkflowAction, WorkflowTriggerEvent, WorkflowActionType } from '../../../types'

const TABLES = [
  { value: 'quotes', label: 'Devis' },
  { value: 'invoices', label: 'Factures' },
  { value: 'clients', label: 'Clients' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'chantiers', label: 'Chantiers' },
]

const EVENTS: { value: WorkflowTriggerEvent; label: string }[] = [
  { value: 'INSERT', label: 'Création' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'SCHEDULE', label: 'Planifié (cron)' },
]

const OPERATORS: { value: string; label: string }[] = [
  { value: 'equals', label: 'Égal à' },
  { value: 'not_equals', label: 'Différent de' },
  { value: 'contains', label: 'Contient' },
  { value: 'changed_to', label: 'Changé en' },
  { value: 'gt', label: 'Supérieur à' },
  { value: 'lt', label: 'Inférieur à' },
  { value: 'is_empty', label: 'Est vide' },
  { value: 'is_not_empty', label: "N'est pas vide" },
]

const ACTION_TYPES: { value: WorkflowActionType; label: string }[] = [
  { value: 'send_email', label: 'Envoyer un email' },
  { value: 'create_notification', label: 'Créer une notification' },
  { value: 'change_status', label: 'Changer le statut' },
  { value: 'create_task', label: 'Créer une tâche' },
]

const STATUS_OPTIONS_BY_TABLE: Record<string, { value: string; label: string }[]> = {
  quotes: [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'envoye', label: 'Envoyé' },
    { value: 'accepte', label: 'Accepté' },
    { value: 'refuse', label: 'Refusé' },
    { value: 'expire', label: 'Expiré' },
  ],
  invoices: [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'emise', label: 'Émise' },
    { value: 'envoyee', label: 'Envoyée' },
    { value: 'payee', label: 'Payée' },
    { value: 'partiellement_payee', label: 'Partiellement payée' },
    { value: 'en_retard', label: 'En retard' },
  ],
  clients: [
    { value: 'actif', label: 'Actif' },
    { value: 'inactif', label: 'Inactif' },
    { value: 'archive', label: 'Archivé' },
  ],
  prospects: [
    { value: 'nouveau', label: 'Nouveau' },
    { value: 'contacte', label: 'Contacté' },
    { value: 'qualifie', label: 'Qualifié' },
    { value: 'converti', label: 'Converti' },
    { value: 'perdu', label: 'Perdu' },
  ],
  chantiers: [
    { value: 'planifie', label: 'Planifié' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'termine', label: 'Terminé' },
    { value: 'annule', label: 'Annulé' },
  ],
  planning_slots: [
    { value: 'planifiee', label: 'Planifiée' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'terminee', label: 'Terminée' },
    { value: 'annulee', label: 'Annulée' },
    { value: 'reportee', label: 'Reportée' },
  ],
}

export function WorkflowRuleFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const { data: existing, isLoading: isLoadingExisting } = useWorkflowRule(id)
  const createMutation = useCreateWorkflowRule()
  const updateMutation = useUpdateWorkflowRule()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerTable, setTriggerTable] = useState('quotes')
  const [triggerEvent, setTriggerEvent] = useState<WorkflowTriggerEvent>('UPDATE')
  const [conditions, setConditions] = useState<WorkflowCondition[]>([])
  const [actions, setActions] = useState<WorkflowAction[]>([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!existing || initialized) return
    setName(existing.name)
    setDescription(existing.description ?? '')
    setTriggerTable(existing.trigger_table)
    setTriggerEvent(existing.trigger_event)
    setConditions(existing.conditions)
    setActions(existing.actions)
    setInitialized(true)
  }, [existing, initialized])

  // Condition management
  const addCondition = () => {
    setConditions([...conditions, { field: 'status', operator: 'changed_to', value: '' }])
  }
  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx))
  }
  const updateCondition = (idx: number, updates: Partial<WorkflowCondition>) => {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, ...updates } : c)))
  }

  // Action management
  const addAction = (type: WorkflowActionType) => {
    const base = { type } as WorkflowAction
    switch (type) {
      case 'send_email':
        setActions([...actions, { ...base, type: 'send_email', to: '', subject: '', body: '' }])
        break
      case 'create_notification':
        setActions([...actions, { ...base, type: 'create_notification', title: '', message: '' }])
        break
      case 'change_status':
        setActions([...actions, { ...base, type: 'change_status', new_status: '' }])
        break
      case 'create_task':
        setActions([...actions, { ...base, type: 'create_task', title: '', description: '' }])
        break
    }
  }
  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx))
  }
  const updateAction = (idx: number, updates: Partial<WorkflowAction>) => {
    setActions(actions.map((a, i) => (i === idx ? { ...a, ...updates } as WorkflowAction : a)))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Nom requis', 'Donnez un nom à la règle.')
      return
    }
    if (actions.length === 0) {
      toast.warning('Action requise', 'Ajoutez au moins une action.')
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      trigger_table: triggerTable,
      trigger_event: triggerEvent,
      conditions,
      actions,
      active: true,
      created_by: user?.id ?? null,
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: id!, input: payload })
        toast.success('Règle mise à jour', `La règle "${name}" a été enregistrée.`)
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Règle créée', `La règle "${name}" est prête.`)
      }
      navigate('/admin/workflows')
    } catch {
      toast.error('Erreur', "Impossible d'enregistrer la règle.")
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (isLoadingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Modifier la règle' : 'Nouvelle automatisation'}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/workflows')}
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
              {isEdit ? 'Enregistrer' : 'Créer la règle'}
            </button>
          </div>
        }
      />

      {/* Step 1: Trigger */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">1. Déclencheur</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Nom de la règle *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Relance auto devis J+7"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Table *</label>
            <select
              value={triggerTable}
              onChange={(e) => setTriggerTable(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {TABLES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Événement *</label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value as WorkflowTriggerEvent)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {EVENTS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Conditions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">2. Conditions (optionnel)</h2>
          <button
            onClick={addCondition}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>

        {conditions.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune condition — la règle s'exécutera à chaque événement.</p>
        ) : (
          <div className="space-y-2">
            {conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                <input
                  type="text"
                  value={cond.field}
                  onChange={(e) => updateCondition(idx, { field: e.target.value })}
                  placeholder="Champ (ex: status)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                />
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value as WorkflowCondition['operator'] })}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                  <input
                    type="text"
                    value={String(cond.value ?? '')}
                    onChange={(e) => updateCondition(idx, { value: e.target.value })}
                    placeholder="Valeur"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                  />
                )}
                <button onClick={() => removeCondition(idx)} className="p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 3: Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">3. Actions *</h2>
          <div className="flex gap-1">
            {ACTION_TYPES.map((at) => (
              <button
                key={at.value}
                onClick={() => addAction(at.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                + {at.label}
              </button>
            ))}
          </div>
        </div>

        {actions.length === 0 ? (
          <p className="text-xs text-slate-400">Ajoutez au moins une action à exécuter.</p>
        ) : (
          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase">
                    {ACTION_TYPES.find((t) => t.value === action.type)?.label}
                  </span>
                  <button onClick={() => removeAction(idx)} className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {action.type === 'send_email' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={action.to}
                      onChange={(e) => updateAction(idx, { to: e.target.value })}
                      placeholder="Destinataire (champ ou email)"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                    />
                    <input
                      type="text"
                      value={action.subject}
                      onChange={(e) => updateAction(idx, { subject: e.target.value })}
                      placeholder="Sujet de l'email"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                    />
                    <textarea
                      value={action.body}
                      onChange={(e) => updateAction(idx, { body: e.target.value })}
                      placeholder="Corps du message..."
                      rows={3}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white resize-none"
                    />
                  </div>
                )}

                {action.type === 'create_notification' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={action.title}
                      onChange={(e) => updateAction(idx, { title: e.target.value })}
                      placeholder="Titre de la notification"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                    />
                    <input
                      type="text"
                      value={action.message}
                      onChange={(e) => updateAction(idx, { message: e.target.value })}
                      placeholder="Message"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                    />
                  </div>
                )}

                {action.type === 'change_status' && (
                  <select
                    value={action.new_status}
                    onChange={(e) => updateAction(idx, { new_status: e.target.value })}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white w-full"
                  >
                    <option value="">-- Sélectionner un statut --</option>
                    {(STATUS_OPTIONS_BY_TABLE[triggerTable] ?? []).map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}

                {action.type === 'create_task' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={action.title}
                      onChange={(e) => updateAction(idx, { title: e.target.value })}
                      placeholder="Titre de la tâche"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                    />
                    <input
                      type="text"
                      value={action.description}
                      onChange={(e) => updateAction(idx, { description: e.target.value })}
                      placeholder="Description"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
