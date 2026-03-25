import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { useToast } from '../../../components/feedback/ToastProvider'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { EmptyState } from '../../../components/data/EmptyState'
import { CsvImportModal } from '../../../components/data/CsvImportModal'
import { useClients, useDeleteClient, useImportClients } from '../../../queries/useClients'
import { supabase } from '../../../lib/supabase'
import { parseClientsCsv } from '../../../utils/csv'
import { exportToExcel, type ExcelColumn } from '../../../utils/excel'
import { getAllClients } from '../../../services/client.service'
import { useAuth } from '../../../contexts/AuthContext'
import type { ClientFilters } from '../../../services/client.service'
import type { Client, ClientType, ContractType } from '../../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

function getClientDisplayName(client: {
  company_name: string | null
  first_name: string
  last_name: string
}): string {
  return client.company_name || `${client.first_name} ${client.last_name}`
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactif', className: 'bg-slate-100 text-slate-500' },
}

const contractTypeLabels: Record<ContractType, string> = {
  ponctuel: 'Ponctuel',
  annuel: 'Annuel',
  trimestriel: 'Trimestriel',
  mensuel: 'Mensuel',
}

const clientTypeLabels: Record<ClientType, string> = {
  particulier: 'Particulier',
  professionnel: 'Professionnel',
  copropriete: 'Copropriété',
  collectivite: 'Collectivité',
}

const contractTypeOptions = [
  { value: 'ponctuel', label: 'Ponctuel' },
  { value: 'annuel', label: 'Annuel' },
  { value: 'trimestriel', label: 'Trimestriel' },
  { value: 'mensuel', label: 'Mensuel' },
]

const contractFilterOptions = [
  { value: '', label: 'Toutes les formules' },
  ...contractTypeOptions,
]

