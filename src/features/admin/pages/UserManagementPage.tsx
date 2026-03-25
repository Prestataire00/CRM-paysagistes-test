import { brand } from '../../../config/brand'
import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Shield,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useUsers, useCreateUser, useUpdateUserRole, useUpdateUserProfile, useDeactivateUser, useUpdateProfileTeam } from '../../../queries/useAdmin'
import { useTeams, useAddTeamMember } from '../../../queries/usePlanning'
import { useVehicles, useUpdateVehicle } from '../../../queries/useResources'
import { useToast } from '../../../components/feedback/ToastProvider'
import { useAuth } from '../../../contexts/AuthContext'
import { ROLE_LABELS, Role } from '../../../types'
import type { User } from '../../../types'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { Button } from '../../../components/ui/Button'

// ---------------------------------------------------------------------------
// Role badge styling
// ---------------------------------------------------------------------------
const roleConfig: Record<string, { className: string }> = {
  super_admin: { className: 'bg-red-100 text-red-700 border-red-200' },
  admin: { className: 'bg-purple-100 text-purple-700 border-purple-200' },
  conducteur_travaux: { className: 'bg-blue-100 text-blue-700 border-blue-200' },
  responsable_commercial: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  commercial: { className: 'bg-teal-100 text-teal-700 border-teal-200' },
  comptabilite: { className: 'bg-amber-100 text-amber-700 border-amber-200' },
  facturation: { className: 'bg-orange-100 text-orange-700 border-orange-200' },
  jardinier: { className: 'bg-green-100 text-green-700 border-green-200' },
}

// All roles for the dropdown
const ALL_ROLES: Role[] = [
  'super_admin',
  'admin',
  'responsable_commercial',
  'commercial',
  'conducteur_travaux',
  'comptabilite',
  'facturation',
  'jardinier',
]

const EMPTY_FORM = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  role: 'commercial' as Role,
  team_id: '',
  vehicle_id: '',
}

const EMPTY_EDIT_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
}

// ---------------------------------------------------------------------------
// Password strength helper
// ---------------------------------------------------------------------------
function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: '', color: '', width: '0%' }
  if (password.length < 6) return { label: 'Trop court', color: 'bg-red-500', width: '33%' }
  if (password.length < 9) return { label: 'Moyen', color: 'bg-amber-500', width: '66%' }
  const hasMixed = /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)
  if (hasMixed) return { label: 'Fort', color: 'bg-green-500', width: '100%' }
  return { label: 'Moyen', color: 'bg-amber-500', width: '66%' }
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-4 w-40 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-24 bg-slate-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-14 bg-slate-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Helper: initials from first_name + last_name
// ---------------------------------------------------------------------------
function getInitials(user: User): string {
  const first = user.first_name?.[0] ?? ''
  const last = user.last_name?.[0] ?? ''
  return (first + last).toUpperCase()
}

