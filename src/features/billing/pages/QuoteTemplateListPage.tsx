import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, FileText, Pencil, Trash2, Loader2, Copy, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useQuoteTemplates, useDeleteQuoteTemplate, useUpdateQuoteTemplate } from '../../../queries/useBilling'
import { useToast } from '../../../components/feedback/ToastProvider'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import type { QuoteTemplate } from '../../../types'

export function QuoteTemplateListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: templates, isLoading } = useQuoteTemplates(true)
  const deleteMutation = useDeleteQuoteTemplate()
  const updateMutation = useUpdateQuoteTemplate()
  const [deleteTarget, setDeleteTarget] = useState<QuoteTemplate | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Modèle supprimé', `Le modèle "${deleteTarget.name}" a été désactivé.`)
      setDeleteTarget(null)
    } catch {
      toast.error('Erreur', 'Impossible de supprimer le modèle.')
    }
  }

  const handleToggleActive = async (template: QuoteTemplate) => {
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        input: { is_active: !template.is_active },
      })
      toast.success(
        template.is_active ? 'Modèle désactivé' : 'Modèle activé',
        `Le modèle "${template.name}" a été ${template.is_active ? 'désactivé' : 'activé'}.`
      )
    } catch {
      toast.error('Erreur', 'Impossible de modifier le modèle.')
    }
  }

  const handleDuplicate = async (template: QuoteTemplate) => {
    navigate(`/billing/templates/new?from=${template.id}`)
  }

  const formatPrice = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modèles de devis"
        description="Créez des modèles réutilisables pour vos prestations courantes"
        actions={
          <button
            onClick={() => navigate('/billing/templates/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau modèle
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucun modèle</h3>
          <p className="text-sm text-slate-500 mb-6">
            Créez votre premier modèle de devis pour accélérer la création de vos devis.
          </p>
          <button
            onClick={() => navigate('/billing/templates/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un modèle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-all ${
                t.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{t.name}</h3>
                  {t.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleActive(t)}
                  className="ml-2 shrink-0"
                  title={t.is_active ? 'Désactiver' : 'Activer'}
                >
                  {t.is_active ? (
                    <ToggleRight className="w-6 h-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-300" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span>{t.lines.length} ligne{t.lines.length > 1 ? 's' : ''}</span>
                <span>•</span>
                <span>TVA {t.tva_rate}%</span>
                <span>•</span>
                <span>{t.validity_days}j</span>
                {t.eligible_tax_credit && (
                  <>
                    <span>•</span>
                    <span className="text-green-600 font-medium">Crédit d'impôt</span>
                  </>
                )}
              </div>

              {t.lines.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-1">
                  {t.lines.slice(0, 3).map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 truncate flex-1 mr-2">{line.description}</span>
                      <span className="text-slate-800 font-medium shrink-0">
                        {formatPrice(line.unit_price_ht)}
                      </span>
                    </div>
                  ))}
                  {t.lines.length > 3 && (
                    <p className="text-xs text-slate-400 pt-1">
                      + {t.lines.length - 3} autre{t.lines.length - 3 > 1 ? 's' : ''} ligne{t.lines.length - 3 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate(`/billing/templates/${t.id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </button>
                <button
                  onClick={() => handleDuplicate(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Dupliquer
                </button>
                <button
                  onClick={() => setDeleteTarget(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <ModalHeader
          title="Supprimer le modèle"
          description={`Êtes-vous sûr de vouloir désactiver le modèle "${deleteTarget?.name}" ? Il ne sera plus visible lors de la création de devis.`}
        />
        <ModalFooter>
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
