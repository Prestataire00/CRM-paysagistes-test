import { memo, type DragEvent } from 'react'
import { GripVertical, Lock, Clock, Truck, Wrench, Phone, MessageSquare, PhoneOff, AlertTriangle, FileText, Camera, PenTool, Star } from 'lucide-react'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import type { PlanningSlot, ChantierColorType, ContactStatus } from '../../../types'
import { clientDisplayName, formatTime, formatDuration } from '../utils/date-helpers'

/** Resolve the color type for a planning slot */
function getSlotColorType(slot: PlanningSlot): ChantierColorType {
  if (slot.color && slot.color in INTERVENTION_COLORS) {
    return slot.color as ChantierColorType
  }
  return 'contrat'
}

export interface DragData {
  slotId: string
  sourceTeamId: string
  sourceDate: string
}

interface SlotCardProps {
  slot: PlanningSlot
  onDragStart: (e: DragEvent<HTMLDivElement>, data: DragData) => void
  onClick?: () => void
  compact?: boolean
  isHighlighted?: boolean
  hasVehicle?: boolean
  hasEquipment?: boolean
}

/** Contact status icon */
function ContactIcon({ status }: { status: ContactStatus | undefined }) {
  if (status === 'appele') return <Phone className="w-2.5 h-2.5 text-emerald-500" />
  if (status === 'sms_envoye') return <MessageSquare className="w-2.5 h-2.5 text-amber-500" />
  return <PhoneOff className="w-2.5 h-2.5 text-slate-900" />
}

export const SlotCard = memo(function SlotCard({ slot, onDragStart, onClick, compact = false, isHighlighted = false, hasVehicle = false, hasEquipment = false }: SlotCardProps) {
  const colorType = getSlotColorType(slot)
  const colors = INTERVENTION_COLORS[colorType]
  const chantierClient = (slot.chantier as (PlanningSlot['chantier'] & { client?: { first_name?: string; last_name?: string; company_name?: string | null } | null }))?.client
  const displayName = clientDisplayName(chantierClient)
  const title = slot.chantier?.title ?? 'Sans titre'
  const timeRange = `${formatTime(slot.start_time)}-${formatTime(slot.end_time)}`
  const duration = formatDuration(slot.start_time, slot.end_time)
  const contactStatus = (slot.chantier as (PlanningSlot['chantier'] & { contact_status?: ContactStatus }))?.contact_status

  // Overtime: slot duration > 8 hours
  const isOvertime = (() => {
    if (!slot.start_time || !slot.end_time) return false
    const [sh, sm] = slot.start_time.split(':').map(Number)
    const [eh, em] = slot.end_time.split(':').map(Number)
    return (eh * 60 + em) - (sh * 60 + sm) > 480
  })()

  const isDraggable = !slot.is_locked

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!isDraggable) {
      e.preventDefault()
      return
    }
    onDragStart(e, {
      slotId: slot.id,
      sourceTeamId: slot.team_id,
      sourceDate: slot.slot_date,
    })
  }

  if (compact) {
    return (
      <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0`} title={`${title} - ${displayName}`} />
    )
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`${colors.bg} ${colors.border} border rounded-md p-1.5 mb-1 transition-shadow group relative ${
        isDraggable ? 'cursor-grab active:cursor-grabbing hover:shadow-sm' : 'cursor-default'
      } ${onClick ? 'cursor-pointer' : ''} ${isHighlighted ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}
    >
      <div className="flex items-start gap-1">
        {isDraggable ? (
          <GripVertical className="w-3 h-3 text-slate-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        ) : (
          <Lock className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-semibold ${colors.text} truncate`}>
            {title}
          </p>
          <div className="flex items-center gap-1">
            <p className={`text-[9px] ${colors.text} opacity-80 truncate flex-1`}>
              {displayName}
            </p>
            <ContactIcon status={contactStatus} />
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className={`w-2.5 h-2.5 ${colors.text} opacity-60`} />
            <p className={`text-[9px] ${colors.text} opacity-70`}>
              {timeRange}
            </p>
            {duration && (
              <span className={`text-[8px] font-medium ${colors.text} opacity-60 ml-auto`}>
                {duration}
              </span>
            )}
          </div>
          {/* Bottom row: equipment + overtime indicators */}
          <div className="flex items-center gap-1 mt-0.5">
            {hasVehicle && <Truck className={`w-2.5 h-2.5 ${colors.text} opacity-50`} />}
            {hasEquipment && <Wrench className={`w-2.5 h-2.5 ${colors.text} opacity-50`} />}
            {isOvertime && (
              <div className="ml-auto flex items-center gap-0.5" title="Heures supplémentaires">
                <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
              </div>
            )}
          </div>
          {/* Completion indicators */}
          {(slot.chantier?.completion_notes || (slot.chantier?.completion_photos?.length ?? 0) > 0 || slot.chantier?.client_signature_url || slot.chantier?.satisfaction_rating) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {slot.chantier?.completion_notes && (
                <span title="Notes de complétion"><FileText className="w-3 h-3 text-slate-400" /></span>
              )}
              {(slot.chantier?.completion_photos?.length ?? 0) > 0 && (
                <span className="flex items-center gap-0.5" title={`${slot.chantier!.completion_photos!.length} photo(s)`}>
                  <Camera className="w-3 h-3 text-slate-400" />
                  <span className="text-[8px] text-slate-400">{slot.chantier!.completion_photos!.length}</span>
                </span>
              )}
              {slot.chantier?.client_signature_url && (
                <span title="Signature client"><PenTool className="w-3 h-3 text-slate-400" /></span>
              )}
              {slot.chantier?.satisfaction_rating && (
                <span className="flex items-center gap-0.5" title={`Note: ${slot.chantier.satisfaction_rating}/5`}>
                  <Star className="w-3 h-3 text-slate-400" />
                  <span className="text-[8px] text-slate-400">{slot.chantier.satisfaction_rating}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export { getSlotColorType }
