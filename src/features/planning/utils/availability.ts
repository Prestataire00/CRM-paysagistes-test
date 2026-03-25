import type { Team, PlanningSlot } from '../../../types'
import type { Absence } from '../../../types/resource.types'
import { getDurationMinutes } from './date-helpers'

type AvailabilityLevel = 'full' | 'partial' | 'none'

interface TeamMemberProfile {
  id: string
  is_team_leader: boolean
  profile?: {
    id: string
    first_name: string
    last_name: string
    role: string
    avatar_url: string | null
  }
}

/** Check if an absence covers a specific date */
function isAbsentOnDate(absence: Absence, dateStr: string): boolean {
  return absence.start_date <= dateStr && absence.end_date >= dateStr
}

/** Get team availability for a given day */
export function getTeamDayAvailability(
  team: Team & { members?: TeamMemberProfile[] },
  absences: Absence[],
  dateStr: string,
): AvailabilityLevel {
  const members = team.members ?? []
  if (members.length === 0) return 'full'

  const absentCount = members.filter((m) =>
    m.profile && absences.some((a) => a.profile_id === m.profile!.id && isAbsentOnDate(a, dateStr)),
  ).length

  if (absentCount === 0) return 'full'
  if (absentCount >= members.length) return 'none'
  return 'partial'
}

/** Get list of available member names for a given day */
export function getAvailableMembers(
  team: Team & { members?: TeamMemberProfile[] },
  absences: Absence[],
  dateStr: string,
): Array<{ name: string; isAbsent: boolean; isLeader: boolean }> {
  const members = team.members ?? []
  return members.map((m) => ({
    name: m.profile?.first_name ?? '',
    isAbsent: absences.some((a) => m.profile && a.profile_id === m.profile.id && isAbsentOnDate(a, dateStr)),
    isLeader: m.is_team_leader,
  }))
}

/** Get total planned hours for a team on a given day */
export function getTeamDayHours(slots: PlanningSlot[], teamId: string, dateStr: string): number {
  return slots
    .filter((s) => s.team_id === teamId && s.slot_date === dateStr)
    .reduce((total, s) => total + getDurationMinutes(s.start_time, s.end_time), 0)
}

/** Availability dot color classes */
export const AVAILABILITY_COLORS: Record<AvailabilityLevel, string> = {
  full: 'bg-emerald-500',
  partial: 'bg-amber-500',
  none: 'bg-red-500',
}
