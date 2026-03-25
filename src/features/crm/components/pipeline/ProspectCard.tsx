import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, User, Clock, Bell } from 'lucide-react'
import { cn } from '../../../../utils/cn'
import { ScoringBadge } from './ScoringBadge'
import { daysSinceLastActivity } from '../../utils/scoring'
import type { ProspectWithMeta } from '../../../../types'
import type { EnrichedProspect } from '../../../../services/prospect.service'

interface ProspectCardProps {
  prospect: ProspectWithMeta
  onClick: () => void
}

function formatValue(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDaysAgo(days: number): string {
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

export const ProspectCard = memo(function ProspectCard({ prospect, onClick }: ProspectCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospect.id,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const days = daysSinceLastActivity(prospect as unknown as EnrichedProspect)

  // Inactivity border color
  const borderColor =
    prospect.is_inactive
      ? 'border-l-red-400'
      : days > 5
        ? 'border-l-amber-400'
        : 'border-l-emerald-400'

  const displayName = prospect.company_name || `${prospect.first_name} ${prospect.last_name}`
  const subName = prospect.company_name ? `${prospect.first_name} ${prospect.last_name}` : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        'border-l-4',
        borderColor,
        isDragging && 'opacity-40 shadow-none',
      )}
      onClick={(e) => {
        // Don't trigger click if dragging
        if (!isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-1.5 px-3 pt-2.5 pb-1.5">
        <button
          className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
          {subName && (
            <p className="text-xs text-slate-500 truncate">{subName}</p>
          )}
        </div>
        <ScoringBadge score={prospect.score} size="sm" />
      </div>

      {/* Value + Probability */}
      <div className="flex items-center gap-2 px-3 pb-1.5">
        <span className="text-xs font-semibold text-slate-800">
          {formatValue(prospect.estimated_value)}
        </span>
        {prospect.probability != null && (
          <span className="text-[10px] font-medium text-slate-400">
            ● {prospect.probability}%
          </span>
        )}
      </div>

      {/* Commercial + Last activity */}
      <div className="px-3 pb-2 space-y-1">
        {prospect.assigned_commercial && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {prospect.assigned_commercial.first_name} {prospect.assigned_commercial.last_name}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{formatDaysAgo(days)}</span>
          {prospect.reminder_message && (
            <Bell className="w-3 h-3 text-amber-500 animate-pulse ml-auto shrink-0" />
          )}
        </div>
      </div>

      {/* Source tag */}
      {prospect.source && (
        <div className="px-3 pb-2.5">
          <span className="inline-block text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {prospect.source}
          </span>
        </div>
      )}
    </div>
  )
})
