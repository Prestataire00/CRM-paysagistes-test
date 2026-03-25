import { useState, useCallback } from 'react'
import {
  Sparkles,
  Send,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { Modal, ModalHeader, ModalFooter } from '../../../../components/feedback/Modal'
import { Button } from '../../../../components/ui/Button'
import { Select } from '../../../../components/ui/Select'
import { useGenerateRelance, useSendRelance } from '../../../../queries/useRelance'
import { useToast } from '../../../../components/feedback/ToastProvider'
import type { ProspectWithMeta, RelanceTone, RelanceEmail } from '../../../../types'

interface BatchRelanceModalProps {
  open: boolean
  onClose: () => void
  inactiveProspects: ProspectWithMeta[]
}

const toneOptions = [
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'amical', label: 'Amical' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'relance_douce', label: 'Relance douce' },
]

type ProspectStatus = 'pending' | 'generating' | 'generated' | 'sending' | 'sent' | 'error'

interface ProspectBatchState {
  prospect: ProspectWithMeta
  status: ProspectStatus
  relance: RelanceEmail | null
  error: string | null
}

export function BatchRelanceModal({
  open,
  onClose,
  inactiveProspects,
}: BatchRelanceModalProps) {
  const toast = useToast()
  const generateMutation = useGenerateRelance()
  const sendMutation = useSendRelance()

  const [tone, setTone] = useState<RelanceTone>('professionnel')
  const [selected, setSelected] = useState<Set<string>>(() => {
    const withEmail = inactiveProspects.filter((p) => p.email)
    return new Set(withEmail.map((p) => p.id))
  })
  const [batchState, setBatchState] = useState<Map<string, ProspectBatchState>>(
    new Map(),
  )
  const [isProcessing, setIsProcessing] = useState(false)

  const toggleSelect = useCallback((prospectId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(prospectId)) {
        next.delete(prospectId)
      } else {
        next.add(prospectId)
      }
      return next
    })
  }, [])

  const generatedCount = Array.from(batchState.values()).filter(
    (s) => s.status === 'generated' || s.status === 'sent',
  ).length
  const sentCount = Array.from(batchState.values()).filter(
    (s) => s.status === 'sent',
  ).length
  const errorCount = Array.from(batchState.values()).filter(
    (s) => s.status === 'error',
  ).length

  async function handleGenerateAll() {
    setIsProcessing(true)
    const selectedProspects = inactiveProspects.filter((p) =>
      selected.has(p.id),
    )

    for (const prospect of selectedProspects) {
      setBatchState((prev) => {
        const next = new Map(prev)
        next.set(prospect.id, {
          prospect,
          status: 'generating',
          relance: null,
          error: null,
        })
        return next
      })

      try {
        const result = await generateMutation.mutateAsync({
          prospect_id: prospect.id,
          tone,
        })
        setBatchState((prev) => {
          const next = new Map(prev)
          next.set(prospect.id, {
            prospect,
            status: 'generated',
            relance: result.relance,
            error: null,
          })
          return next
        })
      } catch (err) {
        setBatchState((prev) => {
          const next = new Map(prev)
          next.set(prospect.id, {
            prospect,
            status: 'error',
            relance: null,
            error: (err as Error).message,
          })
          return next
        })
      }

      // Small delay between API calls
      await new Promise((r) => setTimeout(r, 500))
    }

    setIsProcessing(false)
    toast.success(`${generatedCount} emails generes`)
  }

  async function handleSendAll() {
    setIsProcessing(true)
    const toSend = Array.from(batchState.values()).filter(
      (s) => s.status === 'generated' && s.relance,
    )

    for (const item of toSend) {
      setBatchState((prev) => {
        const next = new Map(prev)
        next.set(item.prospect.id, { ...item, status: 'sending' })
        return next
      })

      try {
        await sendMutation.mutateAsync({
          relance_id: item.relance!.id,
        })
        setBatchState((prev) => {
          const next = new Map(prev)
          next.set(item.prospect.id, { ...item, status: 'sent' })
          return next
        })
      } catch (err) {
        setBatchState((prev) => {
          const next = new Map(prev)
          next.set(item.prospect.id, {
            ...item,
            status: 'error',
            error: (err as Error).message,
          })
          return next
        })
      }

      await new Promise((r) => setTimeout(r, 300))
    }

    setIsProcessing(false)
    toast.success('Relances envoyees')
  }

  const hasGenerated = generatedCount > 0
  const allSent = sentCount === selected.size && sentCount > 0

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader
        title="Relance groupee"
        description={`${inactiveProspects.length} prospect${inactiveProspects.length > 1 ? 's' : ''} inactif${inactiveProspects.length > 1 ? 's' : ''}`}
        onClose={onClose}
      />

      <div className="px-6 pb-4">
        {/* Tone selector */}
        <div className="flex items-end gap-3 mb-4">
          <div className="w-44">
            <Select
              label="Ton des emails"
              options={toneOptions}
              value={tone}
              onChange={(e) => setTone(e.target.value as RelanceTone)}
            />
          </div>
          {batchState.size > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-500 pb-2">
              <span>
                Generes : <strong>{generatedCount}</strong>/{selected.size}
              </span>
              <span>
                Envoyes : <strong>{sentCount}</strong>/{generatedCount}
              </span>
              {errorCount > 0 && (
                <span className="text-red-500">
                  Erreurs : <strong>{errorCount}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Prospect list */}
        <div className="max-h-80 overflow-y-auto space-y-1 rounded-lg border border-slate-200">
          {inactiveProspects.map((prospect) => {
            const hasEmail = !!prospect.email
            const state = batchState.get(prospect.id)
            const isChecked = selected.has(prospect.id)

            return (
              <div
                key={prospect.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  hasEmail
                    ? 'hover:bg-slate-50'
                    : 'bg-slate-50/50 opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={!hasEmail || isProcessing}
                  onChange={() => toggleSelect(prospect.id)}
                  className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {prospect.company_name ||
                      `${prospect.first_name} ${prospect.last_name}`}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {hasEmail ? prospect.email : 'Pas d\'email'}
                  </p>
                </div>

                {/* Status indicator */}
                {state && (
                  <div className="shrink-0">
                    {state.status === 'generating' && (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    )}
                    {state.status === 'generated' && (
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                        Pret
                      </span>
                    )}
                    {state.status === 'sending' && (
                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    )}
                    {state.status === 'sent' && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                    {state.status === 'error' && (
                      <span title={state.error ?? ''}>
                        <X className="w-4 h-4 text-red-500" />
                      </span>
                    )}
                  </div>
                )}

                {/* Subject preview */}
                {state?.relance?.subject && (
                  <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                    {state.relance.subject}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {inactiveProspects.some((p) => !p.email) && (
          <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Les prospects sans email sont exclus automatiquement.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
          Fermer
        </Button>
        {!hasGenerated ? (
          <Button
            onClick={handleGenerateAll}
            loading={isProcessing}
            disabled={selected.size === 0}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Generer {selected.size} email{selected.size > 1 ? 's' : ''}
          </Button>
        ) : !allSent ? (
          <Button
            onClick={handleSendAll}
            loading={isProcessing}
            disabled={generatedCount === 0}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Envoyer {generatedCount} email{generatedCount > 1 ? 's' : ''}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            <Check className="w-3.5 h-3.5 mr-1" />
            Termine
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
