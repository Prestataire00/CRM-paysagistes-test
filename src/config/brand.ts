// ============================================================
// BRAND CONFIGURATION — À MODIFIER POUR CHAQUE CLIENT
// Ce fichier est l'unique source de vérité pour l'identité
// de marque. Ne jamais hardcoder le nom client ailleurs.
// ============================================================

export const brand = {
  // Nom complet affiché partout (PDF, mails, sidebar)
  name: 'CLIENT SERVICES',

  // Nom court (slug, DB locale, identifiants)
  slug: 'client',

  // Email commercial (expéditeur des mails automatiques)
  email: 'commercial@client.fr',

  // URL de production du CRM
  url: 'https://crm.client.fr',

  // Couleur principale de la marque (hex)
  primaryColor: '#7AB928',

  // Secteur d'activité affiché dans la sidebar et les labels
  sector: 'Paysagiste',

  // Nom du rôle terrain (affiché dans les interfaces)
  workerLabel: 'jardinier',
  workerLabelPlural: 'jardiniers',

  // Chemin vers le logo dans /public
  logoPath: '/demonfaucon.jpg',
  logoAlt: 'Logo Demonfaucon',

  // Texte utilisé dans les prompts IA (newsletters, relances)
  aiContext: 'une entreprise de travaux de jardinage et entretien de jardins',
} as const

export type Brand = typeof brand
