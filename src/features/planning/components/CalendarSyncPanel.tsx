import { useState } from 'react'
import { Calendar, Copy, RefreshCw, Check, Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../components/feedback/ToastProvider'
import { supabase } from '../../../lib/supabase'

interface CalendarSyncPanelProps {
  open: boolean
  onClose: () => void
}

export function CalendarSyncPanel({ open, onClose }: CalendarSyncPanelProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [token, setToken] = useState(user?.calendar_token ?? null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const icalUrl = token
    ? `${supabaseUrl}/functions/v1/ics-calendar?token=${token}`
    : null

  const handleCopy = async () => {
    if (!icalUrl) return
    try {
      await navigator.clipboard.writeText(icalUrl)
      setCopied(true)
      toast.success('Copié', "L'URL du calendrier a été copiée.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erreur', 'Impossible de copier dans le presse-papiers.')
    }
  }

  const handleRegenerate = async () => {
    if (!user) return
    setRegenerating(true)
    try {
      const newToken = crypto.randomUUID()
      const { error } = await supabase
        .from('profiles')
        .update({ calendar_token: newToken })
        .eq('id', user.id)
      if (error) throw error
      setToken(newToken)
      toast.success('Token régénéré', "L'ancien lien ne fonctionnera plus.")
    } catch {
      toast.error('Erreur', 'Impossible de régénérer le token.')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title="Synchroniser le calendrier"
        description="Abonnez-vous à votre planning depuis Google Calendar, Outlook ou Apple Calendar"
      />

      <div className="px-6 py-4 space-y-5">
        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">URL iCal</label>
          {icalUrl ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={icalUrl}
                readOnly
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono bg-slate-50 text-slate-600 outline-none"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 p-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                title="Copier"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Aucun token de calendrier. Cliquez sur "Régénérer" pour en créer un.
            </p>
          )}
        </div>

        {/* Regenerate */}
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Régénérer le lien
        </button>

        {/* Instructions */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Instructions</h4>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Google Calendar</p>
                <p className="text-slate-500">
                  Paramètres → Autres agendas → Ajouter par URL → Collez l'URL ci-dessus
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Outlook</p>
                <p className="text-slate-500">
                  Ajouter un calendrier → S'abonner à partir du web → Collez l'URL
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Apple Calendar</p>
                <p className="text-slate-500">
                  Fichier → Nouvel abonnement à un calendrier → Collez l'URL
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
          Ce lien est personnel et donne accès à votre planning. Ne le partagez pas.
          Si vous pensez qu'il a été compromis, régénérez-le.
        </p>
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Fermer
        </button>
      </ModalFooter>
    </Modal>
  )
}
