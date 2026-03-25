import { useState, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Users,
  UserPlus,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Loader2,
  X,
  Search,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  useEvent,
  useUpdateEvent,
  useAddParticipants,
  useUpdateParticipantStatus,
  useRemoveParticipant,
} from '../../../queries/useEvents'
import { useClients } from '../../../queries/useClients'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { EventStatus, ParticipantStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const statusConfig: Record<EventStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600' },
  publie: { label: 'Publie', className: 'bg-blue-100 text-blue-700' },
  annule: { label: 'Annule', className: 'bg-red-100 text-red-600' },
  termine: { label: 'Termine', className: 'bg-emerald-100 text-emerald-700' },
}

const participantStatusConfig: Record<ParticipantStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  invite: { label: 'Invite', className: 'bg-slate-100 text-slate-600', icon: Clock },
  confirme: { label: 'Confirme', className: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  decline: { label: 'Decline', className: 'bg-red-100 text-red-600', icon: XCircle },
  present: { label: 'Present', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  absent: { label: 'Absent', className: 'bg-amber-100 text-amber-700', icon: XCircle },
}

const eventTypeLabels: Record<string, string> = {
  salon: 'Salon',
  portes_ouvertes: 'Portes ouvertes',
  atelier: 'Atelier',
  formation: 'Formation',
  reunion: 'Reunion',
  autre: 'Autre',
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

function clientName(c: { first_name?: string; last_name?: string; company_name?: string | null }): string {
  const firstName = c.first_name && c.first_name !== 'N/A' ? c.first_name : ''
  const lastName = c.last_name && c.last_name !== 'N/A' ? c.last_name : ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (c.company_name) return fullName ? `${c.company_name} — ${fullName}` : c.company_name
  return fullName || '-'
}

// ===========================================================================
// EventDetailPage
// ===========================================================================
export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()

  const { data: event, isLoading, error } = useEvent(id)
  const updateEventMutation = useUpdateEvent()
  const addParticipantsMutation = useAddParticipants()
  const updateParticipantStatusMutation = useUpdateParticipantStatus()
  const removeParticipantMutation = useRemoveParticipant()

  const [showAddModal, setShowAddModal] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())

  // Fetch clients for add participants modal
  const { data: clientsResult } = useClients({ search: clientSearch, pageSize: 50 })
  const allClients = clientsResult?.data ?? []

  // Participants already in this event
  const existingClientIds = useMemo(
    () => new Set((event as { participants?: { client_id: string }[] })?.participants?.map((p) => p.client_id) ?? []),
    [event],
  )

  // Available clients (not already participants)
  const availableClients = useMemo(
    () => allClients.filter((c) => !existingClientIds.has(c.id)),
    [allClients, existingClientIds],
  )

  // Participant stats
  const stats = useMemo(() => {
    const participants = (event as { participants?: { status: ParticipantStatus }[] })?.participants ?? []
    return {
      total: participants.length,
      confirme: participants.filter((p) => p.status === 'confirme').length,
      present: participants.filter((p) => p.status === 'present').length,
      decline: participants.filter((p) => p.status === 'decline').length,
    }
  }, [event])

  const handleStatusChange = useCallback(
    (newStatus: EventStatus) => {
      if (!id) return
      updateEventMutation.mutate(
        { id, data: { status: newStatus } },
        {
          onSuccess: () => toast.success('Statut mis a jour'),
          onError: () => toast.error('Erreur'),
        },
      )
    },
    [id, updateEventMutation, toast],
  )

  const handleAddParticipants = useCallback(() => {
    if (!id || selectedClientIds.size === 0) return
    addParticipantsMutation.mutate(
      { eventId: id, clientIds: [...selectedClientIds] },
      {
        onSuccess: () => {
          toast.success(`${selectedClientIds.size} participant(s) ajoute(s)`)
          setShowAddModal(false)
          setSelectedClientIds(new Set())
          setClientSearch('')
        },
        onError: () => toast.error("Erreur lors de l'ajout"),
      },
    )
  }, [id, selectedClientIds, addParticipantsMutation, toast])

  const handleParticipantStatus = useCallback(
    (participantId: string, status: ParticipantStatus) => {
      updateParticipantStatusMutation.mutate(
        { participantId, status },
        {
          onSuccess: () => toast.success('Statut mis a jour'),
          onError: () => toast.error('Erreur'),
        },
      )
    },
    [updateParticipantStatusMutation, toast],
  )

  const handleRemoveParticipant = useCallback(
    (participantId: string) => {
      if (!confirm('Retirer ce participant ?')) return
      removeParticipantMutation.mutate(participantId, {
        onSuccess: () => toast.success('Participant retire'),
        onError: () => toast.error('Erreur'),
      })
    },
    [removeParticipantMutation, toast],
  )

  const toggleClientSelection = useCallback((clientId: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <CalendarDays className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500">Evenement introuvable</p>
        <Link to="/relation/events" className="text-sm text-primary-600 hover:underline">
          Retour a la liste
        </Link>
      </div>
    )
  }

  const sc = statusConfig[event.status]
  const participants = (event as { participants?: Array<{ id: string; client_id: string; status: ParticipantStatus; client: { id: string; first_name: string; last_name: string; company_name: string | null; email: string | null } }> })?.participants ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        description={`${eventTypeLabels[event.event_type]} — ${formatDate(event.start_date)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/relation/events"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
            <select
              value={event.status}
              onChange={(e) => handleStatusChange(e.target.value as EventStatus)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="brouillon">Brouillon</option>
              <option value="publie">Publie</option>
              <option value="termine">Termine</option>
              <option value="annule">Annule</option>
            </select>
          </div>
        }
      />

      {/* Event Info Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${sc.className}`}>
            {sc.label}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-medium">{formatDate(event.start_date)} a {formatTime(event.start_date)}</p>
              {event.end_date && <p className="text-xs text-slate-400">Jusqu'au {formatDate(event.end_date)}</p>}
            </div>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              {event.location}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="w-4 h-4 text-slate-400" />
            {stats.total} participant(s)
            {event.max_participants && <span className="text-slate-400">/ {event.max_participants} max</span>}
          </div>
        </div>
        {event.description && (
          <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">{event.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">Total invites</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.confirme}</p>
          <p className="text-xs text-slate-500">Confirmes</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
          <p className="text-xs text-slate-500">Presents</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-500">{stats.decline}</p>
          <p className="text-xs text-slate-500">Declines</p>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
            Participants ({participants.length})
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Client</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Statut</th>
                <th className="w-32 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                    Aucun participant. Cliquez sur "Ajouter" pour inviter des clients.
                  </td>
                </tr>
              ) : (
                participants.map((p) => {
                  const psc = participantStatusConfig[p.status]
                  const PIcon = psc.icon
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {clientName(p.client)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {p.client.email ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${psc.className}`}>
                          <PIcon className="w-3 h-3" />
                          {psc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <select
                            value={p.status}
                            onChange={(e) => handleParticipantStatus(p.id, e.target.value as ParticipantStatus)}
                            className="text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="invite">Invite</option>
                            <option value="confirme">Confirme</option>
                            <option value="decline">Decline</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                          </select>
                          <button
                            onClick={() => handleRemoveParticipant(p.id)}
                            className="p-1 rounded hover:bg-red-50 transition-colors"
                            title="Retirer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Participants Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Ajouter des participants</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                {availableClients.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400 text-center">Aucun client trouve</p>
                ) : (
                  availableClients.map((client) => (
                    <label
                      key={client.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClientIds.has(client.id)}
                        onChange={() => toggleClientSelection(client.id)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{clientName(client)}</p>
                        {client.email && <p className="text-xs text-slate-400 truncate">{client.email}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddParticipants}
                  disabled={selectedClientIds.size === 0 || addParticipantsMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {addParticipantsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ajouter {selectedClientIds.size} client(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventDetailPage
