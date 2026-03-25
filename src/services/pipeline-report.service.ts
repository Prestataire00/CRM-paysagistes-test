import { supabase } from '../lib/supabase'
import type { CommercialWeeklyReport } from '../types'

// ---------------------------------------------------------------------------
// getWeeklyCommercialReport - Aggregate prospect & activity data per commercial
// ---------------------------------------------------------------------------
export async function getWeeklyCommercialReport(
  weekStart: string,
  weekEnd: string,
): Promise<CommercialWeeklyReport[]> {
  // 1. Get all commercial users
  const { data: commercials, error: usersError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('role', ['commercial', 'responsable_commercial'])
    .eq('is_active', true)

  if (usersError) throw usersError
  if (!commercials || commercials.length === 0) return []

  const commercialIds = commercials.map((c) => c.id)

  // 2. Count new prospects per commercial in date range
  const { data: newProspects } = await supabase
    .from('prospects')
    .select('assigned_commercial_id')
    .in('assigned_commercial_id', commercialIds)
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)

  // 3. Count completed activities per commercial
  const { data: completedActivities } = await supabase
    .from('commercial_activities')
    .select('assigned_to')
    .in('assigned_to', commercialIds)
    .eq('is_completed', true)
    .gte('completed_at', weekStart)
    .lte('completed_at', weekEnd)

  // 4. Count won/lost prospects (stage changed in date range)
  const { data: wonProspects } = await supabase
    .from('prospects')
    .select('assigned_commercial_id, estimated_value')
    .in('assigned_commercial_id', commercialIds)
    .eq('pipeline_stage', 'gagne')
    .gte('updated_at', weekStart)
    .lte('updated_at', weekEnd)

  const { data: lostProspects } = await supabase
    .from('prospects')
    .select('assigned_commercial_id')
    .in('assigned_commercial_id', commercialIds)
    .eq('pipeline_stage', 'perdu')
    .gte('updated_at', weekStart)
    .lte('updated_at', weekEnd)

  // 5. Aggregate per commercial
  return commercials.map((c) => {
    const newCount = (newProspects ?? []).filter(
      (p) => p.assigned_commercial_id === c.id,
    ).length

    const activityCount = (completedActivities ?? []).filter(
      (a) => a.assigned_to === c.id,
    ).length

    const won = (wonProspects ?? []).filter(
      (p) => p.assigned_commercial_id === c.id,
    )
    const wonCount = won.length
    const wonValue = won.reduce(
      (sum, p) => sum + (Number(p.estimated_value) || 0),
      0,
    )

    const lostCount = (lostProspects ?? []).filter(
      (p) => p.assigned_commercial_id === c.id,
    ).length

    const total = wonCount + lostCount
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0

    return {
      commercial_id: c.id,
      commercial_name: `${c.first_name} ${c.last_name}`,
      new_prospects: newCount,
      activities_completed: activityCount,
      prospects_won: wonCount,
      prospects_lost: lostCount,
      total_won_value: wonValue,
      conversion_rate: conversionRate,
    }
  })
}
