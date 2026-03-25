import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import {
  useFieldDefinitions,
  useEntityCustomFieldValues,
  useUpsertCustomFieldValues,
} from '../../queries/useCustomFields'
import { useToast } from '../feedback/ToastProvider'
import type { CustomFieldEntityType } from '../../types'

interface CustomFieldsSectionProps {
  entityType: CustomFieldEntityType
  entityId: string
  readOnly?: boolean
}

export function CustomFieldsSection({ entityType, entityId, readOnly = false }: CustomFieldsSectionProps) {
  const toast = useToast()
  const { data: definitions, isLoading: isLoadingDefs } = useFieldDefinitions(entityType)
  const { data: values, isLoading: isLoadingValues } = useEntityCustomFieldValues(entityType, entityId)
  const upsertMutation = useUpsertCustomFieldValues()

  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)

  // Initialize form values from DB
  useEffect(() => {
    if (!definitions || !values) return
    const map: Record<string, unknown> = {}
    for (const def of definitions) {
      const existing = values.find((v) => v.field_definition_id === def.id)
      map[def.id] = existing?.value ?? (def.field_type === 'boolean' ? false : '')
    }
    setFormValues(map)
    setDirty(false)
  }, [definitions, values])

  const updateValue = (defId: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [defId]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!definitions) return
    const payload = definitions.map((def) => ({
      field_definition_id: def.id,
      value: formValues[def.id] ?? null,
    }))

    try {
      await upsertMutation.mutateAsync({ entityType, entityId, values: payload })
      toast.success('Enregistré', 'Les champs personnalisés ont été sauvegardés.')
      setDirty(false)
    } catch {
      toast.error('Erreur', 'Impossible de sauvegarder les champs.')
    }
  }

  if (isLoadingDefs || isLoadingValues) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (!definitions || definitions.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        Aucun champ personnalisé défini pour cette entité.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {definitions.map((def) => {
          const value = formValues[def.id]

          return (
            <div key={def.id}>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                {def.field_label}
                {def.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {def.field_type === 'text' && (
                <input
                  type="text"
                  value={String(value ?? '')}
                  onChange={(e) => updateValue(def.id, e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50"
                />
              )}

              {def.field_type === 'number' && (
                <input
                  type="number"
                  value={value === '' || value === null || value === undefined ? '' : Number(value)}
                  onChange={(e) => updateValue(def.id, e.target.value ? parseFloat(e.target.value) : '')}
                  disabled={readOnly}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50"
                />
              )}

              {def.field_type === 'date' && (
                <input
                  type="date"
                  value={String(value ?? '')}
                  onChange={(e) => updateValue(def.id, e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50"
                />
              )}

              {def.field_type === 'select' && (
                <select
                  value={String(value ?? '')}
                  onChange={(e) => updateValue(def.id, e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50"
                >
                  <option value="">— Sélectionner —</option>
                  {(def.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {def.field_type === 'boolean' && (
                <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => updateValue(def.id, e.target.checked)}
                    disabled={readOnly}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-600">Oui</span>
                </label>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && dirty && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {upsertMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Enregistrer
          </button>
        </div>
      )}
    </div>
  )
}
