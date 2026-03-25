import { useState } from 'react'
import { X, MapPin, Clock, CheckCircle, Circle, Loader2, UserCircle, Trash2 } from 'lucide-react'
import { useSlotEmargements, useSignEmargement } from '../../../queries/usePlanning'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { PlanningSlot, Team, TeamMemberWithProfile, SignatureType } from '../../../types'
import { clientDisplayName, formatTime } from '../utils/date-helpers'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import { getSlotColorType } from './SlotCard'

interface EmargementPanelProps {
  slot: PlanningSlot
  team: Team
  onClose: () => void
  onDelete?: (slotId: string) => void
}

export function EmargementPanel({ slot, team, onClose, onDelete }: EmargementPanelProps) {
  const toast = useToast()
  const { data: emargements = [], isLoading } = useSlotEmargements(slot.id)
  const signMutation = useSignEmargement()
  const [signingFor, setSigningFor] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const colorType = getSlotColorType(slot)
  const colors = INTERVENTION_COLORS[colorType]

  const chantierClient = slot.chantier?.client
  const displayName = clientDisplayName(chantierClient)
  const title = slot.chantier?.title ?? 'Sans titre'
  const timeRange = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`

  const members = (team.members ?? []).filter((m): m is TeamMemberWithProfile & { profile: NonNullable<TeamMemberWithProfile['profile']> } => !!m.profile)

  // Build emargement status for each member
  const getEmargementStatus = (profileId: string) => {
    const arrivee = emargements.find((e) => e.profile_id === profileId && e.signature_type === 'arrivee')
    const depart = emargements.find((e) => e.profile_id === profileId && e.signature_type === 'depart')
    return { arrivee, depart }
  }

  const handleSign = async (profileId: string, type: SignatureType) => {
    setSigningFor(`${profileId}-${type}`)

    // Try to get GPS location
    let latitude: number | null = null
    let longitude: number | null = null

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })
      latitude = position.coords.latitude
      longitude = position.coords.longitude
    } catch {
      // GPS not available - proceed without
    }

    signMutation.mutate(
      {
        planning_slot_id: slot.id,
        profile_id: profileId,
        signature_type: type,
        latitude,
        longitude,
      },
      {
        onSuccess: () => {
          toast.success(type === 'arrivee' ? 'Arrivée pointée' : 'Départ pointé')
          setSigningFor(null)
        },
        onError: (err) => {
          toast.error('Erreur', (err as Error).message)
          setSigningFor(null)
        },
      },
    )
  }

  const arrivedCount = new Set(
    emargements.filter((e) => e.signature_type === 'arrivee').map((e) => e.profile_id),
  ).size
  const totalMembers = members.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-200 ${colors.bg}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`text-base font-semibold ${colors.text}`}>{title}</h3>
              <p className={`text-xs ${colors.text} opacity-80 mt-0.5`}>{displayName}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <Clock className={`w-3.5 h-3.5 ${colors.text} opacity-60`} />
                  <span className={`text-xs ${colors.text} opacity-70`}>{timeRange}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: team.color || '#6366f1' }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <span className={`text-xs ${colors.text} opacity-70`}>{team.name}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Emargement badge */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Émargement</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            arrivedCount === totalMembers && totalMembers > 0
              ? 'bg-emerald-100 text-emerald-700'
              : arrivedCount > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
          }`}>
            {arrivedCount}/{totalMembers} pointés
          </span>
        </div>

        {/* Members list */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 text-slate-300 animate-spin mx-auto" />
              <p className="text-sm text-slate-400 mt-2">Chargement...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center">
              <UserCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucun membre dans cette équipe</p>
            </div>
          ) : (
            members.map((member) => {
              const { arrivee, depart } = getEmargementStatus(member.profile.id)
              const isSigningArrivee = signingFor === `${member.profile.id}-arrivee`
              const isSigningDepart = signingFor === `${member.profile.id}-depart`

              return (
                <div key={member.id} className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                      {member.profile.first_name.charAt(0)}{member.profile.last_name.charAt(0)}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {member.profile.first_name} {member.profile.last_name}
                        {member.is_team_leader && (
                          <span className="ml-1.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Chef</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Signature buttons */}
                  <div className="ml-11 mt-2 flex items-center gap-2">
                    {/* Arrivée */}
                    {arrivee ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                          Arrivée {new Date(arrivee.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {arrivee.latitude && (
                          <MapPin className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSign(member.profile.id, 'arrivee')}
                        disabled={isSigningArrivee}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {isSigningArrivee ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Circle className="w-3.5 h-3.5" />
                        )}
                        Pointer arrivée
                      </button>
                    )}

                    {/* Départ */}
                    {depart ? (
                      <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                          Départ {new Date(depart.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {depart.latitude && (
                          <MapPin className="w-3 h-3 text-blue-400" />
                        )}
                      </div>
                    ) : arrivee ? (
                      <button
                        onClick={() => handleSign(member.profile.id, 'depart')}
                        disabled={isSigningDepart}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {isSigningDepart ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Circle className="w-3.5 h-3.5" />
                        )}
                        Pointer départ
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">Arrivée requise d&apos;abord</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer with delete */}
        {onDelete && !slot.is_locked && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
            {showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-red-600 font-medium">Supprimer cette intervention ?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      onDelete(slot.id)
                      onClose()
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer l'intervention
              </button>
            )}
          </div>
        )}
        {slot.is_locked && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-400 italic">Intervention verrouillée — suppression impossible</p>
          </div>
        )}
      </div>
    </div>
  )
}
