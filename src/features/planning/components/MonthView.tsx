import { useMemo } from 'react'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import type { PlanningSlot } from '../../../types'
import { DAY_LABELS, toDateStr, getMonthGrid } from '../utils/date-helpers'
import { getSlotColorType } from './SlotCard'

type InterventionColorKey = keyof typeof INTERVENTION_COLORS

interface MonthViewProps {
  currentDate: Date
  slots: PlanningSlot[]
  activeFilters: Set<InterventionColorKey>
  isLoading: boolean
  onDayClick: (date: Date) => void
}

export function MonthView({
  currentDate,
  slots,
  activeFilters,
  isLoading,
  onDayClick,
}: MonthViewProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

  const filteredSlots = useMemo(() => {
    if (activeFilters.size === 0) return slots
    return slots.filter((slot) => {
      const colorType = getSlotColorType(slot)
      return activeFilters.has(colorType)
    })
  }, [slots, activeFilters])

  // Group slots by date string
  const slotsByDate = useMemo(() => {
    const map = new Map<string, PlanningSlot[]>()
    for (const slot of filteredSlots) {
      const key = slot.slot_date
      const existing = map.get(key)
      if (existing) {
        existing.push(slot)
      } else {
        map.set(key, [slot])
      }
    }
    return map
  }, [filteredSlots])

  const todayStr = toDateStr(new Date())
  const rows = grid.length / 7

  if (isLoading) {
    return (
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAY_LABELS.map((label) => (
            <div key={label} className="p-3 text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="p-3 border-r border-b border-slate-100 min-h-[100px]">
              <div className="animate-pulse bg-slate-100 rounded h-4 w-6 mb-2" />
              <div className="animate-pulse bg-slate-100 rounded h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Day labels header */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${
              i >= 5 ? 'bg-slate-50/50' : ''
            }`}
          >
            <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 grid-rows-${rows}`}>
        {grid.map((cell, i) => {
          const dateStr = toDateStr(cell.date)
          const isToday = dateStr === todayStr
          const daySlots = slotsByDate.get(dateStr) ?? []
          const dayIndex = i % 7
          const isWeekend = dayIndex >= 5

          // Count by color type
          const colorCounts = new Map<string, number>()
          for (const slot of daySlots) {
            const ct = getSlotColorType(slot)
            colorCounts.set(ct, (colorCounts.get(ct) ?? 0) + 1)
          }
          const colorEntries = Array.from(colorCounts.entries()).slice(0, 4)

          return (
            <div
              key={i}
              onClick={() => onDayClick(cell.date)}
              className={`p-2 border-r border-b border-slate-100 last:border-r-0 min-h-[100px] cursor-pointer transition-colors hover:bg-slate-50 ${
                !cell.isCurrentMonth ? 'bg-slate-50/40' : ''
              } ${isWeekend && cell.isCurrentMonth ? 'bg-slate-50/30' : ''} ${
                isToday ? 'bg-primary-50/50 ring-1 ring-inset ring-primary-200' : ''
              }`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-sm font-medium ${
                    isToday
                      ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center'
                      : cell.isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {daySlots.length > 0 && (
                  <span className={`text-[10px] font-medium ${cell.isCurrentMonth ? 'text-slate-500' : 'text-slate-300'}`}>
                    {daySlots.length}
                  </span>
                )}
              </div>

              {/* Color dots summary */}
              {cell.isCurrentMonth && colorEntries.length > 0 && (
                <div className="space-y-1">
                  {colorEntries.map(([colorType, count]) => {
                    const colors = INTERVENTION_COLORS[colorType as InterventionColorKey]
                    return (
                      <div key={colorType} className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
                        <span className={`text-[10px] ${colors.text} truncate`}>
                          {count} {colorType}
                        </span>
                      </div>
                    )
                  })}
                  {daySlots.length > 4 && (
                    <span className="text-[10px] text-slate-400">+{daySlots.length - 4} autres</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
