import { useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { Plus, PanelLeftClose, PanelLeftOpen, Undo2, ChevronDown, ChevronUp, Users, Calendar } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Tabs } from '../../../components/navigation/Tabs'
import { PlanningToolbar } from '../components/PlanningToolbar'
import { PlanningSearch } from '../components/PlanningSearch'
import { WeekView } from '../components/WeekView'
import { MonthView } from '../components/MonthView'
import { DayView } from '../components/DayView'
import { TableView } from '../components/TableView'
import { AnnualView } from '../components/AnnualView'
import { CreateInterventionModal } from '../components/CreateInterventionModal'
import { TeamManagementModal } from '../components/TeamManagementModal'
import { EmargementPanel } from '../components/EmargementPanel'
import { ColorLegendModal } from '../components/ColorLegendModal'
import { CalendarSyncPanel } from '../components/CalendarSyncPanel'
import { ConflictConfirmDialog, type Conflict } from '../components/ConflictConfirmDialog'
import { PersonnelPanel } from '../components/sidebar/PersonnelPanel'
import { UnplannedJobsPanel } from '../components/sidebar/UnplannedJobsPanel'
import { KPIBar } from '../components/KPIBar'
import { WeatherWidget } from '../components/WeatherWidget'
const ZoneMap = lazy(() => import('../components/footer/ZoneMap').then(m => ({ default: m.ZoneMap })))
const AvailabilityCharts = lazy(() => import('../components/footer/AvailabilityCharts').then(m => ({ default: m.AvailabilityCharts })))
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import {
  useWeeklyPlanning,
  useMonthlyPlanning,
  useTeams,
  useMoveIntervention,
  useWeekAbsences,
  useTeamEquipment,
  useUnplannedChantiers,
  usePostponeChantier,
  useDeletePlanningSlot,
  usePersonnelWithAbsences,
  useAnnualSlotCounts,
  planningKeys,
} from '../../../queries/usePlanning'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/feedback/ToastProvider'
import { INTERVENTION_COLORS } from '../../../utils/constants'
import { getMonday, toDateStr } from '../utils/date-helpers'
import { getTeamDayAvailability } from '../utils/availability'
import { useUndoHistory } from '../hooks/useUndoHistory'
import type { PlanningSlot, Team } from '../../../types'

type PlanningView = 'month' | 'week' | 'day' | 'table' | 'annual'
type InterventionColorKey = keyof typeof INTERVENTION_COLORS

const VIEW_TABS = [
  { key: 'month', label: 'Mois' },
  { key: 'week', label: 'Semaine' },
  { key: 'day', label: 'Jour' },
  { key: 'table', label: 'Tableau' },
  { key: 'annual', label: 'Annuel' },
]

