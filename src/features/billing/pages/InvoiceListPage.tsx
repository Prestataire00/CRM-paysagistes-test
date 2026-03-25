import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import {
  Search,
  Filter,
  FileText,
  ArrowUpDown,
  Download,
  Eye,
  Send,
  MoreHorizontal,
  Euro,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  XCircle,
  Printer,
  Plus,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useInvoices, useUpdateInvoiceStatus, useRecordInvoicePayment } from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import { exportToExcel } from '../../../utils/excel'
import type { Invoice, InvoiceStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Status configuration - maps DB status to display
// ---------------------------------------------------------------------------
const statusConfig: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  payee: { label: 'Payee', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  partiellement_payee: {
    label: 'Partielle',
    className: 'bg-teal-100 text-teal-700',
    icon: CheckCircle2,
  },
  emise: { label: 'Emise', className: 'bg-blue-100 text-blue-700', icon: FileText },
  envoyee: { label: 'Envoyee', className: 'bg-amber-100 text-amber-700', icon: Clock },
  en_retard: { label: 'En retard', className: 'bg-red-100 text-red-700', icon: AlertCircle },
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600', icon: FileText },
  annulee: { label: 'Annulee', className: 'bg-slate-100 text-slate-400', icon: AlertCircle },
}

// ---------------------------------------------------------------------------
// Filter tabs - "all" means no status filter
// ---------------------------------------------------------------------------
const filterTabs: { key: string; label: string; dbStatus?: InvoiceStatus }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'payee', label: 'Payees', dbStatus: 'payee' },
  { key: 'envoyee', label: 'En attente', dbStatus: 'envoyee' },
  { key: 'en_retard', label: 'En retard', dbStatus: 'en_retard' },
  { key: 'brouillon', label: 'Brouillons', dbStatus: 'brouillon' },
]

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const currencyFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('fr-FR')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clientDisplayName(client: { first_name?: string; last_name?: string; company_name?: string | null } | null): string {
  if (!client) return '—'
  const companyName = client.company_name || ''
  const firstName = client.first_name && client.first_name !== 'N/A' ? client.first_name : ''
  const lastName = client.last_name && client.last_name !== 'N/A' ? client.last_name : ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  if (companyName) {
    return fullName ? `${companyName} — ${fullName}` : companyName
  }
  return fullName || '—'
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-36 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
    </tr>
  )
}

const PAGE_SIZE = 25

// ===========================================================================
// InvoiceListPage
// ===========================================================================
// Status transition options for the context menu
const statusTransitions: { status: InvoiceStatus; label: string; icon: typeof CheckCircle2; className: string }[] = [
  { status: 'brouillon', label: 'Brouillon', icon: FileText, className: 'text-slate-600 hover:bg-slate-50' },
  { status: 'emise', label: 'Émise', icon: FileText, className: 'text-blue-600 hover:bg-blue-50' },
  { status: 'envoyee', label: 'En attente', icon: Clock, className: 'text-amber-600 hover:bg-amber-50' },
  { status: 'payee', label: 'Payée', icon: CheckCircle2, className: 'text-emerald-600 hover:bg-emerald-50' },
  { status: 'en_retard', label: 'En retard', icon: AlertCircle, className: 'text-red-600 hover:bg-red-50' },
  { status: 'annulee', label: 'Annulée', icon: XCircle, className: 'text-slate-400 hover:bg-slate-50' },
]

