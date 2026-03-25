import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  User,
  Activity,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useAuditLogs } from '../../../queries/useAdmin'
import { useToast } from '../../../components/feedback/ToastProvider'
import { Modal, ModalHeader } from '../../../components/feedback/Modal'
import { exportToExcel } from '../../../utils/excel'
import type { AuditLog } from '../../../types'
import type { AuditLogFilters } from '../../../services/admin.service'

// ---------------------------------------------------------------------------
// DB action -> French label + visual config
// ---------------------------------------------------------------------------
const actionConfig: Record<string, { label: string; icon: typeof Edit; colors: string }> = {
  INSERT: { label: 'Creation', icon: Plus, colors: 'bg-emerald-100 text-emerald-600' },
  UPDATE: { label: 'Modification', icon: Edit, colors: 'bg-blue-100 text-blue-600' },
  DELETE: { label: 'Suppression', icon: Trash2, colors: 'bg-red-100 text-red-600' },
}

// ---------------------------------------------------------------------------
// DB table_name -> French label
// ---------------------------------------------------------------------------
const tableLabels: Record<string, string> = {
  clients: 'Clients',
  profiles: 'Utilisateurs',
  invoices: 'Factures',
  quotes: 'Devis',
  quote_lines: 'Lignes de devis',
  invoice_lines: 'Lignes de facture',
  chantiers: 'Chantiers',
  interventions: 'Interventions',
  teams: 'Equipes',
  team_members: 'Membres equipe',
  vehicles: 'Vehicules',
  equipment: 'Equipements',
  prospects: 'Prospects',
  settings: 'Parametres',
  notifications: 'Notifications',
  documents: 'Documents',
  communications: 'Communications',
  commercial_activities: 'Activites commerciales',
  contracts: 'Contrats',
  payments: 'Paiements',
  audit_logs: 'Journal d\'audit',
  fiscal_attestations: 'Attestations fiscales',
}

function getTableLabel(tableName: string | null): string {
  if (!tableName) return '-'
  return tableLabels[tableName] ?? tableName
}

// ---------------------------------------------------------------------------
// Format timestamp
// ---------------------------------------------------------------------------
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Get a human-readable profile name from the joined profile
// ---------------------------------------------------------------------------
function getProfileName(log: AuditLog & { profile?: { first_name: string; last_name: string; email: string } | null }): string {
  if (log.profile) {
    const first = log.profile.first_name ?? ''
    const last = log.profile.last_name ?? ''
    const name = `${first} ${last}`.trim()
    return name || log.profile.email || '-'
  }
  return '-'
}

// ---------------------------------------------------------------------------
// Build a detail string from old_values / new_values
// ---------------------------------------------------------------------------
function buildDetail(log: AuditLog): string {
  if (log.action === 'DELETE' && log.old_values) {
    const keys = Object.keys(log.old_values)
    return `Suppression (${keys.length} champs)`
  }
  if (log.action === 'INSERT' && log.new_values) {
    const keys = Object.keys(log.new_values)
    return `Creation (${keys.length} champs)`
  }
  if (log.action === 'UPDATE' && log.new_values) {
    const changedKeys = Object.keys(log.new_values).filter((k) => k !== 'updated_at')
    if (changedKeys.length === 0) return 'Mise a jour'
    if (changedKeys.length <= 3) {
      return `Modification: ${changedKeys.join(', ')}`
    }
    return `Modification de ${changedKeys.length} champs`
  }
  return '-'
}

// ---------------------------------------------------------------------------
// Skeleton for loading
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-24 bg-slate-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-48 bg-slate-200 rounded" /></td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Available filter values
// ---------------------------------------------------------------------------
const ACTION_OPTIONS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'INSERT', label: 'Creation' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
]

