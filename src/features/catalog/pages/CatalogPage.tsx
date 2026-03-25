import { useState } from 'react'
import { Plus, Pencil, Trash2, Package, Loader2, X, Check } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useCatalogItems, useCreateCatalogItem, useUpdateCatalogItem, useDeleteCatalogItem } from '../../../queries/useCatalog'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { CatalogItem, CatalogItemCreate } from '../../../services/catalog.service'

const CATEGORIES = [
  'Tonte & Gazon',
  'Taille & Élagage',
  'Désherbage',
  'Entretien floral',
  'Aménagement',
  'Arrosage',
  'Nettoyage',
  'Déchets verts',
  'Autres',
]

const UNITS = ['intervention', 'm²', 'ml', 'heure', 'unité', 'forfait', 'arbre', 'haie']

const EMPTY_FORM: CatalogItemCreate = {
  name: '',
  description: '',
  category: 'Autres',
  unit: 'intervention',
  unit_price_ht: 0,
  tva_rate: 10,
  is_labor: true,
  is_active: true,
  sort_order: 0,
}

export function CatalogPage() {
  const toast = useToast()
  const { data: items = [], isLoading } = useCatalogItems()
  const createMutation = useCreateCatalogItem()
  const updateMutation = useUpdateCatalogItem()
  const deleteMutation = useDeleteCatalogItem()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CatalogItemCreate>(EMPTY_FORM)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description ?? '',
      category: item.category ?? 'Autres',
      unit: item.unit,
      unit_price_ht: item.unit_price_ht,
      tva_rate: item.tva_rate,
      is_labor: item.is_labor,
      is_active: item.is_active,
      sort_order: item.sort_order,
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.warning('Nom requis', 'Saisissez un nom pour la prestation.'); return }
    if (form.unit_price_ht < 0) { toast.warning('Prix invalide', 'Le prix doit être positif ou nul.'); return }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, updates: form })
        toast.success('Prestation mise à jour')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Prestation créée')
      }
      setShowForm(false)
    } catch (err) {
      toast.error('Erreur', (err as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Prestation supprimée')
      setDeleteConfirmId(null)
    } catch (err) {
      toast.error('Erreur', (err as Error).message)
    }
  }

  // Group by category
  const grouped = items.reduce((acc, item) => {
    const cat = item.category ?? 'Autres'
    acc[cat] = acc[cat] ?? []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, CatalogItem[]>)

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <PageHeader
        title="Catalogue prestations"
        description="Gérez vos prestations standards pour accélérer la création de devis"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle prestation
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-slate-600 mb-1">Catalogue vide</p>
          <p className="text-sm text-slate-400 mb-4">Ajoutez vos prestations standards pour accélérer la création de devis</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Ajouter une prestation
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
            <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">{category}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase">Prestation</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Unité</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Prix HT</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">TVA</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {catItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 group">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                        {item.is_labor && <span className="text-[10px] text-primary-600 font-medium">Main-d'œuvre</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.unit}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">
                        {item.unit_price_ht.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.tva_rate}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirmId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Modifier la prestation' : 'Nouvelle prestation'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Tonte pelouse jusqu'à 100m²"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails optionnels..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={form.category ?? 'Autres'}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unité</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prix HT (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price_ht}
                    onChange={e => setForm(f => ({ ...f, unit_price_ht: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">TVA (%)</label>
                  <select
                    value={form.tva_rate}
                    onChange={e => setForm(f => ({ ...f, tva_rate: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={5.5}>5.5%</option>
                    <option value={10}>10%</option>
                    <option value={20}>20%</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_labor}
                  onChange={e => setForm(f => ({ ...f, is_labor: e.target.checked }))}
                  className="rounded text-primary-600"
                />
                <span className="text-sm text-slate-700">Main-d'œuvre (éligible crédit d'impôt)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
