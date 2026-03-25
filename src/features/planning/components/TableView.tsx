import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import type { PlanningSlot } from '../../../types'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import { clientDisplayName, formatTime, formatDuration, DAY_LABELS, MONTH_NAMES } from '../utils/date-helpers'
import { getSlotColorType } from './SlotCard'

type InterventionColorKey = keyof typeof INTERVENTION_COLORS
type SortField = 'date' | 'team' | 'client' | 'city' | 'time' | 'type' | 'duration'
type SortDir = 'asc' | 'desc'

interface TableViewProps {
  slots: PlanningSlot[]
  activeFilters: Set<InterventionColorKey>
  isLoading: boolean
  onSlotClick?: (slot: PlanningSlot) => void
  highlightedSlotIds?: Set<string>
}

function SortHeader({ label, field, sortField, sortDir, onSort }: {
  label: string
  field: SortField
  sortField: SortField
  sortDir: SortDir
  onSort: (field: SortField) => void
}) {
  const isActive = sortField === field
  return (
    <th
      className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </div>
    </th>
  )
}

export function TableView({ slots, activeFilters, isLoading, onSlotClick, highlightedSlotIds }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filteredSlots = useMemo(() => {
    if (activeFilters.size === 0) return slots
    return slots.filter((s) => activeFilters.has(getSlotColorType(s)))
  }, [slots, activeFilters])

  const sortedSlots = useMemo(() => {
    const arr = [...filteredSlots]
    const dir = sortDir === 'asc' ? 1 : -1

    arr.sort((a, b) => {
      switch (sortField) {
        case 'date':
          return dir * a.slot_date.localeCompare(b.slot_date)
        case 'team':
          return dir * (a.team?.name ?? '').localeCompare(b.team?.name ?? '')
        case 'client': {
          const ca = a.chantier?.client
          const cb = b.chantier?.client
          return dir * clientDisplayName(ca).localeCompare(clientDisplayName(cb))
        }
        case 'city':
          return dir * (a.chantier?.city ?? '').localeCompare(b.chantier?.city ?? '')
        case 'time':
          return dir * (a.start_time ?? '').localeCompare(b.start_time ?? '')
        case 'type':
          return dir * getSlotColorType(a).localeCompare(getSlotColorType(b))
        case 'duration': {
          const da = getDurationValue(a)
          const db = getDurationValue(b)
          return dir * (da - db)
        }
        default:
          return 0
      }
    })
    return arr
  }, [filteredSlots, sortField, sortDir])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
          <tr>
            <SortHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Équipe" field="team" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Client" field="client" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Ville" field="city" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Horaires" field="time" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Durée" field="duration" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Type" field="type" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedSlots.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                Aucune intervention
              </td>
            </tr>
          ) : (
            sortedSlots.map((slot) => {
              const colorType = getSlotColorType(slot)
              const colors = INTERVENTION_COLORS[colorType]
              const client = slot.chantier?.client
              const date = new Date(slot.slot_date)
              const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1
              const isHighlighted = highlightedSlotIds?.has(slot.id)

              return (
                <tr
                  key={slot.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${isHighlighted ? 'bg-yellow-50' : ''}`}
                  onClick={() => onSlotClick?.(slot)}
                >
                  <td className="px-3 py-2 text-xs text-slate-700">
                    <span className="font-medium">{DAY_LABELS[dayIdx]}</span>{' '}
                    {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: slot.team?.color || '#6366f1' }}
                      >
                        {(slot.team?.name ?? '?').charAt(0)}
                      </div>
                      <span className="text-xs text-slate-700">{slot.team?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-[160px] truncate">
                    {clientDisplayName(client)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {slot.chantier?.city ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {formatTime(slot.start_time)}-{formatTime(slot.end_time)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {formatDuration(slot.start_time, slot.end_time) || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      {colorType}
                    </span>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function getDurationValue(slot: PlanningSlot): number {
  if (!slot.start_time || !slot.end_time) return 0
  const [sh, sm] = slot.start_time.split(':').map(Number)
  const [eh, em] = slot.end_time.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}
