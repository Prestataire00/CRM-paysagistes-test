import { brand } from '../config/brand'
import type { NewsletterTemplate, NewsletterContent } from '../types'

// ---------------------------------------------------------------------------
// Template configuration
// ---------------------------------------------------------------------------
export interface TemplateConfig {
  key: NewsletterTemplate
  label: string
  description: string
  defaultGreeting: string
  defaultClosing: string
  showCta: boolean
  showIntro: boolean
  showBody: boolean
  showHighlight: boolean
  showValidUntil: boolean
  showSections: boolean
}

export const NEWSLETTER_TEMPLATES: TemplateConfig[] = [
  {
    key: 'annonce',
    label: 'Annonce',
    description: 'Nouveaute, evenement ou information importante',
    defaultGreeting: 'Bonjour {{prenom}},',
    defaultClosing: `A bientot,\nL'equipe ${brand.name}`,
    showCta: true,
    showIntro: true,
    showBody: true,
    showHighlight: false,
    showValidUntil: false,
    showSections: false,
  },
  {
    key: 'promotion',
    label: 'Promotion',
    description: 'Offre speciale ou remise temporaire',
    defaultGreeting: 'Bonjour {{prenom}},',
    defaultClosing: `Cordialement,\nL'equipe ${brand.name}`,
    showCta: true,
    showIntro: false,
    showBody: true,
    showHighlight: true,
    showValidUntil: true,
    showSections: false,
  },
  {
    key: 'actualites',
    label: 'Actualites',
    description: 'Newsletter periodique avec plusieurs sujets',
    defaultGreeting: 'Bonjour {{prenom}},',
    defaultClosing: `A tres bientot,\nL'equipe ${brand.name}`,
    showCta: false,
    showIntro: true,
    showBody: false,
    showHighlight: false,
    showValidUntil: false,
    showSections: true,
  },
  {
    key: 'simple',
    label: 'Simple',
    description: 'Message texte personnel sans mise en forme',
    defaultGreeting: 'Bonjour {{prenom}},',
    defaultClosing: `Cordialement,\nL'equipe ${brand.name}`,
    showCta: false,
    showIntro: false,
    showBody: true,
    showHighlight: false,
    showValidUntil: false,
    showSections: false,
  },
]

export function getTemplateConfig(key: NewsletterTemplate): TemplateConfig {
  return NEWSLETTER_TEMPLATES.find((t) => t.key === key) ?? NEWSLETTER_TEMPLATES[0]
}

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="font-size:15px;margin:0 0 16px;line-height:1.6">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')
}

function closingHtml(closing: string | undefined): string {
  if (!closing) return ''
  return `<div style="margin-top:24px">${closing
    .split(/\n/)
    .map(
      (line) =>
        `<p style="font-size:15px;margin:0 0 4px;line-height:1.5">${escapeHtml(line)}</p>`,
    )
    .join('')}</div>`
}

const STANDARD_FOOTER = `<div style="background:#f8fafc;padding:16px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center">
    <p style="margin:0;font-size:12px;color:#94a3b8">
      ${brand.name} &mdash; Vous recevez cet email car vous avez donne votre consentement.
    </p>
  </div>`

const GREEN_HEADER = `<div style="background:#16a34a;padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px;color:white;font-weight:700">${brand.name}</h1>
    <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85)">Entretien de jardins &amp; espaces verts</p>
  </div>`

