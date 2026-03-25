import { useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { CreditCard, Search, Calendar, Download, Euro, CheckCircle2, Clock, Upload, FileText, ExternalLink, Loader2 } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { exportToExcel } from '../../../utils/excel'
import { useToast } from '../../../components/feedback/ToastProvider'

// ---------------------------------------------------------------------------
// Service — fetch paid invoices with client info
// ---------------------------------------------------------------------------
interface PaymentRow {
  id: string
  reference: string
  title: string
  total_ttc: number
  amount_paid: number
  payment_method: string | null
  payment_reference: string | null
  paid_date: string | null
  issue_date: string
  status: string
  payment_document_url: string | null
  client: { id: string; first_name: string; last_name: string; company_name: string | null } | null
}

async function getPaymentHistory(): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, reference, title, total_ttc, amount_paid, payment_method, payment_reference, paid_date, issue_date, status, payment_document_url,
      client:clients!client_id(id, first_name, last_name, company_name)
    `)
    .gt('amount_paid', 0)
    .order('paid_date', { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    client: Array.isArray(row.client) ? row.client[0] ?? null : row.client,
  })) as PaymentRow[]
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const clientName = (c: PaymentRow['client']) =>
  c ? (c.company_name || `${c.first_name} ${c.last_name}`) : '—'

const methodLabels: Record<string, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  carte_bancaire: 'CB',
  prelevement: 'Prélèvement',
  especes: 'Espèces',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PaymentHistoryPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', 'history'],
    queryFn: getPaymentHistory,
    staleTime: 60_000,
  })

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        const name = clientName(p.client).toLowerCase()
        if (!name.includes(q) && !p.reference.toLowerCase().includes(q)) return false
      }
      if (methodFilter && p.payment_method !== methodFilter) return false
      if (dateFrom && p.paid_date && p.paid_date < dateFrom) return false
      if (dateTo && p.paid_date && p.paid_date > dateTo) return false
      return true
    })
  }, [payments, search, methodFilter, dateFrom, dateTo])

  const stats = useMemo(() => ({
    total: filtered.reduce((s, p) => s + p.amount_paid, 0),
    count: filtered.length,
    fullyPaid: filtered.filter(p => p.status === 'payee').length,
    partial: filtered.filter(p => p.status === 'partiellement_payee').length,
  }), [filtered])

  const handleExport = useCallback(() => {
    exportToExcel('paiements.xlsx', [
      { header: 'Date', accessor: (p: PaymentRow) => fmtDate(p.paid_date), width: 14 },
      { header: 'Facture', accessor: (p: PaymentRow) => p.reference, width: 18 },
      { header: 'Client', accessor: (p: PaymentRow) => clientName(p.client), width: 28 },
      { header: 'Montant facture', accessor: (p: PaymentRow) => p.total_ttc, width: 16 },
      { header: 'Montant payé', accessor: (p: PaymentRow) => p.amount_paid, width: 14 },
      { header: 'Mode', accessor: (p: PaymentRow) => methodLabels[p.payment_method || ''] || p.payment_method || '', width: 14 },
      { header: 'Référence', accessor: (p: PaymentRow) => p.payment_reference || '', width: 18 },
      { header: 'Statut', accessor: (p: PaymentRow) => p.status === 'payee' ? 'Payée' : 'Partielle', width: 12 },
    ], filtered, 'Paiements')
  }, [filtered])

  // Upload justificatif
  const handleUploadClick = useCallback((invoiceId: string) => {
    uploadTargetRef.current = invoiceId
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const invoiceId = uploadTargetRef.current
    if (!file || !invoiceId) return

    setUploadingId(invoiceId)
    try {
      const ext = file.name.split('.').pop()
      const path = `paiements/${invoiceId}/justificatif_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(path)

      // Save URL to invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ payment_document_url: urlData.publicUrl })
        .eq('id', invoiceId)

      if (updateError) throw updateError

      queryClient.invalidateQueries({ queryKey: ['payments', 'history'] })
      toast.success('Justificatif uploadé avec succès')
    } catch (err) {
      toast.error('Erreur lors de l\'upload', (err as Error).message)
    } finally {
      setUploadingId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [queryClient, toast])

  return (
    <div>
      <PageHeader
        title="Historique des paiements"
        description={`${stats.count} paiement(s) — ${fmtCurrency(stats.total)}`}
        actions={
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Exporter
          </button>
        }
      />

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total encaissé', value: fmtCurrency(stats.total), icon: Euro, color: 'text-emerald-600' },
          { label: 'Paiements', value: String(stats.count), icon: CreditCard, color: 'text-blue-600' },
          { label: 'Entièrement payées', value: String(stats.fullyPaid), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Partielles', value: String(stats.partial), icon: Clock, color: 'text-amber-600' },
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher client ou facture..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tous les modes</option>
          <option value="virement">Virement</option>
          <option value="cheque">Chèque</option>
          <option value="carte_bancaire">Carte bancaire</option>
          <option value="prelevement">Prélèvement</option>
          <option value="especes">Espèces</option>
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-2 border border-slate-200 rounded-lg text-sm" />
          <span className="text-slate-400">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Facture</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Client</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Montant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mode</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Référence</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Statut</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Justificatif</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">Aucun paiement trouvé</td></tr>
            ) : (
              filtered.map(p => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(p.paid_date)}</td>
                  <td
                    className="px-4 py-3 text-sm font-medium text-primary-600 cursor-pointer hover:underline"
                    onClick={() => navigate(`/billing/invoices/${p.id}`)}
                  >
                    {p.reference}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{clientName(p.client)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{fmtCurrency(p.amount_paid)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{methodLabels[p.payment_method || ''] || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{p.payment_reference || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'payee' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status === 'payee' ? 'Payée' : 'Partielle'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.payment_document_url ? (
                      <a
                        href={p.payment_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        onClick={e => e.stopPropagation()}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Voir
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUploadClick(p.id) }}
                        disabled={uploadingId === p.id}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600 font-medium transition-colors disabled:opacity-50"
                      >
                        {uploadingId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        Ajouter
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
