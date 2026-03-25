import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import {
  Plus,
  Search,
  Filter,
  FileText,
  ArrowUpDown,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Bell,
  Loader2 as Loader2Icon,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { QuoteRelanceModal } from '../components/QuoteRelanceModal'
import { useQuotes, useConvertQuoteToInvoice, useUpdateQuoteStatus, useDeleteQuote } from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import { exportToExcel } from '../../../utils/excel'
import type { Quote, QuoteStatus } from '../../../types'
import type { QuoteFilters } from '../../../services/billing.service'

// ---------------------------------------------------------------------------
// Status configuration - maps DB statuses to display labels + colors
// ---------------------------------------------------------------------------
const statusConfig: Record<QuoteStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600' },
  envoye: { label: 'Envoy\u00e9', className: 'bg-blue-100 text-blue-700' },
  accepte: { label: 'Accept\u00e9', className: 'bg-emerald-100 text-emerald-700' },
  refuse: { label: 'Refus\u00e9', className: 'bg-red-100 text-red-700' },
  expire: { label: 'Expir\u00e9', className: 'bg-amber-100 text-amber-700' },
}

const statusTabs: { value: string; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'envoye', label: 'Envoy\u00e9s' },
  { value: 'accepte', label: 'Accept\u00e9s' },
  { value: 'refuse', label: 'Refus\u00e9s' },
  { value: 'expire', label: 'Expir\u00e9s' },
]

