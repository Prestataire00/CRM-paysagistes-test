import { useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Users,
  BarChart3,
  RefreshCw,
  BookOpen,
} from 'lucide-react'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import type { Team } from '../../../types'
import {
  DAY_LABELS,
  MONTH_NAMES,
  MONTH_NAMES_FULL,
  formatWeekRange,
  getWeekNumber,
  getMonday,
  toDateStr,
} from '../utils/date-helpers'

type InterventionColorKey = keyof typeof INTERVENTION_COLORS

const filterTypes: Array<{ key: InterventionColorKey; label: string }> = [
  { key: 'contrat', label: 'Contrat' },
  { key: 'ponctuel', label: 'Ponctuel' },
  { key: 'extra', label: 'Extra' },
  { key: 'ancien', label: 'Ancien' },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'suspendu', label: 'Suspendu' },
]

type PlanningView = 'month' | 'week' | 'day' | 'table' | 'annual'

interface PlanningToolbarProps {
  view: PlanningView
  currentDate: Date
  onDateChange: (date: Date) => void
  activeFilters: Set<InterventionColorKey>
  onToggleFilter: (type: InterventionColorKey) => void
  teams: Team[]
  selectedTeamIds: Set<string>
  onToggleTeam: (teamId: string) => void
  slotCount: number
  onRefresh?: () => void
  lastRefresh?: Date | null
  onOpenLegend?: () => void
}

export function PlanningToolbar({
  view,
  currentDate,
  onDateChange,
  activeFilters,
  onToggleFilter,
  teams,
  selectedTeamIds,
  onToggleTeam,
  slotCount,
  onRefresh,
  lastRefresh,
  onOpenLegend,
}: PlanningToolbarProps) {
  const goToPrevious = useCallback(() => {
    const d = new Date(currentDate)
    if (view === 'month' || view === 'annual') {
      d.setMonth(d.getMonth() - 1)
    } else if (view === 'week' || view === 'table') {
      d.setDate(d.getDate() - 7)
    } else {
      d.setDate(d.getDate() - 1)
    }
    onDateChange(d)
  }, [currentDate, view, onDateChange])

  const goToNext = useCallback(() => {
    const d = new Date(currentDate)
    if (view === 'month' || view === 'annual') {
      d.setMonth(d.getMonth() + 1)
    } else if (view === 'week' || view === 'table') {
      d.setDate(d.getDate() + 7)
    } else {
      d.setDate(d.getDate() + 1)
    }
    onDateChange(d)
  }, [currentDate, view, onDateChange])

  const goToToday = useCallback(() => {
    onDateChange(new Date())
  }, [onDateChange])

  const handleDatePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val) {
      onDateChange(new Date(val + 'T12:00:00'))
    }
  }, [onDateChange])

  const handleYearChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const d = new Date(currentDate)
    d.setFullYear(Number(e.target.value))
    onDateChange(d)
  }, [currentDate, onDateChange])

  const dateLabel = (() => {
    if (view === 'annual') {
      return `${currentDate.getFullYear()}`
    }
    if (view === 'month') {
      return `${MONTH_NAMES_FULL[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    }
    if (view === 'week' || view === 'table') {
      const monday = getMonday(currentDate)
      return `S${getWeekNumber(monday)} - ${formatWeekRange(monday)}`
    }
    const dayIndex = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1
    return `${DAY_LABELS[dayIndex]} ${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  })()

  const activeTeamCount = selectedTeamIds.size === 0 ? teams.length : selectedTeamIds.size
  const currentYear = currentDate.getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div className="space-y-3 mb-4">
      {/* Row 1: Date nav + actions + stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Date navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Précédent"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 min-w-[240px] justify-center">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900">
              {dateLabel}
            </span>
          </div>
          <button
            onClick={goToNext}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Suivant"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            Aujourd&apos;hui
          </button>

          {/* Date picker */}
          <input
            type="date"
            value={toDateStr(currentDate)}
            onChange={handleDatePick}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-300"
          />

          {/* Year selector */}
          <select
            value={currentYear}
            onChange={handleYearChange}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-300"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Action buttons + stats */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lastRefresh && (
                <span className="text-[10px] text-slate-400">
                  {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </button>
          )}
          {onOpenLegend && (
            <button
              onClick={onOpenLegend}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Légende"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <BarChart3 className="w-3.5 h-3.5" />
            {slotCount} interventions
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <Users className="w-3.5 h-3.5" />
            {activeTeamCount}/{teams.length} équipes
          </div>
        </div>
      </div>

      {/* Row 2: Type filters + team filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Type filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          {filterTypes.map((filter) => {
            const colors = INTERVENTION_COLORS[filter.key]
            const isActive = activeFilters.has(filter.key)
            return (
              <button
                key={filter.key}
                onClick={() => onToggleFilter(filter.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  isActive || activeFilters.size === 0
                    ? `${colors.bg} ${colors.border} ${colors.text}`
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                {filter.label}
              </button>
            )
          })}
        </div>

        {/* Team filters */}
        {teams.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {teams.map((team) => {
              const isActive = selectedTeamIds.size === 0 || selectedTeamIds.has(team.id)
              return (
                <button
                  key={team.id}
                  onClick={() => onToggleTeam(team.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    isActive
                      ? 'bg-white border-slate-300 text-slate-700'
                      : 'bg-slate-50 border-slate-100 text-slate-300'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? (team.color || '#6366f1') : '#cbd5e1' }}
                  />
                  {team.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
