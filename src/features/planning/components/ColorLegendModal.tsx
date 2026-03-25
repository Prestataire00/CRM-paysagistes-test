import { X, GripVertical, Lock, Phone, MessageSquare, PhoneOff, Truck, Wrench, AlertTriangle } from 'lucide-react'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import { AVAILABILITY_COLORS } from '../utils/availability'

const COLOR_DESCRIPTIONS: Record<string, string> = {
  contrat: 'Client sous contrat régulier',
  ponctuel: 'Intervention ponctuelle',
  extra: 'Travail supplémentaire / extra',
  ancien: 'Ancien client',
  fournisseur: 'Intervention fournisseur',
  suspendu: 'Contrat suspendu',
}

interface ColorLegendModalProps {
  onClose: () => void
}

export function ColorLegendModal({ onClose }: ColorLegendModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Légende</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* Color codes */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Codes couleurs</h4>
            <div className="space-y-2">
              {Object.entries(INTERVENTION_COLORS).map(([key, colors]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`} />
                  <div className={`${colors.bg} ${colors.border} border rounded-md px-2 py-1 flex-1`}>
                    <span className={`text-xs font-medium ${colors.text} capitalize`}>{key}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{COLOR_DESCRIPTIONS[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Icons */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Icônes</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600">Poignée de déplacement (drag & drop)</span>
              </div>
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600">Intervention verrouillée (non déplaçable)</span>
              </div>
              <div className="flex items-center gap-3">
                <Truck className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-600">Véhicule assigné</span>
              </div>
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-600">Équipement assigné</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-slate-600">Client appelé</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-slate-600">SMS envoyé au client</span>
              </div>
              <div className="flex items-center gap-3">
                <PhoneOff className="w-4 h-4 text-slate-900" />
                <span className="text-xs text-slate-600">Client non contacté</span>
              </div>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-slate-600">Heures supplémentaires (&gt;8h)</span>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Disponibilité équipe</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${AVAILABILITY_COLORS.full}`} />
                <span className="text-xs text-slate-600">Tous les membres présents</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${AVAILABILITY_COLORS.partial}`} />
                <span className="text-xs text-slate-600">Équipe partielle (absences)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${AVAILABILITY_COLORS.none}`} />
                <span className="text-xs text-slate-600">Aucun membre disponible</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
