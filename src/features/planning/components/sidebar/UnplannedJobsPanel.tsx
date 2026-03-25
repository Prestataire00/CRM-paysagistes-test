import { useState } from 'react'
import { ClipboardList, Trash2, CalendarPlus, ArrowDownUp, MapPin } from 'lucide-react'
import type { Chantier } from '../../../../types'
import { clientDisplayName } from '../../utils/date-helpers'

type SortMode = 'priority' | 'date' | 'zone'

const ZONE_COLORS: Record<string, string> = {
  zone_1: 'bg-blue-500',
  zone_2: 'bg-emerald-500',
  zone_3: 'bg-amber-500',
  zone_4: 'bg-red-500',
  zone_5: 'bg-purple-500',
}

const ZONE_LABELS: Record<string, string> = {
  zone_1: 'Z1',
  zone_2: 'Z2',
  zone_3: 'Z3',
  zone_4: 'Z4',
  zone_5: 'Z5',
}

interface UnplannedJobsPanelProps {
  chantiers: Chantier[]
  isLoading: boolean
  onPostpone: (id: string, days: number) => void
  onDelete: (id: string) => void
}

export function UnplannedJobsPanel({ chantiers, isLoading, onPostpone, onDelete }: UnplannedJobsPanelProps) {
  const [sortMode, setSortMode] = useState<SortMode>('priority')

  const sorted = [...chantiers].sort((a, b) => {
    if (sortMode === 'priority') return a.priority - b.priority
    if (sortMode === 'date') {
      if (!a.scheduled_date) return 1
      if (!b.scheduled_date) return -1
      return a.scheduled_date.localeCompare(b.scheduled_date)
    }
    // zone
    return (a.geographic_zone ?? '').localeCompare(b.geographic_zone ?? '')
  })

  const cycleSortMode = () => {
    const modes: SortMode[] = ['priority', 'date', 'zone']
    const idx = modes.indexOf(sortMode)
    setSortMode(modes[(idx + 1) % modes.length])
  }

  const sortLabel: Record<SortMode, string> = {
    priority: 'Priorité',
    date: 'Date',
    zone: 'Zone',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Non planifiés</span>
          </div>
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
            {chantiers.length}
          </span>
        </div>
        <button
          onClick={cycleSortMode}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowDownUp className="w-3 h-3" />
          Tri : {sortLabel[sortMode]}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-4">Tout est planifié</p>
        ) : (
          <div className="p-1.5 space-y-1">
            {sorted.map((ch) => {
              const client = (ch as Chantier & { client?: { first_name?: string; last_name?: string; company_name?: string | null } | null }).client
              const zone = ch.geographic_zone
              const zoneColor = zone ? ZONE_COLORS[zone] ?? 'bg-slate-400' : null

              return (
                <div
                  key={ch.id}
                  className="bg-white border border-slate-200 rounded-md p-2 hover:shadow-sm transition-shadow group"
                >
                  <div className="flex items-start gap-1.5">
                    {/* Zone dot */}
                    {zoneColor && (
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${zoneColor}`}
                        title={ZONE_LABELS[zone!] ?? zone}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-800 truncate">{ch.title}</p>
                      <p className="text-[9px] text-slate-500 truncate">{clientDisplayName(client)}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {ch.city && (
                          <span className="flex items-center gap-0.5 text-[8px] text-slate-400">
                            <MapPin className="w-2 h-2" />
                            {ch.city}
                          </span>
                        )}
                        <span className="text-[8px] text-slate-300 ml-auto">P{ch.priority}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onPostpone(ch.id, 7)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 bg-slate-50 rounded hover:bg-slate-100 transition-colors"
                      title="Reporter +1 semaine"
                    >
                      <CalendarPlus className="w-2.5 h-2.5" />
                      +1 sem
                    </button>
                    <button
                      onClick={() => onDelete(ch.id)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-red-500 bg-red-50 rounded hover:bg-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
