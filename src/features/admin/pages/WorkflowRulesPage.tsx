import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Plus, Zap, Loader2, ToggleLeft, ToggleRight, Trash2, Pencil, Copy,
  CheckCircle, XCircle, Clock, Play,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useWorkflowRules, useToggleWorkflowRule, useDeleteWorkflowRule, useCreateWorkflowRule } from '../../../queries/useWorkflow'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useAuth } from '../../../contexts/AuthContext'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { testWorkflowRule } from '../../../services/workflow-engine.service'
import type { WorkflowRule } from '../../../types'

const TRIGGER_LABELS: Record<string, string> = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  SCHEDULE: 'Planifié',
}

const TABLE_LABELS: Record<string, string> = {
  quotes: 'Devis',
  invoices: 'Factures',
  clients: 'Clients',
  prospects: 'Prospects',
  chantiers: 'Chantiers',
  planning_slots: 'Planning',
}

export function WorkflowRulesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: rules, isLoading } = useWorkflowRules()
  const toggleMutation = useToggleWorkflowRule()
  const deleteMutation = useDeleteWorkflowRule()
  const createMutation = useCreateWorkflowRule()
  const [deleteTarget, setDeleteTarget] = useState<WorkflowRule | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const { user } = useAuth()

  const handleToggle = async (rule: WorkflowRule) => {
    try {
      await toggleMutation.mutateAsync({ id: rule.id, active: !rule.active })
      toast.success(
        rule.active ? 'Règle désactivée' : 'Règle activée',
        `La règle "${rule.name}" a été ${rule.active ? 'désactivée' : 'activée'}.`
      )
    } catch {
      toast.error('Erreur', 'Impossible de modifier la règle.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Règle supprimée', `La règle "${deleteTarget.name}" a été supprimée.`)
      setDeleteTarget(null)
    } catch {
      toast.error('Erreur', 'Impossible de supprimer la règle.')
    }
  }

  const handleDuplicate = async (rule: WorkflowRule) => {
    setDuplicatingId(rule.id)
    try {
      const newRule = await createMutation.mutateAsync({
        name: `[Copie] ${rule.name}`,
        description: rule.description,
        trigger_table: rule.trigger_table,
        trigger_event: rule.trigger_event,
        conditions: rule.conditions,
        actions: rule.actions,
        active: false,
        created_by: user?.id ?? null,
      })
      toast.success('Règle dupliquée', `La règle "${rule.name}" a été dupliquée.`)
      navigate(`/admin/workflows/${newRule.id}/edit`)
    } catch {
      toast.error('Erreur', 'Impossible de dupliquer la règle.')
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatisations"
        description="Créez des règles pour automatiser les actions récurrentes"
        actions={
          <button
            onClick={() => navigate('/admin/workflows/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle règle
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucune automatisation</h3>
          <p className="text-sm text-slate-500 mb-6">
            Créez votre première règle pour automatiser les relances, notifications et changements de statut.
          </p>
          <button
            onClick={() => navigate('/admin/workflows/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer une règle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white border rounded-2xl p-5 transition-all ${
                rule.active ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl ${rule.active ? 'bg-amber-50' : 'bg-slate-100'}`}>
                  <Zap className={`w-5 h-5 ${rule.active ? 'text-amber-500' : 'text-slate-400'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-800">{rule.name}</h3>
                    {rule.active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Actif</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Inactif</span>
                    )}
                  </div>

                  {rule.description && (
                    <p className="text-xs text-slate-500 mb-2">{rule.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">{TABLE_LABELS[rule.trigger_table] ?? rule.trigger_table}</span>
                      <span>•</span>
                      <span>{TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}</span>
                    </span>
                    <span>•</span>
                    <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Execution stats */}
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-400">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      {rule.run_count} exécution{rule.run_count !== 1 ? 's' : ''}
                      {rule.run_count > 0 && (
                        <span className="text-slate-400 ml-0.5">
                          ({Math.round(((rule.run_count - rule.error_count) / rule.run_count) * 100)}%)
                        </span>
                      )}
                    </span>
                    {rule.error_count > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-3.5 h-3.5" />
                        {rule.error_count} erreur{rule.error_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {rule.last_run_at ? (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        Dernier: {new Date(rule.last_run_at).toLocaleDateString('fr-FR')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 italic">
                        <Clock className="w-3.5 h-3.5" />
                        Jamais exécutée
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      if (!user) return
                      setTestingId(rule.id)
                      try {
                        const result = await testWorkflowRule(rule.id, user.id)
                        if (result.status === 'success') {
                          toast.success('Test réussi', result.message)
                        } else if (result.status === 'no_match') {
                          toast.warning('Aucune correspondance', result.message)
                        } else {
                          toast.error('Erreur', result.message)
                        }
                      } catch {
                        toast.error('Erreur', 'Impossible de tester la règle')
                      } finally {
                        setTestingId(null)
                      }
                    }}
                    disabled={testingId === rule.id}
                    className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                    title="Tester"
                  >
                    {testingId === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleToggle(rule)}
                    className="p-1.5"
                    title={rule.active ? 'Désactiver' : 'Activer'}
                  >
                    {rule.active ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-300" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDuplicate(rule)}
                    disabled={duplicatingId === rule.id}
                    className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                    title="Dupliquer"
                  >
                    {duplicatingId === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => navigate(`/admin/workflows/${rule.id}/edit`)}
                    className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(rule)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <ModalHeader
          title="Supprimer la règle"
          description={`Êtes-vous sûr de vouloir supprimer la règle "${deleteTarget?.name}" ? Cette action est irréversible.`}
        />
        <ModalFooter>
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
