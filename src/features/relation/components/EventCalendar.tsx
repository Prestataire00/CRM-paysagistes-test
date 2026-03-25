import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  getMonthGrid,
  toDateStr,
  DAY_LABELS,
  MONTH_NAMES_FULL,
} from '../../planning/utils/date-helpers'
import type { CrmEvent, EventType } from '../../../types'

// ---------------------------------------------------------------------------
// Types & config
// ---------------------------------------------------------------------------
interface EventCalendarProps {
  events: CrmEvent[]
  isLoading: boolean
  onDayClick: (date: Date) => void
  onEventClick: (eventId: string) => void
}

const typeColors: Record<EventType, { bg: string; text: string }> = {
  salon: { bg: 'bg-purple-100', text: 'text-purple-700' },
  portes_ouvertes: { bg: 'bg-blue-100', text: 'text-blue-700' },
  atelier: { bg: 'bg-amber-100', text: 'text-amber-700' },
  formation: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  reunion: { bg: 'bg-slate-100', text: 'text-slate-700' },
  autre: { bg: 'bg-slate-100', text: 'text-slate-600' },
}

const MAX_VISIBLE = 3

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function EventCalendar({ events, isLoading, onDayClick, onEventClick }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const todayStr = toDateStr(new Date())

  // Group events by date (including multi-day spans)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CrmEvent[]>()
    for (const event of events) {
      const start = new Date(event.start_date)
      const end = event.end_date ? new Date(event.end_date) : start
      const cursor = new Date(start)
      cursor.setHours(0, 0, 0, 0)
      const endDay = new Date(end)
      endDay.setHours(0, 0, 0, 0)

      while (cursor <= endDay) {
        const key = toDateStr(cursor)
        const existing = map.get(key)
        if (existing) {
          existing.push(event)
        } else {
          map.set(key, [event])
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [events])

  // Navigation
  const goToday = useCallback(() => setCurrentDate(new Date()), [])
  const goPrev = useCallback(() => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])
  const goNext = useCallback(() => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const rows = grid.length / 7

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="animate-pulse bg-slate-100 rounded h-5 w-40" />
          <div className="flex gap-2">
            <div className="animate-pulse bg-slate-100 rounded h-8 w-8" />
            <div className="animate-pulse bg-slate-100 rounded h-8 w-20" />
            <div className="animate-pulse bg-slate-100 rounded h-8 w-8" />
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAY_LABELS.map((label) => (
            <div key={label} className="p-3 text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="p-2 border-r border-b border-slate-100 min-h-[100px]">
              <div className="animate-pulse bg-slate-100 rounded h-5 w-5 mb-2" />
              <div className="animate-pulse bg-slate-100 rounded h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-900">
          {MONTH_NAMES_FULL[month]} {year}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={goPrev} />
          <Button variant="secondary" size="sm" onClick={goToday}>
            Aujourd'hui
          </Button>
          <Button variant="ghost" size="sm" icon={ChevronRight} onClick={goNext} />
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center">
            <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const dateStr = toDateStr(cell.date)
          const isToday = dateStr === todayStr
          const dayEvents = eventsByDate.get(dateStr) ?? []
          const overflow = dayEvents.length - MAX_VISIBLE

          return (
            <div
              key={i}
              onClick={() => onDayClick(cell.date)}
              className={`min-h-[110px] p-1.5 border-r border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                !cell.isCurrentMonth ? 'bg-slate-50/50' : ''
              } ${i % 7 === 6 ? 'border-r-0' : ''} ${Math.floor(i / 7) === rows - 1 ? 'border-b-0' : ''}`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span
                  className={`inline-flex items-center justify-center text-xs font-medium w-6 h-6 rounded-full ${
                    isToday
                      ? 'bg-green-600 text-white'
                      : cell.isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Event pills */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map((event) => {
                  const colors = typeColors[event.event_type]
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event.id)
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity`}
                      title={event.title}
                    >
                      {event.title}
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <p className="text-[10px] text-slate-400 font-medium px-1">+{overflow} autre{overflow > 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
