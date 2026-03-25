import { useState, useMemo } from 'react'
import {
  Users, Plus, Trash2, Star, StarOff, UserPlus, X,
} from 'lucide-react'
import { Modal, ModalHeader } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../components/feedback/ToastProvider'
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMember,
} from '../../../queries/usePlanning'
import { usePersonnel } from '../../../queries/useResources'
import { useVehicles } from '../../../queries/useResources'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PRESET_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5',
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TeamWithMembers {
  id: string
  name: string
  color: string
  leader_id: string | null
  default_vehicle_id: string | null
  is_active: boolean
  members?: Array<{
    id: string
    is_team_leader: boolean
    joined_at: string
    profile?: {
      id: string
      first_name: string
      last_name: string
      role: string
      avatar_url: string | null
    }
  }>
}

interface Props {
  open: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TeamManagementModal({ open, onClose }: Props) {
  const toast = useToast()
  const { data: teams = [] } = useTeams()
  const { data: personnel = [] } = usePersonnel()
  const { data: vehicles = [] } = useVehicles()

  const createTeam = useCreateTeam()
  const updateTeamMut = useUpdateTeam()
  const deleteTeamMut = useDeleteTeam()
  const addMember = useAddTeamMember()
  const removeMember = useRemoveTeamMember()
  const updateMember = useUpdateTeamMember()

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [editVehicleId, setEditVehicleId] = useState<string>('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)

  const selectedTeam = useMemo(
    () => (teams as TeamWithMembers[]).find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  )

  const teamMembers = selectedTeam?.members ?? []
  const memberProfileIds = useMemo(
    () => new Set(teamMembers.map((m) => m.profile?.id).filter(Boolean)),
    [teamMembers],
  )

  const availablePersonnel = useMemo(
    () => (personnel as Array<{ id: string; first_name: string; last_name: string; role: string }>)
      .filter((p) => !memberProfileIds.has(p.id)),
    [personnel, memberProfileIds],
  )

  // --- Handlers ---

  function handleSelectTeam(team: TeamWithMembers) {
    setSelectedTeamId(team.id)
    setEditName(team.name)
    setEditColor(team.color)
    setEditVehicleId(team.default_vehicle_id ?? '')
    setIsCreating(false)
    setShowAddMember(false)
  }

  function handleNewTeam() {
    setSelectedTeamId(null)
    setIsCreating(true)
    setEditName('')
    setEditColor(PRESET_COLORS[0])
    setEditVehicleId('')
    setShowAddMember(false)
  }

  function handleSave() {
    if (!editName.trim()) return

    if (isCreating) {
      createTeam.mutate(
        {
          name: editName.trim(),
          color: editColor,
          default_vehicle_id: editVehicleId || null,
        },
        {
          onSuccess: (newTeam) => {
            setSelectedTeamId(newTeam.id)
            setIsCreating(false)
            toast.success('Équipe créée')
          },
          onError: (err) => toast.error('Erreur création équipe', (err as Error).message),
        },
      )
    } else if (selectedTeamId) {
      updateTeamMut.mutate(
        {
          id: selectedTeamId,
          data: {
            name: editName.trim(),
            color: editColor,
            default_vehicle_id: editVehicleId || null,
          },
        },
        {
          onSuccess: () => toast.success('Équipe mise à jour'),
          onError: (err) => toast.error('Erreur mise à jour', (err as Error).message),
        },
      )
    }
  }

  function handleDelete() {
    if (!deleteConfirmId) return
    deleteTeamMut.mutate(deleteConfirmId, {
      onSuccess: () => {
        if (selectedTeamId === deleteConfirmId) {
          setSelectedTeamId(null)
          setIsCreating(false)
        }
        setDeleteConfirmId(null)
        toast.success('Équipe supprimée')
      },
      onError: (err) => toast.error('Erreur suppression', (err as Error).message),
    })
  }

  function handleAddMember(profileId: string) {
    if (!selectedTeamId) return
    addMember.mutate(
      { teamId: selectedTeamId, profileId },
      {
        onSuccess: () => toast.success('Membre ajouté'),
        onError: (err) => toast.error('Erreur ajout membre', (err as Error).message),
      },
    )
    setShowAddMember(false)
  }

  function handleRemoveMember(memberId: string) {
    removeMember.mutate(memberId)
  }

  function handleToggleLeader(memberId: string, currentValue: boolean) {
    updateMember.mutate({ memberId, data: { is_team_leader: !currentValue } })
  }

  const isSaving = createTeam.isPending || updateTeamMut.isPending

  return (
    <>
      <Modal open={open} onClose={onClose} size="xl">
        <ModalHeader title="Gestion des equipes" onClose={onClose}>
          <Users className="w-5 h-5 text-primary-600" />
        </ModalHeader>

        <div className="flex min-h-[400px] max-h-[65vh]">
          {/* Left panel — Team list */}
          <div className="w-64 shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50/50">
            <div className="p-3 space-y-1">
              {(teams as TeamWithMembers[]).map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors',
                    selectedTeamId === team.id && !isCreating
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="truncate flex-1">{team.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {team.members?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-slate-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNewTeam}
                className="w-full justify-center"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle equipe
              </Button>
            </div>
          </div>

          {/* Right panel — Team detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedTeam && !isCreating ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                Selectionnez une equipe ou creez-en une nouvelle
              </div>
            ) : (
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Nom de l'equipe
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ex: Equipe Entretien Nord"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Couleur
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          editColor === color
                            ? 'border-slate-800 scale-110 shadow-md'
                            : 'border-transparent hover:scale-105',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Default vehicle */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Vehicule par defaut
                  </label>
                  <select
                    value={editVehicleId}
                    onChange={(e) => setEditVehicleId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                  >
                    <option value="">Aucun vehicule</option>
                    {(vehicles as Array<{ id: string; registration_plate: string; brand: string; model: string }>).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration_plate} — {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    loading={isSaving}
                    disabled={!editName.trim()}
                    size="sm"
                  >
                    {isCreating ? 'Creer l\'equipe' : 'Sauvegarder'}
                  </Button>
                  {!isCreating && selectedTeamId && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteConfirmId(selectedTeamId)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </Button>
                  )}
                </div>

                {/* Members (only for existing teams) */}
                {!isCreating && selectedTeamId && (
                  <div className="border-t border-slate-200 pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">
                        Membres ({teamMembers.length})
                      </h3>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAddMember(!showAddMember)}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Ajouter
                      </Button>
                    </div>

                    {/* Add member dropdown */}
                    {showAddMember && (
                      <div className="mb-3 border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto">
                        {availablePersonnel.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">
                            Tous les employes sont deja membres
                          </p>
                        ) : (
                          availablePersonnel.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleAddMember(p.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                              {p.first_name} {p.last_name}
                              <span className="text-[10px] text-slate-400 ml-auto">
                                {p.role}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Member list */}
                    <div className="space-y-1">
                      {teamMembers.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">
                          Aucun membre dans cette equipe
                        </p>
                      ) : (
                        teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {member.profile?.first_name} {member.profile?.last_name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {member.profile?.role}
                              </p>
                            </div>

                            <button
                              onClick={() => handleToggleLeader(member.id, member.is_team_leader)}
                              title={member.is_team_leader ? 'Retirer chef d\'equipe' : 'Definir chef d\'equipe'}
                              className={cn(
                                'p-1 rounded transition-colors',
                                member.is_team_leader
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-slate-300 hover:text-slate-500',
                              )}
                            >
                              {member.is_team_leader ? (
                                <Star className="w-4 h-4 fill-current" />
                              ) : (
                                <StarOff className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              title="Retirer de l'equipe"
                              className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Supprimer l'equipe"
        message="Cette equipe sera desactivee. Les interventions planifiees resteront en place."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteTeamMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </>
  )
}
