/**
 * Migration Phase 2: Fournisseurs, Articles, Règlements, Contrats
 *
 * Usage:
 *   npx tsx scripts/migrate-phase2.ts --dry-run
 *   npx tsx scripts/migrate-phase2.ts
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = 'https://spuxyppnyzpmaznuqdcc.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwdXh5cHBueXpwbWF6bnVxZGNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc2NDI5OCwiZXhwIjoyMDg3MzQwMjk4fQ.kcVgsEPh0CXXfc7AevODxZICUumRqYHPaH9HJEotxG4'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.resolve(__dirname, '..')

function readExcel(filename: string): Record<string, any>[] {
  const filepath = path.join(ROOT, filename)
  if (!fs.existsSync(filepath)) { console.warn(`⚠ Fichier introuvable: ${filename}`); return [] }
  const wb = XLSX.readFile(filepath)
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
}

function clean(val: any): string { return val == null ? '' : String(val).trim() }
function capitalize(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '' }
function cleanPhone(val: any): string { if (!val) return ''; return String(val).replace(/[^0-9+]/g, '') || '' }
function cleanEmail(val: any): string { const e = clean(val).toLowerCase(); return (!e || !e.includes('@')) ? '' : e }
function excelDateToISO(val: any): string | null {
  if (!val) return null
  if (typeof val === 'string' && val.includes('/')) {
    const [d, m, y] = val.split(/[/ ]/)
    return `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`
  }
  if (typeof val === 'number' && val > 30000) {
    const date = new Date((val - 25569) * 86400 * 1000)
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
  }
  return null
}

const report = { suppliers: { ok: 0, err: 0 }, articles: { ok: 0, err: 0 }, reglements: { ok: 0, err: 0 }, contrats: { ok: 0, err: 0 } }

// ---------------------------------------------------------------------------
// 1. Fournisseurs — Fixed column mapping for suppliers table
// ---------------------------------------------------------------------------
async function migrateSuppliers() {
  console.log('\n🏭 Fournisseurs...')
  const rows = readExcel('export fournisseurs dreamflore.xlsx')
  console.log(`  ${rows.length} lignes`)
  if (DRY_RUN) { console.log('  [DRY RUN]'); return }

  for (const row of rows) {
    const companyName = clean(row['Nom']) || clean(row['Code'])
    if (!companyName) continue

    const address = [clean(row['numerovoie']), clean(row['lettrevoie']), clean(row['typevoie']), clean(row['libellevoie'])].filter(Boolean).join(' ')
      || clean(row['complement']) || clean(row['lieudit']) || ''

    const { error } = await supabase.from('suppliers').insert({
      company_name: companyName,
      contact_first_name: null,
      contact_last_name: null,
      email: cleanEmail(row['Email']) || null,
      phone: cleanPhone(row['Bureau/Domicile']) || cleanPhone(row['Portable']) || null,
      mobile: cleanPhone(row['Portable']) || null,
      address_line1: address || null,
      postal_code: clean(row['C.P.']) || null,
      city: capitalize(clean(row['Ville'])) || null,
      category: clean(row['motsclefs']) || null,
      notes: 'Migré depuis Dreamflore',
      is_active: true,
    })

    if (error) { report.suppliers.err++; if (report.suppliers.err <= 3) console.error('  ❌', companyName, error.message) }
    else report.suppliers.ok++
  }
  console.log(`  ✅ ${report.suppliers.ok} insérés, ${report.suppliers.err} erreurs`)
}

// ---------------------------------------------------------------------------
// 2. Articles catalogue
// ---------------------------------------------------------------------------
async function migrateArticles() {
  console.log('\n📦 Articles catalogue...')

  // Check if catalog_items table exists
  const { error: testErr } = await supabase.from('catalog_items').select('id').limit(1)
  if (testErr) {
    console.log('  ⚠ Table catalog_items inexistante — SQL à exécuter dans Supabase:')
    console.log(`
  CREATE TABLE IF NOT EXISTS public.catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Autres',
    unit TEXT NOT NULL DEFAULT 'unité',
    unit_price_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
    tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    is_labor BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can read catalog" ON public.catalog_items FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admins can manage catalog" ON public.catalog_items FOR ALL TO authenticated USING (true);
    `)
    return
  }

  const rows = readExcel('export articles dreamflore.xlsx')
  console.log(`  ${rows.length} articles`)
  if (DRY_RUN) { console.log('  [DRY RUN]'); return }

  for (const row of rows) {
    const name = clean(row['Libellé']) || clean(row['Article'])
    if (!name) continue

    const prixTTC = Number(row['Prix vente TTC']) || 0
    const prixHT = prixTTC > 0 ? Math.round(prixTTC / 1.2 * 100) / 100 : 0

    const typeRaw = clean(row['Type']).toUpperCase()
    const isLabor = typeRaw === 'M' || typeRaw === 'MO' // Main d'oeuvre

    const { error } = await supabase.from('catalog_items').insert({
      name,
      description: clean(row['Observation']) || null,
      category: clean(row['Famille']) || clean(row['Famille parent']) || 'Autres',
      unit: clean(row['Unité vente']) || 'unité',
      unit_price_ht: prixHT,
      tva_rate: 20,
      is_labor: isLabor,
      is_active: !(row['Périmé'] === true),
      sort_order: 0,
    })

    if (error) { report.articles.err++; if (report.articles.err <= 3) console.error('  ❌', name, error.message) }
    else report.articles.ok++
  }
  console.log(`  ✅ ${report.articles.ok} insérés, ${report.articles.err} erreurs`)
}

// ---------------------------------------------------------------------------
// 3. Règlements — update invoices with payment info
// ---------------------------------------------------------------------------
async function migrateReglements() {
  console.log('\n💶 Règlements...')
  const rows = readExcel('export reglement dreamflore.xlsx')
  console.log(`  ${rows.length} règlements`)
  if (DRY_RUN) { console.log('  [DRY RUN]'); return }

  // Build map: facture reference → total payment
  const paymentsByInvoice = new Map<string, { total: number; method: string; date: string | null }>()

  for (const row of rows) {
    const factureRef = clean(row['Facture'])
    if (!factureRef) continue

    const montant = Number(row['Montant TTC']) || 0
    const modeRaw = clean(row['Mode paiement']).toLowerCase()
    const date = excelDateToISO(row['Date'])

    const methodMap: Record<string, string> = {
      'virement': 'virement', 'cheque': 'cheque', 'chèque': 'cheque',
      'cb': 'carte_bancaire', 'carte': 'carte_bancaire',
      'prelevement': 'prelevement', 'especes': 'especes',
    }

    const existing = paymentsByInvoice.get(factureRef) || { total: 0, method: '', date: null }
    existing.total += montant
    existing.method = methodMap[modeRaw] || existing.method || 'virement'
    if (date && (!existing.date || date > existing.date)) existing.date = date
    paymentsByInvoice.set(factureRef, existing)
  }

  console.log(`  ${paymentsByInvoice.size} factures avec paiements`)

  // Update each invoice
  for (const [factureRef, payment] of paymentsByInvoice) {
    // Find invoice by migrated reference
    const migRef = `MIG-FAC-${factureRef}`
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, total_ttc')
      .eq('reference', migRef)
      .maybeSingle()

    if (!invoice) continue

    const isPaid = payment.total >= (invoice.total_ttc * 0.99) // 1% tolerance
    const { error } = await supabase
      .from('invoices')
      .update({
        amount_paid: Math.round(payment.total * 100) / 100,
        payment_method: payment.method || null,
        paid_date: payment.date,
        status: isPaid ? 'payee' : payment.total > 0 ? 'partiellement_payee' : undefined,
      })
      .eq('id', invoice.id)

    if (error) { report.reglements.err++ }
    else report.reglements.ok++
  }
  console.log(`  ✅ ${report.reglements.ok} factures mises à jour, ${report.reglements.err} erreurs`)
}

// ---------------------------------------------------------------------------
// 4. Contrats — update clients with contract dates
// ---------------------------------------------------------------------------
async function migrateContrats() {
  console.log('\n📝 Contrats...')
  const rows = readExcel('export contrat dreamflore.xlsx')
  console.log(`  ${rows.length} contrats`)
  if (DRY_RUN) { console.log('  [DRY RUN]'); return }

  for (const row of rows) {
    const lastName = capitalize(clean(row['Nom']))
    const firstName = capitalize(clean(row['Prénom']))
    if (!lastName) continue

    const startDate = excelDateToISO(row['Début facturation'])
    const endDate = excelDateToISO(row['Fin facturation'])
    const renewDate = excelDateToISO(row['Date renouvell.'])

    // Find client by name match
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .ilike('last_name', lastName)
      .ilike('first_name', firstName || '%')
      .limit(1)

    if (!clients || clients.length === 0) continue

    const update: Record<string, any> = { contract_type: 'annuel' }
    if (startDate) update.contract_start_date = startDate
    if (endDate || renewDate) update.contract_end_date = endDate || renewDate

    const { error } = await supabase.from('clients').update(update).eq('id', clients[0].id)

    if (error) report.contrats.err++
    else report.contrats.ok++
  }
  console.log(`  ✅ ${report.contrats.ok} clients enrichis, ${report.contrats.err} erreurs`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(50))
  console.log('  MIGRATION PHASE 2')
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 RÉEL'}`)
  console.log('='.repeat(50))

  await migrateSuppliers()
  await migrateArticles()
  await migrateReglements()
  await migrateContrats()

  console.log('\n' + '='.repeat(50))
  console.log('  RÉSULTAT')
  console.log('='.repeat(50))
  console.log(`  Fournisseurs: ${report.suppliers.ok} OK, ${report.suppliers.err} erreurs`)
  console.log(`  Articles:     ${report.articles.ok} OK, ${report.articles.err} erreurs`)
  console.log(`  Règlements:   ${report.reglements.ok} OK, ${report.reglements.err} erreurs`)
  console.log(`  Contrats:     ${report.contrats.ok} OK, ${report.contrats.err} erreurs`)
}

main().catch(err => { console.error('💥', err); process.exit(1) })
