import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Loader2, X } from 'lucide-react'
import { useGenerateAiContent } from '../../queries/useAiContent'
import type { AiContentContext, AiContentAction } from '../../types'

// ---------------------------------------------------------------------------
// Default prompts per context
// ---------------------------------------------------------------------------

const defaultPrompts: Record<AiContentContext, string> = {
  newsletter_subject: "Génère un objet d'email accrocheur pour cette newsletter",
  newsletter_intro: 'Rédige une introduction accueillante pour cette newsletter',
  newsletter_body: 'Rédige le contenu principal de cette newsletter',
  newsletter_cta: "Génère un texte court pour le bouton d'appel à l'action",
  newsletter_section: "Rédige le contenu de cette section d'actualité",
  quote_description: 'Génère une description professionnelle pour cette prestation de paysagisme',
  quote_conditions: 'Rédige les conditions particulières pour ce devis de paysagisme',
  freeform: 'Génère un texte professionnel',
}

const placeholders: Record<AiContentContext, string> = {
  newsletter_subject: "Ex: newsletter saisonnière sur l'entretien de printemps...",
  newsletter_intro: 'Décrivez le thème de la newsletter...',
  newsletter_body: 'Décrivez le sujet principal...',
  newsletter_cta: "Ex: inciter à prendre rendez-vous, demander un devis...",
  newsletter_section: "Décrivez le sujet de cette section d'actualité...",
  quote_description: 'Ex: taille de haies, entretien pelouse, élagage...',
  quote_conditions: 'Ex: travaux éligibles crédit impôt, accès chantier...',
  freeform: 'Décrivez ce que vous souhaitez rédiger...',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AiAssistButtonProps {
  context: AiContentContext
  currentValue: string
  onApply: (generatedText: string) => void
  metadata?: Record<string, unknown>
  className?: string
}

export function AiAssistButton({ context, currentValue, onApply, metadata, className }: AiAssistButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const mutation = useGenerateAiContent()

  const POPOVER_WIDTH = 380

  // Position the popover when opened
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceRight = window.innerWidth - rect.left
    const left = spaceRight >= POPOVER_WIDTH + 16
      ? rect.left
      : Math.max(16, window.innerWidth - POPOVER_WIDTH - 16)
    setPopoverPos({ top: rect.bottom + 6, left })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleAction(action: AiContentAction) {
    mutation.mutate(
      {
        context,
        prompt: prompt || defaultPrompts[context],
        current_text: action !== 'generate' ? currentValue : undefined,
        action,
        metadata,
      },
      {
        onSuccess: (data) => {
          setGeneratedText(data.generated_text)
        },
      },
    )
  }

  function handleApply() {
    onApply(generatedText)
    setIsOpen(false)
    setPrompt('')
    setGeneratedText('')
    mutation.reset()
  }

  function handleClose() {
    setIsOpen(false)
    setPrompt('')
    setGeneratedText('')
    mutation.reset()
  }

  const hasCurrentText = currentValue.trim().length > 0

  const popover = isOpen
    ? createPortal(
        <div
          ref={popoverRef}
          className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999]"
          style={{ top: popoverPos.top, left: popoverPos.left, width: POPOVER_WIDTH }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-violet-50 rounded-t-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
              <Sparkles className="w-4 h-4" />
              Assistant IA
            </div>
            <button type="button" onClick={handleClose} className="p-1 rounded hover:bg-violet-100 transition-colors">
              <X className="w-4 h-4 text-violet-400" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Prompt input */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholders[context]}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAction('generate')}
                disabled={mutation.isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                Générer
              </button>
              {hasCurrentText && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAction('improve')}
                    disabled={mutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Améliorer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('shorten')}
                    disabled={mutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Raccourcir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('lengthen')}
                    disabled={mutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Rallonger
                  </button>
                </>
              )}
            </div>

            {/* Loading state */}
            {mutation.isPending && (
              <div className="flex items-center gap-2 py-3 text-sm text-violet-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération en cours...
              </div>
            )}

            {/* Error state */}
            {mutation.isError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                Erreur : {(mutation.error as Error).message}
              </p>
            )}

            {/* Generated text preview */}
            {generatedText && !mutation.isPending && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Résultat</p>
                <div className="max-h-[180px] overflow-y-auto px-3 py-2 text-sm text-slate-800 bg-violet-50 border border-violet-200 rounded-lg whitespace-pre-wrap">
                  {generatedText}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedText('')
                      mutation.reset()
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Régénérer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className={`inline-flex ${className ?? ''}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-all"
        title="Assistance IA"
      >
        <Sparkles className="w-3.5 h-3.5" />
        IA
      </button>
      {popover}
    </div>
  )
}
