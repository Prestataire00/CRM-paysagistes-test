import { useState, useMemo, type FormEvent } from 'react'
import {
  Plus,
  Users,
  AlertTriangle,
  RotateCcw,
  Mail,
  Download,
  Upload,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { PIPELINE_STAGES } from '../../../utils/constants'
import {
  useProspectsByStageEnriched,
  useScoringConfig,
  useCreateProspect,
  useUpdateProspect,
  useDeleteProspect,
  useMoveProspectStageOptimistic,
} from '../../../queries/useProspects'
import { useUsers } from '../../../queries/useAdmin'
import { useToast } from '../../../components/feedback/ToastProvider'
import { Modal, ModalHeader, ModalFooter } from '../../../components/feedback/Modal'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { KanbanBoard } from '../components/pipeline/KanbanBoard'
import { ProspectDetailPanel } from '../components/pipeline/ProspectDetailPanel'
import { PipelineReportPanel } from '../components/pipeline/PipelineReportPanel'
import { BatchRelanceModal } from '../components/pipeline/BatchRelanceModal'
import { CsvImportModal } from '../../../components/data/CsvImportModal'
import { exportToExcel } from '../../../utils/excel'
import { getAllProspects, importProspects, type ProspectCsvRow } from '../../../services/prospect.service'
import { useAuth } from '../../../contexts/AuthContext'
import {
  enrichProspectsWithScoring,
  computePipelineStats,
  applyPipelineFilters,
  type PipelineFilters,
} from '../utils/scoring'
import type { PipelineStage, Prospect, ProspectScoringConfig, ProspectWithMeta } from '../../../types'

// ---------------------------------------------------------------------------
// Static options
// ---------------------------------------------------------------------------

const sourceOptions = [
  { value: 'site_web', label: 'Site web' },
  { value: 'bouche_a_oreille', label: 'Bouche à oreille' },
  { value: 'recommandation', label: 'Recommandation' },
  { value: 'annuaire', label: 'Annuaire' },
  { value: 'signaletique', label: 'Signalétique / Véhicules' },
  { value: 'publipostage', label: 'Publipostage / Flyer' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'salon', label: 'Salon / Événement' },
  { value: 'reseaux_sociaux', label: 'Réseaux sociaux' },
  { value: 'appel_offres', label: "Appel d'offres" },
  { value: 'deja_client', label: 'Déjà client' },
  { value: 'autre', label: 'Autre' },
]

// Mapping value → label for display elsewhere
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  sourceOptions.map((o) => [o.value, o.label]),
)

const clientTypeOptions = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'copropriete', label: 'Copropriete' },
  { value: 'collectivite', label: 'Collectivite' },
]

