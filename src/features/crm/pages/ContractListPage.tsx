import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { FileText, Search, Download, AlertTriangle, CheckCircle2, XCircle, Pencil } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { exportToExcel } from '../../../utils/excel'

export const contractKeys = {
  list: ['contracts', 'list'] as const,
}

// ---------------------------------------------------------------------------
// Types & Service
// ---------------------------------------------------------------------------
interface ContractClient {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  contract_type: string
  contract_start_date: string | null
  contract_end_date: string | null
}

type ContractStatus = 'actif' | 'expire' | 'a_renouveler'

function getContractStatus(c: ContractClient): ContractStatus {
  if (!c.contract_end_date) return 'actif'
  const end = new Date(c.contract_end_date)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'expire'
  if (diff <= 60) return 'a_renouveler'
  return 'actif'
}

function daysUntilEnd(c: ContractClient): number | null {
  if (!c.contract_end_date) return null
  return Math.ceil((new Date(c.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

async function getContractClients(): Promise<ContractClient[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, email, phone, city, contract_type, contract_start_date, contract_end_date')
    .eq('is_active', true)
    .order('contract_end_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as ContractClient[]
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const clientName = (c: ContractClient) =>
  c.company_name || `${c.first_name} ${c.last_name}`

const contractTypeLabels: Record<string, string> = {
  ponctuel: 'Ponctuel',
  annuel: 'Annuel',
  trimestriel: 'Trimestriel',
  mensuel: 'Mensuel',
}

const statusConfig: Record<ContractStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  actif: { label: 'Actif', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  a_renouveler: { label: 'À renouveler', className: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  expire: { label: 'Expiré', className: 'bg-red-100 text-red-700', icon: XCircle },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ContractListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts', 'list'],
    queryFn: getContractClients,
    staleTime: 60_000,
  })

  const enriched = useMemo(() =>
    contracts.map(c => ({ ...c, status: getContractStatus(c), days: daysUntilEnd(c) })),
    [contracts],
  )

  const filtered = useMemo(() => {
    return enriched.filter(c => {
      if (search) {
        const q = search.toLowerCase()
        if (!clientName(c).toLowerCase().includes(q) && !c.city?.toLowerCase().includes(q)) return false
      }
      if (statusFilter && c.status !== statusFilter) return false
      if (typeFilter && c.contract_type !== typeFilter) return false
      return true
    })
  }, [enriched, search, statusFilter, typeFilter])

  const stats = useMemo(() => ({
    total: enriched.length,
    actif: enriched.filter(c => c.status === 'actif').length,
    aRenouveler: enriched.filter(c => c.status === 'a_renouveler').length,
    expire: enriched.filter(c => c.status === 'expire').length,
  }), [enriched])

  const handleExport = useCallback(() => {
    exportToExcel('contrats.xlsx', [
      { header: 'Client', accessor: (c: typeof filtered[0]) => clientName(c), width: 28 },
      { header: 'Ville', accessor: (c) => c.city || '', width: 18 },
      { header: 'Type', accessor: (c) => contractTypeLabels[c.contract_type] || c.contract_type, width: 14 },
      { header: 'Début', accessor: (c) => c.contract_start_date || '', width: 14 },
      { header: 'Fin', accessor: (c) => c.contract_end_date || '', width: 14 },
      { header: 'Statut', accessor: (c) => statusConfig[c.status].label, width: 14 },
      { header: 'Jours restants', accessor: (c) => c.days ?? '', width: 14 },
    ], filtered, 'Contrats')
  }, [filtered])

  return (
    <div>
      <PageHeader
        title="Gestion des contrats"
        description={`${stats.total} contrat(s) — ${stats.aRenouveler} à renouveler, ${stats.expire} expiré(s)`}
        actions={
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Exporter
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total contrats', value: stats.total, icon: FileText, color: 'text-blue-600' },
          { label: 'Actifs', value: stats.actif, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'À renouveler', value: stats.aRenouveler, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Expirés', value: stats.expire, icon: XCircle, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Alert banner for contracts expiring soon */}
      {stats.aRenouveler > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{stats.aRenouveler} contrat(s) expirent dans les 60 jours</p>
            <p className="text-xs text-amber-600 mt-1">Cliquez sur un contrat pour accéder à la fiche client et lancer le renouvellement.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher client ou ville..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="a_renouveler">À renouveler</option>
          <option value="expire">Expiré</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Tous les types</option>
          <option value="ponctuel">Ponctuel</option>
          <option value="annuel">Annuel</option>
          <option value="trimestriel">Trimestriel</option>
          <option value="mensuel">Mensuel</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ville</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Début</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fin</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Statut</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">Aucun contrat trouvé</td></tr>
            ) : (
              filtered.map(c => {
                const cfg = statusConfig[c.status]
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/crm/clients/${c.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{clientName(c)}</p>
                      {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.city || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{contractTypeLabels[c.contract_type] || c.contract_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(c.contract_start_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(c.contract_end_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                        {c.days !== null && c.days >= 0 && c.days <= 60 && (
                          <span className="ml-1">J-{c.days}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/crm/clients/${c.id}/edit`) }}
                        className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
