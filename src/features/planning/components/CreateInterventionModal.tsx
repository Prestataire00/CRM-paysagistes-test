import { useState, useEffect, useRef } from 'react'
import { X, Search, MapPin, Loader2 } from 'lucide-react'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import { useTeams, useSearchClients, useCreateFullIntervention } from '../../../queries/usePlanning'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { InterventionType, ChantierColorType } from '../../../types'
import type { ClientSearchResult } from '../../../services/planning.service'

type InterventionColorKey = keyof typeof INTERVENTION_COLORS

const INTERVENTION_TYPES: Array<{ value: InterventionType; label: string }> = [
  { value: 'entretien', label: 'Entretien' },
  { value: 'tonte', label: 'Tonte' },
  { value: 'taille', label: 'Taille' },
  { value: 'desherbage', label: 'Désherbage' },
  { value: 'plantation', label: 'Plantation' },
  { value: 'amenagement', label: 'Aménagement' },
  { value: 'arrosage', label: 'Arrosage' },
  { value: 'debroussaillage', label: 'Débroussaillage' },
  { value: 'evacuation', label: 'Évacuation' },
  { value: 'autre', label: 'Autre' },
]

const COLOR_TYPES: Array<{ key: InterventionColorKey; label: string }> = [
  { key: 'contrat', label: 'Contrat' },
  { key: 'ponctuel', label: 'Ponctuel' },
  { key: 'extra', label: 'Extra' },
  { key: 'ancien', label: 'Ancien' },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'suspendu', label: 'Suspendu' },
]

interface CreateInterventionModalProps {
  defaultDate?: string
  defaultTeamId?: string
  onClose: () => void
}

export function CreateInterventionModal({ defaultDate, defaultTeamId, onClose }: CreateInterventionModalProps) {
  const toast = useToast()
  const { data: teams = [] } = useTeams()
  const createMutation = useCreateFullIntervention()

  // Form state
  const [title, setTitle] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [addressLine1, setAddressLine1] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [interventionType, setInterventionType] = useState<InterventionType>('entretien')
  const [teamId, setTeamId] = useState(defaultTeamId ?? '')
  const [slotDate, setSlotDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')
  const [priority, setPriority] = useState(3)
  const [estimatedDuration, setEstimatedDuration] = useState('')
  const [color, setColor] = useState<InterventionColorKey>('contrat')
  const [description, setDescription] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Client search query
  const { data: clientResults = [], isLoading: clientsLoading } = useSearchClients(clientSearch)

  // Set default team if not already set
  useEffect(() => {
    if (!teamId && teams.length > 0) {
      setTeamId(teams[0].id)
    }
  }, [teams, teamId])

  // Auto-fill address when client is selected
  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client)
    setClientSearch(client.company_name || `${client.first_name} ${client.last_name}`)
    setAddressLine1(client.address_line1 || '')
    setPostalCode(client.postal_code || '')
    setCity(client.city || '')
    setShowClientDropdown(false)

    // Auto-suggest title
    if (!title) {
      const clientName = client.company_name || `${client.last_name}`
      setTitle(`${interventionType.charAt(0).toUpperCase() + interventionType.slice(1)} - ${clientName}`)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedClient || !teamId || !title) return

    createMutation.mutate(
      {
        title,
        client_id: selectedClient.id,
        address_line1: addressLine1,
        postal_code: postalCode,
        city,
        intervention_type: interventionType,
        team_id: teamId,
        slot_date: slotDate,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        priority,
        estimated_duration_minutes: estimatedDuration ? parseInt(estimatedDuration, 10) : null,
        color: color as ChantierColorType,
        description: description || null,
      },
      {
        onSuccess: () => {
          toast.success('Intervention créée avec succès')
          onClose()
        },
        onError: (err) => {
          toast.error('Erreur lors de la création', (err as Error).message)
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nouvelle intervention</h3>
            <p className="text-xs text-slate-500 mt-0.5">Créer un chantier et le planifier</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Client search */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Client <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  setShowClientDropdown(true)
                  if (!e.target.value) setSelectedClient(null)
                }}
                onFocus={() => clientSearch.length >= 2 && setShowClientDropdown(true)}
                placeholder="Rechercher un client par nom ou entreprise..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {clientsLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>
            {showClientDropdown && clientResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                {clientResults.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {client.company_name || `${client.first_name} ${client.last_name}`}
                      </p>
                      {client.city && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {client.city} {client.postal_code}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showClientDropdown && clientSearch.length >= 2 && !clientsLoading && clientResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg p-3 text-center">
                <p className="text-sm text-slate-500">Aucun client trouvé</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Tonte pelouse - Dupont"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          {/* Address (auto-filled, editable) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Adresse"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Code postal"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ville"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Type intervention + Team */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Type d&apos;intervention <span className="text-red-500">*</span>
              </label>
              <select
                value={interventionType}
                onChange={(e) => setInterventionType(e.target.value as InterventionType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {INTERVENTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Équipe <span className="text-red-500">*</span>
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Sélectionner...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Time range */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Début</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
          </div>

          {/* Priority + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value={1}>1 - Urgente</option>
                <option value={2}>2 - Haute</option>
                <option value={3}>3 - Normale</option>
                <option value={4}>4 - Basse</option>
                <option value={5}>5 - Très basse</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Durée estimée (min)</label>
              <input
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="Ex: 120"
                min={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Color type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type de couleur</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_TYPES.map((ct) => {
                const colors = INTERVENTION_COLORS[ct.key]
                const isActive = color === ct.key
                return (
                  <button
                    key={ct.key}
                    type="button"
                    onClick={() => setColor(ct.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive
                        ? `${colors.bg} ${colors.border} ${colors.text} ring-2 ring-offset-1 ring-primary-400`
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    {ct.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes ou instructions supplémentaires..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest('.flex-col')?.querySelector('form')
              form?.requestSubmit()
            }}
            disabled={!selectedClient || !teamId || !title || createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer l&apos;intervention
          </button>
        </div>
      </div>
    </div>
  )
}
