import { AlertTriangle, X } from 'lucide-react'

interface Conflict {
  type: 'absence' | 'equipment' | 'overload'
  message: string
}

interface ConflictConfirmDialogProps {
  conflicts: Conflict[]
  onConfirm: () => void
  onCancel: () => void
}

export function ConflictConfirmDialog({ conflicts, onConfirm, onCancel }: ConflictConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">Conflits détectés</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              {conflicts.length} problème{conflicts.length > 1 ? 's' : ''} identifié{conflicts.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-amber-100 transition-colors">
            <X className="w-4 h-4 text-amber-600" />
          </button>
        </div>

        {/* Conflicts list */}
        <div className="px-5 py-3 space-y-2">
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                c.type === 'absence' ? 'bg-red-500' :
                c.type === 'equipment' ? 'bg-amber-500' :
                'bg-orange-500'
              }`} />
              <p className="text-xs text-slate-700">{c.message}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Forcer le déplacement
          </button>
        </div>
      </div>
    </div>
  )
}

export type { Conflict }