const zoneFilterOptions = [
  { value: '', label: 'Toutes les zones' },
  { value: 'zone_1', label: 'Zone 1' },
  { value: 'zone_2', label: 'Zone 2' },
  { value: 'zone_3', label: 'Zone 3' },
  { value: 'zone_4', label: 'Zone 4' },
  { value: 'zone_5', label: 'Zone 5' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ClientListPage() {
  const navigate = useNavigate()
  const toast = useToast()

  // -- State ----------------------------------------------------------------
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const [filters, setFilters] = useState<ClientFilters>({
    page: 1,
    pageSize: 25,
  })

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [relatedCounts, setRelatedCounts] = useState<{ quotes: number; invoices: number }>({ quotes: 0, invoices: 0 })

  // Fetch related record counts when a delete target is selected
  useEffect(() => {
    if (!deleteTargetId) return
    let cancelled = false

    async function fetchCounts() {
      const [quotesRes, invoicesRes] = await Promise.all([
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('client_id', deleteTargetId!),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('client_id', deleteTargetId!),
      ])
      if (!cancelled) {
        setRelatedCounts({
          quotes: quotesRes.count ?? 0,
          invoices: invoicesRes.count ?? 0,
        })
      }
    }

    fetchCounts()
    return () => { cancelled = true }
  }, [deleteTargetId])

  // Sync debounced search into filters (reset to page 1)
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch || undefined,
      page: 1,
    }))
  }, [debouncedSearch])

  const [showImportModal, setShowImportModal] = useState(false)
  const { user } = useAuth()
  const importMutation = useImportClients()

  // -- Queries & mutations --------------------------------------------------
  const { data: paginatedData, isLoading } = useClients(filters)
  const deleteMutation = useDeleteClient()

  const clients = paginatedData?.data ?? []
  const totalCount = paginatedData?.count ?? 0
  const currentPage = paginatedData?.page ?? 1
  const totalPages = paginatedData?.totalPages ?? 1

  // -- Sort handler ----------------------------------------------------------
  const handleSort = useCallback((field: NonNullable<ClientFilters['sortField']>) => {
    setFilters((prev) => {
      const isSameField = prev.sortField === field
      return {
        ...prev,
        sortField: field,
        sortDirection: isSameField && prev.sortDirection === 'asc' ? 'desc' : 'asc',
        page: 1,
      }
    })
  }, [])

  function SortIcon({ field }: { field: NonNullable<ClientFilters['sortField']> }) {
    if (filters.sortField !== field) return <ArrowUpDown className="w-3 h-3" />
    return filters.sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />
  }

  // -- CSV Export/Import ----------------------------------------------------
  const CLIENT_EXCEL_COLUMNS: ExcelColumn<Client>[] = [
    { header: 'Nom', accessor: (c) => c.last_name, width: 18 },
    { header: 'Prénom', accessor: (c) => c.first_name, width: 18 },
    { header: 'Société', accessor: (c) => c.company_name, width: 22 },
    { header: 'Email', accessor: (c) => c.email, width: 28 },
    { header: 'Téléphone', accessor: (c) => c.phone, width: 16 },
    { header: 'Mobile', accessor: (c) => c.mobile, width: 16 },
    { header: 'Adresse', accessor: (c) => c.address_line1, width: 30 },
    { header: 'Code postal', accessor: (c) => c.postal_code, width: 12 },
    { header: 'Ville', accessor: (c) => c.city, width: 18 },
    { header: 'Type', accessor: (c) => c.client_type, width: 14 },
    { header: 'Contrat', accessor: (c) => c.contract_type, width: 14 },
    { header: 'Statut', accessor: (c) => (c.is_active ? 'Actif' : 'Inactif'), width: 10 },
  ]

  const handleExport = useCallback(async () => {
    try {
      const all = await getAllClients()
      exportToExcel('clients.xlsx', CLIENT_EXCEL_COLUMNS, all, 'Clients')
      toast.success('Export réussi', `${all.length} client(s) exporté(s)`)
    } catch {
      toast.error('Erreur', "Impossible d'exporter les clients")
    }
  }, [toast, CLIENT_EXCEL_COLUMNS])

  const handleImport = useCallback(async (rows: string[][]) => {
    const { valid } = parseClientsCsv(rows)
    if (valid.length === 0) return { inserted: 0, errors: ['Aucune ligne valide'] }
    try {
      const result = await importMutation.mutateAsync({ rows: valid, createdBy: user?.id ?? '' })
      return result
    } catch (err) {
      return { inserted: 0, errors: [(err as Error).message ?? "Erreur lors de l'import"] }
    }
  }, [importMutation, user])

  // -- Handlers -------------------------------------------------------------
  const handleFilterChange = useCallback(
    (key: keyof ClientFilters, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value || undefined,
        page: 1, // reset page on filter change
      }))
    },
    []
  )

  const handleStatusFilter = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      is_active: value === 'all' ? undefined : value === 'active',
      page: 1,
    }))
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }))
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTargetId) return

    deleteMutation.mutate(deleteTargetId, {
      onSuccess: () => {
        toast.success('Client desactive avec succes')
        setDeleteTargetId(null)
      },
      onError: (error) => {
        toast.error('Erreur lors de la suppression', (error as Error).message)
      },
    })
  }, [deleteTargetId, deleteMutation, toast])

  const handleRowClick = useCallback(
    (clientId: string) => {
      navigate(`/crm/clients/${clientId}`)
    },
    [navigate]
  )

  // Derive active filter value for the status select
  const activeFilterValue =
    filters.is_active === undefined
      ? 'all'
      : filters.is_active
        ? 'active'
        : 'inactive'

  // -- Render ---------------------------------------------------------------
  return (
    <div>
      <PageHeader
        title="Clients"
        description={`${totalCount} client${totalCount !== 1 ? 's' : ''} enregistre${totalCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importer
            </button>
            <button
              onClick={() => navigate('/crm/clients/new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter un client
            </button>
          </div>
        }
      />

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un client (nom, email, telephone)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={activeFilterValue}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <select
            value={filters.contract_type ?? ''}
            onChange={(e) => handleFilterChange('contract_type', e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {contractFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.geographic_zone ?? ''}
            onChange={(e) => handleFilterChange('geographic_zone', e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {zoneFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Client Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => handleSort('last_name')} className="flex items-center gap-1 hover:text-slate-700">
                    Client <SortIcon field="last_name" />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => handleSort('city')} className="flex items-center gap-1 hover:text-slate-700">
                    Adresse <SortIcon field="city" />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Formule</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Statut</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                // Skeleton loading rows
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className="px-4 py-3">
                      <Skeleton width="70%" height={16} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Skeleton width="80%" height={12} />
                        <Skeleton width="60%" height={12} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width="90%" height={12} />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={80} height={14} />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={70} height={14} />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={50} height={20} rounded="full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={24} height={24} rounded="md" />
                    </td>
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyState
                      icon={Users}
                      title={
                        debouncedSearch || filters.geographic_zone || filters.contract_type || filters.is_active !== undefined
                          ? 'Aucun client ne correspond aux filtres'
                          : 'Aucun client enregistre'
                      }
                      description={
                        debouncedSearch || filters.geographic_zone || filters.contract_type || filters.is_active !== undefined
                          ? 'Essayez de modifier ou de supprimer vos filtres.'
                          : 'Ajoutez votre premier client pour commencer.'
                      }
                      action={
                        !debouncedSearch && !filters.geographic_zone && !filters.contract_type && filters.is_active === undefined
                          ? <Button icon={Plus} onClick={() => navigate('/crm/clients/new')}>Ajouter un client</Button>
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const displayName = getClientDisplayName(client)
                  const statusKey = client.is_active ? 'active' : 'inactive'
                  const address = [client.address_line1, client.postal_code, client.city]
                    .filter(Boolean)
                    .join(', ')

                  return (
                    <tr
                      key={client.id}
                      onClick={() => handleRowClick(client.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{displayName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {client.email && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {client.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{address}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-700">
                          {clientTypeLabels[client.client_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-700">
                          {contractTypeLabels[client.contract_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig[statusKey].className}`}
                        >
                          {statusConfig[statusKey].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTargetId(client.id)
                          }}
                          className="p-1 rounded-md hover:bg-red-50 transition-colors group"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                        </button>
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
            Page {currentPage} sur {totalPages} ({totalCount} client{totalCount !== 1 ? 's' : ''})
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
              Precedent
            </button>
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white">
              {currentPage}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Dialog                                          */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Desactiver ce client ?"
        message={`Ce client a ${relatedCounts.quotes} devis et ${relatedCounts.invoices} facture${relatedCounts.invoices !== 1 ? 's' : ''} associe(s). Le desactiver le masquera des listes actives mais ses donnees seront conservees.`}
        confirmLabel="Desactiver"
        cancelLabel="Annuler"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />

      <CsvImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Importer des clients"
        description="Format CSV avec colonnes : Nom, Prénom, Adresse, Code postal, Ville (requis)"
        headers={['Nom', 'Prénom', 'Société', 'Email', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Type', 'Contrat']}
        parseRows={parseClientsCsv}
        onImport={handleImport}
      />
    </div>
  )
}