// ---------------------------------------------------------------------------
// Amount formatter
// ---------------------------------------------------------------------------
const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '\u2014'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Helper to get client display name from the joined relation
// ---------------------------------------------------------------------------
function getClientName(quote: Record<string, unknown>): string {
  const client = quote.client as { first_name?: string; last_name?: string; company_name?: string } | null
  const prospect = quote.prospect as { first_name?: string; last_name?: string; company_name?: string } | null
  const entity = client ?? prospect

  if (!entity) return '\u2014'

  const companyName = entity.company_name || ''
  const firstName = entity.first_name || ''
  const lastName = entity.last_name || ''

  // Filter out "N/A" placeholder names
  const cleanFirst = firstName === 'N/A' ? '' : firstName
  const cleanLast = lastName === 'N/A' ? '' : lastName

  // If company exists, show company + optional contact name
  if (companyName) {
    const contactName = [cleanFirst, cleanLast].filter(Boolean).join(' ')
    return contactName ? `${companyName} \u2014 ${contactName}` : companyName
  }

  // Individual: just first + last name
  const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ')
  return fullName || '\u2014'
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
const PAGE_SIZE = 25

export function QuoteListPage() {
  const toast = useToast()
  const convertMutation = useConvertQuoteToInvoice()
  const updateStatusMutation = useUpdateQuoteStatus()
  const deleteMutation = useDeleteQuote()
  const [relanceQuoteId, setRelanceQuoteId] = useState<string | null>(null)

  // Local UI state
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<'reference' | 'issue_date' | 'total_ttc'>('issue_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }, [sortField])

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setPage(1) // Reset to page 1 on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset page when filter changes
  const handleFilterChange = useCallback((value: string) => {
    setFilterStatus(value)
    setPage(1)
  }, [])

  // Build filters for the query
  const filters: QuoteFilters = {
    search: debouncedSearch || undefined,
    status: filterStatus !== 'all' ? (filterStatus as QuoteStatus) : undefined,
    page,
    pageSize: PAGE_SIZE,
  }

  const { data, isLoading, isError, error } = useQuotes(filters)

  const handleExportQuotes = useCallback(() => {
    const quotes = data?.data ?? []
    exportToExcel('devis.xlsx', [
      { header: 'Référence', accessor: (q: Quote) => q.reference, width: 16 },
      { header: 'Titre', accessor: (q: Quote) => q.title, width: 30 },
      { header: 'Date émission', accessor: (q: Quote) => q.issue_date, width: 14 },
      { header: 'Validité', accessor: (q: Quote) => q.validity_date, width: 14 },
      { header: 'Total HT', accessor: (q: Quote) => q.subtotal_ht, width: 12 },
      { header: 'Total TTC', accessor: (q: Quote) => q.total_ttc, width: 12 },
      { header: 'Statut', accessor: (q: Quote) => statusConfig[q.status]?.label ?? q.status, width: 12 },
    ], quotes, 'Devis')
    toast.success('Export réussi', `${quotes.length} devis exporté(s)`)
  }, [data, toast])

  // Show a toast on error
  useEffect(() => {
    if (isError && error) {
      toast.error('Erreur de chargement', (error as Error).message || 'Impossible de charger les devis.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, error])

  const rawQuotes = data?.data ?? []
  const quotes = useMemo(() => {
    const sorted = [...rawQuotes]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortField === 'reference') cmp = (a.reference ?? '').localeCompare(b.reference ?? '')
      else if (sortField === 'issue_date') cmp = (a.issue_date ?? '').localeCompare(b.issue_date ?? '')
      else if (sortField === 'total_ttc') cmp = (a.total_ttc ?? 0) - (b.total_ttc ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rawQuotes, sortField, sortDir])
  const totalCount = data?.count ?? 0
  const totalPages = data?.totalPages ?? 1

  // Summary stats computed from current result metadata
  const summaryCards = [
    { label: 'Total devis', value: String(totalCount), sub: 'tous statuts' },
    {
      label: 'Page actuelle',
      value: `${page}/${totalPages}`,
      sub: `${PAGE_SIZE} par page`,
    },
    {
      label: 'R\u00e9sultats affich\u00e9s',
      value: String(quotes.length),
      sub: `sur ${totalCount}`,
    },
    {
      label: 'Filtre',
      value: filterStatus === 'all' ? 'Tous' : statusConfig[filterStatus as QuoteStatus]?.label ?? filterStatus,
      sub: debouncedSearch ? `Recherche : ${debouncedSearch}` : 'Aucune recherche',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Devis"
        description="Gestion des devis clients"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportQuotes}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
            <Link
              to="/crm/devis/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau devis
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{card.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par n\u00b0 devis ou titre..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {statusTabs.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => toggleSort('reference')} className="flex items-center gap-1 hover:text-slate-700">
                    N&deg; Devis <ArrowUpDown className={`w-3 h-3 ${sortField === 'reference' ? 'text-primary-600' : ''}`} />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Client</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => toggleSort('issue_date')} className="flex items-center gap-1 hover:text-slate-700">
                    Date <ArrowUpDown className={`w-3 h-3 ${sortField === 'issue_date' ? 'text-primary-600' : ''}`} />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Validit&eacute;</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => toggleSort('total_ttc')} className="flex items-center gap-1 hover:text-slate-700">
                    Montant TTC <ArrowUpDown className={`w-3 h-3 ${sortField === 'total_ttc' ? 'text-primary-600' : ''}`} />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Statut</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Loading skeletons */}
              {isLoading && quotes.length === 0 && (
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
              )}

              {/* Empty state */}
              {!isLoading && quotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Aucun devis trouv&eacute;</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {debouncedSearch || filterStatus !== 'all'
                        ? 'Essayez de modifier vos filtres de recherche.'
                        : 'Cr\u00e9ez votre premier devis pour commencer.'}
                    </p>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {quotes.map((quote) => {
                const status = quote.status as QuoteStatus
                const config = statusConfig[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
                return (
                  <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-primary-600">
                          {quote.reference || quote.id.substring(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-700">
                        {getClientName(quote as unknown as Record<string, unknown>)}
                      </div>
                      {quote.title && (
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{quote.title}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(quote.issue_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(quote.validity_date ?? null)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {formatAmount(quote.total_ttc)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.className}`}
                      >
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/crm/devis/${quote.id}`}
                          className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                          title="Voir"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                        {status === 'brouillon' && (
                          <button
                            onClick={() => {
                              updateStatusMutation.mutate(
                                { id: quote.id, status: 'envoye' },
                                {
                                  onSuccess: () => toast.success('Statut mis à jour', 'Le devis est marqué comme envoyé.'),
                                  onError: (err) => toast.error('Erreur', (err as Error).message),
                                },
                              )
                            }}
                            disabled={updateStatusMutation.isPending}
                            className="p-1 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-40"
                            title="Marquer comme envoyé"
                          >
                            {updateStatusMutation.isPending ? (
                              <Loader2Icon className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5 text-blue-500" />
                            )}
                          </button>
                        )}
                        {status === 'envoye' && (
                          <>
                            <button
                              onClick={() => setRelanceQuoteId(quote.id)}
                              className="p-1 rounded-md hover:bg-amber-100 transition-colors"
                              title="Relancer"
                            >
                              <Bell className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                            {quote.converted_to_invoice_id ? (
                              <>
                                <Link
                                  to={`/billing/invoices/${quote.converted_to_invoice_id}`}
                                  className="p-1 rounded-md hover:bg-blue-100 transition-colors"
                                  title="Voir la facture"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                                </Link>
                                <button
                                  onClick={() => {
                                    updateStatusMutation.mutate(
                                      { id: quote.id, status: 'accepte' },
                                      {
                                        onSuccess: () => toast.success('Devis accepté', 'Le devis est marqué comme accepté.'),
                                        onError: (err) => toast.error('Erreur', (err as Error).message),
                                      },
                                    )
                                  }}
                                  disabled={updateStatusMutation.isPending}
                                  className="p-1 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-40"
                                  title="Marquer comme accepté"
                                >
                                  {updateStatusMutation.isPending ? (
                                    <Loader2Icon className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  convertMutation.mutate(quote.id, {
                                    onSuccess: (result) => toast.success('Devis accepté', `Facture ${result.invoice.reference} générée automatiquement.`),
                                    onError: (err) => toast.error('Erreur', (err as Error).message),
                                  })
                                }}
                                disabled={convertMutation.isPending}
                                className="p-1 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-40"
                                title="Accepter et générer la facture"
                              >
                                {convertMutation.isPending ? (
                                  <Loader2Icon className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                updateStatusMutation.mutate(
                                  { id: quote.id, status: 'refuse' },
                                  { onSuccess: () => toast.success('Devis refusé') },
                                )
                              }}
                              disabled={updateStatusMutation.isPending}
                              className="p-1 rounded-md hover:bg-red-100 transition-colors disabled:opacity-40"
                              title="Refuser"
                            >
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </>
                        )}
                        {(status === 'brouillon' || status === 'refuse') && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Supprimer le devis ${quote.reference} ? Cette action est irréversible.`)) {
                                deleteMutation.mutate(quote.id, {
                                  onSuccess: () => toast.success('Devis supprimé'),
                                  onError: (err) => toast.error('Erreur', (err as Error).message),
                                })
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-1 rounded-md hover:bg-red-100 transition-colors disabled:opacity-40"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Affichage de {quotes.length} sur {totalCount} devis
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Pr&eacute;c&eacute;dent
            </button>
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white">
              {page}
            </span>
            {totalPages > 1 && (
              <span className="px-2 py-1.5 text-xs text-slate-500">
                / {totalPages}
              </span>
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Relance Modal */}
      {relanceQuoteId && (
        <QuoteRelanceModal
          quoteId={relanceQuoteId}
          isOpen={!!relanceQuoteId}
          onClose={() => setRelanceQuoteId(null)}
        />
      )}
    </div>
  )
}