export function InvoiceListPage() {
  const toast = useToast()
  const navigate = useNavigate()

  // ---- Local UI state ----
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const [sortField, setSortField] = useState<'reference' | 'total_ttc'>('reference')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }, [sortField])

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setPage(1) // reset to first page on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset page when filter changes
  const handleFilterChange = useCallback((key: string) => {
    setFilterStatus(key)
    setPage(1)
  }, [])

  // ---- Build query filters ----
  const filters = useMemo(() => {
    const f: Record<string, unknown> = {
      page,
      pageSize: PAGE_SIZE,
    }
    if (debouncedSearch) f.search = debouncedSearch
    const tab = filterTabs.find((t) => t.key === filterStatus)
    if (tab?.dbStatus) f.status = tab.dbStatus
    return f
  }, [page, debouncedSearch, filterStatus])

  // ---- Data queries ----
  const { data: result, isLoading, isFetching, refetch } = useInvoices(filters)
  const updateStatus = useUpdateInvoiceStatus()
  const recordPayment = useRecordInvoicePayment()

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<{ invoiceId: string; reference: string; totalTtc: number; amountPaid: number } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>('virement')
  const [paymentRef, setPaymentRef] = useState('')

  const rawInvoices = result?.data ?? []
  const invoices = useMemo(() => {
    const sorted = [...rawInvoices]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortField === 'reference') cmp = (a.reference ?? '').localeCompare(b.reference ?? '')
      else if (sortField === 'total_ttc') cmp = (a.total_ttc ?? 0) - (b.total_ttc ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rawInvoices, sortField, sortDir])
  const totalCount = result?.count ?? 0
  const totalPages = result?.totalPages ?? 1

  const handleExportInvoices = useCallback(() => {
    exportToExcel('factures.xlsx', [
      { header: 'Référence', accessor: (i: Invoice) => i.reference, width: 16 },
      { header: 'Date émission', accessor: (i: Invoice) => i.issue_date, width: 14 },
      { header: 'Date échéance', accessor: (i: Invoice) => i.due_date, width: 14 },
      { header: 'Total HT', accessor: (i: Invoice) => i.subtotal_ht, width: 12 },
      { header: 'Total TTC', accessor: (i: Invoice) => i.total_ttc, width: 12 },
      { header: 'Statut', accessor: (i: Invoice) => statusConfig[i.status]?.label ?? i.status, width: 14 },
      { header: 'Date paiement', accessor: (i: Invoice) => i.paid_date, width: 14 },
    ], invoices, 'Factures')
    toast.success('Export réussi', `${invoices.length} facture(s) exportée(s)`)
  }, [invoices, toast])

  // ---- Computed summary stats from current result set ----
  const stats = useMemo(() => {
    const totalTTC = invoices.reduce((sum, inv) => sum + (inv.total_ttc ?? 0), 0)
    const paid = invoices.filter((i) => i.status === 'payee').length
    const pending = invoices.filter(
      (i) => i.status === 'envoyee' || i.status === 'emise' || i.status === 'partiellement_payee',
    ).length
    const overdue = invoices.filter((i) => i.status === 'en_retard').length
    return { totalTTC, paid, pending, overdue }
  }, [invoices])

  // ---- Open payment modal ----
  const handleMarkPaid = useCallback(
    (invoice: Invoice) => {
      setPaymentMethod('virement')
      setPaymentRef('')
      setPaymentModal({
        invoiceId: invoice.id,
        reference: invoice.reference,
        totalTtc: invoice.total_ttc,
        amountPaid: invoice.amount_paid ?? 0,
      })
    },
    [],
  )

  const handleConfirmPayment = useCallback(() => {
    if (!paymentModal) return
    const remaining = paymentModal.totalTtc - paymentModal.amountPaid
    recordPayment.mutate(
      {
        id: paymentModal.invoiceId,
        amount: remaining,
        method: paymentMethod,
        reference: paymentRef || null,
        currentAmountPaid: paymentModal.amountPaid,
        totalTtc: paymentModal.totalTtc,
      },
      {
        onSuccess: () => {
          toast.success('Paiement enregistré avec succès')
          setPaymentModal(null)
        },
        onError: () => toast.error('Erreur lors de l\'enregistrement du paiement'),
      },
    )
  }, [paymentModal, paymentMethod, paymentRef, recordPayment, toast])

  // ---- Pagination helpers ----
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Suivi de la facturation"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/billing/invoices/new')}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle facture
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Synchroniser
            </button>
            <button
              onClick={handleExportInvoices}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>
        }
      />

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Total facture',
            value: currencyFmt.format(stats.totalTTC),
            icon: Euro,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
          },
          {
            label: 'Payees',
            value: String(stats.paid),
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'En attente',
            value: String(stats.pending),
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'En retard',
            value: String(stats.overdue),
            icon: AlertCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-lg border border-slate-200 p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <p className="text-xs text-slate-500">{card.label}</p>
            </div>
            <p className="text-xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status Filter Badges */}
      <div className="flex items-center gap-2 mb-4">
        {filterTabs.map((filter) => (
          <button
            key={filter.key}
            onClick={() => handleFilterChange(filter.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filterStatus === filter.key
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par n° facture ou client..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400">
          <Filter className="w-4 h-4" />
          {totalCount} facture{totalCount > 1 ? 's' : ''}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => toggleSort('reference')} className="flex items-center gap-1 hover:text-slate-700">
                    N° Facture <ArrowUpDown className={`w-3 h-3 ${sortField === 'reference' ? 'text-primary-600' : ''}`} />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Date
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Echeance
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => toggleSort('total_ttc')} className="flex items-center gap-1 hover:text-slate-700">
                    Montant <ArrowUpDown className={`w-3 h-3 ${sortField === 'total_ttc' ? 'text-primary-600' : ''}`} />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Statut
                </th>
                <th className="w-10 px-4 py-3" />
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
                </>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Aucune facture trouvee
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const status = statusConfig[invoice.status] ?? statusConfig.brouillon
                  const clientObj = invoice.client ?? null
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-primary-600">
                            {invoice.reference}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">
                          {clientDisplayName(clientObj)}
                        </div>
                        {invoice.title && (
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">{invoice.title}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {fmtDate(invoice.issue_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {fmtDate(invoice.due_date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {currencyFmt.format(invoice.total_ttc)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}
                        >
                          <status.icon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/billing/invoices/${invoice.id}`}
                            className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                            title="Voir"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                          </Link>
                          <Link
                            to={`/billing/invoices/${invoice.id}`}
                            className="p-1 rounded-md hover:bg-blue-100 transition-colors"
                            title="Envoyer"
                          >
                            <Send className="w-3.5 h-3.5 text-blue-500" />
                          </Link>
                          {invoice.status !== 'payee' && invoice.status !== 'annulee' && (
                            <button
                              onClick={() => handleMarkPaid(invoice)}
                              disabled={recordPayment.isPending}
                              className="p-1 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              title="Enregistrer le paiement"
                            >
                              {recordPayment.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                            </button>
                          )}
                          <div>
                            <button
                              onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
                                if (openMenuId === invoice.id) {
                                  setOpenMenuId(null)
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 })
                                  setOpenMenuId(invoice.id)
                                }
                              }}
                              className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </div>
                        </div>
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
            Affichage de {invoices.length} sur {totalCount} factures
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prec.
            </button>
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                  p === page
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suiv.
            </button>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {paymentModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setPaymentModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 z-10">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Enregistrer le paiement</h3>
            <p className="text-sm text-slate-500 mb-5">Facture {paymentModal.reference} — {currencyFmt.format(paymentModal.totalTtc - paymentModal.amountPaid)} restant</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode de paiement</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="virement">Virement</option>
                  <option value="cheque">Chèque</option>
                  <option value="carte_bancaire">Carte bancaire</option>
                  <option value="prelevement">Prélèvement</option>
                  <option value="especes">Espèces</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Référence de paiement (optionnel)</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Ex: VIR-2026-001, N° chèque..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-sm text-emerald-700">
                  <span className="font-semibold">Montant :</span> {currencyFmt.format(paymentModal.totalTtc - paymentModal.amountPaid)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleConfirmPayment}
                disabled={recordPayment.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {recordPayment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirmer le paiement
              </button>
              <button
                onClick={() => setPaymentModal(null)}
                className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Context menu rendered via portal to avoid overflow clipping */}
      {openMenuId && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
          <div
            ref={menuRef}
            className="fixed z-50 w-52 bg-white border border-slate-200 rounded-lg shadow-xl py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <Link
              to={`/billing/invoices/${openMenuId}`}
              onClick={() => setOpenMenuId(null)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Voir le détail
            </Link>
            <Link
              to={`/billing/invoices/${openMenuId}`}
              onClick={() => setOpenMenuId(null)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer / PDF
            </Link>
            <div className="border-t border-slate-100 my-1" />
            <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase">Changer le statut</p>
            {(() => {
              const inv = invoices.find(i => i.id === openMenuId)
              if (!inv) return null
              return statusTransitions
                .filter(t => t.status !== inv.status)
                .map(t => (
                  <button
                    key={t.status}
                    onClick={() => {
                      if (t.status === 'payee') {
                        // Open payment modal instead of direct status change
                        setOpenMenuId(null)
                        handleMarkPaid(inv)
                        return
                      }
                      const needsConfirm = t.status === 'annulee'
                      if (needsConfirm && !window.confirm(`Annuler la facture ${inv.reference} ?`)) return
                      setOpenMenuId(null)
                      updateStatus.mutate(
                        { id: inv.id, status: t.status },
                        {
                          onSuccess: () => toast.success(`Statut mis à jour : ${t.label}`),
                          onError: () => toast.error('Erreur lors de la mise à jour'),
                        },
                      )
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm ${t.className}`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))
            })()}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
