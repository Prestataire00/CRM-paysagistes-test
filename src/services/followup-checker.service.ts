import { supabase } from '../lib/supabase'
import type { NotificationType } from '../types'
import { runWorkflowEngine } from './workflow-engine.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FollowUpNotification {
  profile_id: string
  notification_type: NotificationType
  title: string
  message: string
  action_url: string
  action_entity_type: string
  action_entity_id: string
}

// ---------------------------------------------------------------------------
// Deduplication: get existing unread notification keys for current user
// ---------------------------------------------------------------------------

async function getExistingUnreadKeys(profileId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('notifications')
    .select('action_entity_type, action_entity_id')
    .eq('profile_id', profileId)
    .eq('is_read', false)
    .not('action_entity_type', 'is', null)
    .not('action_entity_id', 'is', null)

  if (error) throw error

  const keys = new Set<string>()
  for (const n of data ?? []) {
    keys.add(`${n.action_entity_type}:${n.action_entity_id}`)
  }
  return keys
}

// ---------------------------------------------------------------------------
// Check 1: Prospects without activity for 7+ days
// ---------------------------------------------------------------------------

async function checkStaleProspects(currentUserId: string): Promise<FollowUpNotification[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('prospects')
    .select('id, first_name, last_name, company_name, last_activity_at, assigned_commercial_id, pipeline_stage, created_at')
    .not('pipeline_stage', 'in', '(gagne,perdu)')

  if (error) throw error

  const notifications: FollowUpNotification[] = []

  for (const p of data ?? []) {
    // Use last_activity_at, fallback to created_at
    const referenceDate = p.last_activity_at ?? p.created_at
    if (!referenceDate) continue
    if (new Date(referenceDate) >= sevenDaysAgo) continue

    // Only create for the assigned commercial (or current user if unassigned)
    const recipientId = p.assigned_commercial_id ?? currentUserId
    if (recipientId !== currentUserId) continue

    const name = p.company_name || `${p.first_name} ${p.last_name}`
    const daysAgo = Math.floor(
      (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    notifications.push({
      profile_id: recipientId,
      notification_type: 'reminder',
      title: 'Prospect à relancer',
      message: `${name} n'a pas été contacté depuis ${daysAgo} jours.`,
      action_url: '/crm/prospects',
      action_entity_type: 'prospect_relance',
      action_entity_id: p.id,
    })
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Check 2: Quotes sent but unsigned for 7+ days
// ---------------------------------------------------------------------------

async function checkUnsignedQuotes(currentUserId: string): Promise<FollowUpNotification[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('quotes')
    .select('id, reference, title, issue_date, assigned_commercial_id, created_by')
    .eq('status', 'envoye')
    .is('accepted_date', null)
    .lt('issue_date', sevenDaysAgo.toISOString().split('T')[0])

  if (error) throw error

  const notifications: FollowUpNotification[] = []

  for (const q of data ?? []) {
    const recipientId = q.assigned_commercial_id ?? q.created_by ?? currentUserId
    if (recipientId !== currentUserId) continue

    const daysAgo = Math.floor(
      (Date.now() - new Date(q.issue_date).getTime()) / (1000 * 60 * 60 * 24)
    )

    notifications.push({
      profile_id: recipientId,
      notification_type: 'warning',
      title: 'Devis en attente de signature',
      message: `Le devis ${q.reference} (${q.title}) est en attente depuis ${daysAgo} jours.`,
      action_url: `/crm/devis/${q.id}`,
      action_entity_type: 'quote_relance',
      action_entity_id: q.id,
    })
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Check 3: Invoices past due date
// ---------------------------------------------------------------------------

async function checkOverdueInvoices(currentUserId: string, currentUserRole: string): Promise<FollowUpNotification[]> {
  const allowedRoles = ['comptabilite', 'admin', 'super_admin']
  if (!allowedRoles.includes(currentUserRole)) return []

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('invoices')
    .select('id, reference, title, due_date, total_ttc')
    .in('status', ['emise', 'envoyee', 'en_retard'])
    .lt('due_date', today)

  if (error) throw error

  const notifications: FollowUpNotification[] = []
  const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

  for (const inv of data ?? []) {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
    )

    // 3 escalation levels with different entity IDs for deduplication
    let level: number
    let title: string
    let notifType: NotificationType

    if (daysOverdue >= 30) {
      level = 3
      title = '🔴 Mise en demeure requise'
      notifType = 'error'
    } else if (daysOverdue >= 15) {
      level = 2
      title = '🟠 Relance ferme à envoyer'
      notifType = 'error'
    } else if (daysOverdue >= 7) {
      level = 1
      title = '🟡 Rappel de paiement'
      notifType = 'warning'
    } else {
      continue // Less than 7 days, skip
    }

    notifications.push({
      profile_id: currentUserId,
      notification_type: notifType,
      title,
      message: `Facture ${inv.reference} (${formatter.format(inv.total_ttc)}) — ${daysOverdue} jours de retard. Relance niveau ${level}/3.`,
      action_url: `/billing/invoices/${inv.id}`,
      action_entity_type: `invoice_relance_${level}`,
      action_entity_id: inv.id,
    })
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Check 3b: Quotes expiring within 3 days
// ---------------------------------------------------------------------------

async function checkExpiringQuotes(currentUserId: string): Promise<FollowUpNotification[]> {
  const today = new Date()
  const threeDaysLater = new Date(today)
  threeDaysLater.setDate(today.getDate() + 3)

  const { data, error } = await supabase
    .from('quotes')
    .select('id, reference, title, validity_date, assigned_commercial_id, created_by')
    .eq('status', 'envoye')
    .not('validity_date', 'is', null)
    .gte('validity_date', today.toISOString().split('T')[0])
    .lte('validity_date', threeDaysLater.toISOString().split('T')[0])

  if (error) throw error

  const notifications: FollowUpNotification[] = []

  for (const q of data ?? []) {
    const recipientId = q.assigned_commercial_id ?? q.created_by ?? currentUserId
    if (recipientId !== currentUserId) continue

    const daysLeft = Math.ceil(
      (new Date(q.validity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    notifications.push({
      profile_id: recipientId,
      notification_type: 'warning',
      title: 'Devis bientôt expiré',
      message: daysLeft <= 0
        ? `Le devis ${q.reference} (${q.title}) expire aujourd'hui !`
        : `Le devis ${q.reference} (${q.title}) expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`,
      action_url: `/crm/devis/${q.id}`,
      action_entity_type: 'quote_expiring',
      action_entity_id: q.id,
    })
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Check 3c: Contracts expiring within 30 days
// ---------------------------------------------------------------------------

async function checkExpiringContracts(currentUserId: string): Promise<FollowUpNotification[]> {
  const today = new Date()
  const thirtyDaysLater = new Date(today)
  thirtyDaysLater.setDate(today.getDate() + 30)

  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, contract_end_date, assigned_commercial_id')
    .eq('is_active', true)
    .neq('contract_type', 'ponctuel')
    .not('contract_end_date', 'is', null)
    .gte('contract_end_date', today.toISOString().split('T')[0])
    .lte('contract_end_date', thirtyDaysLater.toISOString().split('T')[0])

  if (error) throw error

  const notifications: FollowUpNotification[] = []

  for (const client of data ?? []) {
    const recipientId = client.assigned_commercial_id ?? currentUserId
    if (recipientId !== currentUserId) continue

    const daysLeft = Math.ceil(
      (new Date(client.contract_end_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const name = client.company_name || `${client.first_name} ${client.last_name}`

    // Only notify at J-30 and J-7
    if (daysLeft > 7 && daysLeft <= 30) {
      notifications.push({
        profile_id: recipientId,
        notification_type: 'reminder',
        title: 'Contrat à renouveler',
        message: `Le contrat de ${name} expire dans ${daysLeft} jours. Pensez à proposer un renouvellement.`,
        action_url: `/crm/clients/${client.id}`,
        action_entity_type: 'contract_renewal_30',
        action_entity_id: client.id,
      })
    } else if (daysLeft <= 7) {
      notifications.push({
        profile_id: recipientId,
        notification_type: 'warning',
        title: '⚠ Contrat expire bientôt',
        message: daysLeft <= 0
          ? `Le contrat de ${name} expire aujourd'hui !`
          : `Le contrat de ${name} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} !`,
        action_url: `/crm/clients/${client.id}`,
        action_entity_type: 'contract_renewal_7',
        action_entity_id: client.id,
      })
    }
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Check 4: Upcoming client birthdays (within 7 days)
// ---------------------------------------------------------------------------

interface BirthdayEntry {
  label: string
  date: string
}

async function checkUpcomingBirthdays(currentUserId: string): Promise<FollowUpNotification[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, company_name, birthdays, assigned_commercial_id')
    .eq('is_active', true)
    .not('birthdays', 'eq', '[]')

  if (error) throw error

  const notifications: FollowUpNotification[] = []
  const today = new Date()

  for (const client of data ?? []) {
    if (!client.birthdays || !Array.isArray(client.birthdays)) continue

    const recipientId = client.assigned_commercial_id ?? currentUserId
    if (recipientId !== currentUserId) continue

    for (const bday of client.birthdays as BirthdayEntry[]) {
      if (!bday.date) continue

      const parts = bday.date.split('-')
      if (parts.length < 3) continue
      const bdayMonth = parseInt(parts[1], 10)
      const bdayDay = parseInt(parts[2], 10)

      for (let offset = 0; offset <= 7; offset++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() + offset)
        if (checkDate.getMonth() + 1 === bdayMonth && checkDate.getDate() === bdayDay) {
          const name = client.company_name || `${client.first_name} ${client.last_name}`
          const formattedDate = `${String(bdayDay).padStart(2, '0')}/${String(bdayMonth).padStart(2, '0')}`

          notifications.push({
            profile_id: recipientId,
            notification_type: 'reminder',
            title: 'Anniversaire client',
            message: offset === 0
              ? `${name} fête son anniversaire aujourd'hui !`
              : `${name} fête son anniversaire le ${formattedDate} (dans ${offset} jour${offset > 1 ? 's' : ''}).`,
            action_url: `/crm/clients/${client.id}`,
            action_entity_type: 'birthday',
            action_entity_id: `${client.id}_${bdayMonth}_${bdayDay}`,
          })
          break
        }
      }
    }
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Check 5: RDV tomorrow reminder
// ---------------------------------------------------------------------------

async function checkTomorrowRdvs(currentUserId: string): Promise<FollowUpNotification[]> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('commercial_activities')
    .select('id, subject, scheduled_at')
    .eq('assigned_to', currentUserId)
    .eq('is_completed', false)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', `${tomorrowStr}T00:00:00`)
    .lte('scheduled_at', `${tomorrowStr}T23:59:59`)

  if (error) throw error

  return (data ?? []).map(rdv => {
    const time = new Date(rdv.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return {
      profile_id: currentUserId,
      notification_type: 'reminder' as NotificationType,
      title: 'RDV demain',
      message: `${rdv.subject} — demain à ${time}`,
      action_url: '/crm/agenda',
      action_entity_type: 'rdv_reminder',
      action_entity_id: rdv.id,
    }
  })
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runFollowUpCheck(
  currentUserId: string,
  currentUserRole: string,
): Promise<number> {
  // Run all checks in parallel
  const [prospectNotifs, quoteNotifs, invoiceNotifs, birthdayNotifs, expiringQuoteNotifs, contractNotifs, rdvNotifs] = await Promise.all([
    checkStaleProspects(currentUserId),
    checkUnsignedQuotes(currentUserId),
    checkOverdueInvoices(currentUserId, currentUserRole),
    checkUpcomingBirthdays(currentUserId),
    checkExpiringQuotes(currentUserId),
    checkExpiringContracts(currentUserId),
    checkTomorrowRdvs(currentUserId),
  ])

  const allNotifs = [...prospectNotifs, ...quoteNotifs, ...invoiceNotifs, ...birthdayNotifs, ...expiringQuoteNotifs, ...contractNotifs, ...rdvNotifs]
  if (allNotifs.length === 0) return 0

  // Deduplicate against existing unread notifications
  const existingKeys = await getExistingUnreadKeys(currentUserId)
  const newNotifs = allNotifs.filter(
    (n) => !existingKeys.has(`${n.action_entity_type}:${n.action_entity_id}`)
  )

  if (newNotifs.length === 0) return 0

  // Batch insert
  const { error } = await supabase.from('notifications').insert(newNotifs)
  if (error) throw error

  // Run workflow automation engine (non-blocking)
  runWorkflowEngine(currentUserId).catch(err => {
    console.error('[WorkflowEngine]', err)
  })

  return newNotifs.length
}
