import { useState, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import {
  Send,
  Pencil,
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Mail,
} from 'lucide-react'
import { cn } from '../../../../utils/cn'
import { Button } from '../../../../components/ui/Button'
import { ConfirmDialog } from '../../../../components/feedback/ConfirmDialog'
import type { RelanceEmail, RelanceStatus } from '../../../../types'

interface RelancePreviewCardProps {
  relance: RelanceEmail
  onSend: (relanceId: string, subject?: string, bodyHtml?: string) => void
  onCancel: (relanceId: string) => void
  isSending: boolean
}

const statusConfig: Record<
  RelanceStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  generated: {
    label: 'Brouillon IA',
    icon: Clock,
    className: 'bg-blue-50 text-blue-700',
  },
  edited: {
    label: 'Modifie',
    icon: Pencil,
    className: 'bg-amber-50 text-amber-700',
  },
  sending: {
    label: 'Envoi...',
    icon: Loader2,
    className: 'bg-blue-50 text-blue-700',
  },
  sent: {
    label: 'Envoye',
    icon: CheckCircle,
    className: 'bg-emerald-50 text-emerald-700',
  },
  failed: {
    label: 'Echec',
    icon: AlertCircle,
    className: 'bg-red-50 text-red-700',
  },
  cancelled: {
    label: 'Annule',
    icon: XCircle,
    className: 'bg-slate-100 text-slate-500',
  },
}

const toneLabels: Record<string, string> = {
  professionnel: 'Professionnel',
  amical: 'Amical',
  urgent: 'Urgent',
  relance_douce: 'Relance douce',
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function RelancePreviewCard({
  relance,
  onSend,
  onCancel,
  isSending,
}: RelancePreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editSubject, setEditSubject] = useState(relance.subject)
  const [editBody, setEditBody] = useState(relance.body_html)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const status = statusConfig[relance.status]
  const StatusIcon = status.icon
  const isSendable =
    relance.status === 'generated' || relance.status === 'edited'

  const handleBodyInput = useCallback(() => {
    if (bodyRef.current) {
      setEditBody(bodyRef.current.innerHTML)
    }
  }, [])

  function handleSave() {
    if (bodyRef.current) {
      setEditBody(bodyRef.current.innerHTML)
    }
    setIsEditing(false)
  }

  function handleCancelEdit() {
    setEditSubject(relance.subject)
    setEditBody(relance.body_html)
    setIsEditing(false)
  }

  function handleConfirmSend() {
    const subjectChanged = editSubject !== relance.subject ? editSubject : undefined
    const bodyChanged = editBody !== relance.body_html ? editBody : undefined
    onSend(relance.id, subjectChanged, bodyChanged)
    setShowSendConfirm(false)
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                status.className,
              )}
            >
              <StatusIcon
                className={cn(
                  'w-3 h-3',
                  relance.status === 'sending' && 'animate-spin',
                )}
              />
              {status.label}
            </span>
            <span className="text-[10px] text-slate-400">
              {toneLabels[relance.tone] ?? relance.tone}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {formatDate(relance.created_at)}
          </span>
        </div>

        {/* Email preview */}
        <div className="bg-white">
          {/* Destinataire */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">A :</span>
            <span className="text-xs font-medium text-slate-700">
              {relance.recipient_email}
            </span>
          </div>

          {/* Subject */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            {isEditing ? (
              <div>
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1 block">
                  Objet
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full text-sm font-semibold text-slate-800 bg-transparent border-b border-dashed border-slate-300 pb-1 focus:outline-none focus:border-primary-500"
                />
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-800">
                {editSubject}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            {isEditing ? (
              <div>
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                  Contenu
                </label>
                <div
                  ref={bodyRef}
                  contentEditable
                  onInput={handleBodyInput}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editBody) }}
                  className="min-h-[120px] max-h-[300px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 [&>p]:mb-3 [&>p:last-child]:mb-0"
                />
              </div>
            ) : (
              <div
                className="prose prose-sm prose-slate max-w-none text-sm text-slate-700 leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editBody) }}
              />
            )}
          </div>
        </div>

        {/* Error message */}
        {relance.status === 'failed' && relance.error_message && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {relance.error_message}
            </p>
          </div>
        )}

        {/* Actions */}
        {isSendable && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave}>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Valider
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Annuler
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => setShowSendConfirm(true)}
                  loading={isSending}
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Envoyer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancel(relance.id)}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Annuler
                </Button>
              </>
            )}
          </div>
        )}

        {/* Sent info */}
        {relance.status === 'sent' && relance.sent_at && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-emerald-50/30">
            <p className="text-xs text-emerald-700">
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Envoye le {formatDate(relance.sent_at)} a{' '}
              {relance.recipient_email}
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showSendConfirm}
        title="Envoyer la relance"
        message={`Envoyer cet email a ${relance.recipient_email} ? L'email sera envoye via Brevo et enregistre dans l'historique.`}
        confirmLabel="Envoyer"
        variant="primary"
        onConfirm={handleConfirmSend}
        onCancel={() => setShowSendConfirm(false)}
        loading={isSending}
      />
    </>
  )
}
