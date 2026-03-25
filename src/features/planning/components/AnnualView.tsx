import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { MONTH_NAMES_FULL, DAY_LABELS, getMonthGrid, toDateStr } from '../utils/date-helpers'

interface AnnualViewProps {
  year: number
  slotCounts: Record<string, number>
  isLoading: boolean
  onMonthClick: (month: number) => void
}

function getHeatColor(count: number): string {
  if (count === 0) return 'bg-slate-50'
  if (count <= 2) return 'bg-blue-100'
  if (count <= 5) return 'bg-blue-300'
  return 'bg-blue-500'
}

function getTextColor(count: number): string {
  if (count >= 6) return 'text-white'
  return 'text-slate-700'
}

function MiniMonth({ year, month, slotCounts, onClick }: {
  year: number
  month: number
  slotCounts: Record<string, number>
  onClick: () => void
}) {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <h4 className="text-xs font-semibold text-slate-700 text-center mb-1.5">
        {MONTH_NAMES_FULL[month]}
      </h4>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-0.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-[7px] text-slate-400 text-center font-medium">
            {d.charAt(0)}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {grid.map((cell, i) => {
          const dateStr = toDateStr(cell.date)
          const count = slotCounts[dateStr] ?? 0
          const isToday = dateStr === toDateStr(new Date())

          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center text-[7px] rounded-sm ${
                cell.isCurrentMonth
                  ? `${getHeatColor(count)} ${getTextColor(count)}`
                  : 'text-slate-200'
              } ${isToday ? 'ring-1 ring-primary-400' : ''}`}
              title={cell.isCurrentMonth ? `${dateStr}: ${count} intervention(s)` : undefined}
            >
              {cell.isCurrentMonth ? cell.date.getDate() : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AnnualView({ year, slotCounts, isLoading, onMonthClick }: AnnualViewProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto p-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, month) => (
          <MiniMonth
            key={month}
            year={year}
            month={month}
            slotCounts={slotCounts}
            onClick={() => onMonthClick(month)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <span className="text-[10px] text-slate-500">Interventions :</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-slate-50 border border-slate-200" />
          <span className="text-[9px] text-slate-400">0</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-100" />
          <span className="text-[9px] text-slate-400">1-2</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-300" />
          <span className="text-[9px] text-slate-400">3-5</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-[9px] text-slate-400">6+</span>
        </div>
      </div>
    </div>
  )
}
