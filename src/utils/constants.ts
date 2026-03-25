import { brand } from '../config/brand'
export const APP_NAME = `CRM ${brand.name}`

export const INTERVENTION_COLORS = {
  contrat: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  ponctuel: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', dot: 'bg-orange-500' },
  suspendu: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-500', dot: 'bg-slate-400' },
  extra: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500' },
  ancien: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', dot: 'bg-red-500' },
  fournisseur: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800', dot: 'bg-purple-500' },
} as const

export const CONTRACT_FORMULAS = {
  essentiel: { label: 'Essentiel', hours: 2, description: '2h/mois' },
  tranquillite: { label: 'Tranquillité', hours: 4, description: '4h/mois' },
  serenite: { label: 'Sérénité', hours: 8, description: '8h/mois' },
} as const

export const PIPELINE_STAGES = [
  { id: 'nouveau', label: 'Nouveau contact', color: '#3b82f6' },
  { id: 'qualification', label: 'Qualification', color: '#f59e0b' },
  { id: 'proposition', label: 'Devis envoyé', color: '#8b5cf6' },
  { id: 'negociation', label: 'Négociation', color: '#f97316' },
  { id: 'gagne', label: 'Gagné', color: '#22c55e' },
  { id: 'perdu', label: 'Perdu', color: '#ef4444' },
] as const

export const ABSENCE_TYPES_LABELS: Record<string, string> = {
  conge_paye: 'Congé payé',
  maladie: 'Maladie',
  rtt: 'RTT',
  formation: 'Formation',
  sans_solde: 'Sans solde',
  autre: 'Autre',
}

export const MAX_TEAMS = 16
export const DEFAULT_TVA_RATE = 20
export const TAX_CREDIT_RATE = 50
export const SESSION_MAX_DAYS = 14
