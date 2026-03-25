import { brand } from '../../../config/brand'
import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Printer,
  CalendarCheck,
  Euro,
  Clock,
  Receipt,
  Leaf,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { PageHeader } from '../../../components/layout/PageHeader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AnnualIntervention {
  id: string
  reference: string | null
  scheduled_date: string | null
  intervention_type: string | null
  estimated_duration_minutes: number | null
  actual_duration_minutes: number | null
  status: string
  address_line1: string | null
  city: string | null
}

interface AnnualInvoice {
  id: string
  reference: string | null
  issue_date: string | null
  paid_date: string | null
  total_ttc: number
  subtotal_ht: number
  tva_amount: number
  tax_credit_amount: number | null
  eligible_tax_credit: boolean
  status: string
}

interface AnnualReport {
  client: {
    id: string
    first_name: string
    last_name: string
    company_name: string | null
    address_line1: string | null
    postal_code: string | null
    city: string | null
    email: string | null
    phone: string | null
    eligible_tax_credit: boolean
    client_type: string | null
  }
  interventions: AnnualIntervention[]
  invoices: AnnualInvoice[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
async function getClientAnnualReport(clientId: string, year: number): Promise<AnnualReport> {
  const [clientRes, interventionRes, invoiceRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, first_name, last_name, company_name, address_line1, postal_code, city, email, phone, eligible_tax_credit, client_type')
      .eq('id', clientId)
      .single(),

    supabase
      .from('chantiers')
      .select('id, reference, scheduled_date, intervention_type, estimated_duration_minutes, actual_duration_minutes, status, address_line1, city')
      .eq('client_id', clientId)
      .gte('scheduled_date', `${year}-01-01`)
      .lte('scheduled_date', `${year}-12-31`)
      .order('scheduled_date', { ascending: true }),

    supabase
      .from('invoices')
      .select('id, reference, issue_date, paid_date, total_ttc, subtotal_ht, tva_amount, tax_credit_amount, eligible_tax_credit, status')
      .eq('client_id', clientId)
      .gte('issue_date', `${year}-01-01`)
      .lte('issue_date', `${year}-12-31`)
      .order('issue_date', { ascending: true }),
  ])

  if (clientRes.error) throw clientRes.error
  if (interventionRes.error) throw interventionRes.error
  if (invoiceRes.error) throw invoiceRes.error

  return {
    client: clientRes.data,
    interventions: interventionRes.data ?? [],
    invoices: invoiceRes.data ?? [],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR')
}

function fmtMoney(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function fmtDuration(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

const STATUS_LABELS: Record<string, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
  payee: 'Payée',
  en_attente: 'En attente',
  partiellement_payee: 'Part. payée',
}

const CURRENT_YEAR = new Date().getFullYear()

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ClientAnnualReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)
  const [year, setYear] = useState(CURRENT_YEAR)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['clientAnnualReport', id, year],
    queryFn: () => getClientAnnualReport(id!, year),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const handlePrint = () => window.print()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p>Impossible de charger le bilan.</p>
      </div>
    )
  }

  const { client, interventions, invoices } = data
  const clientName = client.company_name || `${client.first_name} ${client.last_name}`

  // KPIs
  const doneInterventions = interventions.filter(i => i.status === 'terminee')
  const totalEstimatedMin = doneInterventions.reduce((s, i) => s + (i.estimated_duration_minutes ?? 0), 0)
  const totalActualMin = doneInterventions.reduce((s, i) => s + (i.actual_duration_minutes ?? 0), 0)
  const totalHours = fmtDuration(totalActualMin || totalEstimatedMin)

  const paidInvoices = invoices.filter(i => i.status === 'payee' || i.status === 'partiellement_payee')
  const totalTtc = paidInvoices.reduce((s, i) => s + i.total_ttc, 0)
  const totalHt = paidInvoices.reduce((s, i) => s + i.subtotal_ht, 0)
  const totalTaxCredit = paidInvoices.reduce((s, i) => s + (i.tax_credit_amount ?? 0), 0)
  const netAfterCredit = totalTtc - totalTaxCredit

  const years = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]

  return (
    <div>
      {/* Screen header — hidden in print */}
      <div className="print:hidden">
        <PageHeader
          title={`Bilan annuel — ${clientName}`}
          description={`Récapitulatif des prestations et de la facturation ${year}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/crm/clients/${id}`)}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>
              <div className="relative">
                <select
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value))}
                  className="appearance-none pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimer / PDF
              </button>
            </div>
          }
        />
      </div>

      {/* Printable content */}
      <div ref={printRef} className="space-y-6 print:space-y-4">

        {/* Print-only header */}
        <div className="hidden print:block mb-6">
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Bilan annuel {year}</h1>
              <p className="text-slate-600 mt-1">{brand.name} — {brand.sector}</p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>Édité le {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{clientName}</h2>
            {(client.address_line1 || client.city) && (
              <p className="text-sm text-slate-600">{[client.address_line1, client.postal_code, client.city].filter(Boolean).join(', ')}</p>
            )}
            {client.email && <p className="text-sm text-slate-600">{client.email}</p>}
          </div>
        </div>

        {/* Client info card — screen only */}
        <div className="print:hidden bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <Leaf className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{clientName}</h2>
            {(client.address_line1 || client.city) && (
              <p className="text-sm text-slate-500">{[client.address_line1, client.postal_code, client.city].filter(Boolean).join(', ')}</p>
            )}
            {client.email && <p className="text-sm text-slate-500">{client.email}</p>}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Interventions réalisées"
            value={String(doneInterventions.length)}
            sub={`/ ${interventions.length} planifiées`}
            icon={CalendarCheck}
            color="bg-emerald-50 text-emerald-600"
          />
          <KpiCard
            label="Heures de travail"
            value={totalHours}
            sub={totalActualMin ? 'heures réelles' : 'heures estimées'}
            icon={Clock}
            color="bg-blue-50 text-blue-600"
          />
          <KpiCard
            label="Montant facturé TTC"
            value={fmtMoney(totalTtc)}
            sub={`HT : ${fmtMoney(totalHt)}`}
            icon={Euro}
            color="bg-primary-50 text-primary-600"
          />
          <KpiCard
            label="Crédit d'impôt 50%"
            value={fmtMoney(totalTaxCredit)}
            sub={`Net : ${fmtMoney(netAfterCredit)}`}
            icon={Receipt}
            color="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Interventions table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-300">
          <div className="px-5 py-4 border-b border-slate-100 print:border-slate-300">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-slate-400 print:hidden" />
              Interventions {year}
              <span className="ml-1 text-xs font-normal text-slate-400">({interventions.length})</span>
            </h3>
          </div>
          {interventions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Aucune intervention pour {year}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 print:border-slate-300">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Lieu</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Durée</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                  {interventions.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="px-5 py-2.5 font-medium text-slate-800">{fmt(i.scheduled_date)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{i.intervention_type ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{[i.address_line1, i.city].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {fmtDuration(i.actual_duration_minutes ?? i.estimated_duration_minutes)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full print:bg-transparent print:text-slate-600 ${
                          i.status === 'terminee' ? 'bg-emerald-100 text-emerald-700' :
                          i.status === 'annulee' ? 'bg-red-100 text-red-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {STATUS_LABELS[i.status] ?? i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Invoices table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-300">
          <div className="px-5 py-4 border-b border-slate-100 print:border-slate-300">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400 print:hidden" />
              Facturation {year}
              <span className="ml-1 text-xs font-normal text-slate-400">({invoices.length})</span>
            </h3>
          </div>
          {invoices.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Aucune facture pour {year}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 print:border-slate-300">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase">Référence</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Date</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Montant HT</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">TVA</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">TTC</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Crédit impôt</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{inv.reference ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{fmt(inv.issue_date)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmtMoney(inv.subtotal_ht)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{fmtMoney(inv.tva_amount)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmtMoney(inv.total_ttc)}</td>
                      <td className="px-4 py-2.5 text-right text-violet-700 font-medium">
                        {inv.eligible_tax_credit ? fmtMoney(inv.tax_credit_amount ?? 0) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full print:bg-transparent print:text-slate-600 ${
                          inv.status === 'payee' ? 'bg-emerald-100 text-emerald-700' :
                          inv.status === 'partiellement_payee' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                {invoices.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 print:border-slate-400 font-semibold bg-slate-50 print:bg-transparent">
                      <td className="px-5 py-3 text-slate-700" colSpan={2}>Total {year}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(totalHt)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtMoney(invoices.reduce((s, i) => s + i.tva_amount, 0))}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{fmtMoney(totalTtc)}</td>
                      <td className="px-4 py-3 text-right text-violet-700">{fmtMoney(totalTaxCredit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Tax credit attestation notice */}
        {totalTaxCredit > 0 && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 print:border print:border-slate-300">
            <h4 className="text-sm font-semibold text-violet-900 mb-2">Attestation crédit d'impôt</h4>
            <p className="text-sm text-violet-800">
              Conformément à l'article 199 sexdecies du CGI, les services à domicile réalisés par {brand.name}
              ouvrent droit à un crédit d'impôt de 50% sur les dépenses engagées.
            </p>
            <p className="text-sm font-semibold text-violet-900 mt-2">
              Montant total des dépenses éligibles en {year} : {fmtMoney(totalTtc)}<br />
              Crédit d'impôt estimé (50%) : {fmtMoney(totalTaxCredit)}
            </p>
            <p className="text-xs text-violet-600 mt-2">
              Ce document est établi à titre indicatif. Conservez vos factures originales pour votre déclaration fiscale.
            </p>
          </div>
        )}

        {/* Print footer */}
        <div className="hidden print:block text-center text-xs text-slate-400 border-t border-slate-200 pt-4 mt-8">
          {brand.name} — {brand.sector} — Document généré le {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------
function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof CalendarCheck
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 print:shadow-none print:border print:border-slate-300">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 print:hidden ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
