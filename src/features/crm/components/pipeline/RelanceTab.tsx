import { useState } from 'react'
import { Sparkles, Mail, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { Select } from '../../../../components/ui/Select'
import { RelancePreviewCard } from './RelancePreviewCard'
import {
  useRelancesForProspect,
  useGenerateRelance,
  useSendRelance,
  useCancelRelance,
} from '../../../../queries/useRelance'
import { useToast } from '../../../../components/feedback/ToastProvider'
import type { ProspectWithMeta, RelanceTone } from '../../../../types'

interface RelanceTabProps {
  prospect: ProspectWithMeta
}

const toneOptions = [
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'amical', label: 'Amical' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'relance_douce', label: 'Relance douce' },
]

export function RelanceTab({ prospect }: RelanceTabProps) {
  const toast = useToast()
  const [tone, setTone] = useState<RelanceTone>('professionnel')
  const [customInstructions, setCustomInstructions] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const { data: relances = [], isLoading } = useRelancesForProspect(prospect.id)
  const generateMutation = useGenerateRelance()
  const sendMutation = useSendRelance()
  const cancelMutation = useCancelRelance()

  // Guard: no email
  if (!prospect.email) {
    return (
      <div className="px-5 py-8 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">
          Aucun email renseigne
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Ajoutez une adresse email au prospect pour pouvoir generer une relance.
        </p>
      </div>
    )
  }

  const activeDraft = relances.find(
    (r) => r.status === 'generated' || r.status === 'edited',
  )
  const pastRelances = relances.filter(
    (r) => r.status !== 'generated' && r.status !== 'edited',
  )

  async function handleGenerate() {
    try {
      await generateMutation.mutateAsync({
        prospect_id: prospect.id,
        tone,
        custom_instructions: customInstructions.trim() || undefined,
      })
      toast.success('Email genere par l\'IA')
      setCustomInstructions('')
    } catch {
      toast.error('Erreur lors de la generation')
    }
  }

  async function handleSend(
    relanceId: string,
    subject?: string,
    bodyHtml?: string,
  ) {
    try {
      await sendMutation.mutateAsync({
        relance_id: relanceId,
        subject,
        body_html: bodyHtml,
      })
      toast.success('Email envoye avec succes')
    } catch {
      toast.error('Erreur lors de l\'envoi')
    }
  }

  async function handleCancel(relanceId: string) {
    try {
      await cancelMutation.mutateAsync(relanceId)
      toast.success('Relance annulee')
    } catch {
      toast.error('Erreur lors de l\'annulation')
    }
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Generate section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Generer une relance
          </h3>
        </div>

        <div className="flex items-end gap-2">
          <div className="w-40">
            <Select
              label="Ton"
              options={toneOptions}
              value={tone}
              onChange={(e) => setTone(e.target.value as RelanceTone)}
            />
          </div>
          <Button
            size="sm"
            onClick={handleGenerate}
            loading={generateMutation.isPending}
            disabled={!!activeDraft}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Generer avec l'IA
          </Button>
        </div>

        {/* Custom instructions (optional) */}
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Instructions supplementaires pour l'IA (optionnel)..."
          rows={2}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-green-500 focus:ring-green-500/20"
        />

        {activeDraft && (
          <p className="text-xs text-amber-600">
            Un brouillon existe deja. Envoyez-le ou annulez-le avant d'en generer un nouveau.
          </p>
        )}
      </div>

      {/* Active draft */}
      {activeDraft && (
        <RelancePreviewCard
          relance={activeDraft}
          onSend={handleSend}
          onCancel={handleCancel}
          isSending={sendMutation.isPending}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-6 text-center">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
        </div>
      )}

      {/* Past relances history */}
      {pastRelances.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
          >
            Historique ({pastRelances.length})
            {showHistory ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3">
              {pastRelances.map((relance) => (
                <RelancePreviewCard
                  key={relance.id}
                  relance={relance}
                  onSend={handleSend}
                  onCancel={handleCancel}
                  isSending={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && relances.length === 0 && !generateMutation.isPending && (
        <div className="py-6 text-center">
          <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            Aucune relance envoyee pour ce prospect
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cliquez sur "Generer avec l'IA" pour creer un email de relance personnalise.
          </p>
        </div>
      )}
    </div>
  )
}
