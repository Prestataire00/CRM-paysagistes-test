import { useState, useEffect, useCallback, type FormEvent } from 'react'
import {
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Package,
  Building2,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { useToast } from '../../../components/feedback/ToastProvider'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { EmptyState } from '../../../components/data/EmptyState'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '../../../queries/useSuppliers'
import type { Supplier } from '../../../types'
import type { SupplierFilters } from '../../../services/supplier.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactif', className: 'bg-slate-100 text-slate-500' },
}

// ---------------------------------------------------------------------------
// Initial form state for creation modal
// ---------------------------------------------------------------------------
interface CreateFormData {
  company_name: string
  contact_first_name: string
  contact_last_name: string
  email: string
  phone: string
  mobile: string
  address_line1: string
  postal_code: string
  city: string
  category: string
  siret: string
  notes: string
}

const initialFormData: CreateFormData = {
  company_name: '',
  contact_first_name: '',
  contact_last_name: '',
  email: '',
  phone: '',
  mobile: '',
  address_line1: '',
  postal_code: '',
  city: '',
  category: '',
  siret: '',
  notes: '',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SupplierListPage() {
  const toast = useToast()

  // -- State ----------------------------------------------------------------
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const [filters, setFilters] = useState<SupplierFilters>({
    page: 1,
    pageSize: 25,
  })

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateFormData>(initialFormData)

  // Sync debounced search into filters (reset to page 1)
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch || undefined,
      page: 1,
    }))
  }, [debouncedSearch])

  // -- Queries & mutations --------------------------------------------------
  const { data: paginatedData, isLoading } = useSuppliers(filters)
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()

  const suppliers = paginatedData?.data ?? []
  const totalCount = paginatedData?.count ?? 0
  const currentPage = paginatedData?.page ?? 1
  const totalPages = paginatedData?.totalPages ?? 1

  // -- Handlers -------------------------------------------------------------
  const handleStatusFilter = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      is_active: value === 'all' ? undefined : value === 'active',
      page: 1,
    }))
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }))
  }, [])

  const handleFormChange = useCallback(
    (field: keyof CreateFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const openCreate = useCallback(() => {
    setEditingSupplier(null)
    setFormData(initialFormData)
    setIsFormOpen(true)
  }, [])

  const openEdit = useCallback((supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      company_name: supplier.company_name ?? '',
      contact_first_name: supplier.contact_first_name ?? '',
      contact_last_name: supplier.contact_last_name ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      mobile: supplier.mobile ?? '',
      address_line1: supplier.address_line1 ?? '',
      postal_code: supplier.postal_code ?? '',
      city: supplier.city ?? '',
      category: supplier.category ?? '',
      siret: supplier.siret ?? '',
      notes: supplier.notes ?? '',
    })
    setIsFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingSupplier(null)
    setFormData(initialFormData)
  }, [])

  const handleFormSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()

      const payload = {
        company_name: formData.company_name,
        contact_first_name: formData.contact_first_name || null,
        contact_last_name: formData.contact_last_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        mobile: formData.mobile || null,
        address_line1: formData.address_line1 || null,
        postal_code: formData.postal_code || null,
        city: formData.city || null,
        category: formData.category || null,
        siret: formData.siret || null,
        notes: formData.notes || null,
      }

      if (editingSupplier) {
        updateMutation.mutate(
          { id: editingSupplier.id, data: payload },
          {
            onSuccess: () => {
              toast.success('Fournisseur modifie avec succes')
              closeForm()
            },
            onError: (error) => {
              toast.error('Erreur lors de la modification', (error as Error).message)
            },
          }
        )
      } else {
        createMutation.mutate(
          { ...payload, is_active: true },
          {
            onSuccess: () => {
              toast.success('Fournisseur cree avec succes')
              closeForm()
            },
            onError: (error) => {
              toast.error('Erreur lors de la creation', (error as Error).message)
            },
          }
        )
      }
    },
    [formData, editingSupplier, createMutation, updateMutation, toast, closeForm]
  )

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTargetId) return

    deleteMutation.mutate(deleteTargetId, {
      onSuccess: () => {
        toast.success('Fournisseur desactive avec succes')
        setDeleteTargetId(null)
      },
      onError: (error) => {
        toast.error('Erreur lors de la desactivation', (error as Error).message)
      },
    })
  }, [deleteTargetId, deleteMutation, toast])

  // Derive active filter value for the status select
  const activeFilterValue =
    filters.is_active === undefined
      ? 'all'
      : filters.is_active
        ? 'active'
        : 'inactive'

  // -- Render ---------------------------------------------------------------
  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description={`${totalCount} fournisseur${totalCount !== 1 ? 's' : ''} enregistre${totalCount !== 1 ? 's' : ''}`}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Ajouter un fournisseur
          </Button>
        }
      />

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur (nom, contact, email)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={activeFilterValue}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
      </div>

      {/* Supplier Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Entreprise
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Coordonnees</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Categorie</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Ville</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Statut</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className="px-4 py-3"><Skeleton width="70%" height={16} /></td>
                    <td className="px-4 py-3"><Skeleton width="80%" height={12} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Skeleton width="80%" height={12} />
                        <Skeleton width="60%" height={12} />
                      </div>
                    </td>
                    <td className="px-4 py-3"><Skeleton width={80} height={14} /></td>
                    <td className="px-4 py-3"><Skeleton width={70} height={14} /></td>
                    <td className="px-4 py-3"><Skeleton width={50} height={20} rounded="full" /></td>
                    <td className="px-4 py-3"><Skeleton width={24} height={24} rounded="md" /></td>
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyState
                      icon={Package}
                      title={
                        debouncedSearch || filters.is_active !== undefined
                          ? 'Aucun fournisseur ne correspond aux filtres'
                          : 'Aucun fournisseur enregistre'
                      }
                      description={
                        debouncedSearch || filters.is_active !== undefined
                          ? 'Essayez de modifier ou de supprimer vos filtres.'
                          : 'Ajoutez votre premier fournisseur pour commencer.'
                      }
                      action={
                        !debouncedSearch && filters.is_active === undefined
                          ? <Button icon={Plus} onClick={openCreate}>Ajouter un fournisseur</Button>
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const statusKey = supplier.is_active ? 'active' : 'inactive'
                  const contactName = [supplier.contact_first_name, supplier.contact_last_name]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <tr
                      key={supplier.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <p className="text-sm font-medium text-slate-900">{supplier.company_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600">{contactName || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {supplier.email && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {supplier.email}
                            </span>
                          )}
                          {supplier.phone && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {supplier.phone}
                            </span>
                          )}
                          {!supplier.email && !supplier.phone && (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-700">
                          {supplier.category || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                          {supplier.city ? (
                            <>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              {supplier.city}
                            </>
                          ) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig[statusKey].className}`}
                        >
                          {statusConfig[statusKey].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(supplier)}
                            className="p-1 rounded-md hover:bg-blue-50 transition-colors group"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(supplier.id)}
                            className="p-1 rounded-md hover:bg-red-50 transition-colors group"
                            title="Desactiver"
                          >
                            <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Page {currentPage} sur {totalPages} ({totalCount} fournisseur{totalCount !== 1 ? 's' : ''})
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
              Precedent
            </button>
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white">
              {currentPage}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create Supplier Modal                                               */}
      {/* ------------------------------------------------------------------ */}
      <Modal open={isFormOpen} onClose={closeForm} size="lg">
        <form onSubmit={handleFormSubmit}>
          <ModalHeader
            title={editingSupplier ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
            description={editingSupplier ? 'Modifiez les informations du fournisseur.' : 'Remplissez les informations du nouveau fournisseur.'}
            onClose={closeForm}
          />

          <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nom de l'entreprise"
                placeholder="Nom du fournisseur"
                value={formData.company_name}
                onChange={(e) => handleFormChange('company_name', e.target.value)}
                required
              />
            </div>
            <Input
              label="Prenom du contact"
              placeholder="Jean"
              value={formData.contact_first_name}
              onChange={(e) => handleFormChange('contact_first_name', e.target.value)}
            />
            <Input
              label="Nom du contact"
              placeholder="Dupont"
              value={formData.contact_last_name}
              onChange={(e) => handleFormChange('contact_last_name', e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="contact@fournisseur.fr"
              value={formData.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
            />
            <Input
              label="Telephone"
              type="tel"
              placeholder="01 23 45 67 89"
              value={formData.phone}
              onChange={(e) => handleFormChange('phone', e.target.value)}
            />
            <div className="sm:col-span-2">
              <Input
                label="Adresse"
                placeholder="12 rue des Lilas"
                value={formData.address_line1}
                onChange={(e) => handleFormChange('address_line1', e.target.value)}
              />
            </div>
            <Input
              label="Code postal"
              placeholder="37000"
              value={formData.postal_code}
              onChange={(e) => handleFormChange('postal_code', e.target.value)}
            />
            <Input
              label="Ville"
              placeholder="Tours"
              value={formData.city}
              onChange={(e) => handleFormChange('city', e.target.value)}
            />
            <Input
              label="Categorie"
              placeholder="Materiaux, Vegetaux, Location..."
              value={formData.category}
              onChange={(e) => handleFormChange('category', e.target.value)}
            />
            <Input
              label="SIRET"
              placeholder="123 456 789 00001"
              value={formData.siret}
              onChange={(e) => handleFormChange('siret', e.target.value)}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                placeholder="Notes complementaires..."
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingSupplier ? 'Enregistrer' : 'Creer le fournisseur'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Dialog                                          */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Desactiver ce fournisseur ?"
        message="Le fournisseur sera desactive et n'apparaitra plus dans les listes actives. Cette action est reversible."
        confirmLabel="Desactiver"
        cancelLabel="Annuler"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}
