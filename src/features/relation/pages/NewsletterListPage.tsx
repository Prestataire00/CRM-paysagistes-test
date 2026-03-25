import { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Mail,
  Plus,
  Search,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Filter,
  Users,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { StatCard } from '../../../components/data/StatCard'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { useCampaigns, useDeleteCampaign } from '../../../queries/useNewsletters'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { CampaignStatus } from '../../../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const statusConfig: Record<CampaignStatus, { label: string; badgeVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon: typeof CheckCircle2 }> = {
  brouillon: { label: 'Brouillon', badgeVariant: 'neutral', icon: Clock },
  programmee: { label: 'Programmee', badgeVariant: 'warning', icon: Calendar },
  en_cours: { label: 'En cours', badgeVariant: 'info', icon: Send },
  envoyee: { label: 'Envoyee', badgeVariant: 'success', icon: CheckCircle2 },
  annulee: { label: 'Annulee', badgeVariant: 'error', icon: XCircle },
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

const formatDateTime = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ===========================================================================
// NewsletterListPage
// ===========================================================================
export function NewsletterListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; subject: string } | null>(null)

  const { data: campaigns = [], isLoading } = useCampaigns({
    status: statusFilter || undefined,
  })
  const deleteMutation = useDeleteCampaign()

  // Stats
  const stats = useMemo(() => {
    const total = campaigns.length
    const drafts = campaigns.filter((c) => c.status === 'brouillon').length
    const sent = campaigns.filter((c) => c.status === 'envoyee').length
    const totalRecipients = campaigns
      .filter((c) => c.status === 'envoyee')
      .reduce((sum, c) => sum + c.sent_count, 0)
    return { total, drafts, sent, totalRecipients }
  }, [campaigns])

  const filteredCampaigns = useMemo(() => {
    if (!search) return campaigns
    const lower = search.toLowerCase()
    return campaigns.filter((c) => c.subject.toLowerCase().includes(lower))
  }, [campaigns, search])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Campagne supprimee')
        setDeleteTarget(null)
      },
      onError: () => {
        toast.error('Erreur lors de la suppression')
        setDeleteTarget(null)
      },
    })
  }, [deleteTarget, deleteMutation, toast])

  return (
    <div>
      <PageHeader
        title="Newsletters"
        description="Campagnes email vers vos clients consentants"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate('/relation/newsletters/new')}>
            Nouvelle campagne
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Mail} label="Total campagnes" value={stats.total} />
        <StatCard icon={FileText} label="Brouillons" value={stats.drafts} />
        <StatCard icon={CheckCircle2} label="Envoyees" value={stats.sent} />
        <StatCard icon={Users} label="Emails envoyes" value={stats.totalRecipients} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par sujet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="programmee">Programmee</option>
            <option value="en_cours">En cours</option>
            <option value="envoyee">Envoyee</option>
            <option value="annulee">Annulee</option>
          </select>
        </div>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
          <span className="text-sm text-slate-500">Chargement...</span>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucune campagne trouvee</p>
          <button
            onClick={() => navigate('/relation/newsletters/new')}
            className="text-sm text-primary-600 hover:underline mt-2"
          >
            Creer la premiere campagne
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCampaigns.map((campaign) => {
            const sc = statusConfig[campaign.status]
            const StatusIcon = sc.icon
            return (
              <div
                key={campaign.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={sc.badgeVariant}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {sc.label}
                      </Badge>
                    </div>
                    <Link
                      to={`/relation/newsletters/${campaign.id}`}
                      className="text-base font-bold text-slate-900 hover:text-primary-600 transition-colors"
                    >
                      {campaign.subject}
                    </Link>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Cree le {formatDate(campaign.created_at)}
                      </span>
                      {campaign.sent_at && (
                        <span className="flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" />
                          Envoye le {formatDateTime(campaign.sent_at)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {campaign.recipients_count} destinataire{campaign.recipients_count !== 1 ? 's' : ''}
                      </span>
                      {campaign.sent_count > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {campaign.sent_count} envoye{campaign.sent_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/relation/newsletters/${campaign.id}`}
                      className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Voir / Modifier"
                    >
                      <Eye className="w-4 h-4 text-slate-400" />
                    </Link>
                    <button
                      onClick={() => setDeleteTarget({ id: campaign.id, subject: campaign.subject })}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la campagne"
        message={`Etes-vous sur de vouloir supprimer la campagne "${deleteTarget?.subject ?? ''}" ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default NewsletterListPage
