import { brand } from '../../../config/brand'
import { useState, useMemo, useCallback, useEffect } from 'react'
import DOMPurify from 'dompurify'
import {
  Plus, CalendarDays, List, ChevronLeft, ChevronRight,
  Phone, MapPin, Video, Building2, Clock, CheckCircle2,
  X, User, Mail, Trash2, Loader2, Sparkles, AlertCircle,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useAuth } from '../../../contexts/AuthContext'
import { getAgendaRdvs, createRdv, completeRdv, deleteRdv, getRdvContext, type AgendaRdv } from '../../../services/agenda.service'
import { generateAiContent } from '../../../services/ai-content.service'
import { sendClientEmail, buildRdvConfirmationEmail, buildRdvReminderEmail } from '../../../services/client-email.service'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_LABELS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const typeConfig: Record<string, { label: string; icon: typeof Phone; color: string; bg: string }> = {
  visite:  { label: 'Visite terrain', icon: MapPin,    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  appel:   { label: 'Appel',         icon: Phone,     color: 'text-blue-700',    bg: 'bg-blue-100' },
  visio:   { label: 'Visioconférence', icon: Video,   color: 'text-violet-700',  bg: 'bg-violet-100' },
  reunion: { label: 'RDV bureau',    icon: Building2, color: 'text-amber-700',   bg: 'bg-amber-100' },
  email:   { label: 'Email',         icon: Mail,      color: 'text-slate-700',   bg: 'bg-slate-100' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function contactName(rdv: AgendaRdv): string {
  const c = rdv.client || rdv.prospect
  if (!c) return '—'
  return c.company_name || `${c.first_name} ${c.last_name}`
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDay = (first.getDay() + 6) % 7 // Mon=0
  const grid: (Date | null)[][] = []
  let week: (Date | null)[] = Array(startDay).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) { grid.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    grid.push(week)
  }
  return grid
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CommercialAgendaPage() {
  const toast = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedRdv, setSelectedRdv] = useState<AgendaRdv | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AgendaRdv | null>(null)
  const [listFilter, setListFilter] = useState('all')
  const [aiPrep, setAiPrep] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [crLoading, setCrLoading] = useState(false)
  const [emailSending, setEmailSending] = useState<string | null>(null)

  // Form state
  const [formType, setFormType] = useState('visite')
  const [formSubject, setFormSubject] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('09:00')
  const [formNotes, setFormNotes] = useState('')
  const [formContactType, setFormContactType] = useState<'client' | 'prospect'>('prospect')
  const [formContactSearch, setFormContactSearch] = useState('')
  const [formContactId, setFormContactId] = useState('')
  const [formContactName, setFormContactName] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')

  // Load existing AI prep when selecting a RDV
  useEffect(() => {
    if (selectedRdv?.follow_up_notes) {
      setAiPrep(selectedRdv.follow_up_notes)
    } else {
      setAiPrep(null)
    }
  }, [selectedRdv])

  // Contact search
  const { data: searchResults = [] } = useQuery({
    queryKey: ['agenda', 'search', formContactType, formContactSearch],
    queryFn: async () => {
      if (formContactSearch.length < 2) return []
      const table = formContactType === 'client' ? 'clients' : 'prospects'
      const { data } = await supabase
        .from(table)
        .select('id, first_name, last_name, company_name')
        .or(`first_name.ilike.%${formContactSearch}%,last_name.ilike.%${formContactSearch}%,company_name.ilike.%${formContactSearch}%`)
        .limit(8)
      return (data ?? []).map(c => ({
        id: c.id,
        name: c.company_name || `${c.first_name} ${c.last_name}`,
      }))
    },
    enabled: formContactSearch.length >= 2,
    staleTime: 5000,
  })

  // RDV data
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}T23:59:59`

  const { data: rdvs = [], isLoading } = useQuery({
    queryKey: ['agenda', 'rdvs', year, month],
    queryFn: () => getAgendaRdvs(monthStart, monthEnd),
    staleTime: 30_000,
  })

  // Mutations
  const createMut = useMutation({
    mutationFn: createRdv,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agenda'] }); toast.success('RDV créé'); handleCloseCreate() },
    onError: () => toast.error('Erreur lors de la création'),
  })
  const completeMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string | null }) => completeRdv(id, notes),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agenda'] }); toast.success('RDV marqué comme effectué'); setSelectedRdv(null) },
  })
  const deleteMut = useMutation({
    mutationFn: deleteRdv,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agenda'] }); toast.success('RDV supprimé'); setDeleteTarget(null); setSelectedRdv(null) },
  })

  // Calendar grid
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const rdvsByDate = useMemo(() => {
    const map = new Map<string, AgendaRdv[]>()
    for (const r of rdvs) {
      const d = r.scheduled_at.split('T')[0]
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(r)
    }
    return map
  }, [rdvs])

  const today = toDateStr(new Date())

  // Handlers
  function handleCloseCreate() {
    setCreateOpen(false)
    setFormSubject(''); setFormDate(''); setFormTime('09:00'); setFormNotes('')
    setFormContactSearch(''); setFormContactId(''); setFormContactName('')
  }

  function handleSubmitCreate() {
    if (!formSubject.trim() || !formDate || !formContactId || !user) return
    createMut.mutate({
      activity_type: formType,
      subject: formSubject.trim(),
      description: null,
      scheduled_at: `${formDate}T${formTime}:00`,
      follow_up_notes: formNotes.trim() || null,
      assigned_to: user.id,
      created_by: user.id,
      prospect_id: formContactType === 'prospect' ? formContactId : null,
      client_id: formContactType === 'client' ? formContactId : null,
      is_completed: false,
    })
  }

  const prevMonth = useCallback(() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
  const nextMonth = useCallback(() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])
  const goToday = useCallback(() => setCurrentDate(new Date()), [])

  // List filter
  const filteredListRdvs = useMemo(() => {
    const now = new Date()
    const todayStr = toDateStr(now)
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() + (7 - now.getDay()))
    const weekEndStr = toDateStr(weekEnd)

    return rdvs.filter(r => {
      const d = r.scheduled_at.split('T')[0]
      if (listFilter === 'today') return d === todayStr
      if (listFilter === 'week') return d >= todayStr && d <= weekEndStr
      if (listFilter === 'pending') return !r.is_completed && r.scheduled_at > now.toISOString()
      return true
    })
  }, [rdvs, listFilter])

  // Stats
  const stats = useMemo(() => {
    const upcoming = rdvs.filter(r => !r.is_completed && r.scheduled_at > new Date().toISOString())
    const completed = rdvs.filter(r => r.is_completed)
    return { total: rdvs.length, upcoming: upcoming.length, completed: completed.length }
  }, [rdvs])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Agenda commercial"
        description={`${stats.upcoming} RDV à venir · ${stats.completed} effectués ce mois`}
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setView('calendar')} className={`p-1.5 rounded-md transition-colors ${view === 'calendar' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500'}`}>
                <CalendarDays className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>Nouveau RDV</Button>
          </div>
        }
      />

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {view === 'calendar' ? (
            /* ---- CALENDAR VIEW ---- */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Nav */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
                  <h2 className="text-base font-semibold text-slate-900 min-w-[160px] text-center">
                    {MONTH_NAMES[month]} {year}
                  </h2>
                  <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <button onClick={goToday} className="text-xs text-primary-600 font-medium hover:underline">Aujourd'hui</button>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 border-b border-slate-100">
                {DAY_LABELS.map(d => (
                  <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase">{d}</div>
                ))}
              </div>

              {isLoading ? (
                <div className="p-8 flex justify-center"><Skeleton className="w-full h-64" /></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {grid.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 divide-x divide-slate-100">
                      {week.map((day, di) => {
                        if (!day) return <div key={di} className="min-h-[80px] bg-slate-50/50" />
                        const dateStr = toDateStr(day)
                        const dayRdvs = rdvsByDate.get(dateStr) ?? []
                        const isToday = dateStr === today
                        return (
                          <div
                            key={di}
                            className={`min-h-[80px] p-1 cursor-pointer hover:bg-slate-50 transition-colors ${isToday ? 'bg-primary-50/50' : ''}`}
                            onClick={() => { setFormDate(dateStr); setCreateOpen(true) }}
                          >
                            <div className={`text-xs font-medium mb-1 ${isToday ? 'w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center' : 'text-slate-600 pl-1'}`}>
                              {day.getDate()}
                            </div>
                            {dayRdvs.slice(0, 3).map(r => {
                              const cfg = typeConfig[r.activity_type] || typeConfig.visite
                              return (
                                <button
                                  key={r.id}
                                  onClick={e => { e.stopPropagation(); setSelectedRdv(r) }}
                                  className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate ${r.is_completed ? 'bg-slate-100 text-slate-400 line-through' : `${cfg.bg} ${cfg.color}`}`}
                                >
                                  {fmtTime(r.scheduled_at)} {contactName(r)}
                                </button>
                              )
                            })}
                            {dayRdvs.length > 3 && <p className="text-[10px] text-slate-400 pl-1">+{dayRdvs.length - 3}</p>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ---- LIST VIEW (improved) ---- */
            <div>
              {/* Filter tabs */}
              <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
                {[
                  { key: 'all', label: 'Tout' },
                  { key: 'today', label: "Aujourd'hui" },
                  { key: 'week', label: 'Cette semaine' },
                  { key: 'pending', label: 'À venir' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setListFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      listFilter === tab.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {filteredListRdvs.length === 0 ? (
                  <p className="p-8 text-center text-slate-400 text-sm">Aucun RDV</p>
                ) : (
                  <div>
                    {/* Group by day with headers */}
                    {(() => {
                      let lastDate = ''
                      return filteredListRdvs.map(r => {
                        const dateStr = r.scheduled_at.split('T')[0]
                        const showHeader = dateStr !== lastDate
                        lastDate = dateStr
                        const cfg = typeConfig[r.activity_type] || typeConfig.visite
                        const Icon = cfg.icon
                        const now = new Date().toISOString()
                        const isOverdue = !r.is_completed && r.scheduled_at < now

                        // Day label
                        const dayLabel = dateStr === today ? "Aujourd'hui"
                          : dateStr === (() => { const t = new Date(); t.setDate(t.getDate() + 1); return toDateStr(t) })() ? 'Demain'
                          : fmtDateFull(r.scheduled_at)

                        return (
                          <div key={r.id}>
                            {showHeader && (
                              <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase">{dayLabel}</p>
                              </div>
                            )}
                            <button
                              onClick={() => setSelectedRdv(r)}
                              className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
                            >
                              {/* Status indicator */}
                              <div className={`w-1.5 h-10 rounded-full shrink-0 ${
                                r.is_completed ? 'bg-emerald-400' : isOverdue ? 'bg-red-400' : 'bg-blue-400'
                              }`} />
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${r.is_completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{r.subject}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-xs text-slate-500">{contactName(r)}</span>
                                  {(r.client || r.prospect)?.city && (
                                    <span className="text-xs text-slate-400 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{(r.client || r.prospect)!.city}</span>
                                  )}
                                  {(r.client || r.prospect)?.phone && (
                                    <span className="text-xs text-slate-400 flex items-center gap-0.5"><Phone className="w-3 h-3" />{(r.client || r.prospect)!.phone}</span>
                                  )}
                                </div>
                                {r.follow_up_notes && (
                                  <p className="text-[11px] text-slate-400 mt-1 truncate max-w-md">📋 {r.follow_up_notes}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-slate-700">{fmtTime(r.scheduled_at)}</p>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${
                                  r.is_completed ? 'bg-emerald-100 text-emerald-700'
                                    : isOverdue ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {r.is_completed ? <><CheckCircle2 className="w-3 h-3" />Effectué</>
                                    : isOverdue ? <><AlertCircle className="w-3 h-3" />En retard</>
                                    : <><Clock className="w-3 h-3" />Planifié</>}
                                </span>
                              </div>
                            </button>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---- DETAIL PANEL (fiche de préparation) ---- */}
        {selectedRdv && (
          <div className="w-96 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col shrink-0 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Fiche RDV</h3>
              <button onClick={() => setSelectedRdv(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* RDV Info */}
              <div>
                <p className="text-lg font-bold text-slate-900">{selectedRdv.subject}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <span>{fmtDateFull(selectedRdv.scheduled_at)} à {fmtTime(selectedRdv.scheduled_at)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {(() => { const cfg = typeConfig[selectedRdv.activity_type] || typeConfig.visite; return (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      <cfg.icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  )})()}
                  {selectedRdv.is_completed && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />Effectué
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              {(selectedRdv.client || selectedRdv.prospect) && (() => {
                const c = selectedRdv.client || selectedRdv.prospect!
                return (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-900">{c.company_name || `${c.first_name} ${c.last_name}`}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{selectedRdv.client ? 'Client' : 'Prospect'}</span>
                    </div>
                    {c.phone && <p className="text-xs text-slate-600 flex items-center gap-1.5"><Phone className="w-3 h-3" />{c.phone}</p>}
                    {c.email && <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5"><Mail className="w-3 h-3" />{c.email}</p>}
                    {c.city && <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5"><MapPin className="w-3 h-3" />{c.city}</p>}
                  </div>
                )
              })()}

              {/* Email actions */}
              {(selectedRdv.client || selectedRdv.prospect)?.email && !selectedRdv.is_completed && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const c = selectedRdv.client || selectedRdv.prospect!
                      const name = c.company_name || `${c.first_name} ${c.last_name}`
                      setEmailSending('confirm')
                      try {
                        const cfg = typeConfig[selectedRdv.activity_type] || typeConfig.visite
                        const email = buildRdvConfirmationEmail({
                          clientName: name,
                          rdvDate: fmtDateFull(selectedRdv.scheduled_at),
                          rdvTime: fmtTime(selectedRdv.scheduled_at),
                          rdvType: cfg.label,
                          rdvSubject: selectedRdv.subject,
                        })
                        await sendClientEmail({
                          recipient_email: c.email!,
                          recipient_name: name,
                          subject: email.subject,
                          html_content: email.html,
                          client_id: selectedRdv.client_id,
                          prospect_id: selectedRdv.prospect_id,
                          email_type: 'rdv_confirmation',
                        })
                        toast.success('Email envoyé', 'Confirmation de RDV envoyée')
                      } catch { toast.error('Erreur', "L'email n'a pas pu être envoyé") }
                      finally { setEmailSending(null) }
                    }}
                    disabled={emailSending !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors disabled:opacity-50"
                  >
                    {emailSending === 'confirm' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    Confirmer par email
                  </button>
                  <button
                    onClick={async () => {
                      const c = selectedRdv.client || selectedRdv.prospect!
                      const name = c.company_name || `${c.first_name} ${c.last_name}`
                      setEmailSending('remind')
                      try {
                        const email = buildRdvReminderEmail({
                          clientName: name,
                          rdvDate: fmtDateFull(selectedRdv.scheduled_at),
                          rdvTime: fmtTime(selectedRdv.scheduled_at),
                          rdvSubject: selectedRdv.subject,
                        })
                        await sendClientEmail({
                          recipient_email: c.email!,
                          recipient_name: name,
                          subject: email.subject,
                          html_content: email.html,
                          client_id: selectedRdv.client_id,
                          prospect_id: selectedRdv.prospect_id,
                          email_type: 'rdv_reminder',
                        })
                        toast.success('Email envoyé', 'Rappel de RDV envoyé')
                      } catch { toast.error('Erreur', "L'email n'a pas pu être envoyé") }
                      finally { setEmailSending(null) }
                    }}
                    disabled={emailSending !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {emailSending === 'remind' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                    Rappel par email
                  </button>
                </div>
              )}

              {/* AI Preparation — always visible, positioned prominently */}
              <div className="border-t border-slate-100 pt-3">
                <button
                    onClick={async () => {
                      setAiLoading(true)
                      setAiPrep(null)
                      try {
                        const ctx = await getRdvContext(selectedRdv)
                        const prompt = `${`Tu es un assistant commercial pour ${brand.name}, ${brand.aiContext}.`}

Prépare un briefing pour un rendez-vous commercial avec les informations suivantes :

**RDV :** ${ctx.rdvSubject} (${ctx.rdvType})
**Contact :** ${ctx.contactName} (${ctx.contactType})
**Ville :** ${ctx.contactCity || 'Non renseignée'}
**Client depuis :** ${ctx.clientSince ? new Date(ctx.clientSince).toLocaleDateString('fr-FR') : 'Nouveau'}
**Type contrat :** ${ctx.contractType || 'Aucun'}
${ctx.contractEndDate ? `**Fin contrat :** ${new Date(ctx.contractEndDate).toLocaleDateString('fr-FR')}` : ''}
**CA total facturé :** ${ctx.totalInvoiced.toLocaleString('fr-FR')}€
${ctx.lastQuote ? `**Dernier devis :** ${ctx.lastQuote.reference} — ${ctx.lastQuote.title} — ${ctx.lastQuote.total_ttc}€ (${ctx.lastQuote.status})` : '**Aucun devis précédent**'}
**Dernières interactions :** ${ctx.recentActivities.length > 0 ? ctx.recentActivities.map(a => `${a.type}: ${a.subject}`).join(', ') : 'Aucune'}

Génère un briefing structuré avec :
1. **Résumé contexte** (2-3 lignes sur le client)
2. **Points à aborder** (3-5 bullet points prioritaires)
3. **Questions à poser** (3-4 questions pour qualifier le besoin)
4. **Argumentaire** (2-3 arguments adaptés au profil)
5. **Objectif du RDV** (1 phrase claire)

Sois concis et actionnable. Pas de formules de politesse.`

                        const result = await generateAiContent({
                          context: 'freeform',
                          prompt,
                          action: 'generate',
                        })
                        setAiPrep(result.generated_text)
                        // Sauvegarder la prépa IA dans follow_up_notes
                        await supabase
                          .from('commercial_activities')
                          .update({ follow_up_notes: result.generated_text })
                          .eq('id', selectedRdv.id)
                      } catch {
                        setAiPrep('Erreur lors de la génération. Vérifiez la connexion.')
                      } finally {
                        setAiLoading(false)
                      }
                    }}
                    disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? 'Préparation en cours...' : 'Préparer avec l\'IA'}
                  </button>

                  {aiPrep && (
                    <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                        <span className="text-xs font-semibold text-violet-700">Briefing IA</span>
                      </div>
                      <div
                        className="text-sm text-violet-900 leading-relaxed prose prose-sm prose-violet max-w-none
                          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-violet-800 [&_h2]:mt-3 [&_h2]:mb-1.5
                          [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-violet-700 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:uppercase [&_h3]:tracking-wide
                          [&_ul]:mt-1 [&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:space-y-0.5
                          [&_li]:text-sm [&_li]:text-violet-800
                          [&_p]:mb-1.5 [&_p]:text-violet-800
                          [&_strong]:text-violet-900"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(aiPrep
                            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/^[•\-] (.+)$/gm, '<li>$1</li>')
                            .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
                            .replace(/\n{2,}/g, '</p><p>')
                            .replace(/\n/g, '<br/>'))
                            .replace(/^(?!<[hul])/gm, (line) => line ? `<p>${line}` : '')
                        }}
                      />
                    </div>
                  )}
              </div>

              {/* Preparation notes */}
              {selectedRdv.follow_up_notes && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Notes de préparation</h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{selectedRdv.follow_up_notes}</p>
                  </div>
                </div>
              )}

              {/* Result (if completed) */}
              {selectedRdv.is_completed && selectedRdv.description && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Résultat du RDV</h4>
                  <p className="text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{selectedRdv.description}</p>
                </div>
              )}

              {/* Mark as completed */}
              {!selectedRdv.is_completed && (
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Compte-rendu</h4>
                  <textarea
                    value={completionNotes}
                    onChange={e => setCompletionNotes(e.target.value)}
                    placeholder="Résumé du RDV, prochaines étapes..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-2"
                  />
                  <button
                    onClick={async () => {
                      setCrLoading(true)
                      try {
                        const ctx = await getRdvContext(selectedRdv)
                        const briefing = aiPrep ? `\nBriefing préparé:\n${aiPrep}` : ''
                        const notesPrep = selectedRdv.follow_up_notes ? `\nNotes de préparation: ${selectedRdv.follow_up_notes}` : ''
                        const userNotes = completionNotes ? `\nNotes saisies par le commercial: ${completionNotes}` : ''

                        const result = await generateAiContent({
                          context: 'freeform',
                          prompt: `${`Tu es un assistant commercial pour ${brand.name}.`}

Génère un compte-rendu professionnel et concis pour ce rendez-vous :

**RDV :** ${ctx.rdvSubject} (${ctx.rdvType})
**Contact :** ${ctx.contactName} (${ctx.contactType})
**Date :** ${new Date(selectedRdv.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
**CA client :** ${ctx.totalInvoiced.toLocaleString('fr-FR')}€
${ctx.lastQuote ? `**Dernier devis :** ${ctx.lastQuote.reference} — ${ctx.lastQuote.total_ttc}€ (${ctx.lastQuote.status})` : ''}
${notesPrep}${briefing}${userNotes}

Structure du compte-rendu :
1. Contexte (1 phrase)
2. Points abordés (3-5 bullet points)
3. Décisions prises
4. Actions à mener (avec responsable et délai si possible)
5. Prochaine étape

Format texte simple, pas de markdown. Sois factuel et concis.`,
                          action: 'generate',
                        })
                        setCompletionNotes(result.generated_text)
                      } catch {
                        // silently fail
                      } finally {
                        setCrLoading(false)
                      }
                    }}
                    disabled={crLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 mb-2 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-200 transition-colors disabled:opacity-50"
                  >
                    {crLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {crLoading ? 'Génération...' : 'Générer le compte-rendu avec l\'IA'}
                  </button>
                  <button
                    onClick={() => completeMut.mutate({ id: selectedRdv.id, notes: completionNotes || null })}
                    disabled={completeMut.isPending || !completionNotes.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {completeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Marquer comme effectué
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => setDeleteTarget(selectedRdv)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />Supprimer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- CREATE MODAL ---- */}
      <Modal open={createOpen} onClose={handleCloseCreate}>
          <ModalHeader title="Nouveau rendez-vous" />
          <div className="p-5 space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Type de RDV</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFormType(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      formType === key ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-1 ring-current` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Contact</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setFormContactType('prospect')} className={`text-xs px-3 py-1 rounded-full ${formContactType === 'prospect' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>Prospect</button>
                <button onClick={() => setFormContactType('client')} className={`text-xs px-3 py-1 rounded-full ${formContactType === 'client' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>Client</button>
              </div>
              {formContactId ? (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-900 flex-1">{formContactName}</span>
                  <button onClick={() => { setFormContactId(''); setFormContactName(''); setFormContactSearch('') }} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={formContactSearch}
                    onChange={e => setFormContactSearch(e.target.value)}
                    placeholder={`Rechercher un ${formContactType}...`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {searchResults.map(r => (
                        <button key={r.id} onClick={() => { setFormContactId(r.id); setFormContactName(r.name); setFormContactSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">{r.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Heure</label>
                <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Objet du RDV</label>
              <input type="text" value={formSubject} onChange={e => setFormSubject(e.target.value)}
                placeholder="Ex: Présentation devis aménagement jardin"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            {/* Prep notes */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Notes de préparation</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                rows={3} placeholder="Documents à apporter, points à aborder, informations à préparer..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
          </div>
          <ModalFooter>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={handleCloseCreate}>Annuler</Button>
              <Button
                onClick={handleSubmitCreate}
                disabled={!formSubject.trim() || !formDate || !formContactId || createMut.isPending}
              >
                {createMut.isPending ? 'Création...' : 'Créer le RDV'}
              </Button>
            </div>
          </ModalFooter>
        </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer ce RDV ?"
        message={deleteTarget ? `Le RDV "${deleteTarget.subject}" sera définitivement supprimé.` : ''}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
