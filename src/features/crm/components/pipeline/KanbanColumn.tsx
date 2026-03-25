import { useDroppable } from '@dnd-kit/core'
import { Plus, AlertTriangle } from 'lucide-react'
import { cn } from '../../../../utils/cn'
import { ProspectCard } from './ProspectCard'
import type { ProspectWithMeta } from '../../../../types'

interface KanbanColumnProps {
  stageId: string
  label: string
  color: string
  prospects: ProspectWithMeta[]
  totalCount: number
  collapsed?: boolean
  onToggleCollapse?: () => void
  onCardClick: (prospectId: string) => void
  onAddClick: () => void
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k €`
  }
  return `${value} €`
}

export function KanbanColumn({
  stageId,
  label,
  color,
  prospects,
  totalCount,
  collapsed = false,
  onToggleCollapse,
  onCardClick,
  onAddClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId })

  const totalValue = prospects.reduce((sum, p) => sum + (p.estimated_value ?? 0), 0)
  const weightedValue = prospects.reduce(
    (sum, p) => sum + (p.estimated_value ?? 0) * (p.probability ?? 0) / 100,
    0,
  )
  const inactiveCount = prospects.filter((p) => p.is_inactive).length
  const overflow = totalCount - prospects.length

  // Collapsed "perdu" column
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={onToggleCollapse}
        className={cn(
          'w-14 min-h-[400px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 shrink-0',
          isOver
            ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100',
        )}
      >
        <span
          className="text-xs font-semibold text-slate-500 whitespace-nowrap"
          style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
        >
          {label}
        </span>
        <span className="text-xs font-bold text-slate-600 bg-white rounded-full w-6 h-6 flex items-center justify-center border border-slate-200">
          {totalCount}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-72 shrink-0 flex flex-col rounded-xl border transition-all duration-200',
        isOver
          ? 'border-2 border-dashed ring-2 ring-primary-200'
          : 'border-slate-200',
        isOver ? 'bg-primary-50/40' : 'bg-slate-50',
      )}
      style={isOver ? { borderColor: color } : undefined}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 border-b border-slate-200 bg-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {inactiveCount > 0 && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full"
                title={`${inactiveCount} prospect${inactiveCount > 1 ? 's' : ''} inactif${inactiveCount > 1 ? 's' : ''}`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {inactiveCount}
              </span>
            )}
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {totalCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-500">
            {formatCurrency(Math.round(totalValue))}
          </span>
          <span className="text-[10px] text-slate-400">
            (pondéré: {formatCurrency(Math.round(weightedValue))})
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-320px)]">
        {prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            onClick={() => onCardClick(prospect.id)}
          />
        ))}

        {overflow > 0 && (
          <p className="text-center text-xs text-slate-400 py-1">
            +{overflow} non affiché{overflow > 1 ? 's' : ''}
          </p>
        )}

        {prospects.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-6">
            Aucun prospect
          </p>
        )}
      </div>

      {/* Add button */}
      <div className="p-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onAddClick}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-primary-600 border border-dashed border-slate-200 hover:border-primary-300 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}
