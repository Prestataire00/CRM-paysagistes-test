import { useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import {
  useFieldDefinitions,
  useDeleteFieldDefinition,
  useUpdateFieldDefinition,
  useReorderFieldDefinitions,
} from '../../../queries/useCustomFields'
import { useToast } from '../../../components/feedback/ToastProvider'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { CustomFieldFormModal } from '../components/CustomFieldFormModal'
import type { CustomFieldDefinition, CustomFieldEntityType } from '../../../types'

const ENTITY_TABS: { key: CustomFieldEntityType; label: string }[] = [
  { key: 'clients', label: 'Clients' },
  { key: 'prospects', label: 'Prospects' },
  { key: 'chantiers', label: 'Chantiers' },
]

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texte',
  number: 'Nombre',
  date: 'Date',
  select: 'Liste',
  boolean: 'Oui/Non',
}

export function CustomFieldsPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<CustomFieldEntityType>('clients')
  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDefinition | null>(null)

  const { data: definitions, isLoading } = useFieldDefinitions(activeTab, true)
  const { data: clientsDefs } = useFieldDefinitions('clients', true)
  const { data: prospectsDefs } = useFieldDefinitions('prospects', true)
  const { data: chantiersDefs } = useFieldDefinitions('chantiers', true)
  const deleteMutation = useDeleteFieldDefinition()
  const updateMutation = useUpdateFieldDefinition()
  const reorderMutation = useReorderFieldDefinitions()

  const fieldCounts: Record<string, number> = {
    clients: clientsDefs?.length ?? 0,
    prospects: prospectsDefs?.length ?? 0,
    chantiers: chantiersDefs?.length ?? 0,
  }

  const activeFields = (definitions ?? []).filter((d) => d.is_active)
  const inactiveFields = (definitions ?? []).filter((d) => !d.is_active)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Champ désactivé', `Le champ "${deleteTarget.field_label}" a été désactivé.`)
      setDeleteTarget(null)
    } catch {
      toast.error('Erreur', 'Impossible de supprimer le champ.')
    }
  }

  const handleToggleActive = async (field: CustomFieldDefinition) => {
    try {
      await updateMutation.mutateAsync({
        id: field.id,
        input: { is_active: !field.is_active },
      })
      toast.success(
        field.is_active ? 'Champ désactivé' : 'Champ réactivé',
        `Le champ "${field.field_label}" a été ${field.is_active ? 'désactivé' : 'réactivé'}.`
      )
    } catch {
      toast.error('Erreur', 'Impossible de modifier le champ.')
    }
  }

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return
    const reordered = [...activeFields]
    ;[reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]]
    const updates = reordered.map((d, i) => ({ id: d.id, position: i }))
    reorderMutation.mutate(updates)
  }

  const handleMoveDown = (idx: number) => {
    if (idx >= activeFields.length - 1) return
    const reordered = [...activeFields]
    ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]
    const updates = reordered.map((d, i) => ({ id: d.id, position: i }))
    reorderMutation.mutate(updates)
  }

  const nextPosition = activeFields.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Champs personnalisés"
        description="Ajoutez des champs sur mesure à vos fiches clients, prospects et chantiers"
        actions={
          <button
            onClick={() => {
              setEditingField(null)
              setShowForm(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau champ
          </button>
        }
      />

      {/* Entity tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}{fieldCounts[tab.key] > 0 ? ` (${fieldCounts[tab.key]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : activeFields.length === 0 && inactiveFields.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucun champ personnalisé</h3>
          <p className="text-sm text-slate-500 mb-6">
            Créez votre premier champ pour enrichir les fiches {activeTab}.
          </p>
          <button
            onClick={() => {
              setEditingField(null)
              setShowForm(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un champ
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active fields */}
          {activeFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">
                  Champs actifs ({activeFields.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {activeFields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{field.field_label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                        </span>
                        {field.required && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            Obligatoire
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{field.field_name}</p>
                    </div>

                    {field.field_type === 'select' && field.options.length > 0 && (
                      <div className="flex gap-1 flex-wrap max-w-[200px]">
                        {field.options.slice(0, 3).map((opt) => (
                          <span key={opt} className="text-xs px-1.5 py-0.5 bg-slate-50 rounded text-slate-500">
                            {opt}
                          </span>
                        ))}
                        {field.options.length > 3 && (
                          <span className="text-xs text-slate-400">+{field.options.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        title="Monter"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx >= activeFields.length - 1}
                        className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        title="Descendre"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(field)
                          setShowForm(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(field)}
                        className="p-1.5 text-green-500 hover:text-slate-400 transition-colors"
                        title="Désactiver"
                      >
                        <ToggleRight className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(field)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inactive fields */}
          {inactiveFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden opacity-75">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-500">
                  Champs désactivés ({inactiveFields.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {inactiveFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-500">{field.field_label}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        ({FIELD_TYPE_LABELS[field.field_type] ?? field.field_type})
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleActive(field)}
                      className="p-1.5 text-slate-300 hover:text-green-500 transition-colors"
                      title="Réactiver"
                    >
                      <ToggleLeft className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form modal */}
      <CustomFieldFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingField(null)
        }}
        entityType={activeTab}
        existing={editingField}
        nextPosition={nextPosition}
      />

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <ModalHeader
          title="Désactiver le champ"
          description={`Le champ "${deleteTarget?.field_label}" sera désactivé. Les données existantes seront conservées.`}
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
            {deleteMutation.isPending ? 'Suppression...' : 'Désactiver'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
