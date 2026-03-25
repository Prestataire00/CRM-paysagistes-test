import { useState, useMemo, useCallback, type DragEvent } from 'react'
import { Plus, Users } from 'lucide-react'
import type { PlanningSlot, Team } from '../../../types'
import type { Absence } from '../../../types/resource.types'
import { SlotCard, type DragData } from './SlotCard'
import { getSlotColorType } from './SlotCard'
import { DAY_LABELS, MONTH_NAMES, toDateStr, getWeekDates, getMonday } from '../utils/date-helpers'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import { getTeamDayAvailability, getAvailableMembers, AVAILABILITY_COLORS } from '../utils/availability'

type InterventionColorKey = keyof typeof INTERVENTION_COLORS

interface WeekViewProps {
  currentDate: Date
  teams: Team[]
  slots: PlanningSlot[]
  activeFilters: Set<InterventionColorKey>
  isLoading: boolean
  onMoveSlot: (slotId: string, newTeamId: string, newDate: string) => void
  onCellClick: (teamId: string, teamName: string, date: string) => void
  onSlotClick?: (slot: PlanningSlot) => void
  absences?: Absence[]
  highlightedSlotIds?: Set<string>
  teamVehicleMap?: Map<string, boolean>
  teamEquipmentMap?: Map<string, boolean>
}

function SkeletonCell() {
  return (
    <div className="p-1 border-r border-slate-100 last:border-r-0 min-h-[52px]">
      <div className="animate-pulse bg-slate-100 rounded-md h-10 w-full" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-slate-100 last:border-b-0">
      <div className="p-2.5 border-r border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse" />
        <div className="h-3 bg-slate-200 rounded animate-pulse flex-1" />
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <SkeletonCell key={i} />
      ))}
    </div>
  )
}

