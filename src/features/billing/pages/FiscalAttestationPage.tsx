import { brand } from '../../../config/brand'
import { useState, useCallback, useMemo, useRef } from 'react'
import {
  FileCheck,
  Download,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  Euro,
  Printer,
  Send,
  Loader2,
  X,
  MapPin,
  Eye,
  UserPlus,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { TAX_CREDIT_RATE } from '../../../utils/constants'
import {
  useFiscalAttestations,
  useGenerateFiscalAttestation,
  useEligibleClientsForAttestation,
} from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { FiscalAttestation } from '../../../types'
import type { EligibleClient } from '../../../services/billing.service'

// ---------------------------------------------------------------------------
// Year tabs
// ---------------------------------------------------------------------------
const years = [2026, 2025, 2024, 2023]

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const currencyFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

const dateFmt = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type AttestationWithClient = FiscalAttestation & {
  client?: {
    id?: string
    first_name?: string
    last_name?: string
    company_name?: string
    email?: string
    address_line1?: string
    postal_code?: string
    city?: string
  } | null
}

function clientDisplayName(attestation: AttestationWithClient): string {
  if (attestation.company_name) return attestation.company_name
  const c = attestation.client
  if (!c) return '-'
  if (c.company_name) return c.company_name
  const firstName = c.first_name && c.first_name !== 'N/A' ? c.first_name : ''
  const lastName = c.last_name && c.last_name !== 'N/A' ? c.last_name : ''
  return [firstName, lastName].filter(Boolean).join(' ') || '-'
}

function getClientFullName(attestation: AttestationWithClient): string {
  const c = attestation.client
  if (!c) return '-'
  const firstName = c.first_name && c.first_name !== 'N/A' ? c.first_name : ''
  const lastName = c.last_name && c.last_name !== 'N/A' ? c.last_name : ''
  return [firstName, lastName].filter(Boolean).join(' ') || '-'
}

function getClientAddress(attestation: AttestationWithClient): string {
  const c = attestation.client
  if (!c) return ''
  return [c.address_line1, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

// ---------------------------------------------------------------------------
// PDF CSS (shared between single and bulk print)
// ---------------------------------------------------------------------------
const printCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background: white; }
  .attestation-page { max-width: 210mm; margin: 0 auto; padding: 20mm; }
  .header-band { background: #2563eb; color: white; padding: 1.5rem 2rem; border-radius: 8px 8px 0 0; }
  .content { padding: 2rem; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
  .section { margin-bottom: 1.5rem; }
  .section-title { font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .info-box { padding: 1rem; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; }
  .info-label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .info-name { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
  .info-detail { font-size: 0.875rem; color: #64748b; margin-bottom: 0.125rem; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 0.625rem 1rem; font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.75rem 1rem; font-size: 0.875rem; color: #334155; border-bottom: 1px solid #f1f5f9; }
  .text-right { text-align: right; }
  .text-bold { font-weight: 700; }
  .text-emerald { color: #047857; }
  .total-row td { font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0; font-size: 1rem; }
  .legal-box { padding: 0.75rem; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 0.75rem; color: #047857; }
  .signature-section { margin-top: 2rem; display: flex; justify-content: space-between; }
  .signature-block { width: 45%; }
  .signature-line { border-top: 1px solid #94a3b8; margin-top: 3rem; padding-top: 0.5rem; font-size: 0.75rem; color: #64748b; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .attestation-page { padding: 0; page-break-after: always; }
    .attestation-page:last-child { page-break-after: auto; }
  }
  @page { size: A4; margin: 15mm; }
`

// ---------------------------------------------------------------------------
// Build attestation HTML content
// ---------------------------------------------------------------------------
function buildAttestationHtml(attestation: AttestationWithClient): string {
  const clientName = clientDisplayName(attestation)
  const clientFullName = getClientFullName(attestation)
  const clientAddr = getClientAddress(attestation)

  return `
    <div class="attestation-page">
      <div class="header-band">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h1 style="font-size:1.5rem;font-weight:700;letter-spacing:-0.025em;">${attestation.company_name || brand.name}</h1>
            <p style="color:#bfdbfe;font-size:0.875rem;margin-top:0.25rem;">Petits travaux de jardinage</p>
          </div>
          <div style="text-align:right;">
            <p style="font-size:1.5rem;font-weight:700;letter-spacing:-0.025em;">ATTESTATION FISCALE</p>
            <p style="color:#bfdbfe;font-size:0.875rem;margin-top:0.25rem;">${attestation.reference}</p>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="display:inline-flex;align-items:center;gap:0.375rem;font-size:0.875rem;font-weight:600;padding:0.25rem 0.75rem;border-radius:9999px;background:#dbeafe;color:#1d4ed8;">
              Annee fiscale ${attestation.fiscal_year}
            </span>
            <span style="font-size:0.875rem;color:#64748b;">
              Generee le ${dateFmt(attestation.created_at)}
            </span>
          </div>
        </div>

        <div class="section grid-2">
          <div class="info-box">
            <p class="info-label">Entreprise prestataire</p>
            <p class="info-name">${attestation.company_name || brand.name}</p>
            ${attestation.company_siret ? `<p class="info-detail">SIRET : ${attestation.company_siret}</p>` : ''}
            ${attestation.company_address ? `<p class="info-detail">${attestation.company_address}</p>` : ''}
            ${attestation.company_agrement ? `<p class="info-detail">Agrement SAP : ${attestation.company_agrement}</p>` : ''}
          </div>
          <div class="info-box">
            <p class="info-label">Client beneficiaire</p>
            <p class="info-name">${clientName}</p>
            ${clientFullName !== clientName ? `<p class="info-detail">${clientFullName}</p>` : ''}
            ${clientAddr ? `<p class="info-detail">${clientAddr}</p>` : ''}
          </div>
        </div>

        <div class="section">
          <p class="section-title">Recapitulatif des prestations - Annee ${attestation.fiscal_year}</p>
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total des prestations reglees (TTC)</td>
                  <td class="text-right text-bold">${currencyFmt.format(attestation.total_amount_ttc)}</td>
                </tr>
                <tr>
                  <td>Dont main d'oeuvre (HT)</td>
                  <td class="text-right">${currencyFmt.format(attestation.total_labor_ht)}</td>
                </tr>
                <tr>
                  <td>Nombre de factures</td>
                  <td class="text-right">${attestation.invoice_ids?.length ?? 0}</td>
                </tr>
                <tr class="total-row">
                  <td class="text-emerald">Credit d'impot (${TAX_CREDIT_RATE}%)</td>
                  <td class="text-right text-emerald">${currencyFmt.format(attestation.tax_credit_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="section">
          <div class="legal-box">
            <p style="font-weight:600;margin-bottom:0.25rem;">Mention legale</p>
            <p>
              La presente attestation est etablie conformement aux dispositions de l'article 199 sexdecies du Code General des Impots.
              Les prestations de services a la personne (jardinage) ouvrent droit a un credit d'impot de ${TAX_CREDIT_RATE}% des depenses engagees,
              dans la limite de 5 000 € de depenses par an et par foyer fiscal (soit un credit d'impot maximum de 2 500 €).
            </p>
          </div>
        </div>

        <div class="signature-section">
          <div class="signature-block">
            <p style="font-size:0.75rem;color:#64748b;">Fait a ________________</p>
            <p style="font-size:0.75rem;color:#64748b;margin-top:0.25rem;">Le ${dateFmt(attestation.created_at)}</p>
            <div class="signature-line">
              Signature et cachet de l'entreprise
            </div>
          </div>
          <div class="signature-block">
            <p style="font-size:0.75rem;color:#64748b;">Le client,</p>
            <p style="font-size:0.75rem;color:#64748b;margin-top:0.25rem;">${clientName}</p>
            <div class="signature-line">
              Signature du client
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-4 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-36 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
    </tr>
  )
}

// ===========================================================================
// FiscalAttestationPage
// ===========================================================================
export function FiscalAttestationPage() {
  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  // ---- Local UI state ----
  const [selectedYear, setSelectedYear] = useState(2025)
  const [search, setSearch] = useState('')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [previewAttestation, setPreviewAttestation] = useState<AttestationWithClient | null>(null)
  const [showEligibleModal, setShowEligibleModal] = useState(false)
  const [selectedEligible, setSelectedEligible] = useState<Set<string>>(new Set())

  // ---- Data queries ----
  const { data: rawAttestations = [], isLoading } = useFiscalAttestations(selectedYear)
  const attestations = rawAttestations as AttestationWithClient[]
  const generateAttestation = useGenerateFiscalAttestation()
  const { data: eligibleClients = [], isLoading: eligibleLoading } = useEligibleClientsForAttestation(selectedYear, showEligibleModal)

  // ---- Filter attestations by search ----
  const filteredAttestations = useMemo(() => {
    if (!search) return attestations
    const lower = search.toLowerCase()
    return attestations.filter((a) => clientDisplayName(a).toLowerCase().includes(lower))
  }, [attestations, search])

  // ---- Computed stats ----
  const stats = useMemo(() => {
    const total = attestations.length
    const generated = attestations.filter((a) => a.is_sent || a.pdf_url).length
    const remaining = total - generated
    return { total, generated, remaining }
  }, [attestations])

  // ---- Selection handlers ----
  const toggleClient = useCallback((id: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedClients.size === filteredAttestations.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(filteredAttestations.map((a) => a.id)))
    }
  }, [selectedClients.size, filteredAttestations])

  // ---- Generate handler ----
  const handleGenerate = useCallback(
    (clientId: string) => {
      generateAttestation.mutate(
        { clientId, year: selectedYear },
        {
          onSuccess: () => toast.success('Attestation generee avec succes'),
          onError: () => toast.error("Erreur lors de la generation de l'attestation"),
        },
      )
    },
    [generateAttestation, selectedYear, toast],
  )

  // ---- Bulk generate handler ----
  const handleBulkGenerate = useCallback(() => {
    const selectedAttestations = attestations.filter((a) => selectedClients.has(a.id))
    let completed = 0
    const total = selectedAttestations.length

    selectedAttestations.forEach((a) => {
      generateAttestation.mutate(
        { clientId: a.client_id, year: selectedYear },
        {
          onSuccess: () => {
            completed++
            if (completed === total) {
              toast.success(`${total} attestation(s) generee(s) avec succes`)
              setSelectedClients(new Set())
            }
          },
          onError: () => {
            completed++
            toast.error(`Erreur pour le client ${clientDisplayName(a)}`)
          },
        },
      )
    })
  }, [attestations, selectedClients, generateAttestation, selectedYear, toast])

  // ---- Print single attestation ----
  const handlePrintSingle = useCallback((attestation: AttestationWithClient) => {
    const html = buildAttestationHtml(attestation)
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenetre d'impression")
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${attestation.reference} — Attestation Fiscale</title>
<style>${printCSS}</style></head><body>${html}</body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }, [toast])

  // ---- Bulk print handler ----
  const handleBulkPrint = useCallback(() => {
    const selectedAttestations = attestations.filter((a) => selectedClients.has(a.id))
    if (selectedAttestations.length === 0) return

    const allHtml = selectedAttestations.map((a) => buildAttestationHtml(a)).join('')
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenetre d'impression")
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Attestations Fiscales ${selectedYear}</title>
<style>${printCSS}</style></head><body>${allHtml}</body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }, [attestations, selectedClients, selectedYear, toast])

  // ---- Bulk email handler ----
  const handleBulkEmail = useCallback(() => {
    const selectedAttestations = attestations.filter(a => selectedClients.has(a.client_id))
    const emails = selectedAttestations
      .map(a => a.client?.email)
      .filter(Boolean)

    if (emails.length === 0) {
      toast.warning('Aucun email', 'Les clients sélectionnés n\'ont pas d\'adresse email renseignée.')
      return
    }

    const subject = encodeURIComponent(`${`Attestation fiscale ${selectedYear} — ${brand.name}`}`)
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver ci-joint votre attestation fiscale pour l'année ${selectedYear} relative aux travaux d'entretien de jardins réalisés par ${brand.name}.\n\nCe document vous permet de bénéficier du crédit d'impôt de 50% sur les services à la personne.\n\n${`Cordialement,\n${brand.name}`}`
    )
    window.open(`mailto:${emails.join(',')}?subject=${subject}&body=${body}`, '_blank')
    toast.success('Client mail ouvert', `${emails.length} destinataire(s)`)
  }, [attestations, selectedClients, selectedYear, toast])

  // ---- Year change resets selection ----
  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year)
    setSelectedClients(new Set())
  }, [])

  // ---- Eligible clients not yet in attestation list ----
  const existingClientIds = useMemo(
    () => new Set(attestations.map((a) => a.client_id)),
    [attestations],
  )
  const newEligibleClients = useMemo(
    () => eligibleClients.filter((c) => !existingClientIds.has(c.client_id)),
    [eligibleClients, existingClientIds],
  )

  // ---- Generate from eligible modal ----
  const handleGenerateFromEligible = useCallback(() => {
    if (selectedEligible.size === 0) return
    let completed = 0
    const total = selectedEligible.size
    const clientIds = [...selectedEligible]

    clientIds.forEach((clientId) => {
      generateAttestation.mutate(
        { clientId, year: selectedYear },
        {
          onSuccess: () => {
            completed++
            if (completed === total) {
              toast.success(`${total} attestation(s) generee(s) avec succes`)
              setSelectedEligible(new Set())
              setShowEligibleModal(false)
            }
          },
          onError: () => {
            completed++
            toast.error('Erreur lors de la generation')
          },
        },
      )
    })
  }, [selectedEligible, generateAttestation, selectedYear, toast])

  const toggleEligible = useCallback((clientId: string) => {
    setSelectedEligible((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }, [])

  const selectAllEligible = useCallback(() => {
    if (selectedEligible.size === newEligibleClients.length) {
      setSelectedEligible(new Set())
    } else {
      setSelectedEligible(new Set(newEligibleClients.map((c) => c.client_id)))
    }
  }, [selectedEligible.size, newEligibleClients])

  function eligibleClientName(c: EligibleClient): string {
    const firstName = c.first_name && c.first_name !== 'N/A' ? c.first_name : ''
    const lastName = c.last_name && c.last_name !== 'N/A' ? c.last_name : ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ')
    if (c.company_name) return fullName ? `${c.company_name} — ${fullName}` : c.company_name
    return fullName || '-'
  }

  return (
    <div>
      <PageHeader
        title="Attestations fiscales"
        description={`Generation des attestations pour le credit d'impot de ${TAX_CREDIT_RATE}%`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedEligible(new Set()); setShowEligibleModal(true) }}
              className="flex items-center gap-2 px-3 py-2 border border-emerald-300 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Detecter clients eligibles
            </button>
            <button
              onClick={handleBulkPrint}
              disabled={selectedClients.size === 0}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              Imprimer ({selectedClients.size})
            </button>
            <button
              onClick={handleBulkEmail}
              disabled={selectedClients.size === 0}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Envoyer par email ({selectedClients.size})
            </button>
            <button
              onClick={handleBulkGenerate}
              disabled={selectedClients.size === 0 || generateAttestation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generateAttestation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              Generer ({selectedClients.size})
            </button>
          </div>
        }
      />

      {/* Year Selector & Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
          <Calendar className="w-5 h-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500 mb-1">Annee fiscale</p>
            <div className="flex items-center gap-1">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => handleYearChange(year)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedYear === year
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500">Clients eligibles</span>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {isLoading ? <span className="inline-block w-8 h-6 bg-slate-200 rounded animate-pulse" /> : stats.total}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-slate-500">Deja generees</span>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {isLoading ? <span className="inline-block w-8 h-6 bg-slate-200 rounded animate-pulse" /> : stats.generated}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-slate-500">Restantes</span>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {isLoading ? <span className="inline-block w-8 h-6 bg-slate-200 rounded animate-pulse" /> : stats.remaining}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Attestation List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={
                    selectedClients.size === filteredAttestations.length &&
                    filteredAttestations.length > 0
                  }
                  onChange={selectAll}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                Client
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                Reference
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                Total TTC
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                Main d'oeuvre HT
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                <div className="flex items-center gap-1">
                  <Euro className="w-3 h-3" />
                  Credit d'impot
                </div>
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                Statut
              </th>
              <th className="w-20 px-4 py-3" />
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
            ) : filteredAttestations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucune attestation trouvee pour {selectedYear}
                </td>
              </tr>
            ) : (
              filteredAttestations.map((attestation) => {
                const isGenerated = attestation.is_sent || !!attestation.pdf_url
                return (
                  <tr key={attestation.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedClients.has(attestation.id)}
                        onChange={() => toggleClient(attestation.id)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setPreviewAttestation(attestation)}
                        className="text-left hover:underline"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {clientDisplayName(attestation)}
                        </p>
                        {getClientAddress(attestation) && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {getClientAddress(attestation)}
                          </p>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {attestation.reference ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {currencyFmt.format(attestation.total_amount_ttc)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {currencyFmt.format(attestation.total_labor_ht)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-emerald-700">
                        {currencyFmt.format(attestation.tax_credit_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isGenerated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Generee
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" />
                          A generer
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPreviewAttestation(attestation)}
                          className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                          title="Voir l'attestation"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                        </button>
                        {isGenerated ? (
                          <button
                            onClick={() => handlePrintSingle(attestation)}
                            className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                            title="Telecharger / Imprimer"
                          >
                            <Download className="w-4 h-4 text-slate-400" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGenerate(attestation.client_id)}
                            disabled={generateAttestation.isPending}
                            className="p-1.5 rounded-md bg-primary-50 hover:bg-primary-100 transition-colors disabled:opacity-50"
                            title="Generer l'attestation"
                          >
                            {generateAttestation.isPending ? (
                              <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                            ) : (
                              <FileCheck className="w-4 h-4 text-primary-600" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewAttestation && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setPreviewAttestation(null)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 z-10">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {previewAttestation.reference}
                </h2>
                <p className="text-sm text-slate-500">
                  Attestation fiscale {previewAttestation.fiscal_year} — {clientDisplayName(previewAttestation)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintSingle(previewAttestation)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer / PDF
                </button>
                <button
                  onClick={() => setPreviewAttestation(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Modal content — printable preview */}
            <div ref={printRef} className="p-6">
              <div
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {/* Company header band */}
                <div className="bg-primary-600 text-white px-8 py-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">
                        {previewAttestation.company_name || brand.name}
                      </h1>
                      <p className="text-primary-200 text-sm mt-1">Petits travaux de jardinage</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tracking-tight">ATTESTATION FISCALE</p>
                      <p className="text-primary-200 text-sm mt-1">{previewAttestation.reference}</p>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-6 space-y-6">
                  {/* Year badge + date */}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                      <Calendar className="w-4 h-4" />
                      Annee fiscale {previewAttestation.fiscal_year}
                    </span>
                    <span className="text-sm text-slate-500">
                      Generee le {dateFmt(previewAttestation.created_at)}
                    </span>
                  </div>

                  {/* Company + Client info */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Entreprise prestataire
                      </h3>
                      <p className="text-sm font-bold text-slate-900">
                        {previewAttestation.company_name || brand.name}
                      </p>
                      {previewAttestation.company_siret && (
                        <p className="text-sm text-slate-500 mt-1">SIRET : {previewAttestation.company_siret}</p>
                      )}
                      {previewAttestation.company_address && (
                        <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {previewAttestation.company_address}
                        </p>
                      )}
                      {previewAttestation.company_agrement && (
                        <p className="text-sm text-slate-500 mt-1">
                          Agrement SAP : {previewAttestation.company_agrement}
                        </p>
                      )}
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Client beneficiaire
                      </h3>
                      <p className="text-sm font-bold text-slate-900">
                        {clientDisplayName(previewAttestation)}
                      </p>
                      {(() => {
                        const fName = getClientFullName(previewAttestation)
                        const dName = clientDisplayName(previewAttestation)
                        return fName !== dName ? (
                          <p className="flex items-center gap-2 text-sm text-slate-700 mt-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {fName}
                          </p>
                        ) : null
                      })()}
                      {getClientAddress(previewAttestation) && (
                        <p className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {getClientAddress(previewAttestation)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Summary table */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Recapitulatif des prestations — Annee {previewAttestation.fiscal_year}
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">
                              Montant
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="px-4 py-3 text-sm text-slate-700">
                              Total des prestations reglees (TTC)
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">
                              {currencyFmt.format(previewAttestation.total_amount_ttc)}
                            </td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td className="px-4 py-3 text-sm text-slate-700">
                              Dont main d'oeuvre (HT)
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 text-right">
                              {currencyFmt.format(previewAttestation.total_labor_ht)}
                            </td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-4 py-3 text-sm text-slate-700">
                              Nombre de factures
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 text-right">
                              {previewAttestation.invoice_ids?.length ?? 0}
                            </td>
                          </tr>
                          <tr className="border-t-2 border-slate-200">
                            <td className="px-4 py-3 text-sm font-bold text-emerald-700">
                              Credit d'impot ({TAX_CREDIT_RATE}%)
                            </td>
                            <td className="px-4 py-3 text-base font-bold text-emerald-700 text-right">
                              {currencyFmt.format(previewAttestation.tax_credit_amount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Legal mention */}
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Mention legale</p>
                    <p className="text-xs text-emerald-700">
                      La presente attestation est etablie conformement aux dispositions de l'article 199 sexdecies du Code General des Impots.
                      Les prestations de services a la personne (jardinage) ouvrent droit a un credit d'impot de {TAX_CREDIT_RATE}% des depenses engagees,
                      dans la limite de 5 000 € de depenses par an et par foyer fiscal (soit un credit d'impot maximum de 2 500 €).
                    </p>
                  </div>

                  {/* Signature section */}
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div>
                      <p className="text-xs text-slate-500">Fait a ________________</p>
                      <p className="text-xs text-slate-500 mt-1">Le {dateFmt(previewAttestation.created_at)}</p>
                      <div className="border-t border-slate-300 mt-12 pt-2">
                        <p className="text-xs text-slate-400">Signature et cachet de l'entreprise</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Le client,</p>
                      <p className="text-xs text-slate-500 mt-1">{clientDisplayName(previewAttestation)}</p>
                      <div className="border-t border-slate-300 mt-12 pt-2">
                        <p className="text-xs text-slate-400">Signature du client</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eligible Clients Modal */}
      {showEligibleModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowEligibleModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Clients eligibles — {selectedYear}
                </h2>
                <p className="text-sm text-slate-500">
                  Clients ayant des factures payees avec credit d'impot en {selectedYear}
                </p>
              </div>
              <button
                onClick={() => setShowEligibleModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6">
              {eligibleLoading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                  <span className="text-sm text-slate-500">Recherche des clients eligibles...</span>
                </div>
              ) : newEligibleClients.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">Tous les clients eligibles ont deja une attestation</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {eligibleClients.length} client(s) eligible(s) detecte(s), tous deja traites
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      <span className="font-bold text-emerald-700">{newEligibleClients.length}</span> nouveau(x) client(s) eligible(s) detecte(s)
                      {existingClientIds.size > 0 && (
                        <span className="text-slate-400"> ({existingClientIds.size} deja traite(s))</span>
                      )}
                    </p>
                    <button
                      onClick={selectAllEligible}
                      className="text-xs text-primary-600 hover:underline font-medium"
                    >
                      {selectedEligible.size === newEligibleClients.length ? 'Tout deselectionner' : 'Tout selectionner'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0">
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2.5 w-10">
                            <input
                              type="checkbox"
                              checked={selectedEligible.size === newEligibleClients.length && newEligibleClients.length > 0}
                              onChange={selectAllEligible}
                              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Factures</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total TTC</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">MO HT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {newEligibleClients.map((client) => (
                          <tr key={client.client_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedEligible.has(client.client_id)}
                                onChange={() => toggleEligible(client.client_id)}
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900">{eligibleClientName(client)}</p>
                              {client.city && (
                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {[client.postal_code, client.city].filter(Boolean).join(' ')}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 text-right">{client.invoice_count}</td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">{currencyFmt.format(client.total_ttc)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 text-right">{currencyFmt.format(client.total_labor_ht)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setShowEligibleModal(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleGenerateFromEligible}
                      disabled={selectedEligible.size === 0 || generateAttestation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generateAttestation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileCheck className="w-4 h-4" />
                      )}
                      Generer {selectedEligible.size} attestation(s)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
