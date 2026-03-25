import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Calendar,
  Fuel,
  MoreHorizontal,
  MapPin,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/feedback/ToastProvider'
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from '../../../queries/useResources'
import type { VehicleStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  disponible: { label: 'Disponible', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  en_mission: { label: 'En service', className: 'bg-blue-100 text-blue-700', icon: Truck },
  en_maintenance: { label: 'En maintenance', className: 'bg-amber-100 text-amber-700', icon: Wrench },
  hors_service: { label: 'Hors service', className: 'bg-red-100 text-red-700', icon: XCircle },
}

const VEHICLE_TYPES = [
  'Fourgon',
  'Utilitaire',
  'Pick-up',
  'Camion',
  'Remorque',
  'Autre',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

function formatKm(km: number | null) {
  if (km == null) return '—'
  return `${km.toLocaleString('fr-FR')} km`
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function VehicleCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200" />
            <div>
              <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
              <div className="h-3 w-20 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-16 bg-slate-200 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2 py-3 border-t border-slate-100">
          <div className="h-8 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
        <div className="h-5 w-20 bg-slate-200 rounded-full" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------
const emptyVehicleForm = {
  brand: '',
  model: '',
  registration_plate: '',
  vehicle_type: '' as string,
  mileage: '' as string | number,
  insurance_expiry: '',
  status: 'disponible' as VehicleStatus,
  last_maintenance_date: '',
  next_maintenance_date: '',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VehicleListPage() {
  const toast = useToast()

  // Data hooks
  const { data: vehicles = [], isLoading } = useVehicles()
  const createVehicle = useCreateVehicle()
  const updateVehicle = useUpdateVehicle()
  const deleteVehicle = useDeleteVehicle()

  // Local state
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<any | null>(null)
  const [form, setForm] = useState(emptyVehicleForm)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Derived
  const filteredVehicles = vehicles.filter((v: any) => {
    const name = `${v.brand} ${v.model}`.toLowerCase()
    const plate = (v.registration_plate || '').toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || plate.includes(q)
  })

  // Compute alerts: vehicles with maintenance or insurance within 30 days
  const alerts = useMemo(() => {
    const list: Array<{ vehicle: any; type: string; message: string; days: number }> = []
    vehicles.forEach((v: any) => {
      const maintenanceDays = daysUntil(v.next_maintenance_date)
      if (maintenanceDays !== null && maintenanceDays >= 0 && maintenanceDays <= 30) {
        list.push({
          vehicle: v,
          type: 'maintenance',
          message: `${v.brand} ${v.model} (${v.registration_plate}) - Révision dans ${maintenanceDays} jours`,
          days: maintenanceDays,
        })
      }
      const insuranceDays = daysUntil(v.insurance_expiry)
      if (insuranceDays !== null && insuranceDays >= 0 && insuranceDays <= 30) {
        list.push({
          vehicle: v,
          type: 'insurance',
          message: `${v.brand} ${v.model} (${v.registration_plate}) - Assurance expire dans ${insuranceDays} jours`,
          days: insuranceDays,
        })
      }
    })
    return list.sort((a, b) => a.days - b.days)
  }, [vehicles])

  function getVehicleAlerts(vehicleId: string) {
    return alerts.filter((a) => a.vehicle.id === vehicleId)
  }

  // Open create modal
  function openCreate() {
    setForm(emptyVehicleForm)
    setShowCreate(true)
  }

  // Open edit modal
  function openEdit(vehicle: any) {
    setMenuOpenId(null)
    setForm({
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      registration_plate: vehicle.registration_plate || '',
      vehicle_type: vehicle.vehicle_type || '',
      mileage: vehicle.mileage ?? '',
      insurance_expiry: vehicle.insurance_expiry || '',
      status: vehicle.status || 'disponible',
      last_maintenance_date: vehicle.last_maintenance_date || '',
      next_maintenance_date: vehicle.next_maintenance_date || '',
    })
    setEditingVehicle(vehicle)
  }

  // Handlers
  async function handleCreate() {
    if (!form.brand || !form.model || !form.registration_plate) {
      toast.warning('Veuillez remplir la marque, le modèle et l\'immatriculation.')
      return
    }
    try {
      await createVehicle.mutateAsync({
        brand: form.brand,
        model: form.model,
        registration_plate: form.registration_plate,
        vehicle_type: form.vehicle_type || null,
        mileage: form.mileage ? Number(form.mileage) : null,
        insurance_expiry: form.insurance_expiry || null,
        insurance_provider: null,
        status: 'disponible',
        last_maintenance_date: form.last_maintenance_date || null,
        next_maintenance_date: form.next_maintenance_date || null,
        assigned_team_id: null,
        notes: null,
        is_active: true,
      })
      toast.success('Véhicule ajouté', `${form.brand} ${form.model} a été ajouté à la flotte.`)
      setShowCreate(false)
    } catch {
      toast.error('Erreur', 'Impossible de créer le véhicule.')
    }
  }

  async function handleUpdate() {
    if (!editingVehicle) return
    if (!form.brand || !form.model || !form.registration_plate) {
      toast.warning('Veuillez remplir la marque, le modèle et l\'immatriculation.')
      return
    }
    try {
      await updateVehicle.mutateAsync({
        id: editingVehicle.id,
        data: {
          brand: form.brand,
          model: form.model,
          registration_plate: form.registration_plate,
          vehicle_type: form.vehicle_type || null,
          mileage: form.mileage ? Number(form.mileage) : null,
          insurance_expiry: form.insurance_expiry || null,
          status: form.status,
          last_maintenance_date: form.last_maintenance_date || null,
          next_maintenance_date: form.next_maintenance_date || null,
        },
      })
      toast.success('Véhicule mis à jour', `${form.brand} ${form.model} a été modifié.`)
      setEditingVehicle(null)
    } catch {
      toast.error('Erreur', 'Impossible de modifier le véhicule.')
    }
  }

  async function handleDelete() {
    if (!deletingVehicle) return
    try {
      await deleteVehicle.mutateAsync(deletingVehicle.id)
      toast.success('Véhicule supprimé', `${deletingVehicle.brand} ${deletingVehicle.model} a été retiré de la flotte.`)
      setDeletingVehicle(null)
    } catch {
      toast.error('Erreur', 'Impossible de supprimer le véhicule.')
    }
  }

  // Form fields (shared between create / edit)
  function renderFormFields() {
    return (
      <div className="px-6 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Marque *</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Renault"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modèle *</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Master"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Immatriculation *</label>
            <input
              type="text"
              value={form.registration_plate}
              onChange={(e) => setForm((f) => ({ ...f, registration_plate: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="AB-123-CD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type de véhicule</label>
            <select
              value={form.vehicle_type}
              onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sélectionner...</option>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kilométrage</label>
            <input
              type="number"
              value={form.mileage}
              onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="45000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expiration assurance</label>
            <input
              type="date"
              value={form.insurance_expiry}
              onChange={(e) => setForm((f) => ({ ...f, insurance_expiry: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dernière révision</label>
            <input
              type="date"
              value={form.last_maintenance_date}
              onChange={(e) => setForm((f) => ({ ...f, last_maintenance_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prochaine révision</label>
            <input
              type="date"
              value={form.next_maintenance_date}
              onChange={(e) => setForm((f) => ({ ...f, next_maintenance_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Status only in edit mode */}
        {editingVehicle && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VehicleStatus }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Véhicules"
        description={isLoading ? 'Chargement...' : `${vehicles.length} véhicules dans la flotte`}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un véhicule
          </button>
        }
      />

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {alerts.length} alerte{alerts.length > 1 ? 's' : ''} véhicule{alerts.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 space-y-0.5">
              {alerts.slice(0, 3).map((alert, i) => (
                <li key={i} className="text-xs text-amber-600">{alert.message}</li>
              ))}
              {alerts.length > 3 && (
                <li className="text-xs text-amber-600 font-medium">... et {alerts.length - 3} autre(s)</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un véhicule (modèle, immatriculation)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <VehicleCardSkeleton key={i} />)
          : filteredVehicles.map((vehicle: any) => {
              const status = statusConfig[vehicle.status] || statusConfig.disponible
              const vehicleAlerts = getVehicleAlerts(vehicle.id)

              return (
                <div
                  key={vehicle.id}
                  className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow ${
                    vehicleAlerts.length > 0 ? 'border-amber-200' : 'border-slate-200'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          vehicle.status === 'en_maintenance' ? 'bg-amber-100' : 'bg-slate-100'
                        }`}>
                          <Truck className={`w-5 h-5 ${vehicle.status === 'en_maintenance' ? 'text-amber-600' : 'text-slate-600'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {vehicle.brand} {vehicle.model}
                          </p>
                          <p className="text-xs font-mono text-slate-500">{vehicle.registration_plate}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          className="p-1 rounded-md hover:bg-slate-100"
                          onClick={() => setMenuOpenId(menuOpenId === vehicle.id ? null : vehicle.id)}
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-400" />
                        </button>
                        {menuOpenId === vehicle.id && (
                          <div className="absolute right-0 top-8 z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                            <button
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => openEdit(vehicle)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Modifier
                            </button>
                            <button
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setMenuOpenId(null)
                                setDeletingVehicle(vehicle)
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {formatKm(vehicle.mileage)}
                      </div>
                      {vehicle.vehicle_type && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Fuel className="w-3 h-3 text-slate-400" />
                          {vehicle.vehicle_type}
                        </div>
                      )}
                      {vehicle.assigned_team && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 col-span-2">
                          <Truck className="w-3 h-3 text-slate-400" />
                          <span>Affecté : </span>
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: vehicle.assigned_team.color || '#94a3b8' }}
                          />
                          <span>{vehicle.assigned_team.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-3 border-t border-slate-100">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Dernière révision</p>
                        <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDate(vehicle.last_maintenance_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Proch. révision</p>
                        <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-slate-400" />
                          {formatDate(vehicle.next_maintenance_date)}
                        </p>
                      </div>
                    </div>

                    {/* Alerts */}
                    {vehicleAlerts.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-1">
                        {vehicleAlerts.map((alert, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              {alert.type === 'maintenance'
                                ? `Révision dans ${alert.days} jour${alert.days > 1 ? 's' : ''}`
                                : `Assurance expire dans ${alert.days} jour${alert.days > 1 ? 's' : ''}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                      <status.icon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })}
      </div>

      {/* Empty state */}
      {!isLoading && filteredVehicles.length === 0 && (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucun véhicule trouvé</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} size="md">
        <ModalHeader title="Ajouter un véhicule" onClose={() => setShowCreate(false)} />
        {renderFormFields()}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={createVehicle.isPending}>
            Ajouter
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingVehicle} onClose={() => setEditingVehicle(null)} size="md">
        <ModalHeader
          title="Modifier le véhicule"
          description={editingVehicle ? `${editingVehicle.brand} ${editingVehicle.model} - ${editingVehicle.registration_plate}` : ''}
          onClose={() => setEditingVehicle(null)}
        />
        {renderFormFields()}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setEditingVehicle(null)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleUpdate} loading={updateVehicle.isPending}>
            Enregistrer
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deletingVehicle}
        title="Supprimer le véhicule"
        message={
          deletingVehicle
            ? `Voulez-vous vraiment retirer ${deletingVehicle.brand} ${deletingVehicle.model} (${deletingVehicle.registration_plate}) de la flotte ?`
            : ''
        }
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteVehicle.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingVehicle(null)}
      />
    </div>
  )
}