const stageOptions = PIPELINE_STAGES.map((s) => ({ value: s.id, label: s.label }))

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const defaultScoringConfig: ProspectScoringConfig = {
  weights: { estimated_value: 25, probability: 25, activity_frequency: 25, recency: 25 },
  thresholds: { high_value: 10000, high_probability: 70, active_frequency_days: 7, recent_activity_days: 3 },
  inactivity_alert_days: 7,
  stage_age_reminders: { nouveau: 3, qualification: 5, proposition: 7, negociation: 10 },
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

interface CreateFormState {
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
  client_type: string
  source: string
  estimated_value: string
  probability: string
  pipeline_stage: PipelineStage
}

const initialForm: CreateFormState = {
  first_name: '',
  last_name: '',
  company_name: '',
  email: '',
  phone: '',
  client_type: 'particulier',
  source: 'site_web',
  estimated_value: '',
  probability: '50',
  pipeline_stage: 'nouveau',
}

// ---------------------------------------------------------------------------
// Skeleton while loading
// ---------------------------------------------------------------------------

function ColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-72 bg-slate-50/50 rounded-xl border border-slate-200 flex flex-col">
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Skeleton width={10} height={10} rounded="full" />
            <Skeleton width={100} height={16} rounded="md" />
          </div>
          <Skeleton width={28} height={20} rounded="full" />
        </div>
        <Skeleton width={60} height={12} rounded="md" className="mt-1" />
      </div>
      <div className="flex-1 p-2 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
            <Skeleton width="70%" height={14} rounded="md" />
            <Skeleton width="90%" height={10} rounded="md" />
            <Skeleton width="60%" height={10} rounded="md" />
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <Skeleton width={60} height={12} rounded="md" />
              <Skeleton width={70} height={12} rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProspectPipelinePage() {
  const toast = useToast()
  const { user } = useAuth()

  // --- Data hooks ---
  const { data: pipelineData, isLoading } = useProspectsByStageEnriched()
  const { data: scoringConfig } = useScoringConfig()
  const { data: usersData } = useUsers()
  const createMutation = useCreateProspect()
  const updateMutation = useUpdateProspect()
  const deleteMutation = useDeleteProspect()
  const moveMutation = useMoveProspectStageOptimistic()

  // --- Local state ---
  const [createOpen, setCreateOpen] = useState(false)
  const [editingProspect, setEditingProspect] = useState<ProspectWithMeta | null>(null)
  const [form, setForm] = useState<CreateFormState>(initialForm)
  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null)
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null)
  const [filters, setFilters] = useState<PipelineFilters>({ commercialId: null, source: null })
  const [batchRelanceOpen, setBatchRelanceOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // --- Computed: enrich with scoring ---
  const config = scoringConfig ?? defaultScoringConfig

  const enrichedResult = useMemo(() => {
    if (!pipelineData) return null
    return enrichProspectsWithScoring(pipelineData.cards, pipelineData.counts, config)
  }, [pipelineData, config])

  const enrichedData = enrichedResult?.enriched ?? null
  const enrichedCounts = enrichedResult?.counts ?? pipelineData?.counts ?? ({} as Record<PipelineStage, number>)

  // --- Computed: stats ---
  const stats = useMemo(() => computePipelineStats(enrichedData), [enrichedData])

  // --- Computed: apply filters ---
  const filteredData = useMemo(() => {
    if (!enrichedData) return null
    return applyPipelineFilters(enrichedData, filters)
  }, [enrichedData, filters])

  // --- Computed: inactive prospects for batch relance ---
  const inactiveProspects = useMemo(() => {
    if (!enrichedData) return []
    return Object.values(enrichedData)
      .flat()
      .filter((p) => p.is_inactive)
  }, [enrichedData])

  // --- Computed: commercial options for filter ---
  const commercialOptions = useMemo(() => {
    if (!usersData) return []
    return usersData
      .filter((u) => u.is_active)
      .map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))
  }, [usersData])

  // --- Computed: selected prospect ---
  const selectedProspect: ProspectWithMeta | null = useMemo(() => {
    if (!selectedProspectId || !enrichedData) return null
    for (const stage of Object.keys(enrichedData) as PipelineStage[]) {
      const found = enrichedData[stage].find((p) => p.id === selectedProspectId)
      if (found) return found
    }
    return null
  }, [selectedProspectId, enrichedData])

  const hasActiveFilters = filters.commercialId !== null || filters.source !== null

  // --- Handlers ---

  function updateField(field: keyof CreateFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function openEditProspect(prospect: ProspectWithMeta) {
    setEditingProspect(prospect)
    setForm({
      first_name: prospect.first_name ?? '',
      last_name: prospect.last_name ?? '',
      company_name: prospect.company_name ?? '',
      email: prospect.email ?? '',
      phone: prospect.phone ?? '',
      client_type: 'particulier',
      source: prospect.source ?? 'site_web',
      estimated_value: prospect.estimated_value != null ? String(prospect.estimated_value) : '',
      probability: prospect.probability != null ? String(prospect.probability) : '50',
      pipeline_stage: prospect.pipeline_stage ?? 'nouveau',
    })
    setCreateOpen(true)
  }

  function closeForm() {
    setCreateOpen(false)
    setEditingProspect(null)
    setForm(initialForm)
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.warning('Veuillez renseigner le prenom et le nom.')
      return
    }

    const prospectData = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      client_type: form.client_type as Prospect['client_type'],
      pipeline_stage: form.pipeline_stage,
      ...(form.company_name.trim() && { company_name: form.company_name.trim() }),
      ...(form.email.trim() && { email: form.email.trim() }),
      ...(form.phone.trim() && { phone: form.phone.trim() }),
      ...(form.source && { source: form.source }),
      ...(form.estimated_value && { estimated_value: parseFloat(form.estimated_value) }),
      ...(form.probability && { probability: parseInt(form.probability, 10) }),
    }

    if (editingProspect) {
      updateMutation.mutate(
        { id: editingProspect.id, data: prospectData },
        {
          onSuccess: () => {
            toast.success('Prospect mis a jour avec succes')
            closeForm()
          },
          onError: (err: unknown) => {
            console.error('Erreur mise a jour prospect:', err)
            const msg = err instanceof Error ? err.message : 'Erreur inconnue'
            toast.error(`Erreur : ${msg}`)
          },
        },
      )
    } else {
      createMutation.mutate(
        prospectData as Omit<Prospect, 'id' | 'created_at' | 'updated_at'>,
        {
          onSuccess: () => {
            toast.success('Prospect cree avec succes')
            closeForm()
          },
          onError: (err: unknown) => {
            console.error('Erreur creation prospect:', err)
            const msg = err instanceof Error ? err.message : 'Erreur inconnue'
            toast.error(`Erreur : ${msg}`)
          },
        },
      )
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Prospect supprime')
        setDeleteTarget(null)
      },
      onError: () => {
        toast.error('Erreur lors de la suppression')
        setDeleteTarget(null)
      },
    })
  }

  function handleMoveProspect(prospectId: string, newStage: PipelineStage) {
    const stageLabel = PIPELINE_STAGES.find((s) => s.id === newStage)?.label ?? newStage
    moveMutation.mutate(
      { id: prospectId, newStage },
      {
        onSuccess: () => {
          toast.success(`Prospect deplace vers "${stageLabel}"`)
        },
        onError: () => {
          toast.error('Erreur lors du deplacement')
        },
      },
    )
  }

  function handleCardClick(prospectId: string) {
    setSelectedProspectId(prospectId)
  }

  function handleAddClick(stage: PipelineStage) {
    setEditingProspect(null)
    setForm({ ...initialForm, pipeline_stage: stage })
    setCreateOpen(true)
  }

  function resetFilters() {
    setFilters({ commercialId: null, source: null })
  }

  // --- Export Pipeline to Excel ---
  async function handleExport() {
    setExporting(true)
    try {
      const allProspects = await getAllProspects()
      const stageLabels: Record<string, string> = {
        nouveau: 'Nouveau', qualification: 'Qualification', proposition: 'Proposition',
        negociation: 'Négociation', gagne: 'Gagné', perdu: 'Perdu',
      }
      exportToExcel(
        `pipeline-prospects-${new Date().toISOString().slice(0, 10)}.xlsx`,
        [
          { header: 'Prénom', accessor: (p) => p.first_name, width: 15 },
          { header: 'Nom', accessor: (p) => p.last_name, width: 15 },
          { header: 'Société', accessor: (p) => p.company_name, width: 20 },
          { header: 'Email', accessor: (p) => p.email, width: 25 },
          { header: 'Téléphone', accessor: (p) => p.phone, width: 15 },
          { header: 'Mobile', accessor: (p) => p.mobile, width: 15 },
          { header: 'Type', accessor: (p) => p.client_type, width: 14 },
          { header: 'Étape', accessor: (p) => stageLabels[p.pipeline_stage] ?? p.pipeline_stage, width: 14 },
          { header: 'Source', accessor: (p) => SOURCE_LABELS[p.source ?? ''] ?? p.source, width: 18 },
          { header: 'Valeur estimée', accessor: (p) => p.estimated_value, width: 15 },
          { header: 'Probabilité %', accessor: (p) => p.probability, width: 14 },
          { header: 'Commercial', accessor: (p) => {
            const c = (p as unknown as { assigned_commercial?: { first_name: string; last_name: string } | null }).assigned_commercial
            return c ? `${c.first_name} ${c.last_name}` : ''
          }, width: 20 },
          { header: 'Notes', accessor: (p) => p.notes, width: 30 },
          { header: 'Créé le', accessor: (p) => p.created_at?.slice(0, 10), width: 12 },
        ],
        allProspects,
        'Prospects',
      )
      toast.success(`${allProspects.length} prospect(s) exporté(s)`)
    } catch (err) {
      toast.error('Erreur lors de l\'export')
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  // --- Import CSV ---
  const importHeaders = ['prenom', 'nom', 'societe', 'email', 'telephone', 'mobile', 'type_client', 'source', 'etape', 'valeur_estimee', 'probabilite', 'notes']

  function parseProspectRows(rows: string[][]): { valid: ProspectCsvRow[]; errors: { row: number; field: string; message: string }[]; total: number } {
    const errors: { row: number; field: string; message: string }[] = []
    const valid: ProspectCsvRow[] = []
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every((c) => !c.trim())) continue
      const firstName = row[0]?.trim()
      const lastName = row[1]?.trim()
      if (!firstName || !lastName) {
        errors.push({ row: i + 1, field: 'prenom/nom', message: 'Prénom et nom requis' })
        continue
      }
      valid.push({
        first_name: firstName,
        last_name: lastName,
        company_name: row[2]?.trim() || undefined,
        email: row[3]?.trim() || undefined,
        phone: row[4]?.trim() || undefined,
        mobile: row[5]?.trim() || undefined,
        client_type: row[6]?.trim() || undefined,
        source: row[7]?.trim() || undefined,
        pipeline_stage: row[8]?.trim() || undefined,
        estimated_value: row[9]?.trim() || undefined,
        probability: row[10]?.trim() || undefined,
        notes: row[11]?.trim() || undefined,
      })
    }
    return { valid, errors, total: rows.length - 1 }
  }

  async function handleImport(rows: string[][]): Promise<{ inserted: number; errors: string[] }> {
    const { valid } = parseProspectRows(rows)
    if (valid.length === 0) return { inserted: 0, errors: ['Aucune ligne valide'] }
    return importProspects(valid, user?.id ?? '')
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Pipeline Commercial"
        description="Suivi et optimisation des opportunites commerciales"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
              Importer
            </Button>
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Exporter
            </Button>
            <Button icon={Plus} onClick={() => { setEditingProspect(null); setForm(initialForm); setCreateOpen(true) }}>
              Nouveau prospect
            </Button>
          </div>
        }
      />

      {/* Oplead-style KPI Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          {/* Contacts count */}
          <div className="flex items-center gap-3 min-w-[100px]">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.activeCount + (enrichedCounts['gagne'] ?? 0) + (enrichedCounts['perdu'] ?? 0)}</p>
              <p className="text-xs text-slate-500">Contacts</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200" />

          {/* Stage counters */}
          {(['nouveau', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu'] as PipelineStage[]).map(stage => {
            const count = enrichedCounts[stage] ?? 0
            const colors: Record<string, string> = {
              nouveau: 'bg-slate-100 text-slate-700',
              qualification: 'bg-blue-100 text-blue-700',
              proposition: 'bg-violet-100 text-violet-700',
              negociation: 'bg-amber-100 text-amber-700',
              gagne: 'bg-emerald-100 text-emerald-700',
              perdu: 'bg-red-100 text-red-700',
            }
            const labels: Record<string, string> = {
              nouveau: 'Nouveaux',
              qualification: 'Qualification',
              proposition: 'Proposition',
              negociation: 'Négociation',
              gagne: 'Gagnés',
              perdu: 'Perdus',
            }
            return (
              <div key={stage} className="text-center min-w-[70px]">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${colors[stage]}`}>
                  {count}
                </span>
                <p className="text-[10px] text-slate-500 mt-1">{labels[stage]}</p>
              </div>
            )
          })}

          <div className="h-10 w-px bg-slate-200" />

          {/* Conversion rate - big */}
          <div className="text-center min-w-[90px]">
            <p className="text-2xl font-bold text-emerald-600">{stats.conversionRate}%</p>
            <p className="text-xs text-slate-500">Conversion</p>
          </div>

          {/* Pipeline value */}
          <div className="text-center min-w-[100px]">
            <p className="text-lg font-bold text-slate-900">{eurFormatter.format(stats.totalValue)}</p>
            <p className="text-xs text-slate-500">Pipeline</p>
          </div>

          {/* Weighted value */}
          <div className="text-center min-w-[100px]">
            <p className="text-lg font-bold text-violet-600">{eurFormatter.format(stats.weightedValue)}</p>
            <p className="text-xs text-slate-500">Pondéré</p>
          </div>

          {stats.inactiveCount > 0 && (
            <>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-center min-w-[70px]">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold">
                  {stats.inactiveCount}
                </span>
                <p className="text-[10px] text-red-500 mt-1">En retard</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inactivity reminder banner */}
      {stats.inactiveCount > 0 && (
        <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>{stats.inactiveCount} prospect{stats.inactiveCount > 1 ? 's' : ''}</strong>{' '}
              sans activite depuis plus de {config.inactivity_alert_days} jours — un suivi est recommande.
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBatchRelanceOpen(true)}
          >
            <Mail className="w-3.5 h-3.5 mr-1" />
            Relancer les inactifs
          </Button>
        </div>
      )}

      {/* Filters toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-52">
          <Select
            options={[{ value: '', label: 'Tous les commerciaux' }, ...commercialOptions]}
            value={filters.commercialId ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                commercialId: e.target.value || null,
              }))
            }
          />
        </div>
        <div className="w-44">
          <Select
            options={[
              { value: '', label: 'Toutes les sources' },
              ...sourceOptions,
            ]}
            value={filters.source ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                source: e.target.value || null,
              }))
            }
          />
        </div>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reinitialiser
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => (
              <ColumnSkeleton key={stage.id} />
            ))}
          </div>
        ) : filteredData ? (
          <KanbanBoard
            data={filteredData}
            counts={enrichedCounts}
            onMoveProspect={handleMoveProspect}
            onCardClick={handleCardClick}
            onAddClick={handleAddClick}
          />
        ) : null}
      </div>

      {/* Reporting Panel */}
      {!isLoading && <PipelineReportPanel stats={stats} />}

      {/* Prospect Detail Panel */}
      {selectedProspect && (
        <ProspectDetailPanel
          prospect={selectedProspect}
          onClose={() => setSelectedProspectId(null)}
          onDeleted={() => setSelectedProspectId(null)}
          onEdit={(p) => {
            setSelectedProspectId(null)
            openEditProspect(p)
          }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal open={createOpen} onClose={closeForm} size="lg">
        <form onSubmit={handleCreate}>
          <ModalHeader
            title={editingProspect ? 'Modifier le prospect' : 'Nouveau prospect'}
            description={editingProspect ? 'Modifiez les informations du prospect' : 'Ajoutez un prospect au pipeline commercial'}
            onClose={closeForm}
          />

          <div className="px-6 pb-4 grid grid-cols-2 gap-4">
            <Input
              label="Prenom *"
              placeholder="Jean"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              required
            />
            <Input
              label="Nom *"
              placeholder="Dupont"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              required
            />
            <Input
              label="Societe"
              placeholder="Nom de la societe (optionnel)"
              value={form.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
            />
            <Select
              label="Type de client"
              options={clientTypeOptions}
              value={form.client_type}
              onChange={(e) => updateField('client_type', e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="jean@exemple.fr"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
            <Input
              label="Telephone"
              type="tel"
              placeholder="06 12 34 56 78"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
            <Select
              label="Source"
              options={sourceOptions}
              value={form.source}
              onChange={(e) => updateField('source', e.target.value)}
            />
            <Select
              label="Etape du pipeline"
              options={stageOptions}
              value={form.pipeline_stage}
              onChange={(e) => updateField('pipeline_stage', e.target.value as PipelineStage)}
            />
            <Input
              label="Valeur estimee (EUR)"
              type="number"
              min="0"
              step="100"
              placeholder="5000"
              value={form.estimated_value}
              onChange={(e) => updateField('estimated_value', e.target.value)}
            />
            <Input
              label="Probabilite (%)"
              type="number"
              min="0"
              max="100"
              placeholder="50"
              value={form.probability}
              onChange={(e) => updateField('probability', e.target.value)}
            />
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={closeForm}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              icon={editingProspect ? undefined : Plus}
              loading={editingProspect ? updateMutation.isPending : createMutation.isPending}
            >
              {editingProspect ? 'Enregistrer' : 'Creer le prospect'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le prospect"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer "${deleteTarget.company_name || `${deleteTarget.first_name} ${deleteTarget.last_name}`}" ? Cette action est irreversible.`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Batch Relance Modal */}
      <BatchRelanceModal
        open={batchRelanceOpen}
        onClose={() => setBatchRelanceOpen(false)}
        inactiveProspects={inactiveProspects}
      />

      {/* Import CSV Modal */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer des prospects"
        description="Format CSV : prenom, nom, societe, email, telephone, mobile, type_client, source, etape, valeur_estimee, probabilite, notes"
        headers={importHeaders}
        onImport={handleImport}
        parseRows={(rows) => {
          const result = parseProspectRows(rows)
          return { valid: result.valid as unknown[], errors: result.errors, total: result.total }
        }}
      />
    </div>
  )
}