export function WeekView({
  currentDate,
  teams,
  slots,
  activeFilters,
  isLoading,
  onMoveSlot,
  onCellClick,
  onSlotClick,
  absences = [],
  highlightedSlotIds,
  teamVehicleMap,
  teamEquipmentMap,
}: WeekViewProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)

  const monday = useMemo(() => getMonday(currentDate), [currentDate])
  const weekDates = useMemo(() => getWeekDates(monday), [monday])

  const filteredSlots = useMemo(() => {
    if (activeFilters.size === 0) return slots
    return slots.filter((slot) => {
      const colorType = getSlotColorType(slot)
      return activeFilters.has(colorType)
    })
  }, [slots, activeFilters])

  const slotGrid = useMemo(() => {
    const map = new Map<string, PlanningSlot[]>()
    for (const slot of filteredSlots) {
      const key = `${slot.team_id}-${slot.slot_date}`
      const existing = map.get(key)
      if (existing) {
        existing.push(slot)
      } else {
        map.set(key, [slot])
      }
    }
    return map
  }, [filteredSlots])

  const handleDragStart = useCallback((_e: DragEvent<HTMLDivElement>, data: DragData) => {
    _e.dataTransfer.setData('application/json', JSON.stringify(data))
    _e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, cellKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCell(cellKey)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, targetTeamId: string, targetDate: string) => {
      e.preventDefault()
      setDragOverCell(null)

      try {
        const raw = e.dataTransfer.getData('application/json')
        if (!raw) return
        const dragData: DragData = JSON.parse(raw)

        if (dragData.sourceTeamId === targetTeamId && dragData.sourceDate === targetDate) return

        onMoveSlot(dragData.slotId, targetTeamId, targetDate)
      } catch {
        // Invalid drag data
      }
    },
    [onMoveSlot],
  )

  const todayStr = toDateStr(new Date())

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="p-3 border-r border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Équipes</span>
          </div>
          {weekDates.map((date, i) => {
            const isToday = toDateStr(date) === todayStr
            return (
              <div
                key={i}
                className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${
                  i >= 5 ? 'bg-slate-50/50' : ''
                } ${isToday ? 'bg-primary-50/60' : ''}`}
              >
                <span className={`text-xs font-semibold ${isToday ? 'text-primary-700' : 'text-slate-700'}`}>
                  {DAY_LABELS[i]}
                </span>
                <p className={`text-[10px] mt-0.5 ${isToday ? 'text-primary-500 font-medium' : 'text-slate-400'}`}>
                  {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                </p>
              </div>
            )
          })}
        </div>

        {/* Loading state */}
        {isLoading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </>
        )}

        {/* Empty state */}
        {!isLoading && teams.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Aucune équipe configurée</p>
            <p className="text-xs text-slate-400 mt-1">Créez des équipes pour commencer à planifier</p>
          </div>
        )}

        {/* Team rows */}
        {!isLoading &&
          teams.map((team: Team) => {
            const hasVehicle = teamVehicleMap?.get(team.id) ?? false
            const hasEquipment = teamEquipmentMap?.get(team.id) ?? false

            return (
              <div
                key={team.id}
                className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30 transition-colors"
              >
                {/* Team label with members */}
                <div className="p-2.5 border-r border-slate-200">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: team.color || '#6366f1' }}
                    >
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate">{team.name}</span>
                  </div>
                </div>

                {weekDates.map((date, dayIndex) => {
                  const dateStr = toDateStr(date)
                  const cellKey = `${team.id}-${dateStr}`
                  const cellSlots = slotGrid.get(cellKey) ?? []
                  const isOver = dragOverCell === cellKey
                  const isToday = dateStr === todayStr

                  // Availability for this team on this day
                  const availability = absences.length > 0
                    ? getTeamDayAvailability(team as Team & { members?: Array<{ id: string; is_team_leader: boolean; profile: { id: string; first_name: string; last_name: string; role: string; avatar_url: string | null } }> }, absences, dateStr)
                    : 'full'
                  const membersList = absences.length > 0
                    ? getAvailableMembers(team as Team & { members?: Array<{ id: string; is_team_leader: boolean; profile: { id: string; first_name: string; last_name: string; role: string; avatar_url: string | null } }> }, absences, dateStr)
                    : []

                  return (
                    <div
                      key={dayIndex}
                      className={`p-1 border-r border-slate-100 last:border-r-0 min-h-[52px] transition-colors ${
                        dayIndex >= 5 ? 'bg-slate-50/30' : ''
                      } ${isToday ? 'bg-primary-50/30' : ''} ${
                        isOver ? 'bg-primary-100/60 ring-1 ring-inset ring-primary-300' : ''
                      }`}
                      onDragOver={(e) => handleDragOver(e, cellKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, team.id, dateStr)}
                      onClick={() => {
                        if (cellSlots.length === 0) {
                          onCellClick(team.id, team.name, dateStr)
                        }
                      }}
                    >
                      {/* Availability indicator + member names */}
                      {membersList.length > 0 && (
                        <div className="flex items-center gap-1 mb-0.5 px-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AVAILABILITY_COLORS[availability]}`} />
                          <div className="flex flex-wrap gap-x-1 min-w-0">
                            {membersList.map((m, idx) => (
                              <span
                                key={idx}
                                className={`text-[8px] leading-tight ${
                                  m.isAbsent
                                    ? 'text-red-400 line-through'
                                    : 'text-slate-400'
                                } ${m.isLeader ? 'font-semibold' : ''}`}
                              >
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Slot cards with scroll if >2 */}
                      <div className={cellSlots.length > 2 ? 'max-h-[120px] overflow-y-auto' : ''}>
                        {cellSlots.map((slot) => (
                          <SlotCard
                            key={slot.id}
                            slot={slot}
                            onDragStart={handleDragStart}
                            onClick={() => onSlotClick?.(slot)}
                            isHighlighted={highlightedSlotIds?.has(slot.id)}
                            hasVehicle={hasVehicle}
                            hasEquipment={hasEquipment}
                          />
                        ))}
                      </div>
                      {cellSlots.length === 0 && (
                        <div className="h-full min-h-[44px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                          <Plus className="w-3.5 h-3.5 text-slate-300" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
      </div>
    </div>
  )
}
