import { brand } from '../../../config/brand'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eraser,
  FileText,
  Leaf,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Types for the quote data returned by the Edge Function
// ---------------------------------------------------------------------------
interface SignQuoteLine {
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  tva_rate: number
  total_ht: number
  total_ttc: number
  is_labor: boolean
  sort_order: number
}

interface SignQuoteData {
  reference: string
  title: string
  description: string | null
  issue_date: string
  validity_date: string | null
  subtotal_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  discount_percentage: number
  discount_amount: number
  eligible_tax_credit: boolean
  tax_credit_amount: number
  net_after_credit: number
  payment_terms: string | null
  special_conditions: string | null
  client: {
    company_name: string | null
    first_name: string | null
    last_name: string | null
    address_line1: string | null
    postal_code: string | null
    city: string | null
  } | null
  lines: SignQuoteLine[]
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
// Signature Pad (self-contained for the public page)
// ---------------------------------------------------------------------------
function InlineSignaturePad({
  onSign,
  disabled,
}: {
  onSign: (base64: string) => void
  disabled: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)

    return () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = 0
      canvas.height = 0
    }
  }, [])

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }, [])

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [getPos])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasContent(true)
  }, [isDrawing, getPos])

  const endDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setIsDrawing(false)
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasContent(false)
  }, [])

  const handleSign = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const base64 = canvas.toDataURL('image/png')
    onSign(base64)
  }, [onSign])

  return (
    <div>
      <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 180 }}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
      </div>
      <p className="text-xs text-slate-400 text-center mt-1.5">
        Signez avec votre souris ou votre doigt dans le cadre ci-dessus
      </p>
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Eraser className="w-4 h-4" />
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSign}
          disabled={!hasContent || disabled}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Signer et accepter le devis
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function QuoteSignPage() {
  const { token } = useParams<{ token: string }>()
  const [quote, setQuote] = useState<SignQuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)

  // Fetch quote data
  useEffect(() => {
    if (!token) {
      setError('Lien invalide.')
      setLoading(false)
      return
    }

    const fetchQuote = async () => {
      try {
        await supabase.functions.invoke('sign-quote', {
          method: 'GET',
          body: undefined,
          headers: { 'Content-Type': 'application/json' },
        })

        // The Edge Function uses GET with query params, but supabase.functions.invoke
        // always uses POST. We need to call the function URL directly.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
        const response = await fetch(
          `${supabaseUrl}/functions/v1/sign-quote?token=${token}`,
          {
            method: 'GET',
            headers: {
              'apikey': anonKey,
              'Content-Type': 'application/json',
            },
          },
        )

        const result = await response.json()

        if (!response.ok) {
          setErrorType(result.error)
          setError(result.message || result.error || 'Erreur inconnue')
          setLoading(false)
          return
        }

        setQuote(result)
        setLoading(false)
      } catch {
        setError('Impossible de charger le devis.')
        setLoading(false)
      }
    }

    fetchQuote()
  }, [token])

  const handleSign = async (signatureBase64: string) => {
    if (!token || !accepted) return
    setSigning(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const response = await fetch(
        `${supabaseUrl}/functions/v1/sign-quote`,
        {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            signature_base64: signatureBase64,
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Erreur lors de la signature.')
        setSigning(false)
        return
      }

      setSigned(true)
    } catch {
      setError('Erreur lors de la signature. Veuillez réessayer.')
    } finally {
      setSigning(false)
    }
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Chargement du devis...</p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (error && !quote) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {errorType === 'already_signed' ? 'Devis déjà signé' : errorType === 'expired' ? 'Lien expiré' : 'Lien invalide'}
          </h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Success state (after signing)
  // -------------------------------------------------------------------------
  if (signed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Devis signé avec succès !</h1>
          <p className="text-sm text-slate-500 mb-1">
            Votre signature a bien été enregistrée pour le devis <strong>{quote?.reference}</strong>.
          </p>
          <p className="text-sm text-slate-500">
            Un email de confirmation a été envoyé. Merci pour votre confiance !
          </p>
        </div>
      </div>
    )
  }

  if (!quote) return null

  const clientName = quote.client?.company_name
    || [quote.client?.first_name, quote.client?.last_name].filter(Boolean).join(' ')
    || 'Client'

  // -------------------------------------------------------------------------
  // Quote preview + signing form
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <Leaf className="w-7 h-7" />
            <div>
              <h1 className="text-lg font-bold">{brand.name}</h1>
              <p className="text-emerald-200 text-xs">Petits travaux de jardinage</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 space-y-6">
        {/* Quote info card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-bold text-slate-900">{quote.reference}</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                En attente de signature
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">{quote.title}</p>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Dates */}
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span>Émis le {formatDate(quote.issue_date)}</span>
              {quote.validity_date && (
                <span>Valide jusqu'au {formatDate(quote.validity_date)}</span>
              )}
            </div>

            {/* Client info */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Destinataire</p>
              <p className="text-sm font-semibold text-slate-900">{clientName}</p>
              {quote.client?.address_line1 && (
                <p className="text-sm text-slate-500 mt-1">
                  {quote.client.address_line1}{quote.client.postal_code || quote.client.city ? `, ${[quote.client.postal_code, quote.client.city].filter(Boolean).join(' ')}` : ''}
                </p>
              )}
            </div>

            {/* Description */}
            {quote.description && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-600">{quote.description}</p>
              </div>
            )}

            {/* Lines table */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Prestations</p>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Description</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase w-16">Qté</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-24">PU HT</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-24">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lines.map((line, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-3 text-sm text-slate-700">{line.description}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 text-center">{line.quantity} {line.unit}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatAmount(line.unit_price_ht)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{formatAmount(line.total_ht)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
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
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Conditions de paiement</p>
                    <p className="text-sm text-slate-600">{quote.payment_terms}</p>
                  </div>
                )}
                {quote.special_conditions && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Conditions particulières</p>
                    <p className="text-sm text-slate-600">{quote.special_conditions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tax credit mention */}
            {quote.eligible_tax_credit && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-700">
                  Services de jardinage éligibles au crédit d'impôt de 50% au titre de l'article 199 sexdecies du Code Général des Impôts
                  (plafond de 5 000 € de dépenses par an et par foyer fiscal).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Signature section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
            Signature électronique
          </h3>

          {/* Acceptance checkbox */}
          <label className="flex items-start gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">
              J'ai lu et j'accepte les conditions du devis <strong>{quote.reference}</strong> pour un montant total TTC de <strong>{formatAmount(quote.total_ttc)}</strong>.
            </span>
          </label>

          {/* Signature pad */}
          {accepted ? (
            <InlineSignaturePad onSign={handleSign} disabled={signing} />
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center" style={{ height: 180 }}>
              <p className="text-sm text-slate-400">Cochez la case ci-dessus pour activer la signature</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-xs text-slate-400">
            {brand.name} — Signature électronique sécurisée
          </p>
        </div>
      </main>
    </div>
  )
}
