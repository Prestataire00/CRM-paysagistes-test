import { brand } from '../../../config/brand'
import { useRef, useCallback, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  Printer,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  MapPin,
  Mail,
  Phone,
  Building2,
  Calendar,
  Send,
  Pencil,
  FileOutput,
  Loader2,
  Copy,
  Eye,
  PenTool,
  RotateCcw,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DocumentManager } from '../components/DocumentManager'
import { RecordHistory } from '../../../components/data/RecordHistory'
import { useQuote, useUpdateQuoteStatus, useConvertQuoteToInvoice, useSendQuoteEmail } from '../../../queries/useBilling'
import { useDocumentsForQuote, useUploadDocument, useDeleteDocument } from '../../../queries/useDocuments'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { QuoteStatus, DocumentType } from '../../../types'

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
const statusConfig: Record<QuoteStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600', icon: FileText },
  envoye: { label: 'Envoyé', className: 'bg-blue-100 text-blue-700', icon: Clock },
  accepte: { label: 'Accepté', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  refuse: { label: 'Refusé', className: 'bg-red-100 text-red-700', icon: XCircle },
  expire: { label: 'Expiré', className: 'bg-amber-100 text-amber-700', icon: Clock },
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const formatAmount = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

const formatDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  const { data: quote, isLoading, error } = useQuote(id)
  const { data: documents = [], isLoading: documentsLoading } = useDocumentsForQuote(id)
  const uploadDocumentMutation = useUploadDocument()
  const deleteDocumentMutation = useDeleteDocument()
  const updateStatusMutation = useUpdateQuoteStatus()
  const convertMutation = useConvertQuoteToInvoice()
  const sendEmailMutation = useSendQuoteEmail()
  const [showConfirmAction, setShowConfirmAction] = useState<'accepte' | 'refuse' | 'convert' | 'send_email' | 'brouillon' | null>(null)

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!id) return
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus })
      toast.success('Statut mis à jour', `Le devis est maintenant "${statusConfig[newStatus]?.label ?? newStatus}".`)
      setShowConfirmAction(null)
    } catch (err) {
      toast.error('Erreur', (err as Error).message || 'Impossible de mettre à jour le statut.')
      setShowConfirmAction(null)
    }
  }

  const handleConvert = async () => {
    if (!id) return
    try {
      await convertMutation.mutateAsync(id)
      toast.success('Facture créée', 'Le devis a été converti en facture.')
      setShowConfirmAction(null)
    } catch {
      toast.error('Erreur', 'Impossible de convertir le devis en facture.')
    }
  }

  const handleSendEmail = async () => {
    if (!id) return
    try {
      await sendEmailMutation.mutateAsync(id)
      toast.success('Devis envoyé', 'Le devis a été envoyé par email au client avec un lien de signature.')
      setShowConfirmAction(null)
    } catch {
      toast.error('Erreur', 'Impossible d\'envoyer le devis par email.')
    }
  }

  const handleCopySigningLink = () => {
    if (!quote?.signing_token) return
    const link = `${window.location.origin}/sign/${quote.signing_token}`
    navigator.clipboard.writeText(link)
    toast.success('Lien copié', 'Le lien de signature a été copié dans le presse-papiers.')
  }

  const isBusy = updateStatusMutation.isPending || convertMutation.isPending || sendEmailMutation.isPending

  // PDF export — opens a clean print window (user can "Save as PDF" from browser print dialog)
  const handleDownloadPdf = useCallback(() => {
    if (!printRef.current || !quote) return
    const content = printRef.current.innerHTML
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Erreur', 'Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez que les pop-ups ne sont pas bloqués.')
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${quote.reference || 'Devis'} — PDF</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background: white; }
    .bg-primary-600 { background-color: #16a34a; }
    .text-white { color: white; }
    .text-primary-200 { color: #bbf7d0; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-50\\/50 { background-color: rgba(248,250,252,0.5); }
    .bg-white { background-color: white; }
    .bg-emerald-50 { background-color: #ecfdf5; }
    .bg-blue-50 { background-color: #eff6ff; }
    .border-slate-200 { border-color: #e2e8f0; }
    .border-slate-100 { border-color: #f1f5f9; }
    .border-emerald-200 { border-color: #a7f3d0; }
    .border-blue-200 { border-color: #bfdbfe; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-800 { color: #1e293b; }
    .text-slate-700 { color: #334155; }
    .text-slate-600 { color: #475569; }
    .text-slate-500 { color: #64748b; }
    .text-slate-400 { color: #94a3b8; }
    .text-emerald-700 { color: #047857; }
    .text-emerald-600 { color: #059669; }
    .text-blue-700 { color: #1d4ed8; }
    .text-blue-600 { color: #2563eb; }
    .text-red-600 { color: #dc2626; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-2xl { font-size: 1.5rem; }
    .text-base { font-size: 1rem; }
    .text-sm { font-size: 0.875rem; }
    .text-xs { font-size: 0.75rem; }
    .text-\\[10px\\] { font-size: 10px; }
    .uppercase { text-transform: uppercase; }
    .tracking-tight { letter-spacing: -0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .px-8 { padding-left: 2rem; padding-right: 2rem; }
    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .p-4 { padding: 1rem; }
    .p-3 { padding: 0.75rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .pt-2 { padding-top: 0.5rem; }
    .pt-4 { padding-top: 1rem; }
    .gap-1\\.5 { gap: 0.375rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-6 { gap: 1.5rem; }
    .space-y-1\\.5 > * + * { margin-top: 0.375rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .space-y-6 > * + * { margin-top: 1.5rem; }
    .flex { display: flex; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
    .items-start { align-items: flex-start; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-end { justify-content: flex-end; }
    .flex-wrap { flex-wrap: wrap; }
    .inline-flex { display: inline-flex; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-full { border-radius: 9999px; }
    .rounded { border-radius: 0.25rem; }
    .border { border-width: 1px; border-style: solid; }
    .border-t { border-top-width: 1px; border-top-style: solid; }
    .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
    .border-dashed { border-style: dashed; }
    .overflow-hidden { overflow: hidden; }
    .w-full { width: 100%; }
    .w-80 { width: 20rem; }
    .w-3\\.5 { width: 0.875rem; height: 0.875rem; }
    .w-4 { width: 1rem; height: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { size: A4; margin: 15mm; }
  </style>
</head>
<body>${content}</body>
</html>`)
    printWindow.document.close()
    // Wait for rendering then trigger print
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }, [quote, toast])

  // Client helper — cast through unknown to satisfy TS
  const quoteAny = quote as unknown as Record<string, unknown> | undefined
  const client = quoteAny?.client as Record<string, unknown> | null

  // Build formal client display
  const firstName = (client?.first_name as string) || ''
  const lastName = (client?.last_name as string) || ''
  const companyName = (client?.company_name as string) || ''
  const clientEmail = (client?.email as string) || null
  const clientPhone = (client?.phone as string) || null

  // Filter out "N/A" placeholder names
  const cleanFirst = firstName === 'N/A' ? '' : firstName
  const cleanLast = lastName === 'N/A' ? '' : lastName
  const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ')
  const isProfessional = !!companyName

  const clientAddress = client
    ? [client.address_line1, [client.postal_code, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : null
  const clientSiret = (client?.siret as string) || null
  const clientTva = (client?.tva_number as string) || null

  const lines = (quoteAny?.lines ?? []) as Array<Record<string, unknown>>

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  // Error state
  if (error || !quote) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <FileText className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500">Devis introuvable</p>
        <button
          onClick={() => navigate('/crm/devis')}
          className="text-sm text-primary-600 hover:underline"
        >
          Retour à la liste
        </button>
      </div>
    )
  }

  const sc = statusConfig[quote.status] ?? statusConfig.brouillon
  const StatusIcon = sc.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`${quote.reference || 'Devis'} — ${quote.title}`}
        description={quote.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/crm/devis"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
            {quote.status === 'brouillon' && (
              <>
                <Link
                  to={`/crm/devis/${id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Modifier
                </Link>
                <button
                  onClick={() => setShowConfirmAction('send_email')}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer au client
                </button>
              </>
            )}
            {quote.status === 'envoye' && (
              <>
                {quote.signing_token && (
                  <button
                    onClick={handleCopySigningLink}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copier le lien
                  </button>
                )}
                {quote.converted_to_invoice_id ? (
                  <>
                    <Link
                      to={`/billing/invoices/${quote.converted_to_invoice_id}`}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Voir la facture
                    </Link>
                    <button
                      onClick={() => setShowConfirmAction('accepte')}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marquer comme accepté
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowConfirmAction('accepte')}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Accepter
                  </button>
                )}
                <button
                  onClick={() => setShowConfirmAction('refuse')}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Refuser
                </button>
              </>
            )}
            {(quote.status === 'accepte' || quote.status === 'refuse') && (
              <button
                onClick={() => setShowConfirmAction('brouillon')}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Remettre en brouillon
              </button>
            )}
            {quote.status === 'accepte' && !quote.converted_to_invoice_id && (
              <button
                onClick={() => setShowConfirmAction('convert')}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FileOutput className="w-4 h-4" />
                Convertir en facture
              </button>
            )}
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              PDF
            </button>
          </div>
        }
      />

      {/* Printable quote preview */}
      <div
        ref={printRef}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Company header band */}
        <div className="bg-primary-600 text-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
              <p className="text-primary-200 text-sm mt-1">Petits travaux de jardinage</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight">DEVIS</p>
              <p className="text-primary-200 text-sm mt-1">{quote.reference}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Status + Dates row */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${sc.className}`}>
              <StatusIcon className="w-4 h-4" />
              {sc.label}
            </span>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Émis le {formatDate(quote.issue_date)}
              </span>
              {quote.validity_date && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Valide jusqu'au {formatDate(quote.validity_date)}
                </span>
              )}
            </div>
          </div>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Émetteur</h3>
              <p className="text-sm font-bold text-slate-900">{brand.name}</p>
              <p className="text-sm text-slate-500 mt-1">Petits travaux de jardinage</p>
              <p className="flex items-center gap-2 text-sm text-slate-500 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                5 La Boisselière RD 751, 37700 La Ville-aux-Dames
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                SIRET : 489 090 779 00013
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {brand.email}
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                02 47 44 41 12
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Destinataire</h3>
              <div className="space-y-1.5">
                {/* Company name first for professionals */}
                {isProfessional && companyName && (
                  <p className="text-sm font-bold text-slate-900">{companyName}</p>
                )}
                {/* Contact name */}
                {fullName && (
                  <p className="flex items-center gap-2 text-sm text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {isProfessional ? fullName : <span className="font-semibold">{fullName}</span>}
                  </p>
                )}
                {/* Address */}
                {clientAddress && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {clientAddress}
                  </p>
                )}
                {/* Email */}
                {clientEmail && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {clientEmail}
                  </p>
                )}
                {/* Phone */}
                {clientPhone && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {clientPhone}
                  </p>
                )}
                {/* SIRET & TVA */}
                {clientSiret && (
                  <p className="text-xs text-slate-400 mt-2">SIRET : {clientSiret}</p>
                )}
                {clientTva && (
                  <p className="text-xs text-slate-400">TVA : {clientTva}</p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {quote.description && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm text-slate-600">{quote.description}</p>
            </div>
          )}

          {/* Lines table */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Prestations</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Qté</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Unité</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Prix unit. HT</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">TVA</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr
                      key={line.id as string}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                    >
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          {String(line.description)}
                          {Boolean(line.is_labor) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                              MO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600 text-center">{Number(line.quantity)}</td>
                      <td className="px-3 py-3 text-sm text-slate-500 text-center">{String(line.unit)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatAmount(Number(line.unit_price_ht))}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{Number(line.tva_rate)}%</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{formatAmount(Number(line.total_ht))}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-slate-400 text-center">
                        Aucune ligne de prestation
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Sous-total HT</span>
                <span className="font-medium">{formatAmount(quote.subtotal_ht)}</span>
              </div>
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Remise ({quote.discount_percentage}%)</span>
                  <span className="font-medium">-{formatAmount(quote.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>TVA ({quote.tva_rate}%)</span>
                <span className="font-medium">{formatAmount(quote.tva_amount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total TTC</span>
                <span>{formatAmount(quote.total_ttc)}</span>
              </div>
              {quote.acompte_percentage > 0 && (
                <>
                  <div className="flex justify-between text-sm text-amber-700 pt-2 border-t border-dashed border-amber-200">
                    <span>Acompte ({quote.acompte_percentage}%)</span>
                    <span className="font-medium">{formatAmount(quote.total_ttc * (quote.acompte_percentage / 100))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Solde restant</span>
                    <span className="font-medium">{formatAmount(quote.total_ttc * (1 - quote.acompte_percentage / 100))}</span>
                  </div>
                </>
              )}
              {quote.eligible_tax_credit && quote.tax_credit_amount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600 pt-2 border-t border-dashed border-emerald-200">
                    <span>Crédit d'impôt (50%)</span>
                    <span className="font-medium">-{formatAmount(quote.tax_credit_amount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-emerald-700">
                    <span>Net après crédit</span>
                    <span>{formatAmount(quote.net_after_credit)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Conditions */}
          {(quote.payment_terms || quote.special_conditions) && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              {quote.payment_terms && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Conditions de paiement</h3>
                  <p className="text-sm text-slate-600">{quote.payment_terms}</p>
                </div>
              )}
              {quote.special_conditions && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Conditions particulières</h3>
                  <p className="text-sm text-slate-600">{quote.special_conditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Tax credit legal mention */}
          {quote.eligible_tax_credit && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xs text-emerald-700">
                Services de jardinage éligibles au crédit d'impôt de 50% au titre de l'article 199 sexdecies du Code Général des Impôts
                (plafond de 5 000 € de dépenses par an et par foyer fiscal).
              </p>
            </div>
          )}

          {/* Converted invoice link */}
          {quote.converted_to_invoice_id && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-700">
                Ce devis a été converti en facture.
              </p>
            </div>
          )}

          {/* Signature status */}
          {quote.signed_at && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-emerald-600" />
                <p className="text-sm text-emerald-700">
                  Signé électroniquement le {formatDate(quote.signed_at)}
                  {quote.signer_ip && <span className="text-emerald-500"> (IP: {quote.signer_ip})</span>}
                </p>
              </div>
              {quote.signature_url && (
                <a
                  href={quote.signature_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Voir la signature
                </a>
              )}
            </div>
          )}
          {quote.signing_token && !quote.signed_at && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-amber-700">
                  En attente de signature
                  {quote.signing_expires_at && (
                    <span className="text-amber-500">
                      {' '}— expire le {formatDate(quote.signing_expires_at)}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleCopySigningLink}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copier le lien
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Documents section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
          Documents ({documents.length})
        </h3>
        <DocumentManager
          documents={documents}
          isLoading={documentsLoading}
          uploading={uploadDocumentMutation.isPending}
          onUpload={async (file: File, type: DocumentType) => {
            await uploadDocumentMutation.mutateAsync({
              file,
              document_type: type,
              quote_id: id,
            })
          }}
          onDelete={(docId: string) => {
            deleteDocumentMutation.mutate(docId)
          }}
        />
      </div>

      {/* Confirmation dialog */}
      {/* Historique des modifications */}
      {id && <RecordHistory tableName="quotes" recordId={id} />}

      {showConfirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {showConfirmAction === 'accepte' && 'Accepter ce devis ?'}
              {showConfirmAction === 'refuse' && 'Refuser ce devis ?'}
              {showConfirmAction === 'convert' && 'Convertir en facture ?'}
              {showConfirmAction === 'send_email' && 'Envoyer le devis au client ?'}
              {showConfirmAction === 'brouillon' && 'Remettre en brouillon ?'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {showConfirmAction === 'accepte' && 'Le devis sera marqué comme accepté par le client.'}
              {showConfirmAction === 'refuse' && 'Le devis sera marqué comme refusé. Cette action est réversible.'}
              {showConfirmAction === 'convert' && 'Une facture sera automatiquement créée à partir de ce devis.'}
              {showConfirmAction === 'send_email' && 'Le client recevra un email avec le détail du devis et un lien pour le signer électroniquement.'}
              {showConfirmAction === 'brouillon' && 'Le devis repassera en brouillon et pourra être modifié puis renvoyé.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (showConfirmAction === 'convert') handleConvert()
                  else if (showConfirmAction === 'send_email') handleSendEmail()
                  else handleStatusChange(showConfirmAction)
                }}
                disabled={isBusy}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                  showConfirmAction === 'refuse'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
