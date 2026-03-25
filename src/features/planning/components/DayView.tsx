import { memo, useMemo } from 'react'
import { Plus, Users, MapPin, Clock } from 'lucide-react'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import type { PlanningSlot, Team } from '../../../types'
import { toDateStr, clientDisplayName, formatTime } from '../utils/date-helpers'
import { getSlotColorType } from './SlotCard'

type InterventionColorKey = keyof typeof INTERVENTION_COLORS

interface DayViewProps {
  currentDate: Date
  teams: Team[]
  slots: PlanningSlot[]
  activeFilters: Set<InterventionColorKey>
  isLoading: boolean
  onCellClick: (teamId: string, teamName: string, date: string) => void
  onSlotClick?: (slot: PlanningSlot) => void
}

const DaySlotCard = memo(function DaySlotCard({ slot, onClick }: { slot: PlanningSlot; onClick?: () => void }) {
  const colorType = getSlotColorType(slot)
  const colors = INTERVENTION_COLORS[colorType]
  const chantierClient = (slot.chantier as (PlanningSlot['chantier'] & { client?: { first_name?: string; last_name?: string; company_name?: string | null } | null }))?.client
  const displayName = clientDisplayName(chantierClient)
  const title = slot.chantier?.title ?? 'Sans titre'
  const timeRange = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
  const address = slot.chantier?.address_line1
    ? `${slot.chantier.address_line1}${slot.chantier.city ? `, ${slot.chantier.city}` : ''}`
    : null

  return (
    <div
      onClick={onClick}
      className={`${colors.bg} ${colors.border} border rounded-lg p-3 transition-shadow hover:shadow-sm cursor-pointer flex-1`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${colors.text}`}>
            {title}
          </p>
          <p className={`text-xs ${colors.text} opacity-80 mt-0.5`}>
            {displayName}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.border} border ${colors.text} font-medium flex-shrink-0`}>
          {colorType}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1">
          <Clock className={`w-3.5 h-3.5 ${colors.text} opacity-60`} />
          <span className={`text-xs ${colors.text} opacity-70`}>{timeRange}</span>
        </div>
        {address && (
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className={`w-3.5 h-3.5 ${colors.text} opacity-60 flex-shrink-0`} />
            <span className={`text-xs ${colors.text} opacity-70 truncate`}>{address}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export function DayView({
  currentDate,
  teams,
  slots,
  activeFilters,
  isLoading,
  onCellClick,
  onSlotClick,
}: DayViewProps) {
  const dateStr = toDateStr(currentDate)

  const filteredSlots = useMemo(() => {
    const daySlots = slots.filter((s) => s.slot_date === dateStr)
    if (activeFilters.size === 0) return daySlots
    return daySlots.filter((slot) => {
      const colorType = getSlotColorType(slot)
      return activeFilters.has(colorType)
    })
  }, [slots, dateStr, activeFilters])

  // Group by team
  const slotsByTeam = useMemo(() => {
    const map = new Map<string, PlanningSlot[]>()
    for (const slot of filteredSlots) {
      const existing = map.get(slot.team_id)
      if (existing) {
        existing.push(slot)
      } else {
        map.set(slot.team_id, [slot])
      }
    }
    return map
  }, [filteredSlots])

  if (isLoading) {
    return (
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-32" />
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
      {teams.length === 0 && (
        <div className="p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Aucune équipe configurée</p>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {teams.map((team) => {
          const teamSlots = slotsByTeam.get(team.id) ?? []

          return (
            <div key={team.id} className="p-4">
              {/* Team header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: team.color || '#6366f1' }}
                >
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{team.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    {teamSlots.length === 0
                      ? 'Aucune intervention'
                      : `${teamSlots.length} intervention${teamSlots.length > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Slots */}
              {teamSlots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 ml-12">
                  {teamSlots.map((slot) => (
                    <DaySlotCard
                      key={slot.id}
                      slot={slot}
                      onClick={() => onSlotClick?.(slot)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => onCellClick(team.id, team.name, dateStr)}
                  className="ml-12 border-2 border-dashed border-slate-200 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
                >
                  <Plus className="w-4 h-4 text-slate-300 mr-1.5" />
                  <span className="text-xs text-slate-400">Ajouter une intervention</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
