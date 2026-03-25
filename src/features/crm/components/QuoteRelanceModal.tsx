import { useState, useCallback } from 'react'
import DOMPurify from 'dompurify'
import {
  Copy,
  Mail,
  Sparkles,
  Loader2,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useQuote } from '../../../queries/useBilling'
import {
  useRelancesForQuote,
  useGenerateQuoteRelance,
  useCancelQuoteRelance,
} from '../../../queries/useQuoteRelance'
import type { QuoteRelance, QuoteRelanceTone } from '../../../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface QuoteRelanceModalProps {
  quoteId: string
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Tone options
// ---------------------------------------------------------------------------
const toneOptions: Array<{ value: QuoteRelanceTone; label: string; description: string }> = [
  { value: 'professionnel', label: 'Professionnel', description: 'Formel et courtois' },
  { value: 'amical', label: 'Amical', description: 'Décontracté et chaleureux' },
  { value: 'urgent', label: 'Urgent', description: 'Insistant avec limite temporelle' },
  { value: 'relance_douce', label: 'Relance douce', description: 'Simple rappel bienveillant' },
]

// ---------------------------------------------------------------------------
// Status badge for relance history
// ---------------------------------------------------------------------------
const relanceStatusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  generated: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600', icon: FileText },
  edited: { label: 'Modifié', className: 'bg-blue-100 text-blue-600', icon: FileText },
  sent: { label: 'Envoyé', className: 'bg-emerald-100 text-emerald-600', icon: CheckCircle2 },
  cancelled: { label: 'Annulé', className: 'bg-slate-100 text-slate-400', icon: XCircle },
}

// ---------------------------------------------------------------------------
// Helper: strip HTML tags for plain text copy
// ---------------------------------------------------------------------------
function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = DOMPurify.sanitize(html)
  return div.textContent ?? div.innerText ?? ''
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuoteRelanceModal({ quoteId, isOpen, onClose }: QuoteRelanceModalProps) {
  const toast = useToast()

  // Data
  const { data: quote } = useQuote(isOpen ? quoteId : undefined)
  const { data: relances = [] } = useRelancesForQuote(isOpen ? quoteId : undefined)

  // Mutations
  const generateMutation = useGenerateQuoteRelance()
  const cancelMutation = useCancelQuoteRelance()

  // Local state
  const [tone, setTone] = useState<QuoteRelanceTone>('professionnel')
  const [customInstructions, setCustomInstructions] = useState('')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [currentDraft, setCurrentDraft] = useState<QuoteRelance | null>(null)

  // Handlers
  const handleGenerate = useCallback(async () => {
    try {
      const result = await generateMutation.mutateAsync({
        quote_id: quoteId,
        tone,
        custom_instructions: customInstructions || undefined,
      })
      setCurrentDraft(result.relance)
      setEditedSubject(result.relance.subject)
      setEditedBody(result.relance.body_html)
      toast.success('Relance générée', "L'email de relance a été généré par l'IA.")
    } catch (err) {
      toast.error('Erreur génération', (err as Error).message)
    }
  }, [quoteId, tone, customInstructions, generateMutation, toast])

  const handleCopyAll = useCallback(async () => {
    const textContent = `Objet : ${editedSubject}\n\n${htmlToPlainText(editedBody)}`
    try {
      await navigator.clipboard.writeText(textContent)
      toast.success('Copié', "L'objet et le contenu ont été copiés dans le presse-papier.")
    } catch {
      toast.error('Erreur', 'Impossible de copier dans le presse-papier.')
    }
  }, [editedSubject, editedBody, toast])

  const handleOpenMailto = useCallback(() => {
    const plainBody = htmlToPlainText(editedBody)
    const mailto = `mailto:${currentDraft?.recipient_email ?? ''}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(plainBody)}`
    window.open(mailto, '_blank')
  }, [editedSubject, editedBody, currentDraft])

  const handleCancel = useCallback(async () => {
    if (!currentDraft) return
    try {
      await cancelMutation.mutateAsync(currentDraft.id)
      setCurrentDraft(null)
      setEditedSubject('')
      setEditedBody('')
    } catch (err) {
      toast.error('Erreur', (err as Error).message)
    }
  }, [currentDraft, cancelMutation, toast])

  const handleClose = useCallback(() => {
    setCurrentDraft(null)
    setEditedSubject('')
    setEditedBody('')
    setCustomInstructions('')
    onClose()
  }, [onClose])

  // Computed
  const daysSinceSent = quote
    ? Math.floor(
        (Date.now() - new Date(quote.updated_at).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0

  return (
    <Modal open={isOpen} onClose={handleClose} size="lg">
      <ModalHeader
        title="Relancer le devis"
        description={quote ? `${quote.reference} — ${quote.title}` : undefined}
        onClose={handleClose}
      />

      <div className="px-6 pb-4 space-y-5">
        {/* Quote summary */}
        {quote && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{quote.reference}</span>
            </div>
            <span className="text-sm text-slate-500">|</span>
            <span className="text-sm font-semibold text-slate-900">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(quote.total_ttc)}
            </span>
            {quote.eligible_tax_credit && (
              <>
                <span className="text-sm text-slate-500">|</span>
                <span className="text-xs text-emerald-600 font-medium">
                  Après crédit : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(quote.net_after_credit)}
                </span>
              </>
            )}
            <span className="text-sm text-slate-500">|</span>
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="w-3 h-3" />
              Envoyé il y a {daysSinceSent} jour{daysSinceSent > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Previous relances */}
        {relances.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Relances précédentes ({relances.length})
            </h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {relances.map((r) => {
                const cfg = relanceStatusConfig[r.status] ?? relanceStatusConfig.generated
                const Icon = cfg.icon
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-white border border-slate-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-slate-400 font-mono">#{r.relance_number}</span>
                      <span className="text-sm text-slate-700 truncate">{r.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.className}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Generation form (only when no draft exists) */}
        {!currentDraft && (
          <div className="space-y-4">
            {/* Tone selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Ton de l'email
              </label>
              <div className="grid grid-cols-2 gap-2">
                {toneOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                      tone === opt.value
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${tone === opt.value ? 'text-primary-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </span>
                    <span className="text-xs text-slate-500">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom instructions */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Instructions personnalisées <span className="font-normal">(optionnel)</span>
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Ex: Mentionner la promotion en cours, insister sur la date de validité..."
                className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Draft preview (when a draft exists) */}
        {currentDraft && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Aperçu de la relance
              </h4>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Objet</label>
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
              />
            </div>

            {/* Body HTML preview */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Corps de l'email</label>
              <div
                className="w-full min-h-[200px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm rounded-lg border border-slate-200 bg-white prose prose-sm prose-slate"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setEditedBody(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editedBody) }}
              />
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Mail className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                Copiez le contenu ci-dessus puis envoyez-le manuellement depuis votre messagerie.
              </p>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        {!currentDraft ? (
          <>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generateMutation.isPending ? 'Génération en cours...' : 'Générer la relance'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Annuler le brouillon
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Regénérer
            </button>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copier
            </button>
            <button
              onClick={handleOpenMailto}
              disabled={!editedSubject.trim() || !editedBody.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Ouvrir dans ma messagerie
            </button>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}