function getFullName(user: User): string {
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Email validation regex
// ---------------------------------------------------------------------------
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function UserManagementPage() {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')

  // Create user modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  // Role change modal
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>('commercial')

  // Edit profile modal
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  // Deactivate confirm dialog
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null)

  const toast = useToast()
  const { user: currentUser } = useAuth()

  // Queries & mutations
  const { data: users = [], isLoading, isError, error: usersError } = useUsers()
  const { data: teams = [] } = useTeams()
  const { data: vehicles = [] } = useVehicles()
  const createUserMutation = useCreateUser()
  const updateRoleMutation = useUpdateUserRole()
  const updateProfileMutation = useUpdateUserProfile()
  const deactivateMutation = useDeactivateUser()
  const updateProfileTeamMutation = useUpdateProfileTeam()
  const addTeamMemberMutation = useAddTeamMember()
  const updateVehicleMutation = useUpdateVehicle()

  // Client-side filters
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = getFullName(user).toLowerCase()
      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = filterRole === 'all' || user.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, search, filterRole])

  // Role distribution computed from live data
  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const user of users) {
      counts[user.role] = (counts[user.role] || 0) + 1
    }
    return counts
  }, [users])

  // Handlers
  const isCreating = createUserMutation.isPending || updateProfileTeamMutation.isPending || addTeamMemberMutation.isPending

  const handleCreateUser = async () => {
    setCreateError(null)
    if (!createForm.email || !createForm.password || !createForm.first_name || !createForm.last_name) {
      setCreateError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    if (!emailRegex.test(createForm.email)) {
      toast.warning('Email invalide')
      return
    }
    if (createForm.password.length < 6) {
      setCreateError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (createForm.role === 'jardinier' && !createForm.team_id) {
      setCreateError('Veuillez sélectionner une équipe pour le jardinier.')
      return
    }
    try {
      const newUser = await createUserMutation.mutateAsync({
        email: createForm.email,
        password: createForm.password,
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        phone: createForm.phone || undefined,
        role: createForm.role,
      })

      // If jardinier, assign team + optional vehicle
      if (createForm.role === 'jardinier' && createForm.team_id) {
        try {
          await updateProfileTeamMutation.mutateAsync({
            id: newUser.id,
            defaultTeamId: createForm.team_id,
          })
          await addTeamMemberMutation.mutateAsync({
            teamId: createForm.team_id,
            profileId: newUser.id,
          })
          // Assign vehicle to team if selected and not already assigned
          if (createForm.vehicle_id) {
            const selectedVehicle = vehicles.find((v) => v.id === createForm.vehicle_id)
            if (selectedVehicle && selectedVehicle.assigned_team_id !== createForm.team_id) {
              await updateVehicleMutation.mutateAsync({
                id: createForm.vehicle_id,
                data: { assigned_team_id: createForm.team_id },
              })
            }
          }
        } catch {
          toast.warning(
            'Utilisateur créé partiellement',
            `${createForm.first_name} ${createForm.last_name} a été créé mais l'affectation d'équipe a échoué. Configurez-la manuellement.`
          )
          setCreateModalOpen(false)
          setCreateForm(EMPTY_FORM)
          return
        }
      }

      toast.success(
        'Utilisateur créé',
        `${createForm.first_name} ${createForm.last_name} a été ajouté avec le rôle ${ROLE_LABELS[createForm.role]}.`
      )
      setCreateModalOpen(false)
      setCreateForm(EMPTY_FORM)
    } catch (err) {
      setCreateError((err as Error).message || 'Erreur lors de la création.')
    }
  }

  const openRoleModal = (user: User) => {
    setRoleModalUser(user)
    setSelectedRole(user.role)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditForm({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
    })
    setEditError(null)
  }

  const handleEditUser = async () => {
    if (!editingUser) return
    setEditError(null)
    if (!editForm.first_name || !editForm.last_name || !editForm.email) {
      setEditError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    if (!emailRegex.test(editForm.email)) {
      setEditError('Email invalide.')
      return
    }
    try {
      await updateProfileMutation.mutateAsync({
        id: editingUser.id,
        fields: {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          phone: editForm.phone || null,
        },
      })
      toast.success(
        'Profil modifié',
        `${editForm.first_name} ${editForm.last_name} a été mis à jour.`
      )
      setEditingUser(null)
    } catch {
      toast.error('Erreur', 'Impossible de modifier le profil.')
    }
  }

  const handleRoleChange = async () => {
    if (!roleModalUser) return
    // Prevent self-demotion
    if (roleModalUser.id === currentUser?.id && selectedRole !== roleModalUser.role) {
      toast.error('Interdit', 'Vous ne pouvez pas modifier votre propre rôle.')
      return
    }
    try {
      await updateRoleMutation.mutateAsync({ id: roleModalUser.id, role: selectedRole })
      toast.success(
        'Rôle mis à jour',
        `${getFullName(roleModalUser)} est maintenant ${ROLE_LABELS[selectedRole]}.`
      )
      setRoleModalUser(null)
    } catch {
      toast.error('Erreur', 'Impossible de modifier le rôle.')
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateUser) return
    try {
      await deactivateMutation.mutateAsync(deactivateUser.id)
      toast.success(
        'Utilisateur désactivé',
        `${getFullName(deactivateUser)} a été désactivé.`
      )
      setDeactivateUser(null)
    } catch {
      toast.error('Erreur', 'Impossible de désactiver l\'utilisateur.')
    }
  }

  const passwordStrength = getPasswordStrength(createForm.password)

  return (
    <div>
      <PageHeader
        title="Gestion des utilisateurs"
        description={`${users.length} utilisateurs enregistrés`}
        actions={
          <button
            onClick={() => { setCreateForm(EMPTY_FORM); setCreateError(null); setCreateModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter utilisateur
          </button>
        }
      />

      {/* Role distribution */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ALL_ROLES.map((role) => {
          const count = roleDistribution[role] ?? 0
          if (count === 0) return null
          const config = roleConfig[role]
          return (
            <div
              key={role}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${config?.className ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}
            >
              <Shield className="w-3 h-3" />
              {ROLE_LABELS[role]}
              <span className="font-bold">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Tous les rôles</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm text-red-600 font-medium">Erreur lors du chargement des utilisateurs.</p>
          {usersError && (
            <p className="text-xs text-red-500 mt-2 font-mono">{(usersError as Error).message}</p>
          )}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Utilisateur</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Rôle</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Équipe</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date d'embauche</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Statut</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const config = roleConfig[user.role]
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                            {getInitials(user)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{getFullName(user)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${config?.className ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.default_team ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: `${user.default_team.color}15`,
                              color: user.default_team.color,
                              borderColor: `${user.default_team.color}30`,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: user.default_team.color }}
                            />
                            {user.default_team.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.hire_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            <XCircle className="w-3 h-3" />
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                            title="Modifier le profil"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button
                            onClick={() => openRoleModal(user)}
                            className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                            title="Modifier le rôle"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => setDeactivateUser(user)}
                              className="p-1 rounded-md hover:bg-red-50 transition-colors"
                              title="Désactiver"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                            </button>
                          )}
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

      {/* Edit Profile Modal */}
      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} size="sm">
        <ModalHeader
          title="Modifier le profil"
          description={editingUser ? `Modifier les informations de ${getFullName(editingUser)}` : ''}
          onClose={() => setEditingUser(null)}
        />
        <div className="px-6 pb-4 space-y-4">
          {editError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 border border-red-200">
              {editError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom *</label>
              <input
                type="text"
                value={editForm.first_name}
                onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom *</label>
              <input
                type="text"
                value={editForm.last_name}
                onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setEditingUser(null)} disabled={updateProfileMutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleEditUser}
            loading={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Enregistrer
          </Button>
        </ModalFooter>
      </Modal>

      {/* Role Change Modal */}
      <Modal open={!!roleModalUser} onClose={() => setRoleModalUser(null)} size="sm">
        <ModalHeader
          title="Modifier le rôle"
          description={roleModalUser ? `Changer le rôle de ${getFullName(roleModalUser)}` : ''}
          onClose={() => setRoleModalUser(null)}
        />
        <div className="px-6 pb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Nouveau rôle</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            disabled={roleModalUser?.id === currentUser?.id}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
          >
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
          {roleModalUser?.id === currentUser?.id && (
            <p className="text-xs text-amber-600 mt-2">Vous ne pouvez pas modifier votre propre rôle.</p>
          )}
          {roleModalUser && selectedRole !== roleModalUser.role && (roleModalUser.role === 'super_admin' || roleModalUser.role === 'admin') && (
            <p className="text-xs text-red-600 mt-2">Attention : vous rétrogradez un administrateur.</p>
          )}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setRoleModalUser(null)} disabled={updateRoleMutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleRoleChange}
            loading={updateRoleMutation.isPending}
          >
            {updateRoleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Enregistrer
          </Button>
        </ModalFooter>
      </Modal>

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        open={!!deactivateUser}
        title="Désactiver l'utilisateur"
        message={deactivateUser ? `Êtes-vous sûr de vouloir désactiver ${getFullName(deactivateUser)} ? L'utilisateur ne pourra plus se connecter.` : ''}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        variant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateUser(null)}
      />

      {/* Create User Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} size="md">
        <ModalHeader
          title="Nouvel utilisateur"
          description="Créer un compte pour un nouveau collaborateur"
          onClose={() => setCreateModalOpen(false)}
        />
        <div className="px-6 pb-4 space-y-4">
          {createError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 border border-red-200">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom *</label>
              <input
                type="text"
                value={createForm.first_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom *</label>
              <input
                type="text"
                value={createForm.last_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Dupont"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              {...{placeholder: `jean.dupont@${brand.email.split("@")[1]}`}}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe *</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Minimum 6 caractères"
            />
            {createForm.password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
                <p className={`text-xs mt-1 ${
                  passwordStrength.color === 'bg-red-500' ? 'text-red-600' :
                  passwordStrength.color === 'bg-amber-500' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  {passwordStrength.label}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
            <input
              type="tel"
              value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="06 12 34 56 78"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rôle *</label>
            <select
              value={createForm.role}
              onChange={(e) => {
                const newRole = e.target.value as Role
                setCreateForm((f) => ({
                  ...f,
                  role: newRole,
                  ...(newRole !== 'jardinier' ? { team_id: '', vehicle_id: '' } : {}),
                }))
              }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>
          {createForm.role === 'jardinier' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Équipe *</label>
                <select
                  value={createForm.team_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, team_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Sélectionner une équipe</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Véhicule</label>
                <select
                  value={createForm.vehicle_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Aucun véhicule</option>
                  {vehicles.map((v) => {
                    const assignedTeam = teams.find((t) => t.id === v.assigned_team_id)
                    return (
                      <option key={v.id} value={v.id}>
                        {v.registration_plate} — {v.brand} {v.model}
                        {assignedTeam ? ` (${assignedTeam.name})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            </>
          )}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCreateModalOpen(false)} disabled={isCreating}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateUser}
            loading={isCreating}
          >
            Créer l'utilisateur
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