// ---------------------------------------------------------------------------
// Template 1 : ANNONCE — Hero title bar + focused content
// ---------------------------------------------------------------------------
function buildAnnonceHtml(content: NewsletterContent, subject: string): string {
  const introHtml = content.intro
    ? `<p style="font-size:15px;margin:0 0 24px;line-height:1.6;color:#64748b;font-style:italic">${escapeHtml(content.intro).replace(/\n/g, '<br>')}</p>`
    : ''

  const ctaHtml =
    content.cta_text && content.cta_url
      ? `<div style="text-align:center;margin:28px 0">
          <a href="${escapeHtml(content.cta_url)}"
             style="display:inline-block;background:#16a34a;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">
            ${escapeHtml(content.cta_text)}
          </a>
        </div>`
      : ''

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  ${GREEN_HEADER}
  <div style="background:#15803d;padding:20px 32px">
    <h2 style="margin:0;font-size:22px;color:white;font-weight:700;line-height:1.3">${escapeHtml(subject || 'Sujet de l\'annonce')}</h2>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e2e8f0;border-top:none">
    <p style="font-size:15px;margin:0 0 16px">${escapeHtml(content.greeting)}</p>
    ${introHtml}
    ${paragraphs(content.body)}
    ${ctaHtml}
    ${closingHtml(content.closing)}
  </div>
  ${STANDARD_FOOTER}
</div>`
}

// ---------------------------------------------------------------------------
// Template 2 : PROMOTION — Amber banner + highlight box + urgency CTA
// ---------------------------------------------------------------------------
function buildPromotionHtml(content: NewsletterContent): string {
  const highlightHtml = content.highlight_text
    ? `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
        <p style="font-size:22px;font-weight:800;color:#b45309;margin:0;line-height:1.3">${escapeHtml(content.highlight_text)}</p>
      </div>`
    : ''

  const ctaHtml =
    content.cta_text && content.cta_url
      ? `<div style="text-align:center;margin:28px 0">
          <a href="${escapeHtml(content.cta_url)}"
             style="display:inline-block;background:#f59e0b;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.3px">
            ${escapeHtml(content.cta_text)}
          </a>
        </div>`
      : ''

  const validUntilHtml = content.valid_until
    ? `<p style="text-align:center;font-size:13px;color:#92400e;margin:0 0 16px">
        &#9200; Offre valable jusqu'au ${escapeHtml(content.valid_until)}
      </p>`
    : ''

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  ${GREEN_HEADER}
  <div style="background:#f59e0b;padding:14px 32px;text-align:center">
    <span style="display:inline-block;background:white;color:#b45309;padding:5px 20px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Offre speciale</span>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e2e8f0;border-top:none">
    <p style="font-size:15px;margin:0 0 16px">${escapeHtml(content.greeting)}</p>
    ${highlightHtml}
    ${paragraphs(content.body)}
    ${ctaHtml}
    ${validUntilHtml}
    ${closingHtml(content.closing)}
  </div>
  ${STANDARD_FOOTER}
</div>`
}

// ---------------------------------------------------------------------------
// Template 3 : ACTUALITES — Multi-section digest with article separators
// ---------------------------------------------------------------------------
function buildActualitesHtml(content: NewsletterContent): string {
  const introHtml = content.intro
    ? `<p style="font-size:15px;margin:0 0 24px;line-height:1.6">${escapeHtml(content.intro).replace(/\n/g, '<br>')}</p>`
    : ''

  const sections = content.sections ?? []
  const sectionsHtml = sections
    .filter((s) => s.title || s.content)
    .map(
      (section, i) => `${i > 0 ? '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">' : ''}
      <div style="margin:24px 0">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:12px">
          <h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">${escapeHtml(section.title)}</h3>
        </div>
        ${section.content
          .split(/\n\n+/)
          .filter(Boolean)
          .map(
            (p) =>
              `<p style="font-size:15px;margin:0 0 12px;line-height:1.6;padding-left:20px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`,
          )
          .join('')}
      </div>`,
    )
    .join('')

  const now = new Date()
  const monthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']
  const subtitle = `Newsletter &mdash; ${monthNames[now.getMonth()]} ${now.getFullYear()}`

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#16a34a;padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px;color:white;font-weight:700">${brand.name}</h1>
    <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85)">${subtitle}</p>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e2e8f0;border-top:none">
    <p style="font-size:15px;margin:0 0 16px">${escapeHtml(content.greeting)}</p>
    ${introHtml}
    ${sectionsHtml}
    ${closingHtml(content.closing)}
  </div>
  ${STANDARD_FOOTER}
</div>`
}

// ---------------------------------------------------------------------------
// Template 4 : SIMPLE — Minimal personal-style email, no branded header
// ---------------------------------------------------------------------------
function buildSimpleHtml(content: NewsletterContent): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="border-top:3px solid #16a34a;background:white;padding:32px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px">
    <p style="font-size:15px;margin:0 0 16px">${escapeHtml(content.greeting)}</p>
    ${paragraphs(content.body)}
    ${closingHtml(content.closing)}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0">
      <p style="font-size:13px;color:#64748b;margin:0;font-weight:600">${brand.name}</p>
      <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">Entretien de jardins &amp; espaces verts</p>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin:12px 0 0">
    Vous recevez cet email car vous avez donne votre consentement.
  </p>
</div>`
}

// ---------------------------------------------------------------------------
// Public API — dispatches to the correct builder
// ---------------------------------------------------------------------------
export function buildNewsletterHtml(content: NewsletterContent, subject?: string): string {
  switch (content.template) {
    case 'annonce':
      return buildAnnonceHtml(content, subject ?? '')
    case 'promotion':
      return buildPromotionHtml(content)
    case 'actualites':
      return buildActualitesHtml(content)
    case 'simple':
      return buildSimpleHtml(content)
    default:
      return buildAnnonceHtml(content, subject ?? '')
  }
}
