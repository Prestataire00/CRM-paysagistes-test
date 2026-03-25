import { useState, useMemo, useCallback } from 'react'
import {
  Search, Filter, Plus, ChevronDown, ChevronUp, MapPin,
  Calendar, Clock, CheckCircle, XCircle, Pause, RotateCcw, Play,
  ClipboardCheck, X, Camera, FileText, Star, PenTool,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Button } from '../../../components/ui/Button'
import { CreateInterventionModal } from '../components/CreateInterventionModal'
import { cn } from '../../../utils/cn'
import { supabase } from '../../../lib/supabase'
import { useInterventions, useUpdateInterventionStatus, useUpdateInterventionTeam } from '../../../queries/useInterventions'
import { useTeams } from '../../../queries/usePlanning'
import type { InterventionFilters } from '../../../services/intervention.service'
import type { InterventionStatus, InterventionType } from '../../../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<InterventionStatus, { label: string; bg: string; text: string; dot: string; icon: typeof CheckCircle }> = {
  planifiee: { label: 'Planifiee', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', icon: Calendar },
  en_cours: { label: 'En cours', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', icon: Play },
  terminee: { label: 'Terminee', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', icon: CheckCircle },
  annulee: { label: 'Annulee', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', icon: XCircle },
  reportee: { label: 'Reportee', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', icon: Pause },
}

const TYPE_LABELS: Record<InterventionType, string> = {
  entretien: 'Entretien',
  tonte: 'Tonte',
  taille: 'Taille',
  desherbage: 'Desherbage',
  plantation: 'Plantation',
  amenagement: 'Amenagement',
  arrosage: 'Arrosage',
  debroussaillage: 'Debroussaillage',
  evacuation: 'Evacuation',
  autre: 'Autre',
}

const ALL_STATUSES: InterventionStatus[] = ['planifiee', 'en_cours', 'terminee', 'annulee', 'reportee']
const ALL_TYPES: InterventionType[] = Object.keys(TYPE_LABELS) as InterventionType[]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateStr))
}

// ---------------------------------------------------------------------------
// InterventionListPage
// ---------------------------------------------------------------------------
export function InterventionListPage() {
  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InterventionStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<InterventionType | ''>('')
  const [teamFilter, setTeamFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sortField, setSortField] = useState<'scheduled_date' | 'reference' | 'title' | 'status'>('scheduled_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Data
  const { data: teams = [] } = useTeams()
  const filters: InterventionFilters = useMemo(() => ({
    ...(statusFilter && { status: statusFilter as InterventionStatus }),
    ...(typeFilter && { intervention_type: typeFilter as InterventionType }),
    ...(teamFilter && { assigned_team_id: teamFilter }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
    ...(search.trim().length >= 2 && { search: search.trim() }),
  }), [statusFilter, typeFilter, teamFilter, dateFrom, dateTo, search])

  const { data: interventions = [], isLoading } = useInterventions(filters)
  const updateStatus = useUpdateInterventionStatus()
  const updateTeam = useUpdateInterventionTeam()

  // Sort
  const sortedInterventions = useMemo(() => {
    const sorted = [...interventions].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'scheduled_date':
          cmp = (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '')
          break
        case 'reference':
          cmp = a.reference.localeCompare(b.reference)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [interventions, sortField, sortDir])

  // Stats
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const s of ALL_STATUSES) byStatus[s] = 0
    for (const i of interventions) byStatus[i.status] = (byStatus[i.status] || 0) + 1
    return { total: interventions.length, byStatus }
  }, [interventions])

  // Handlers
  const handleSort = useCallback((field: string) => {
    const f = field as typeof sortField
    if (sortField === f) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(f)
      setSortDir('desc')
    }
  }, [sortField])

  const handleStatusChange = useCallback((id: string, status: InterventionStatus) => {
    updateStatus.mutate({ id, status })
  }, [updateStatus])

  const handleTeamChange = useCallback((id: string, teamId: string) => {
    updateTeam.mutate({ id, teamId: teamId || null })
  }, [updateTeam])

  const resetFilters = useCallback(() => {
    setStatusFilter('')
    setTypeFilter('')
    setTeamFilter('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }, [])

  const hasFilters = statusFilter || typeFilter || teamFilter || dateFrom || dateTo || search

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interventions"
        description="Liste et gestion de toutes les interventions"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Nouvelle intervention
          </Button>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        {ALL_STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-all',
                statusFilter === s
                  ? `${cfg.bg} border-current ${cfg.text} ring-1 ring-current`
                  : 'bg-white border-slate-200 hover:border-slate-300',
              )}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">{cfg.label}</p>
              <p className={cn('text-2xl font-bold', statusFilter === s ? '' : 'text-slate-800')}>
                {stats.byStatus[s] || 0}
              </p>
            </button>
          )
        })}
      </div>

      {/* Search + filters toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par reference, titre, ville..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors',
            showFilters || hasFilters
              ? 'bg-primary-50 border-primary-200 text-primary-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          <Filter className="w-4 h-4" />
          Filtres
          {hasFilters && (
            <button
              onClick={(e) => { e.stopPropagation(); resetFilters() }}
              className="ml-1 p-0.5 rounded hover:bg-primary-100"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-white border border-slate-200 rounded-xl">
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as InterventionType | '')}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Tous les types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Equipe</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Toutes</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reinitialiser
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : sortedInterventions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ClipboardCheck className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucune intervention trouvee</p>
            {hasFilters && (
              <button onClick={resetFilters} className="mt-2 text-xs text-primary-600 hover:underline">
                Reinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortHeader field="reference" label="Reference" current={sortField} dir={sortDir} onSort={handleSort} />
                  <SortHeader field="title" label="Titre" current={sortField} dir={sortDir} onSort={handleSort} />
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase">Equipe</th>
                  <SortHeader field="scheduled_date" label="Date" current={sortField} dir={sortDir} onSort={handleSort} />
                  <SortHeader field="status" label="Statut" current={sortField} dir={sortDir} onSort={handleSort} />
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase">Type</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedInterventions.map((item) => {
                  const status = STATUS_CONFIG[item.status]
                  const isExpanded = expandedId === item.id
                  const tasksDone = item.tasks?.filter((t) => t.is_completed).length ?? 0
                  const tasksTotal = item.tasks?.length ?? 0

                  return (
                    <InterventionRow
                      key={item.id}
                      item={item}
                      status={status}
                      isExpanded={isExpanded}
                      tasksDone={tasksDone}
                      tasksTotal={tasksTotal}
                      teams={teams}
                      onToggle={() => setExpandedId(isExpanded ? null : item.id)}
                      onStatusChange={handleStatusChange}
                      onTeamChange={handleTeamChange}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <CreateInterventionModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortHeader
// ---------------------------------------------------------------------------
function SortHeader({
  field, label, current, dir, onSort,
}: {
  field: string
  label: string
  current: string
  dir: string
  onSort: (f: string) => void
}) {
  const isActive = current === field
  return (
    <th
      className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase cursor-pointer select-none hover:text-slate-700 transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// InterventionRow
// ---------------------------------------------------------------------------
function InterventionRow({
  item, status, isExpanded, tasksDone, tasksTotal, teams, onToggle, onStatusChange, onTeamChange,
}: {
  item: {
    id: string; reference: string; title: string; status: InterventionStatus
    scheduled_date: string | null; intervention_type: InterventionType
    description: string | null; address_line1: string; city: string
    estimated_duration_minutes: number | null
    completion_notes?: string | null
    completion_photos?: string[] | null
    client_signature_url?: string | null
    satisfaction_rating?: number | null
    satisfaction_comment?: string | null
    client?: { first_name: string; last_name: string; company_name: string | null } | null
    assigned_team?: { id: string; name: string; color: string } | null
    tasks?: Array<{ id: string; is_completed: boolean }>
  }
  status: { label: string; bg: string; text: string; dot: string }
  isExpanded: boolean
  tasksDone: number
  tasksTotal: number
  teams: Array<{ id: string; name: string; color: string }>
  onToggle: () => void
  onStatusChange: (id: string, s: InterventionStatus) => void
  onTeamChange: (id: string, teamId: string) => void
}) {
  const clientName = item.client
    ? `${item.client.first_name} ${item.client.last_name}${item.client.company_name ? ` (${item.client.company_name})` : ''}`
    : '—'

  return (
    <>
      <tr
        className={cn(
          'hover:bg-slate-50/50 cursor-pointer transition-colors',
          isExpanded && 'bg-slate-50/50',
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <span className="font-mono text-xs text-slate-500">{item.reference}</span>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-slate-800 truncate block max-w-[200px]">{item.title}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-slate-600 truncate block max-w-[180px]">{clientName}</span>
        </td>
        <td className="px-4 py-3">
          {item.assigned_team ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.assigned_team.color }} />
              {item.assigned_team.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Non assignee</span>
          )}
        </td>
        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
          {formatDate(item.scheduled_date)}
        </td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', status.bg, status.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
            {status.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-slate-500">{TYPE_LABELS[item.intervention_type] ?? item.intervention_type}</span>
        </td>
        <td className="px-4 py-3 text-center">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-4 py-4 bg-slate-50/80 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Details</h4>
                {item.description && (
                  <p className="text-sm text-slate-600">{item.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {item.address_line1}, {item.city}
                </div>
                {item.estimated_duration_minutes && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {item.estimated_duration_minutes} min estimees
                  </div>
                )}
                {tasksTotal > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {tasksDone}/{tasksTotal} taches completees
                  </div>
                )}
              </div>

              {/* Change status */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Changer le statut</h4>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, s) }}
                        disabled={item.status === s}
                        className={cn(
                          'text-[11px] font-medium px-2.5 py-1 rounded-full transition-all',
                          item.status === s
                            ? `${cfg.bg} ${cfg.text} ring-1 ring-current`
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                        )}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Assign team */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Assigner une equipe</h4>
                <select
                  value={item.assigned_team?.id ?? ''}
                  onChange={(e) => { e.stopPropagation(); onTeamChange(item.id, e.target.value) }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Aucune equipe</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Compte-rendu terrain */}
            {(item.completion_notes || (item.completion_photos && item.completion_photos.length > 0) || item.client_signature_url || item.satisfaction_rating) && (
              <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Compte-rendu terrain</h4>

                {/* Notes */}
                {item.completion_notes && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap flex-1">
                      {item.completion_notes}
                    </div>
                  </div>
                )}

                {/* Photos */}
                {item.completion_photos && item.completion_photos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Camera className="w-3.5 h-3.5" />
                      {item.completion_photos.length} photo{item.completion_photos.length > 1 ? 's' : ''}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.completion_photos.map((path, idx) => {
                        const url = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl
                        return (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-primary-400 transition-colors"
                          >
                            <img
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  {/* Signature client */}
                  {item.client_signature_url && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                      <PenTool className="w-3.5 h-3.5" />
                      Signature client
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Satisfaction */}
                  {item.satisfaction_rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={cn(
                              'w-4 h-4',
                              n <= (item.satisfaction_rating ?? 0)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300',
                            )}
                          />
                        ))}
                      </div>
                      {item.satisfaction_comment && (
                        <span className="text-xs text-slate-500 italic">
                          &laquo;&nbsp;{item.satisfaction_comment}&nbsp;&raquo;
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default InterventionListPage
