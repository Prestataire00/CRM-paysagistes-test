import { useMemo } from 'react'
import { Clock, AlertTriangle, ClipboardList } from 'lucide-react'
import type { PlanningSlot, Team } from '../../../types'
import type { Absence } from '../../../types/resource.types'
import { getDurationMinutes } from '../utils/date-helpers'
import { getTeamDayAvailability } from '../utils/availability'

interface KPIBarProps {
  slots: PlanningSlot[]
  teams: Team[]
  absences: Absence[]
  unplannedCount: number
  currentDate: Date
}

export function KPIBar({ slots, teams, absences, unplannedCount }: KPIBarProps) {
  const stats = useMemo(() => {
    // Total planned hours for current view
    const totalMinutes = slots.reduce((sum, s) => sum + getDurationMinutes(s.start_time, s.end_time), 0)
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10

    // Available team hours (8h per team member per day, rough estimate for the week)
    const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0)
    const availableHours = totalMembers * 8 * 5 // 5 working days

    // Occupation rate
    const occupationRate = availableHours > 0 ? Math.min(Math.round((totalMinutes / 60 / availableHours) * 100), 100) : 0

    // Conflict count: teams with 'none' availability that have slots assigned
    let conflictCount = 0
    const teamDates = new Set<string>()
    for (const slot of slots) {
      teamDates.add(`${slot.team_id}-${slot.slot_date}`)
    }
    for (const key of teamDates) {
      const [teamId] = key.split('-', 2)
      const fullDate = key.substring(teamId.length + 1)
      const team = teams.find((t) => t.id === teamId)
      if (team && absences.length > 0) {
        const avail = getTeamDayAvailability(team, absences, fullDate)
        if (avail === 'none') conflictCount++
      }
    }

    return { totalHours, availableHours, occupationRate, conflictCount }
  }, [slots, teams, absences])

  return (
    <div className="flex items-center gap-3 mb-3">
      {/* Hours planned */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
        <Clock className="w-3.5 h-3.5 text-blue-500" />
        <div>
          <p className="text-[10px] text-slate-400">Heures planifiées</p>
          <p className="text-xs font-semibold text-slate-800">
            {stats.totalHours}h
            {stats.availableHours > 0 && (
              <span className="text-slate-400 font-normal"> / {stats.availableHours}h</span>
            )}
          </p>
        </div>
      </div>

      {/* Occupation rate */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={stats.occupationRate > 90 ? '#ef4444' : stats.occupationRate > 70 ? '#f59e0b' : '#22c55e'}
              strokeWidth="3"
              strokeDasharray={`${stats.occupationRate * 0.94} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-700">
            {stats.occupationRate}%
          </span>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Occupation</p>
          <p className="text-xs font-semibold text-slate-800">{stats.occupationRate}%</p>
        </div>
      </div>

      {/* Planned vs Unplanned */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
        <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
        <div>
          <p className="text-[10px] text-slate-400">Interventions</p>
          <p className="text-xs font-semibold text-slate-800">
            {slots.length} planifiées
            {unplannedCount > 0 && (
              <span className="text-amber-600"> / {unplannedCount} en attente</span>
            )}
          </p>
        </div>
      </div>

      {/* Conflict alerts */}
      {stats.conflictCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <div>
            <p className="text-[10px] text-red-400">Conflits</p>
            <p className="text-xs font-semibold text-red-700">
              {stats.conflictCount} alerte{stats.conflictCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