const TABLE_OPTIONS = [
  { value: '', label: 'Toutes les tables' },
  { value: 'clients', label: 'Clients' },
  { value: 'profiles', label: 'Utilisateurs' },
  { value: 'invoices', label: 'Factures' },
  { value: 'quotes', label: 'Devis' },
  { value: 'chantiers', label: 'Chantiers' },
  { value: 'interventions', label: 'Interventions' },
  { value: 'teams', label: 'Equipes' },
  { value: 'vehicles', label: 'Vehicules' },
  { value: 'equipment', label: 'Equipements' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'settings', label: 'Parametres' },
  { value: 'contracts', label: 'Contrats' },
  { value: 'payments', label: 'Paiements' },
]

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AuditLogPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const toast = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input -> server-side search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 350)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Build filters for the query
  const filters: AuditLogFilters = useMemo(() => {
    const f: AuditLogFilters = { page, pageSize: PAGE_SIZE }
    if (filterAction) f.action = filterAction
    if (filterTable) f.table_name = filterTable
    if (dateFrom) f.date_from = dateFrom
    if (dateTo) {
      // Include the entire end day
      f.date_to = dateTo + 'T23:59:59'
    }
    if (debouncedSearch) f.search = debouncedSearch
    return f
  }, [filterAction, filterTable, dateFrom, dateTo, debouncedSearch, page])

  const { data, isLoading, isError } = useAuditLogs(filters)

  const logs = data?.data ?? []
  const totalCount = data?.count ?? 0
  const totalPages = data?.totalPages ?? 1

  const handleExportAudit = () => {
    exportToExcel('journal-audit.xlsx', [
      { header: 'Date', accessor: (l: AuditLog) => new Date(l.created_at).toLocaleString('fr-FR'), width: 20 },
      { header: 'Action', accessor: (l: AuditLog) => l.action, width: 12 },
      { header: 'Table', accessor: (l: AuditLog) => getTableLabel(l.table_name), width: 18 },
      { header: 'Détail', accessor: (l: AuditLog) => buildDetail(l), width: 40 },
    ], logs, 'Journal audit')
    toast.success('Export réussi', `${logs.length} entrée(s) exportée(s)`)
  }

  // Stats from total count + page data for breakdown
  const stats = useMemo(() => {
    const uniqueUsers = new Set(logs.map((l) => l.profile_id).filter(Boolean)).size
    return { total: totalCount, uniqueUsers }
  }, [logs, totalCount])

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        description="Tracabilite de toutes les actions utilisateurs"
        actions={
          <button
            onClick={handleExportAudit}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter le journal
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total entrees', value: String(stats.total), icon: Activity, color: 'text-blue-600' },
          { label: 'Utilisateurs (page)', value: String(stats.uniqueUsers), icon: User, color: 'text-emerald-600' },
          { label: 'Resultats affiches', value: String(logs.length), icon: Eye, color: 'text-purple-600' },
          { label: 'Pages total', value: String(totalPages), icon: Edit, color: 'text-amber-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-slate-500">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{isLoading ? '-' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => handleFilterChange(setFilterAction)(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filterTable}
            onChange={(e) => handleFilterChange(setFilterTable)(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {TABLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 lg:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFilterChange(setDateFrom)(e.target.value)}
              className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-slate-400 text-xs">au</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
              className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-4">
          <p className="text-sm text-red-600 font-medium">Erreur lors du chargement du journal d'audit.</p>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-[160px]">Date / Heure</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-[160px]">Utilisateur</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-[120px]">Action</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-[140px]">Table</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    Aucune entree trouvee.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const config = actionConfig[log.action] ?? {
                    label: log.action,
                    icon: Eye,
                    colors: 'bg-slate-100 text-slate-600',
                  }
                  const IconComponent = config.icon
                  const profileName = getProfileName(log as AuditLog & { profile?: { first_name: string; last_name: string; email: string } | null })

                  return (
                    <tr key={log.id} onClick={() => setSelectedLog(log)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDateTime(log.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {profileName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.colors}`}>
                          <IconComponent className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {getTableLabel(log.table_name)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[300px] truncate">
                        {buildDetail(log)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            {isLoading
              ? 'Chargement...'
              : `Page ${page} sur ${totalPages} - ${totalCount} entrees au total`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    pageNum === page
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} size="lg">
        {selectedLog && (
          <>
            <ModalHeader
              title="Detail de l'action"
              description={formatDateTime(selectedLog.created_at)}
              onClose={() => setSelectedLog(null)}
            />
            <div className="px-6 pb-6 space-y-4">
              {/* Summary info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-500">Action</span>
                  <p className="text-sm font-medium text-slate-900">
                    {(actionConfig[selectedLog.action]?.label ?? selectedLog.action)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Table</span>
                  <p className="text-sm font-medium text-slate-900">{getTableLabel(selectedLog.table_name)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Utilisateur</span>
                  <p className="text-sm font-medium text-slate-900">
                    {getProfileName(selectedLog as AuditLog & { profile?: { first_name: string; last_name: string; email: string } | null })}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">ID enregistrement</span>
                  <p className="text-sm font-mono text-slate-700 truncate">{selectedLog.record_id ?? '-'}</p>
                </div>
              </div>

              {/* Diff table */}
              {(() => {
                const oldVals = selectedLog.old_values ?? {}
                const newVals = selectedLog.new_values ?? {}
                const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]))
                  .filter((k) => k !== 'updated_at')
                  .sort()

                if (allKeys.length === 0) {
                  return (
                    <p className="text-sm text-slate-500 italic">Aucun detail de modification disponible.</p>
                  )
                }

                return (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Modifications</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Champ</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Ancienne valeur</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Nouvelle valeur</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allKeys.map((key) => {
                            const oldVal = oldVals[key]
                            const newVal = newVals[key]
                            const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal)
                            return (
                              <tr key={key} className={changed ? 'bg-amber-50/50' : ''}>
                                <td className="px-3 py-2 font-mono text-xs text-slate-700">{key}</td>
                                <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px] truncate">
                                  {oldVal !== undefined ? String(oldVal) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px] truncate">
                                  {newVal !== undefined ? String(newVal) : <span className="text-slate-300">-</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
