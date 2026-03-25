import { useState } from 'react'
import { Users, Search, Star, ChevronDown, ChevronRight } from 'lucide-react'
import type { Team } from '../../../../types'

type TeamWithMembers = Team

interface PersonnelPanelProps {
  teams: TeamWithMembers[]
  isLoading: boolean
}

export function PersonnelPanel({ teams, isLoading }: PersonnelPanelProps) {
  const [search, setSearch] = useState('')
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())

  const toggleTeam = (teamId: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0)

  const q = search.toLowerCase()
  const filteredTeams = teams.map((team) => {
    const members = team.members ?? []
    if (!q) return { ...team, members }
    const filtered = members.filter((m) =>
      m.profile && (
        m.profile.first_name.toLowerCase().includes(q) ||
        m.profile.last_name.toLowerCase().includes(q)
      ),
    )
    return { ...team, members: filtered }
  }).filter((team) => {
    if (!q) return true
    return team.members.length > 0 || team.name.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Équipes</span>
          </div>
          <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
            {teams.length} éq. · {totalMembers} membres
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-7 pr-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-300"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-slate-200 rounded animate-pulse w-24 mb-2" />
                <div className="space-y-1.5 pl-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-3 bg-slate-200 rounded animate-pulse flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-3 bg-slate-200 rounded animate-pulse flex-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[11px] text-slate-400">
              {teams.length === 0 ? 'Aucune équipe configurée' : 'Aucun résultat'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredTeams.map((team) => {
              const isCollapsed = collapsedTeams.has(team.id)
              const members = team.members ?? []

              return (
                <div key={team.id}>
                  {/* Team header */}
                  <button
                    onClick={() => toggleTeam(team.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    )}
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="text-[11px] font-semibold text-slate-700 truncate flex-1 text-left">
                      {team.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {members.length}
                    </span>
                  </button>

                  {/* Members */}
                  {!isCollapsed && (
                    <div className="pl-5">
                      {members.length === 0 ? (
                        <p className="text-[10px] text-slate-400 px-3 py-1">Aucun membre</p>
                      ) : (
                        members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 px-3 py-1 hover:bg-slate-50 transition-colors"
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: team.color }}
                            >
                              {(member.profile?.first_name ?? '?').charAt(0)}
                              {(member.profile?.last_name ?? '?').charAt(0)}
                            </div>
                            <span className="text-[11px] text-slate-700 truncate flex-1">
                              {member.profile?.first_name} {member.profile?.last_name}
                            </span>
                            {member.is_team_leader && (
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
