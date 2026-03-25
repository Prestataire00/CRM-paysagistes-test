import { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  CalendarDays,
  Plus,
  Search,
  MapPin,
  Users,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Tabs } from '../../../components/navigation/Tabs'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { StatCard } from '../../../components/data/StatCard'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { EventCalendar } from '../components/EventCalendar'
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '../../../queries/useEvents'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { EventType, EventStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const eventTypeLabels: Record<EventType, string> = {
  salon: 'Salon',
  portes_ouvertes: 'Portes ouvertes',
  atelier: 'Atelier',
  formation: 'Formation',
  reunion: 'Reunion',
  autre: 'Autre',
}

const eventTypeBadgeVariant: Record<EventType, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  salon: 'info',
  portes_ouvertes: 'info',
  atelier: 'warning',
  formation: 'success',
  reunion: 'neutral',
  autre: 'neutral',
}

const statusConfig: Record<EventStatus, { label: string; badgeVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon: typeof CheckCircle2 }> = {
  brouillon: { label: 'Brouillon', badgeVariant: 'neutral', icon: Clock },
  publie: { label: 'Publie', badgeVariant: 'info', icon: CalendarDays },
  annule: { label: 'Annule', badgeVariant: 'error', icon: XCircle },
  termine: { label: 'Termine', badgeVariant: 'success', icon: CheckCircle2 },
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// ===========================================================================
// EventListPage
// ===========================================================================
export function EventListPage() {
  const toast = useToast()
  const navigate = useNavigate()

  // View state
  const [activeView, setActiveView] = useState('calendrier')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<EventType | ''>('')

  // Create / Edit modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<import('../../../types').CrmEvent | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<EventType>('salon')
  const [newStatus, setNewStatus] = useState<EventStatus>('brouillon')
  const [newLocation, setNewLocation] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newMaxParticipants, setNewMaxParticipants] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  // Data
  const { data: events = [], isLoading } = useEvents({
    status: statusFilter || undefined,
    event_type: typeFilter || undefined,
  })
  const createEventMutation = useCreateEvent()
  const updateEventMutation = useUpdateEvent()
  const deleteEventMutation = useDeleteEvent()

  // Stats
  const stats = useMemo(() => {
    const now = new Date()
    const total = events.length
    const upcoming = events.filter(
      (e) => (e.status === 'publie' || e.status === 'brouillon') && new Date(e.start_date) >= now,
    ).length
    const done = events.filter((e) => e.status === 'termine').length
    const totalParticipants = events.reduce((sum, e) => sum + (e.max_participants ?? 0), 0)
    return { total, upcoming, done, totalParticipants }
  }, [events])

  // Filtered events for list view
  const filteredEvents = useMemo(() => {
    if (!search) return events
    const lower = search.toLowerCase()
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        (e.location ?? '').toLowerCase().includes(lower),
    )
  }, [events, search])

  const viewTabs = useMemo(
    () => [
      { key: 'calendrier', label: 'Calendrier' },
      { key: 'liste', label: 'Liste', count: events.length },
    ],
    [events.length],
  )

  // Form helpers
  const resetForm = useCallback(() => {
    setNewTitle('')
    setNewType('salon')
    setNewStatus('brouillon')
    setNewLocation('')
    setNewStartDate('')
    setNewEndDate('')
    setNewDescription('')
    setNewMaxParticipants('')
    setEditingEvent(null)
  }, [])

  const closeForm = useCallback(() => {
    setShowCreateModal(false)
    resetForm()
  }, [resetForm])

  const openEdit = useCallback((event: import('../../../types').CrmEvent) => {
    setEditingEvent(event)
    setNewTitle(event.title)
    setNewType(event.event_type)
    setNewStatus(event.status)
    setNewLocation(event.location ?? '')
    // Format dates for datetime-local input
    const toLocalInput = (iso: string) => {
      const d = new Date(iso)
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setNewStartDate(toLocalInput(event.start_date))
    setNewEndDate(event.end_date ? toLocalInput(event.end_date) : '')
    setNewDescription(event.description ?? '')
    setNewMaxParticipants(event.max_participants != null ? String(event.max_participants) : '')
    setShowCreateModal(true)
  }, [])

  const openCreateForDate = useCallback((date: Date) => {
    const d = new Date(date)
    d.setHours(9, 0, 0, 0)
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, '0')
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    setNewStartDate(formatted)
    setShowCreateModal(true)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!newTitle.trim() || !newStartDate) {
      toast.error('Le titre et la date de debut sont obligatoires')
      return
    }

    if (editingEvent) {
      updateEventMutation.mutate(
        {
          id: editingEvent.id,
          data: {
            title: newTitle.trim(),
            event_type: newType,
            status: newStatus,
            location: newLocation.trim() || null,
            start_date: new Date(newStartDate).toISOString(),
            end_date: newEndDate ? new Date(newEndDate).toISOString() : null,
            description: newDescription.trim() || null,
            max_participants: newMaxParticipants ? parseInt(newMaxParticipants) : null,
          },
        },
        {
          onSuccess: () => {
            toast.success('Evenement modifie avec succes')
            closeForm()
          },
          onError: () => toast.error("Erreur lors de la modification de l'evenement"),
        },
      )
    } else {
      createEventMutation.mutate(
        {
          title: newTitle.trim(),
          event_type: newType,
          status: 'brouillon',
          location: newLocation.trim() || null,
          start_date: new Date(newStartDate).toISOString(),
          end_date: newEndDate ? new Date(newEndDate).toISOString() : null,
          description: newDescription.trim() || null,
          max_participants: newMaxParticipants ? parseInt(newMaxParticipants) : null,
          notes: null,
          created_by: null,
        },
        {
          onSuccess: () => {
            toast.success('Evenement cree avec succes')
            closeForm()
          },
          onError: () => toast.error("Erreur lors de la creation de l'evenement"),
        },
      )
    }
  }, [editingEvent, newTitle, newType, newStatus, newLocation, newStartDate, newEndDate, newDescription, newMaxParticipants, createEventMutation, updateEventMutation, toast, closeForm])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteEventMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Evenement supprime')
        setDeleteTarget(null)
      },
      onError: () => {
        toast.error('Erreur lors de la suppression')
        setDeleteTarget(null)
      },
    })
  }, [deleteTarget, deleteEventMutation, toast])

  return (
    <div>
      <PageHeader
        title="Evenements"
        description="Salons, portes ouvertes et evenements clients"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
            Nouvel evenement
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CalendarDays} label="Total evenements" value={stats.total} />
        <StatCard icon={Clock} label="A venir" value={stats.upcoming} />
        <StatCard icon={CheckCircle2} label="Termines" value={stats.done} />
        <StatCard icon={Users} label="Participants max" value={stats.totalParticipants} />
      </div>

      {/* View tabs */}
      <Tabs tabs={viewTabs} activeTab={activeView} onChange={setActiveView} className="mb-4" />

      {/* ================================================================= */}
      {/* VIEW: Calendrier */}
      {/* ================================================================= */}
      {activeView === 'calendrier' && (
        <EventCalendar
          events={events}
          isLoading={isLoading}
          onDayClick={openCreateForDate}
          onEventClick={(id) => navigate(`/relation/events/${id}`)}
        />
      )}

      {/* ================================================================= */}
      {/* VIEW: Liste */}
      {/* ================================================================= */}
      {activeView === 'liste' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EventStatus | '')}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tous les statuts</option>
                <option value="brouillon">Brouillon</option>
                <option value="publie">Publie</option>
                <option value="termine">Termine</option>
                <option value="annule">Annule</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as EventType | '')}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tous les types</option>
                {Object.entries(eventTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Events List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3">
              <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
              <span className="text-sm text-slate-500">Chargement...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Aucun evenement trouve</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-sm text-primary-600 hover:underline mt-2"
              >
                Creer le premier evenement
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredEvents.map((event) => {
                const sc = statusConfig[event.status]
                const StatusIcon = sc.icon
                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={eventTypeBadgeVariant[event.event_type]}>
                            {eventTypeLabels[event.event_type]}
                          </Badge>
                          <Badge variant={sc.badgeVariant}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {sc.label}
                          </Badge>
                        </div>
                        <Link
                          to={`/relation/events/${event.id}`}
                          className="text-base font-bold text-slate-900 hover:text-primary-600 transition-colors"
                        >
                          {event.title}
                        </Link>
                        {event.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {formatDate(event.start_date)} a {formatTime(event.start_date)}
                            {event.end_date && ` — ${formatDate(event.end_date)}`}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {event.location}
                            </span>
                          )}
                          {event.max_participants && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              Max {event.max_participants}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          to={`/relation/events/${event.id}`}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Voir le detail"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                        </Link>
                        <button
                          onClick={() => openEdit(event)}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4 text-slate-400 hover:text-primary-600" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: event.id, title: event.title })}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'evenement"
        message={`Etes-vous sur de vouloir supprimer l'evenement "${deleteTarget?.title ?? ''}" ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteEventMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Create / Edit Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEvent ? "Modifier l'evenement" : 'Nouvel evenement'}
              </h2>
              <button onClick={closeForm} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Salon du Jardin 2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as EventType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(eventTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lieu</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ex: Parc des Expositions"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              {editingEvent && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as EventStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="publie">Publie</option>
                    <option value="annule">Annule</option>
                    <option value="termine">Termine</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date de debut *</label>
                  <input
                    type="datetime-local"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
                  <input
                    type="datetime-local"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Participants max</label>
                <input
                  type="number"
                  value={newMaxParticipants}
                  onChange={(e) => setNewMaxParticipants(e.target.value)}
                  placeholder="Illimite"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Description de l'evenement..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <Button variant="secondary" onClick={closeForm}>
                Annuler
              </Button>
              <Button
                variant="primary"
                icon={editingEvent ? Pencil : Plus}
                onClick={handleSubmit}
                loading={editingEvent ? updateEventMutation.isPending : createEventMutation.isPending}
              >
                {editingEvent ? "Modifier l'evenement" : "Creer l'evenement"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventListPage
