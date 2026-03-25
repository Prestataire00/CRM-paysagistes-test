import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { getRecordHistory } from '../../services/admin.service'
import { computeDiff, formatFieldValue } from '../../utils/diff'
import type { AuditLog } from '../../types'

interface RecordHistoryProps {
  tableName: string
  recordId: string
  defaultOpen?: boolean
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; color: string }> = {
  INSERT: { label: 'Création', icon: Plus, color: 'text-green-600 bg-green-50' },
  UPDATE: { label: 'Modification', icon: Pencil, color: 'text-blue-600 bg-blue-50' },
  DELETE: { label: 'Suppression', icon: Trash2, color: 'text-red-600 bg-red-50' },
}

export function RecordHistory({ tableName, recordId, defaultOpen = false }: RecordHistoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin', 'history', tableName, recordId],
    queryFn: () => getRecordHistory(tableName, recordId),
    enabled: !!recordId && isOpen,
    staleTime: 30_000,
  })

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Historique des modifications
          </span>
          {logs && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              Aucune modification enregistrée
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />

              <div className="space-y-4">
                {logs.map((log) => (
                  <HistoryEntry key={log.id} log={log} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryEntry({ log }: { log: AuditLog & { profile?: { first_name: string; last_name: string } | null } }) {
  const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.UPDATE
  const Icon = config.icon
  const changes = log.action === 'UPDATE'
    ? computeDiff(log.old_values, log.new_values)
    : []

  const date = new Date(log.created_at)
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const formattedTime = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const userName = log.profile
    ? `${log.profile.first_name} ${log.profile.last_name}`
    : 'Système'

  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 border-white ${
        log.action === 'INSERT' ? 'bg-green-400' :
        log.action === 'DELETE' ? 'bg-red-400' : 'bg-blue-400'
      }`} />

      <div className="bg-slate-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.color}`}>
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
            <span className="text-xs text-slate-500">{userName}</span>
          </div>
          <span className="text-xs text-slate-400">
            {formattedDate} à {formattedTime}
          </span>
        </div>

        {log.action === 'INSERT' && (
          <p className="text-xs text-slate-500 mt-1">Enregistrement créé</p>
        )}

        {log.action === 'DELETE' && (
          <p className="text-xs text-slate-500 mt-1">Enregistrement supprimé</p>
        )}

        {log.action === 'UPDATE' && changes.length > 0 && (
          <div className="mt-2 space-y-1">
            {changes.map((change) => (
              <div key={change.field} className="text-xs">
                <span className="font-medium text-slate-600">{change.label}</span>
                <span className="text-slate-400">{' : '}</span>
                <span className="text-red-500 line-through">
                  {formatFieldValue(change.oldValue)}
                </span>
                <span className="text-slate-400"> → </span>
                <span className="text-green-600 font-medium">
                  {formatFieldValue(change.newValue)}
                </span>
              </div>
            ))}
          </div>
        )}

        {log.action === 'UPDATE' && changes.length === 0 && (
          <p className="text-xs text-slate-500 mt-1">Champs internes modifiés</p>
        )}
      </div>
    </div>
  )
}
