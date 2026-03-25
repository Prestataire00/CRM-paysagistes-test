import type { PipelineStage } from '../../../types'
import type { ProspectScoringConfig, ProspectWithMeta, PipelineStats } from '../../../types'
import type { EnrichedProspect } from '../../../services/prospect.service'

// ---------------------------------------------------------------------------
// Score computation (0-100)
// ---------------------------------------------------------------------------
export function computeProspectScore(
  prospect: EnrichedProspect,
  config: ProspectScoringConfig,
): number {
  const { weights, thresholds } = config
  const totalWeight =
    weights.estimated_value +
    weights.probability +
    weights.activity_frequency +
    weights.recency

  if (totalWeight === 0) return 0

  // 1. Value score (linear scale 0-100 based on threshold)
  const valueScore = Math.min(
    100,
    ((prospect.estimated_value ?? 0) / Math.max(1, thresholds.high_value)) * 100,
  )

  // 2. Probability score (direct 0-100)
  const probScore = prospect.probability ?? 0

  // 3. Activity frequency score (activities per week)
  const ageInDays = Math.max(
    1,
    (Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24),
  )
  const activitiesPerWeek = (prospect.activity_count / ageInDays) * 7
  const freqScore = Math.min(100, activitiesPerWeek * 50) // 2/week = 100

  // 4. Recency score (how recently last activity occurred)
  const lastActivityDaysAgo = prospect.last_activity_at
    ? (Date.now() - new Date(prospect.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    : ageInDays
  const recencyScore = Math.max(
    0,
    100 - (lastActivityDaysAgo / Math.max(1, thresholds.recent_activity_days)) * 33,
  )

  return Math.round(
    (valueScore * weights.estimated_value +
      probScore * weights.probability +
      freqScore * weights.activity_frequency +
      recencyScore * weights.recency) /
      totalWeight,
  )
}

// ---------------------------------------------------------------------------
// Inactivity check
// ---------------------------------------------------------------------------
export function isProspectInactive(
  prospect: EnrichedProspect,
  alertDays: number,
): boolean {
  // Ignore closed stages
  if (prospect.pipeline_stage === 'gagne' || prospect.pipeline_stage === 'perdu') {
    return false
  }
  const reference = prospect.last_activity_at ?? prospect.created_at
  const daysSince =
    (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince > alertDays
}

// ---------------------------------------------------------------------------
// Days since last activity (for display)
// ---------------------------------------------------------------------------
export function daysSinceLastActivity(prospect: EnrichedProspect): number {
  const reference = prospect.last_activity_at ?? prospect.created_at
  return Math.floor(
    (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24),
  )
}

// ---------------------------------------------------------------------------
// Stage reminder message
// ---------------------------------------------------------------------------
export function getStageReminder(
  prospect: EnrichedProspect,
  stageAgeReminders: Record<string, number>,
): string | null {
  if (prospect.pipeline_stage === 'gagne' || prospect.pipeline_stage === 'perdu') {
    return null
  }

  const maxDays = stageAgeReminders[prospect.pipeline_stage]
  if (!maxDays) return null

  const reference = prospect.last_activity_at ?? prospect.updated_at
  const daysSince = Math.floor(
    (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysSince > maxDays) {
    return `Aucune activité depuis ${daysSince}j en "${prospect.pipeline_stage}"`
  }
  return null
}

// ---------------------------------------------------------------------------
// Enrich all pipeline data with scoring + alerts
// ---------------------------------------------------------------------------
export function enrichProspectsWithScoring(
  cards: Record<PipelineStage, EnrichedProspect[]>,
  counts: Record<PipelineStage, number>,
  config: ProspectScoringConfig,
): { enriched: Record<PipelineStage, ProspectWithMeta[]>; counts: Record<PipelineStage, number> } {
  const enriched = {} as Record<PipelineStage, ProspectWithMeta[]>

  for (const stage of Object.keys(cards) as PipelineStage[]) {
    enriched[stage] = cards[stage].map((p) => ({
      id: p.id,
      company_name: p.company_name,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      mobile: p.mobile,
      source: p.source,
      estimated_value: p.estimated_value,
      probability: p.probability,
      pipeline_stage: p.pipeline_stage,
      assigned_commercial_id: p.assigned_commercial_id,
      converted_to_client_id: p.converted_to_client_id,
      converted_at: p.converted_at,
      last_activity_at: p.last_activity_at,
      notes: p.notes,
      created_at: p.created_at,
      updated_at: p.updated_at,
      activity_count: p.activity_count,
      score: computeProspectScore(p, config),
      is_inactive: isProspectInactive(p, config.inactivity_alert_days),
      reminder_message: getStageReminder(p, config.stage_age_reminders),
      assigned_commercial: p.assigned_commercial ?? null,
    }))
  }

  return { enriched, counts }
}

// ---------------------------------------------------------------------------
// Pipeline stats aggregation
// ---------------------------------------------------------------------------
export function computePipelineStats(
  data: Record<PipelineStage, ProspectWithMeta[]> | null,
): PipelineStats {
  if (!data) {
    return { totalValue: 0, weightedValue: 0, activeCount: 0, conversionRate: 0, inactiveCount: 0 }
  }

  const activeStages: PipelineStage[] = ['nouveau', 'qualification', 'proposition', 'negociation']
  let totalValue = 0
  let weightedValue = 0
  let activeCount = 0
  let inactiveCount = 0

  for (const stage of activeStages) {
    for (const p of data[stage] ?? []) {
      totalValue += p.estimated_value ?? 0
      weightedValue += (p.estimated_value ?? 0) * (p.probability ?? 0) / 100
      activeCount++
      if (p.is_inactive) inactiveCount++
    }
  }

  const wonCount = (data.gagne ?? []).length
  const lostCount = (data.perdu ?? []).length
  const closedTotal = wonCount + lostCount
  const conversionRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0

  return {
    totalValue: Math.round(totalValue),
    weightedValue: Math.round(weightedValue),
    activeCount,
    conversionRate,
    inactiveCount,
  }
}

// ---------------------------------------------------------------------------
// Client-side filters
// ---------------------------------------------------------------------------
export interface PipelineFilters {
  commercialId: string | null
  source: string | null
}

export function applyPipelineFilters(
  data: Record<PipelineStage, ProspectWithMeta[]>,
  filters: PipelineFilters,
): Record<PipelineStage, ProspectWithMeta[]> {
  if (!filters.commercialId && !filters.source) return data

  const filtered = {} as Record<PipelineStage, ProspectWithMeta[]>
  for (const stage of Object.keys(data) as PipelineStage[]) {
    filtered[stage] = data[stage].filter((p) => {
      if (filters.commercialId && p.assigned_commercial_id !== filters.commercialId) return false
      if (filters.source && p.source !== filters.source) return false
      return true
    })
  }
  return filtered
}

// ---------------------------------------------------------------------------
// Extract unique sources from pipeline data
// ---------------------------------------------------------------------------
export function getUniqueSources(
  data: Record<PipelineStage, ProspectWithMeta[]>,
): string[] {
  const sources = new Set<string>()
  for (const stage of Object.keys(data) as PipelineStage[]) {
    for (const p of data[stage]) {
      if (p.source) sources.add(p.source)
    }
  }
  return Array.from(sources).sort()
}
