import { Users, Star, Truck, Wrench, Phone, Loader2 } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useTeams, useTeamEquipment } from '../../../queries/usePlanning'
import type { Vehicle, Equipment } from '../../../types'

interface TeamMemberWithProfile {
  id: string
  is_team_leader: boolean
  joined_at: string
  profile?: {
    id: string
    first_name: string
    last_name: string
    role: string
    phone: string | null
    avatar_url: string | null
  }
}

interface TeamWithMembers {
  id: string
  name: string
  color: string
  leader_id: string | null
  default_vehicle_id: string | null
  members?: TeamMemberWithProfile[]
}

export function TeamPage() {
  const { user } = useAuth()
  const { data: teams = [], isLoading: teamsLoading } = useTeams()

  // Find the team(s) the current user belongs to
  const myTeam = (teams as TeamWithMembers[]).find((t) =>
    t.members?.some((m) => m.profile?.id === user?.id),
  )

  const teamIds = myTeam ? [myTeam.id] : []
  const { data: equipment } = useTeamEquipment(teamIds)

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (!myTeam) {
    return (
      <div className="px-4 py-12 text-center">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-700 mb-1">Aucune équipe</h2>
        <p className="text-sm text-slate-500">
          Vous n'êtes assigné à aucune équipe pour le moment.
        </p>
      </div>
    )
  }

  const members = myTeam.members ?? []
  const leader = members.find((m) => m.is_team_leader)
  const others = members.filter((m) => !m.is_team_leader)
  const sortedMembers = leader ? [leader, ...others] : others

  const vehicles: Vehicle[] = equipment?.vehicles ?? []
  const equips: Equipment[] = equipment?.equipment ?? []

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Team header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-1">
          <span
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: myTeam.color }}
          />
          <h1 className="text-lg font-bold text-slate-900">{myTeam.name}</h1>
        </div>
        <p className="text-sm text-slate-500 ml-7">
          {members.length} membre{members.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            Membres
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sortedMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: myTeam.color }}
              >
                {(member.profile?.first_name ?? '?').charAt(0)}
                {(member.profile?.last_name ?? '?').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {member.profile?.first_name} {member.profile?.last_name}
                  </span>
                  {member.is_team_leader && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      Chef
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 capitalize">
                  {member.profile?.role?.replace('_', ' ') ?? 'Jardinier'}
                </p>
              </div>
              {member.profile?.phone && (
                <a
                  href={`tel:${member.profile.phone}`}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vehicles */}
      {vehicles.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-400" />
              Véhicule{vehicles.length > 1 ? 's' : ''}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <div key={v.id} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-900">
                  {v.registration_plate}
                </p>
                <p className="text-xs text-slate-500">
                  {v.brand} {v.model}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment */}
      {equips.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-400" />
              Équipement
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {equips.map((eq) => (
              <div key={eq.id} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{eq.name}</p>
                <p className="text-xs text-slate-500">
                  {[eq.brand, eq.model].filter(Boolean).join(' ') || eq.category || 'Équipement'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