// ---------------------------------------------------------------------------
// PlanningPage - Main orchestrator
// ---------------------------------------------------------------------------
export function PlanningPage() {
  const [activeView, setActiveView] = useState<PlanningView>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [activeFilters, setActiveFilters] = useState<Set<InterventionColorKey>>(new Set())
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDefaults, setCreateModalDefaults] = useState<{ date?: string; teamId?: string }>({})
  const [emargementSlot, setEmargementSlot] = useState<PlanningSlot | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showLegend, setShowLegend] = useState(false)
  const [highlightedSlotIds, setHighlightedSlotIds] = useState<Set<string>>(new Set())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [pendingMove, setPendingMove] = useState<{ slotId: string; newTeamId: string; newDate: string; conflicts: Conflict[] } | null>(null)
  const [showFooter, setShowFooter] = useState(false)
  const [showTeamManager, setShowTeamManager] = useState(false)
  const [showCalendarSync, setShowCalendarSync] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const toast = useToast()
  const { pushAction, popAction, canUndo } = useUndoHistory()
  const queryClient = useQueryClient()

  // Derived dates
  const weekStartStr = toDateStr(getMonday(currentDate))
  const todayStr = toDateStr(new Date())
  const monthYear = currentDate.getFullYear()
  const monthIndex = currentDate.getMonth()

  // Queries
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, error: teamsErrorObj } = useTeams()
  const { data: weeklySlots = [], isLoading: weeklyLoading, isError: weeklyError, error: weeklyErrorObj } = useWeeklyPlanning(weekStartStr)
  const { data: monthlySlots = [], isLoading: monthlyLoading, isError: monthlyError } = useMonthlyPlanning(monthYear, monthIndex, activeView === 'month')
  const { data: weekAbsences = [] } = useWeekAbsences(weekStartStr)
  const { data: unplannedChantiers = [], isLoading: unplannedLoading } = useUnplannedChantiers()
  usePersonnelWithAbsences(todayStr) // pre-warm cache for availability checks
  const { data: annualCounts = {}, isLoading: annualLoading } = useAnnualSlotCounts(monthYear)

  // If a critical query errored, stop showing loading spinner
  const hasQueryError = teamsError || weeklyError || monthlyError
  const queryErrorMessage = teamsErrorObj?.message || weeklyErrorObj?.message || ''

  // Team IDs for equipment query
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const { data: teamEquipmentData } = useTeamEquipment(teamIds)

  // Build maps for vehicle/equipment per team
  const teamVehicleMap = useMemo(() => {
    const map = new Map<string, boolean>()
    if (teamEquipmentData) {
      for (const v of teamEquipmentData.vehicles) {
        if (v.assigned_team_id) map.set(v.assigned_team_id, true)
      }
    }
    return map
  }, [teamEquipmentData])

  const teamEquipmentMap = useMemo(() => {
    const map = new Map<string, boolean>()
    if (teamEquipmentData) {
      for (const e of teamEquipmentData.equipment) {
        if (e.assigned_team_id) map.set(e.assigned_team_id, true)
      }
    }
    return map
  }, [teamEquipmentData])

  // Filter teams by selection
  const visibleTeams = useMemo(() => {
    if (selectedTeamIds.size === 0) return teams
    return teams.filter((t) => selectedTeamIds.has(t.id))
  }, [teams, selectedTeamIds])

  const currentSlots = activeView === 'month' ? monthlySlots : weeklySlots
  const isLoading = !hasQueryError && (teamsLoading || (activeView === 'month' ? monthlyLoading : weeklyLoading))

  // Mutations
  const moveMutation = useMoveIntervention()
  const postponeMutation = usePostponeChantier()
  const deleteMutation = useDeletePlanningSlot()

  // Refresh handler
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: planningKeys.all })
    setLastRefresh(new Date())
    toast.success('Données rafraîchies')
  }, [queryClient, toast])

  // Filter toggles
  const toggleFilter = useCallback((type: InterventionColorKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const toggleTeam = useCallback((teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) {
        next.delete(teamId)
      } else {
        next.add(teamId)
      }
      return next
    })
  }, [])

  // Execute a move (called directly or after conflict confirmation)
  const executeMove = useCallback(
    (slotId: string, newTeamId: string, newDate: string) => {
      // Find original slot for undo
      const originalSlot = weeklySlots.find((s) => s.id === slotId)
      moveMutation.mutate(
        { slotId, newTeamId, newDate, weekStart: weekStartStr },
        {
          onSuccess: () => {
            toast.success('Intervention déplacée')
            if (originalSlot) {
              pushAction({
                type: 'move',
                slotId,
                previousTeamId: originalSlot.team_id,
                previousDate: originalSlot.slot_date,
                newTeamId,
                newDate,
              })
            }
          },
          onError: (err) => toast.error('Erreur lors du déplacement', (err as Error).message),
        },
      )
    },
    [moveMutation, weekStartStr, toast, weeklySlots, pushAction],
  )

  // Move slot handler with conflict detection
  const handleMoveSlot = useCallback(
    (slotId: string, newTeamId: string, newDate: string) => {
      const conflicts: Conflict[] = []
      const targetTeam = teams.find((t) => t.id === newTeamId) as Team & { members?: Array<{ id: string; is_team_leader: boolean; profile: { id: string; first_name: string; last_name: string; role: string; avatar_url: string | null } }> } | undefined

      // Check team availability
      if (targetTeam && weekAbsences.length > 0) {
        const availability = getTeamDayAvailability(targetTeam, weekAbsences, newDate)
        if (availability === 'none') {
          conflicts.push({ type: 'absence', message: `Aucun membre de ${targetTeam.name} n'est disponible ce jour` })
        } else if (availability === 'partial') {
          conflicts.push({ type: 'absence', message: `Équipe ${targetTeam.name} partiellement disponible (absences)` })
        }
      }

      // Check equipment
      if (targetTeam && teamVehicleMap && !teamVehicleMap.has(newTeamId)) {
        conflicts.push({ type: 'equipment', message: `${targetTeam.name} n'a pas de véhicule assigné` })
      }

      if (conflicts.length > 0) {
        setPendingMove({ slotId, newTeamId, newDate, conflicts })
      } else {
        executeMove(slotId, newTeamId, newDate)
      }
    },
    [teams, weekAbsences, teamVehicleMap, executeMove],
  )

  // Undo last move
  const handleUndo = useCallback(() => {
    const action = popAction()
    if (action && action.type === 'move') {
      executeMove(action.slotId, action.previousTeamId, action.previousDate)
      toast.success('Déplacement annulé')
    }
  }, [popAction, executeMove, toast])

  // Cell click → open create modal with date/team prefilled
  const handleCellClick = useCallback(
    (teamId: string, _teamName: string, date: string) => {
      setCreateModalDefaults({ date, teamId })
      setShowCreateModal(true)
    },
    [],
  )

  // "Nouvelle intervention" button
  const handleNewIntervention = useCallback(() => {
    setCreateModalDefaults({ date: toDateStr(currentDate) })
    setShowCreateModal(true)
  }, [currentDate])

  // Day click from MonthView → switch to DayView
  const handleDayClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setActiveView('day')
  }, [])

  const handleViewChange = useCallback((key: string) => {
    setActiveView(key as PlanningView)
  }, [])

  // Slot click → open emargement panel
  const handleSlotClick = useCallback((slot: PlanningSlot) => {
    setEmargementSlot(slot)
  }, [])

  // Annual view → click month → switch to month view
  const handleAnnualMonthClick = useCallback((month: number) => {
    const d = new Date(currentDate)
    d.setMonth(month)
    setCurrentDate(d)
    setActiveView('month')
  }, [currentDate])

  // Search highlight callback
  const handleHighlightChange = useCallback((ids: Set<string>) => {
    setHighlightedSlotIds(ids)
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewIntervention: handleNewIntervention,
    onSearch: () => searchRef.current?.focus(),
    onUndo: canUndo ? handleUndo : undefined,
    onEscape: () => {
      setEmargementSlot(null)
      setShowCreateModal(false)
      setShowLegend(false)
      setPendingMove(null)
    },
  })

  // Sidebar actions
  const handlePostpone = useCallback(
    (id: string, days: number) => {
      postponeMutation.mutate(
        { id, days },
        {
          onSuccess: () => toast.success('Chantier reporté'),
          onError: (err) => toast.error('Erreur', (err as Error).message),
        },
      )
    },
    [postponeMutation, toast],
  )

  const handleDeleteChantier = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Chantier supprimé'),
        onError: (err) => toast.error('Erreur', (err as Error).message),
      })
    },
    [deleteMutation, toast],
  )

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Planning"
        description="Gestion des interventions par équipe"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              title={sidebarOpen ? 'Masquer le panneau' : 'Afficher le panneau'}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            {canUndo && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                title="Annuler le dernier déplacement (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowCalendarSync(true)}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              title="Synchroniser le calendrier"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowTeamManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Users className="w-4 h-4" />
              Equipes
            </button>
            <button
              onClick={handleNewIntervention}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle intervention
            </button>
          </div>
        }
      />

      {/* Main layout: Sidebar + Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <div className="w-[260px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 border-b border-slate-200">
              <PersonnelPanel teams={teams} isLoading={teamsLoading} />
            </div>
            <div className="flex-1 min-h-0">
              <UnplannedJobsPanel
                chantiers={unplannedChantiers}
                isLoading={unplannedLoading}
                onPostpone={handlePostpone}
                onDelete={handleDeleteChantier}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 p-4 pt-0">
          {/* View Tabs + Search + Weather */}
          <div className="flex items-center gap-4 mb-4">
            <Tabs
              tabs={VIEW_TABS}
              activeTab={activeView}
              onChange={handleViewChange}
            />
            <div className="flex-1 max-w-xs">
              <PlanningSearch slots={currentSlots} onHighlightChange={handleHighlightChange} inputRef={searchRef} />
            </div>
            <WeatherWidget />
          </div>

          {/* Toolbar */}
          <PlanningToolbar
            view={activeView}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            teams={teams}
            selectedTeamIds={selectedTeamIds}
            onToggleTeam={toggleTeam}
            slotCount={currentSlots.length}
            onRefresh={handleRefresh}
            lastRefresh={lastRefresh}
            onOpenLegend={() => setShowLegend(true)}
          />

          {/* KPI Bar */}
          <KPIBar
            slots={currentSlots}
            teams={teams}
            absences={weekAbsences}
            unplannedCount={unplannedChantiers.length}
            currentDate={currentDate}
          />

          {/* Error banner */}
          {hasQueryError && (
            <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <p className="text-sm text-red-700">
                Erreur de chargement des données{queryErrorMessage ? ` : ${queryErrorMessage}` : ''}
              </p>
              <button
                onClick={handleRefresh}
                className="text-xs font-medium text-red-600 hover:text-red-800 underline"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Active View */}
          {activeView === 'month' && (
            <MonthView
              currentDate={currentDate}
              slots={monthlySlots}
              activeFilters={activeFilters}
              isLoading={isLoading}
              onDayClick={handleDayClick}
            />
          )}

          {activeView === 'week' && (
            <WeekView
              currentDate={currentDate}
              teams={visibleTeams}
              slots={weeklySlots}
              activeFilters={activeFilters}
              isLoading={isLoading}
              onMoveSlot={handleMoveSlot}
              onCellClick={handleCellClick}
              onSlotClick={handleSlotClick}
              absences={weekAbsences}
              highlightedSlotIds={highlightedSlotIds}
              teamVehicleMap={teamVehicleMap}
              teamEquipmentMap={teamEquipmentMap}
            />
          )}

          {activeView === 'day' && (
            <DayView
              currentDate={currentDate}
              teams={visibleTeams}
              slots={weeklySlots}
              activeFilters={activeFilters}
              isLoading={isLoading}
              onCellClick={handleCellClick}
              onSlotClick={handleSlotClick}
            />
          )}

          {activeView === 'table' && (
            <TableView
              slots={weeklySlots}
              activeFilters={activeFilters}
              isLoading={weeklyLoading}
              onSlotClick={handleSlotClick}
              highlightedSlotIds={highlightedSlotIds}
            />
          )}

          {activeView === 'annual' && (
            <AnnualView
              year={monthYear}
              slotCounts={annualCounts}
              isLoading={annualLoading}
              onMonthClick={handleAnnualMonthClick}
            />
          )}

          {/* Collapsible Footer */}
          <div className="mt-3">
            <button
              onClick={() => setShowFooter((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {showFooter ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              {showFooter ? 'Masquer le tableau de bord' : 'Tableau de bord'}
            </button>
            {showFooter && (
              <Suspense fallback={<div className="grid grid-cols-2 gap-3 mt-2 h-[200px]"><div className="bg-white border border-slate-200 rounded-lg animate-pulse" /><div className="bg-white border border-slate-200 rounded-lg animate-pulse" /></div>}>
                <div className="grid grid-cols-2 gap-3 mt-2 h-[200px]">
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <ZoneMap slots={currentSlots} date={todayStr} />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 overflow-hidden">
                    <AvailabilityCharts
                      teams={teams}
                      absences={weekAbsences}
                      vehicles={teamEquipmentData?.vehicles ?? []}
                      equipment={teamEquipmentData?.equipment ?? []}
                      currentDate={currentDate}
                    />
                  </div>
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* Create Intervention Modal */}
      {showCreateModal && (
        <CreateInterventionModal
          defaultDate={createModalDefaults.date}
          defaultTeamId={createModalDefaults.teamId}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Team Management Modal */}
      <TeamManagementModal
        open={showTeamManager}
        onClose={() => setShowTeamManager(false)}
      />

      {/* Calendar Sync Panel */}
      <CalendarSyncPanel
        open={showCalendarSync}
        onClose={() => setShowCalendarSync(false)}
      />

      {/* Color Legend Modal */}
      {showLegend && (
        <ColorLegendModal onClose={() => setShowLegend(false)} />
      )}

      {/* Conflict Confirm Dialog */}
      {pendingMove && (
        <ConflictConfirmDialog
          conflicts={pendingMove.conflicts}
          onConfirm={() => {
            executeMove(pendingMove.slotId, pendingMove.newTeamId, pendingMove.newDate)
            setPendingMove(null)
          }}
          onCancel={() => setPendingMove(null)}
        />
      )}

      {/* Emargement Panel */}
      {emargementSlot && (() => {
        const slotTeam = teams.find((t) => t.id === emargementSlot.team_id)
        if (!slotTeam) return null
        return (
          <EmargementPanel
            slot={emargementSlot}
            team={slotTeam}
            onClose={() => setEmargementSlot(null)}
            onDelete={handleDeleteChantier}
          />
        )
      })()}
    </div>
  )
}
