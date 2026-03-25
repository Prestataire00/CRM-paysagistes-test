import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Team } from '../../../../types'
import type { Absence } from '../../../../types/resource.types'
import type { Vehicle, Equipment } from '../../../../types/resource.types'
import { DAY_LABELS, getWeekDates, getMonday, toDateStr } from '../../utils/date-helpers'
import { getTeamDayAvailability } from '../../utils/availability'

interface AvailabilityChartsProps {
  teams: Team[]
  absences: Absence[]
  vehicles: Vehicle[]
  equipment: Equipment[]
  currentDate: Date
}

export function AvailabilityCharts({ teams, absences, vehicles, equipment, currentDate }: AvailabilityChartsProps) {
  const monday = getMonday(currentDate)
  const weekDates = getWeekDates(monday)

  // Personnel availability per day
  const personnelData = useMemo(() => {
    return weekDates.slice(0, 5).map((date, i) => {
      const dateStr = toDateStr(date)
      let available = 0
      let total = 0
      for (const team of teams) {
        const members = team.members ?? []
        total += members.length
        const avail = getTeamDayAvailability(team, absences, dateStr)
        if (avail === 'full') available += members.length
        else if (avail === 'partial') {
          const absentCount = members.filter((m: any) =>
            absences.some((a) => a.profile_id === m.profile.id && a.start_date <= dateStr && a.end_date >= dateStr),
          ).length
          available += members.length - absentCount
        }
      }
      return { day: DAY_LABELS[i], disponibles: available, total }
    })
  }, [teams, absences, weekDates])

  // Equipment summary
  const vehicleAvailable = vehicles.filter((v) => v.status === 'disponible').length
  const vehicleTotal = vehicles.length
  const equipAvailable = equipment.filter((e) => e.status === 'disponible').length
  const equipTotal = equipment.length

  return (
    <div className="flex gap-4 h-full">
      {/* Personnel chart */}
      <div className="flex-1 min-w-0">
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Personnel disponible</h4>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={personnelData}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '4px 8px' }}
              formatter={(value: number | undefined) => [`${value ?? 0} pers.`, 'Disponibles']}
            />
            <Bar dataKey="disponibles" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Equipment summary */}
      <div className="w-[180px] flex-shrink-0 space-y-2">
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Matériel</h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600">Véhicules</span>
            <span className={`text-[11px] font-semibold ${vehicleAvailable === vehicleTotal ? 'text-emerald-600' : 'text-amber-600'}`}>
              {vehicleAvailable}/{vehicleTotal}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: vehicleTotal > 0 ? `${(vehicleAvailable / vehicleTotal) * 100}%` : '0%' }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600">Équipements</span>
            <span className={`text-[11px] font-semibold ${equipAvailable === equipTotal ? 'text-emerald-600' : 'text-amber-600'}`}>
              {equipAvailable}/{equipTotal}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: equipTotal > 0 ? `${(equipAvailable / equipTotal) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
