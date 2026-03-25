import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import {
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  UserCheck,
  UserX,
  MoreHorizontal,
  Shield,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserMinus,
  Pencil,
  UserCog,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/feedback/ToastProvider'
import { usePersonnel, useAbsences, useCreateAbsence } from '../../../queries/useResources'
import { ROLE_LABELS } from '../../../types'
import { ABSENCE_TYPES_LABELS } from '../../../utils/constants'
import type { AbsenceType } from '../../../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const absenceColors: Record<string, string> = {
  conge_paye: 'bg-blue-200',
  maladie: 'bg-red-200',
  rtt: 'bg-purple-200',
  formation: 'bg-amber-200',
  sans_solde: 'bg-slate-200',
  autre: 'bg-slate-200',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------
function PersonnelCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200" />
          <div>
            <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-16 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
      <div className="space-y-1 mb-3">
        <div className="h-3 w-28 bg-slate-200 rounded" />
        <div className="h-3 w-36 bg-slate-200 rounded" />
      </div>
      <div className="h-5 w-16 bg-slate-200 rounded-full" />
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse">
      <div className="p-4 border-b border-slate-200">
        <div className="h-6 w-60 bg-slate-200 rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PersonnelListPage() {
  const toast = useToast()

  // Data hooks
  const { data: personnel = [], isLoading: loadingPersonnel } = usePersonnel()
  const [calendarDate, setCalendarDate] = useState(() => new Date())

  // Absence filters scoped to the visible month
  const absenceFilters = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    return {
      date_from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      date_to: `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`,
    }
  }, [calendarDate])

  const { data: absences = [], isLoading: loadingAbsences } = useAbsences(absenceFilters)
  const createAbsence = useCreateAbsence()

  // Local state
  const [search, setSearch] = useState('')
  const [openPersonMenuId, setOpenPersonMenuId] = useState<string | null>(null)
  const [showCreateAbsence, setShowCreateAbsence] = useState(false)
  const [absenceForm, setAbsenceForm] = useState({
    profile_id: '',
    absence_type: 'conge_paye' as AbsenceType,
    start_date: '',
    end_date: '',
    reason: '',
  })

  // Derived
  const filteredPersonnel = personnel.filter((p: any) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
    const role = (ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role).toLowerCase()
    return fullName.includes(search.toLowerCase()) || role.includes(search.toLowerCase())
  })

  const daysInMonth = getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth())
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Determine if a person is currently absent
  function isCurrentlyAbsent(profileId: string) {
    const today = new Date().toISOString().slice(0, 10)
    return absences.some(
      (a: any) => a.profile_id === profileId && a.status !== 'refusee' && a.start_date <= today && a.end_date >= today
    )
  }

  // Navigate calendar months
  function goMonth(delta: number) {
    setCalendarDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + delta)
      return d
    })
  }

  // Create absence handler
  async function handleCreateAbsence() {
    if (!absenceForm.profile_id || !absenceForm.start_date || !absenceForm.end_date) {
      toast.warning('Veuillez remplir tous les champs obligatoires')
      return
    }
    try {
      await createAbsence.mutateAsync({
        profile_id: absenceForm.profile_id,
        absence_type: absenceForm.absence_type,
        start_date: absenceForm.start_date,
        end_date: absenceForm.end_date,
        status: 'en_attente',
        is_half_day_start: false,
        is_half_day_end: false,
        reason: absenceForm.reason || null,
        document_url: null,
      })
      toast.success('Absence créée', 'La demande d\'absence a bien été enregistrée.')
      setShowCreateAbsence(false)
      setAbsenceForm({ profile_id: '', absence_type: 'conge_paye', start_date: '', end_date: '', reason: '' })
    } catch {
      toast.error('Erreur', 'Impossible de créer l\'absence.')
    }
  }

  // Map absences by profile for the calendar
  const absencesByProfile = useMemo(() => {
    const map: Record<string, Array<{ start: number; end: number; type: string }>> = {}
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()

    absences.forEach((a: any) => {
      if (a.status === 'refusee') return
      const startD = new Date(a.start_date)
      const endD = new Date(a.end_date)

      // Clamp to current month
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month, daysInMonth)
      const clampedStart = startD < monthStart ? 1 : startD.getDate()
      const clampedEnd = endD > monthEnd ? daysInMonth : endD.getDate()

      if (!map[a.profile_id]) map[a.profile_id] = []
      map[a.profile_id].push({ start: clampedStart, end: clampedEnd, type: a.absence_type })
    })
    return map
  }, [absences, calendarDate, daysInMonth])

  return (
    <div>
      <PageHeader
        title="Personnel"
        description={loadingPersonnel ? 'Chargement...' : `${personnel.length} collaborateurs`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/users"
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <UserCog className="w-4 h-4" />
              Gérer les utilisateurs
            </Link>
            <button
              onClick={() => setShowCreateAbsence(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Déclarer une absence
            </button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un collaborateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Personnel Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loadingPersonnel
          ? Array.from({ length: 8 }).map((_, i) => <PersonnelCardSkeleton key={i} />)
          : filteredPersonnel.map((person: any) => {
              const absent = isCurrentlyAbsent(person.id)
              const statusCfg = absent
                ? { label: 'Absent', className: 'bg-red-100 text-red-700', Icon: UserX }
                : { label: 'Présent', className: 'bg-emerald-100 text-emerald-700', Icon: UserCheck }

              return (
                <div key={person.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                          {getInitials(person.first_name, person.last_name)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {person.first_name} {person.last_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ROLE_LABELS[person.role as keyof typeof ROLE_LABELS] ?? person.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        to="/admin/users"
                        className="p-1 rounded-md hover:bg-slate-100"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </Link>
                      <button
                        onClick={() => setOpenPersonMenuId(openPersonMenuId === person.id ? null : person.id)}
                        className="p-1 rounded-md hover:bg-slate-100"
                      >
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </button>
                      {openPersonMenuId === person.id && (
                        <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                          <button
                            onClick={() => {
                              setOpenPersonMenuId(null)
                              window.open(`mailto:${person.email}`, '_blank')
                            }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Envoyer un email
                          </button>
                          {person.phone && (
                            <button
                              onClick={() => {
                                setOpenPersonMenuId(null)
                                window.open(`tel:${person.phone}`, '_blank')
                              }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Appeler
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setOpenPersonMenuId(null)
                              setAbsenceForm(f => ({ ...f, profile_id: person.id }))
                              setShowCreateAbsence(true)
                            }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Déclarer une absence
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {person.default_team && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
                      <Shield className="w-3 h-3 text-slate-400" />
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-0.5"
                        style={{ backgroundColor: person.default_team.color || '#94a3b8' }}
                      />
                      {person.default_team.name}
                    </div>
                  )}

                  <div className="space-y-1 mb-3">
                    {person.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="w-3 h-3" />
                        {person.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{person.email}</span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                    <statusCfg.Icon className="w-3 h-3" />
                    {statusCfg.label}
                  </span>
                </div>
              )
            })}
      </div>

      {/* Absence Calendar */}
      {loadingAbsences ? (
        <CalendarSkeleton />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              Calendrier des absences
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goMonth(-1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">
                {formatMonth(calendarDate)}
              </span>
              <button
                onClick={() => goMonth(1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 bg-slate-50">
            {Object.entries(ABSENCE_TYPES_LABELS).slice(0, 4).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`w-3 h-3 rounded ${absenceColors[key]}`} />
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className={`grid border-b border-slate-200`} style={{ gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)` }}>
                <div className="p-2 bg-slate-50 border-r border-slate-200 text-xs font-semibold text-slate-500">
                  Collaborateur
                </div>
                {calendarDays.map((day) => (
                  <div key={day} className="p-1 text-center bg-slate-50 border-r border-slate-100 last:border-r-0">
                    <span className="text-[10px] text-slate-500">{day}</span>
                  </div>
                ))}
              </div>

              {personnel.map((person: any) => {
                const personAbsences = absencesByProfile[person.id] || []
                return (
                  <div
                    key={person.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                    style={{ display: 'grid', gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)` }}
                  >
                    <div className="p-2 border-r border-slate-200 text-xs font-medium text-slate-700 truncate">
                      {person.first_name} {person.last_name}
                    </div>
                    {calendarDays.map((day) => {
                      const absence = personAbsences.find((a) => day >= a.start && day <= a.end)
                      return (
                        <div key={day} className="p-0.5 border-r border-slate-50 last:border-r-0 min-h-[28px]">
                          {absence && (
                            <div
                              className={`h-full rounded-sm ${absenceColors[absence.type] || 'bg-slate-200'}`}
                              title={ABSENCE_TYPES_LABELS[absence.type]}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Absence Modal */}
      <Modal open={showCreateAbsence} onClose={() => setShowCreateAbsence(false)} size="md">
        <ModalHeader title="Déclarer une absence" onClose={() => setShowCreateAbsence(false)} />
        <div className="px-6 pb-4 space-y-4">
          {/* Collaborateur */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Collaborateur *</label>
            <select
              value={absenceForm.profile_id}
              onChange={(e) => setAbsenceForm((f) => ({ ...f, profile_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sélectionner...</option>
              {personnel.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type d'absence *</label>
            <select
              value={absenceForm.absence_type}
              onChange={(e) => setAbsenceForm((f) => ({ ...f, absence_type: e.target.value as AbsenceType }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(ABSENCE_TYPES_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de début *</label>
              <input
                type="date"
                value={absenceForm.start_date}
                onChange={(e) => setAbsenceForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin *</label>
              <input
                type="date"
                value={absenceForm.end_date}
                onChange={(e) => setAbsenceForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Raison */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motif</label>
            <textarea
              value={absenceForm.reason}
              onChange={(e) => setAbsenceForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Motif optionnel..."
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowCreateAbsence(false)}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateAbsence}
            loading={createAbsence.isPending}
          >
            {createAbsence.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Créer l'absence
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
