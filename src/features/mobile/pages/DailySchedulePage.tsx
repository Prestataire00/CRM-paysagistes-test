import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import {
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Loader2,
  Navigation,
  Phone,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useWeeklyPlanning, useTeams } from '../../../queries/usePlanning'
import type { InterventionStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getMondayDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function clientDisplayName(client?: {
  first_name: string
  last_name: string
  company_name: string | null
}): string {
  if (!client) return 'Client inconnu'
  if (client.company_name) return client.company_name
  return `${client.first_name} ${client.last_name}`
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '--:--'
  return t.slice(0, 5)
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h00'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

type StatusKey = 'terminee' | 'en_cours' | 'planifiee' | 'default'

const statusConfig: Record<StatusKey, {
  label: string
  className: string
  icon: typeof CheckCircle2
  cardBorder: string
}> = {
  terminee: {
    label: 'Terminee',
    className: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
    cardBorder: 'border-l-emerald-500',
  },
  en_cours: {
    label: 'En cours',
    className: 'bg-blue-100 text-blue-700',
    icon: Loader2,
    cardBorder: 'border-l-blue-500',
  },
  planifiee: {
    label: 'Planifiee',
    className: 'bg-slate-100 text-slate-600',
    icon: Circle,
    cardBorder: 'border-l-slate-300',
  },
  default: {
    label: 'Planifiee',
    className: 'bg-slate-100 text-slate-600',
    icon: Circle,
    cardBorder: 'border-l-slate-300',
  },
}

function getStatus(s: InterventionStatus | undefined) {
  if (s && s in statusConfig) return statusConfig[s as StatusKey]
  return statusConfig.default
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ScheduleSkeleton() {
  return (
    <div className="max-w-lg mx-auto animate-pulse px-4 pt-4">
      <div className="mb-6">
        <div className="h-6 w-40 bg-slate-200 rounded mb-3" />
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 h-14 bg-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="h-5 w-8 bg-slate-200 rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-slate-200 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 border-l-4 border-l-slate-200">
            <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
            <div className="h-5 w-48 bg-slate-200 rounded mb-3" />
            <div className="h-4 w-56 bg-slate-200 rounded mb-3" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailySchedulePage() {
  const { user } = useAuth()

  // Selected date state (default: today)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate])
  const isToday = selectedDateStr === todayStr

  // Compute the Monday for the weekly query
  const monday = useMemo(() => getMondayDate(selectedDate), [selectedDate])
  const weekStartStr = useMemo(() => toDateStr(monday), [monday])

  // Week days for the strip
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d
    }),
  [monday])

  // Fetch data
  const { data: teams } = useTeams()
  const { data: slots, isLoading, isError, refetch, isRefetching } = useWeeklyPlanning(weekStartStr)

  // Resolve user's team
  const userTeamId = useMemo(() => {
    if (user?.default_team_id) return user.default_team_id
    if (!teams || !user) return null
    for (const team of teams) {
      const members = team.members
      if (members?.some((m) => m.profile?.id === user.id)) return team.id
    }
    return null
  }, [user, teams])

  // Count interventions per day (for week strip dots)
  const slotsPerDay = useMemo(() => {
    if (!slots) return {} as Record<string, number>
    const map: Record<string, number> = {}
    slots
      .filter((s) => (userTeamId ? s.team_id === userTeamId : true))
      .forEach((s) => { map[s.slot_date] = (map[s.slot_date] || 0) + 1 })
    return map
  }, [slots, userTeamId])

  // Filter selected day's interventions
  const dayInterventions = useMemo(() => {
    if (!slots) return []
    return slots.filter((slot) => {
      const matchDate = slot.slot_date === selectedDateStr
      const matchTeam = userTeamId ? slot.team_id === userTeamId : true
      return matchDate && matchTeam
    })
  }, [slots, selectedDateStr, userTeamId])

  // Quick stats
  const completedCount = useMemo(
    () => dayInterventions.filter((s) => s.chantier?.status === 'terminee').length,
    [dayInterventions],
  )
  const totalDuration = useMemo(
    () => dayInterventions.reduce((sum, slot) => {
      if (slot.start_time && slot.end_time) return sum + Math.max(0, durationMinutes(slot.start_time, slot.end_time))
      if (slot.chantier?.estimated_duration_minutes) return sum + slot.chantier.estimated_duration_minutes
      return sum
    }, 0),
    [dayInterventions],
  )

  // Navigation
  const goToPrev = useCallback(() => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  }, [])
  const goToNext = useCallback(() => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  }, [])
  const goToToday = useCallback(() => setSelectedDate(new Date()), [])

  if (isLoading) return <ScheduleSkeleton />

  if (isError) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-4">
        <p className="text-red-600 font-medium mb-2">Erreur de chargement</p>
        <p className="text-sm text-slate-500">Impossible de charger le planning. Verifiez votre connexion.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4">
      {/* Header with day navigation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-slate-900">Planning</h1>
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Day navigation arrows + date */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={goToPrev}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 active:bg-slate-50 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-slate-900 capitalize">{formatDateLong(selectedDate)}</p>
            {!isToday && (
              <button onClick={goToToday} className="text-xs text-primary-600 font-medium">
                Aujourd'hui
              </button>
            )}
          </div>
          <button
            onClick={goToNext}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 active:bg-slate-50 flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Week strip */}
        <div className="flex gap-1.5 mb-4">
          {weekDays.map((day, i) => {
            const dayStr = toDateStr(day)
            const isSelected = dayStr === selectedDateStr
            const isDayToday = dayStr === todayStr
            const count = slotsPerDay[dayStr] || 0

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(new Date(day))}
                className={`flex-1 flex flex-col items-center py-2 rounded-lg text-center transition-colors ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : isDayToday
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                  {DAY_SHORT[i]}
                </span>
                <span className="text-sm font-bold">{day.getDate()}</span>
                {count > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-primary-500'}`} />
                )}
              </button>
            )
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
            <p className="text-lg font-bold text-slate-900">{dayInterventions.length}</p>
            <p className="text-[10px] text-slate-500">Interventions</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-600">
              {completedCount}/{dayInterventions.length}
            </p>
            <p className="text-[10px] text-slate-500">Realisees</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
            <p className="text-lg font-bold text-slate-900">{formatDuration(totalDuration)}</p>
            <p className="text-[10px] text-slate-500">Duree totale</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {dayInterventions.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-600 mb-1">Aucune intervention</p>
          <p className="text-sm text-slate-400">
            {isToday ? 'Aucune intervention pour aujourd\'hui' : `Rien de prevu pour le ${selectedDate.getDate()}/${selectedDate.getMonth() + 1}`}
          </p>
        </div>
      )}

      {/* Intervention Cards */}
      <div className="space-y-3 pb-4">
        {dayInterventions.map((slot) => {
          const chantier = slot.chantier
          const client = chantier?.client
          const tasks = chantier?.tasks
          const status = getStatus(chantier?.status)
          const StatusIcon = status.icon

          const timeRange = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
          const dur =
            slot.start_time && slot.end_time
              ? durationMinutes(slot.start_time, slot.end_time)
              : chantier?.estimated_duration_minutes ?? 0

          const address = [chantier?.address_line1, chantier?.city].filter(Boolean).join(', ')
          const phone = client?.phone || client?.mobile || null

          return (
            <Link
              key={slot.id}
              to={`/m/intervention/${chantier?.id ?? slot.chantier_id}?slot=${slot.id}`}
              className={`block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-l-4 ${status.cardBorder} active:scale-[0.98] transition-transform`}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}
                      >
                        <StatusIcon
                          className={`w-3 h-3 ${chantier?.status === 'en_cours' ? 'animate-spin' : ''}`}
                        />
                        {status.label}
                      </span>
                      {chantier?.intervention_type && (
                        <span className="text-[10px] text-slate-400 capitalize">
                          {chantier.intervention_type}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {clientDisplayName(client)}
                    </h3>
                    {chantier?.title && (
                      <p className="text-xs text-slate-500 mt-0.5">{chantier.title}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 mt-1" />
                </div>

                {/* Address */}
                {address && (
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{address}</span>
                  </div>
                )}

                {/* Time & Duration */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {timeRange}
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                    {formatDuration(dur)}
                  </span>
                  {tasks && tasks.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {tasks.length} tache{tasks.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Tasks preview */}
                {tasks && tasks.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {tasks.slice(0, 4).map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            task.is_completed
                              ? 'bg-emerald-100 border-emerald-300'
                              : 'border-slate-300'
                          }`}
                        >
                          {task.is_completed && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                        </div>
                        <span
                          className={`text-sm ${
                            task.is_completed
                              ? 'text-slate-400 line-through'
                              : 'text-slate-700'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))}
                    {tasks.length > 4 && (
                      <p className="text-xs text-slate-400 pl-6">
                        +{tasks.length - 4} autre{tasks.length - 4 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {chantier?.status !== 'terminee' && (
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <a
                      href={
                        address
                          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium active:bg-blue-100 transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Itineraire
                    </a>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center w-12 h-12 bg-emerald-50 text-emerald-700 rounded-lg active:bg-emerald-100 transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
