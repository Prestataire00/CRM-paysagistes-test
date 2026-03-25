import { useState, useEffect } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { useCreateFieldDefinition, useUpdateFieldDefinition } from '../../../queries/useCustomFields'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { CustomFieldDefinition, CustomFieldEntityType, CustomFieldType } from '../../../types'

interface CustomFieldFormModalProps {
  open: boolean
  onClose: () => void
  entityType: CustomFieldEntityType
  existing?: CustomFieldDefinition | null
  nextPosition: number
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texte',
  number: 'Nombre',
  date: 'Date',
  select: 'Liste déroulante',
  boolean: 'Oui / Non',
}

const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'date', 'select', 'boolean']

export function CustomFieldFormModal({
  open,
  onClose,
  entityType,
  existing,
  nextPosition,
}: CustomFieldFormModalProps) {
  const toast = useToast()
  const createMutation = useCreateFieldDefinition()
  const updateMutation = useUpdateFieldDefinition()

  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('text')
  const [required, setRequired] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [newOption, setNewOption] = useState('')

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setFieldLabel(existing.field_label)
      setFieldName(existing.field_name)
      setFieldType(existing.field_type)
      setRequired(existing.required)
      setOptions(existing.options ?? [])
    } else {
      setFieldLabel('')
      setFieldName('')
      setFieldType('text')
      setRequired(false)
      setOptions([])
    }
    setNewOption('')
  }, [existing, open])

  // Auto-generate field_name from label
  const handleLabelChange = (label: string) => {
    setFieldLabel(label)
    if (!existing) {
      const name = label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
      setFieldName(name)
    }
  }

  const addOption = () => {
    const trimmed = newOption.trim()
    if (trimmed && !options.includes(trimmed)) {
      setOptions([...options, trimmed])
      setNewOption('')
    }
  }

  const removeOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!fieldLabel.trim()) {
      toast.warning('Libellé requis', 'Veuillez donner un libellé au champ.')
      return
    }
    if (!fieldName.trim()) {
      toast.warning('Nom technique requis', 'Le nom technique est requis.')
      return
    }
    if (fieldType === 'select' && options.length < 2) {
      toast.warning('Options requises', 'Une liste déroulante nécessite au moins 2 options.')
      return
    }

    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          input: {
            field_label: fieldLabel.trim(),
            field_type: fieldType,
            required,
            options: fieldType === 'select' ? options : [],
          },
        })
        toast.success('Champ mis à jour', `Le champ "${fieldLabel}" a été modifié.`)
      } else {
        await createMutation.mutateAsync({
          entity_type: entityType,
          field_name: fieldName.trim(),
          field_label: fieldLabel.trim(),
          field_type: fieldType,
          options: fieldType === 'select' ? options : [],
          required,
          position: nextPosition,
          is_active: true,
          created_by: null,
        })
        toast.success('Champ créé', `Le champ "${fieldLabel}" a été ajouté.`)
      }
      onClose()
    } catch {
      toast.error('Erreur', "Impossible d'enregistrer le champ.")
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={existing ? 'Modifier le champ' : 'Nouveau champ personnalisé'}
        description={`Pour l'entité : ${entityType}`}
      />

      <div className="px-6 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Libellé *</label>
          <input
            type="text"
            value={fieldLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Ex: Surface du terrain"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Nom technique</label>
          <input
            type="text"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            disabled={!!existing}
            placeholder="surface_terrain"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-500 font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Type de champ *</label>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
            disabled={!!existing}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {fieldType === 'select' && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Options</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-1.5 bg-slate-50 rounded-lg text-sm text-slate-700">
                    {opt}
                  </span>
                  <button
                    onClick={() => removeOption(idx)}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addOption()
                    }
                  }}
                  placeholder="Nouvelle option..."
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <button
                  onClick={addOption}
                  className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-600">Champ obligatoire</span>
        </label>
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : existing ? (
            'Enregistrer'
          ) : (
            'Créer le champ'
          )}
        </button>
      </ModalFooter>
    </Modal>
  )
}
