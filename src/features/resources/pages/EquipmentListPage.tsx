import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Filter,
  Wrench,
  Package,
  ArrowUpDown,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Calendar,
  Pencil,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/feedback/ToastProvider'
import {
  useEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
} from '../../../queries/useResources'
import type { EquipmentStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  disponible: { label: 'Disponible', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  en_utilisation: { label: 'En utilisation', className: 'bg-blue-100 text-blue-700', icon: Package },
  en_reparation: { label: 'En réparation', className: 'bg-amber-100 text-amber-700', icon: Wrench },
  hors_service: { label: 'Hors service', className: 'bg-red-100 text-red-700', icon: XCircle },
}

const CATEGORIES = [
  'Tous',
  'Tondeuses',
  'Elagueuses',
  'Souffleurs',
  'Taille-haies',
  'Debroussailleuses',
  'Remorques',
  'Outillage',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-44 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-4 bg-slate-200 rounded" /></td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------
const emptyForm = {
  name: '',
  brand: '',
  model: '',
  serial_number: '',
  category: '',
  status: 'disponible' as EquipmentStatus,
  purchase_date: '',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function EquipmentListPage() {
  const toast = useToast()

  // Data hooks
  const { data: equipment = [], isLoading } = useEquipment()
  const createEquipment = useCreateEquipment()
  const updateEquipment = useUpdateEquipment()
  const deleteEquipment = useDeleteEquipment()

  // Local state
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Tous')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<any | null>(null)
  const [deletingEquipment, setDeletingEquipment] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [sortNameDir, setSortNameDir] = useState<'asc' | 'desc'>('asc')

  // Derived: client-side filter on category, search, and status
  const filteredEquipment = useMemo(() => {
    return equipment.filter((eq: any) => {
      const matchesSearch =
        (eq.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (eq.serial_number || '').toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === 'Tous' || (eq.category || '').toLowerCase() === selectedCategory.toLowerCase()
      const matchesStatus = filterStatus === 'all' || eq.status === filterStatus
      return matchesSearch && matchesCategory && matchesStatus
    }).sort((a: any, b: any) => {
      const cmp = (a.name || '').localeCompare(b.name || '')
      return sortNameDir === 'asc' ? cmp : -cmp
    })
  }, [equipment, search, selectedCategory, filterStatus, sortNameDir])

  // Stats
  const stats = useMemo(() => ({
    total: equipment.length,
    disponible: equipment.filter((e: any) => e.status === 'disponible').length,
    en_reparation: equipment.filter((e: any) => e.status === 'en_reparation').length,
    hors_service: equipment.filter((e: any) => e.status === 'hors_service').length,
  }), [equipment])

  // Open create
  function openCreate() {
    setForm(emptyForm)
    setShowCreate(true)
  }

  // Open edit
  function openEdit(eq: any) {
    setMenuOpenId(null)
    setForm({
      name: eq.name || '',
      brand: eq.brand || '',
      model: eq.model || '',
      serial_number: eq.serial_number || '',
      category: eq.category || '',
      status: eq.status || 'disponible',
      purchase_date: eq.purchase_date || '',
    })
    setEditingEquipment(eq)
  }

  // Handlers
  async function handleCreate() {
    if (!form.name) {
      toast.warning('Veuillez renseigner le nom de l\'équipement.')
      return
    }
    try {
      await createEquipment.mutateAsync({
        name: form.name,
        brand: form.brand || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        category: form.category || null,
        status: 'disponible',
        purchase_date: form.purchase_date || null,
        last_maintenance_date: null,
        next_maintenance_date: null,
        assigned_team_id: null,
        notes: null,
        is_active: true,
      })
      toast.success('Equipement ajouté', `${form.name} a été ajouté à l'inventaire.`)
      setShowCreate(false)
    } catch {
      toast.error('Erreur', 'Impossible de créer l\'équipement.')
    }
  }

  async function handleUpdate() {
    if (!editingEquipment) return
    if (!form.name) {
      toast.warning('Veuillez renseigner le nom de l\'équipement.')
      return
    }
    try {
      await updateEquipment.mutateAsync({
        id: editingEquipment.id,
        data: {
          name: form.name,
          brand: form.brand || null,
          model: form.model || null,
          serial_number: form.serial_number || null,
          category: form.category || null,
          status: form.status,
          purchase_date: form.purchase_date || null,
        },
      })
      toast.success('Equipement mis à jour', `${form.name} a été modifié.`)
      setEditingEquipment(null)
    } catch {
      toast.error('Erreur', 'Impossible de modifier l\'équipement.')
    }
  }

  async function handleDelete() {
    if (!deletingEquipment) return
    try {
      await deleteEquipment.mutateAsync(deletingEquipment.id)
      toast.success('Equipement supprimé', `${deletingEquipment.name} a été retiré de l'inventaire.`)
      setDeletingEquipment(null)
    } catch {
      toast.error('Erreur', 'Impossible de supprimer l\'équipement.')
    }
  }

  // Form fields (shared)
  function renderFormFields() {
    return (
      <div className="px-6 pb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Tondeuse autoportée Husqvarna TC 242TX"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Marque</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Husqvarna"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modèle</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="TC 242TX"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">N° de série</label>
            <input
              type="text"
              value={form.serial_number}
              onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="HQ-2023-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sélectionner...</option>
              {CATEGORIES.filter((c) => c !== 'Tous').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date d'achat</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* Status only in edit mode */}
          {editingEquipment && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EquipmentStatus }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Matériel"
        description={isLoading ? 'Chargement...' : `${equipment.length} équipements inventoriés`}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un équipement
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total équipements', value: String(stats.total), icon: Package, color: 'text-slate-600' },
          { label: 'Disponibles', value: String(stats.disponible), icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'En réparation', value: String(stats.en_reparation), icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Hors service', value: String(stats.hors_service), icon: XCircle, color: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-slate-500">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {isLoading ? (
                <span className="inline-block w-8 h-6 bg-slate-200 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou n° de série..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="disponible">Disponibles</option>
            <option value="en_utilisation">En utilisation</option>
            <option value="en_reparation">En réparation</option>
            <option value="hors_service">Hors service</option>
          </select>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  <button onClick={() => setSortNameDir(d => d === 'asc' ? 'desc' : 'asc')} className="flex items-center gap-1 hover:text-slate-700">
                    Equipement <ArrowUpDown className="w-3 h-3 text-primary-600" />
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Catégorie</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">N° Série</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Affecté à</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Achat</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Statut</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)
                : filteredEquipment.map((eq: any) => {
                    const status = statusConfig[eq.status] || statusConfig.disponible
                    return (
                      <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-slate-900">{eq.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {eq.category || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-slate-500">{eq.serial_number || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {eq.assigned_team ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: eq.assigned_team.color || '#94a3b8' }}
                              />
                              {eq.assigned_team.name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(eq.purchase_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                            <status.icon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                              onClick={() => setMenuOpenId(menuOpenId === eq.id ? null : eq.id)}
                            >
                              <MoreHorizontal className="w-4 h-4 text-slate-400" />
                            </button>
                            {menuOpenId === eq.id && (
                              <div className="absolute right-0 top-8 z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                                <button
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                  onClick={() => openEdit(eq)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Modifier
                                </button>
                                <button
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setMenuOpenId(null)
                                    setDeletingEquipment(eq)
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            {isLoading
              ? 'Chargement...'
              : `Affichage de ${filteredEquipment.length} sur ${equipment.length} équipements`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && filteredEquipment.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucun équipement trouvé</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} size="md">
        <ModalHeader title="Ajouter un équipement" onClose={() => setShowCreate(false)} />
        {renderFormFields()}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={createEquipment.isPending}>
            Ajouter
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingEquipment} onClose={() => setEditingEquipment(null)} size="md">
        <ModalHeader
          title="Modifier l'équipement"
          description={editingEquipment?.name}
          onClose={() => setEditingEquipment(null)}
        />
        {renderFormFields()}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setEditingEquipment(null)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleUpdate} loading={updateEquipment.isPending}>
            Enregistrer
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deletingEquipment}
        title="Supprimer l'équipement"
        message={
          deletingEquipment
            ? `Voulez-vous vraiment retirer "${deletingEquipment.name}" de l'inventaire ?`
            : ''
        }
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteEquipment.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingEquipment(null)}
      />
    </div>
  )
}
