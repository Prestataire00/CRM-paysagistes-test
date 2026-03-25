import { brand } from '../../../config/brand'
import { useState, useEffect, useCallback, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { useParams, useNavigate } from 'react-router'
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  Users,
  Tag,
  Megaphone,
  Percent,
  Newspaper,
  FileText,
  Monitor,
  Smartphone,
  Mail,
  Info,
  Search,
  Eye,
  Palette,
  Plus,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { AiAssistButton } from '../../../components/ui/AiAssistButton'
import { Tabs } from '../../../components/navigation/Tabs'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { TagInput } from '../../../components/form/TagInput'
import { StatCard } from '../../../components/data/StatCard'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import {
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useSendCampaign,
  useNewsletterRecipients,
} from '../../../queries/useNewsletters'
import { useClientTags } from '../../../queries/useClients'
import { useToast } from '../../../components/feedback/ToastProvider'
import {
  NEWSLETTER_TEMPLATES,
  getTemplateConfig,
  buildNewsletterHtml,
} from '../../../utils/newsletter-templates'
import type { NewsletterContent, NewsletterTemplate, CampaignStatus } from '../../../types'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const templateIcons: Record<NewsletterTemplate, LucideIcon> = {
  annonce: Megaphone,
  promotion: Percent,
  actualites: Newspaper,
  simple: FileText,
}

const templateColors: Record<NewsletterTemplate, { bg: string; text: string; border: string; ring: string }> = {
  annonce: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-400', ring: 'ring-blue-400' },
  promotion: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-400', ring: 'ring-amber-400' },
  actualites: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-400', ring: 'ring-purple-400' },
  simple: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-400', ring: 'ring-slate-400' },
}

const statusBadgeVariant: Record<CampaignStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  brouillon: 'neutral',
  programmee: 'warning',
  en_cours: 'info',
  envoyee: 'success',
  annulee: 'error',
}

const statusLabels: Record<CampaignStatus, string> = {
  brouillon: 'Brouillon',
  programmee: 'Programmee',
  en_cours: 'En cours',
  envoyee: 'Envoyee',
  annulee: 'Annulee',
}

function makeDefaultContent(template: NewsletterTemplate = 'annonce'): NewsletterContent {
  const cfg = getTemplateConfig(template)
  return {
    template,
    greeting: cfg.defaultGreeting,
    intro: '',
    body: '',
    cta_text: '',
    cta_url: '',
    closing: cfg.defaultClosing,
    highlight_text: '',
    valid_until: '',
    sections: [{ title: '', content: '' }],
  }
}

// ===========================================================================
// NewsletterComposePage
// ===========================================================================
export function NewsletterComposePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const isNew = !id

  // Data
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(id)
  const { data: tags = [] } = useClientTags()

  // Mutations
  const createMutation = useCreateCampaign()
  const updateMutation = useUpdateCampaign()
  const sendMutation = useSendCampaign()

  // Form state
  const [activeTab, setActiveTab] = useState('contenu')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState<NewsletterContent>(makeDefaultContent())
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [recipientSearch, setRecipientSearch] = useState('')

  // Recipients
  const tagFilter = selectedTagIds.length > 0 ? selectedTagIds : undefined
  const { data: recipients = [], isLoading: loadingRecipients } = useNewsletterRecipients(tagFilter)

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch) return recipients
    const lower = recipientSearch.toLowerCase()
    return recipients.filter(
      (r) =>
        r.first_name.toLowerCase().includes(lower) ||
        r.last_name.toLowerCase().includes(lower) ||
        (r.email ?? '').toLowerCase().includes(lower) ||
        (r.company_name ?? '').toLowerCase().includes(lower),
    )
  }, [recipients, recipientSearch])

  // Populate form when campaign loads
  useEffect(() => {
    if (campaign) {
      setSubject(campaign.subject)
      setSelectedTagIds(campaign.tag_filter ?? [])
      if (campaign.content_json) {
        setContent({
          ...makeDefaultContent(campaign.content_json.template),
          ...campaign.content_json,
          sections: campaign.content_json.sections ?? [{ title: '', content: '' }],
        })
      }
    }
  }, [campaign])

  const isReadOnly = campaign?.status === 'envoyee' || campaign?.status === 'annulee'
  const isLegacy = !isNew && campaign && !campaign.content_json
  const currentTemplate = getTemplateConfig(content.template)

  // Template change
  const handleTemplateChange = useCallback(
    (template: NewsletterTemplate) => {
      if (isReadOnly) return
      const cfg = getTemplateConfig(template)
      setContent((prev) => {
        const next: NewsletterContent = {
          ...prev,
          template,
          closing: cfg.defaultClosing,
        }
        // Convert body to section if switching to actualites
        if (template === 'actualites' && (!prev.sections || prev.sections.length === 0)) {
          next.sections = prev.body
            ? [{ title: 'Article', content: prev.body }]
            : [{ title: '', content: '' }]
        }
        return next
      })
    },
    [isReadOnly],
  )

  // Update a content field
  const updateField = useCallback(
    <K extends keyof NewsletterContent>(field: K, value: NewsletterContent[K]) => {
      if (isReadOnly) return
      setContent((prev) => ({ ...prev, [field]: value }))
    },
    [isReadOnly],
  )

  // Section management (actualites)
  const addSection = useCallback(() => {
    if (isReadOnly) return
    setContent((prev) => ({
      ...prev,
      sections: [...(prev.sections ?? []), { title: '', content: '' }],
    }))
  }, [isReadOnly])

  const removeSection = useCallback(
    (index: number) => {
      if (isReadOnly) return
      setContent((prev) => {
        const sections = [...(prev.sections ?? [])]
        if (sections.length <= 1) return prev
        sections.splice(index, 1)
        return { ...prev, sections }
      })
    },
    [isReadOnly],
  )

  const updateSection = useCallback(
    (index: number, field: 'title' | 'content', value: string) => {
      if (isReadOnly) return
      setContent((prev) => {
        const sections = [...(prev.sections ?? [])]
        sections[index] = { ...sections[index], [field]: value }
        return { ...prev, sections }
      })
    },
    [isReadOnly],
  )

  // Generate preview HTML
  const previewHtml = useMemo(() => buildNewsletterHtml(content, subject), [content, subject])

  // Save
  const handleSave = useCallback(() => {
    if (!subject.trim()) {
      toast.error('Le sujet est obligatoire')
      return
    }

    const generatedHtml = buildNewsletterHtml(content, subject)
    const payload = {
      subject: subject.trim(),
      body_html: generatedHtml,
      content_json: content,
      tag_filter: selectedTagIds.length > 0 ? selectedTagIds : null,
      status: 'brouillon' as const,
      scheduled_at: null,
      sent_at: null,
      created_by: null,
    }

    if (isNew) {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          toast.success('Campagne creee avec succes')
          navigate(`/relation/newsletters/${data.id}`, { replace: true })
        },
        onError: () => toast.error('Erreur lors de la creation'),
      })
    } else {
      updateMutation.mutate(
        {
          id: id!,
          data: {
            subject: payload.subject,
            body_html: payload.body_html,
            content_json: payload.content_json,
            tag_filter: payload.tag_filter,
          },
        },
        {
          onSuccess: () => toast.success('Campagne sauvegardee'),
          onError: () => toast.error('Erreur lors de la sauvegarde'),
        },
      )
    }
  }, [subject, content, selectedTagIds, isNew, id, createMutation, updateMutation, toast, navigate])

  // Send
  const handleSend = useCallback(() => {
    if (!id) return
    sendMutation.mutate(
      { id, recipientCount: recipients.length },
      {
        onSuccess: () => {
          toast.success(`Campagne envoyee a ${recipients.length} destinataire${recipients.length !== 1 ? 's' : ''}`)
          setShowSendConfirm(false)
        },
        onError: () => {
          toast.error("Erreur lors de l'envoi")
          setShowSendConfirm(false)
        },
      },
    )
  }, [id, recipients.length, sendMutation, toast])

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Tabs config
  const tabItems = useMemo(
    () => [
      { key: 'contenu', label: 'Contenu' },
      { key: 'destinataires', label: 'Destinataires', count: recipients.length },
      { key: 'apercu', label: 'Apercu' },
    ],
    [recipients.length],
  )

  // Subject char count
  const subjectLen = subject.length
  const subjectColor =
    subjectLen === 0
      ? 'text-slate-400'
      : subjectLen <= 50
        ? 'text-emerald-600'
        : subjectLen <= 70
          ? 'text-amber-600'
          : 'text-red-600'
  const subjectBarColor =
    subjectLen === 0
      ? 'bg-slate-200'
      : subjectLen <= 50
        ? 'bg-emerald-500'
        : subjectLen <= 70
          ? 'bg-amber-500'
          : 'bg-red-500'

  // Loading
  if (!isNew && loadingCampaign) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
        <span className="text-sm text-slate-500">Chargement...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <PageHeader
        title={isNew ? 'Nouvelle campagne' : campaign?.subject ?? 'Campagne'}
        description={
          isNew
            ? 'Composez et envoyez une newsletter a vos clients'
            : `Campagne ${statusLabels[campaign?.status ?? 'brouillon'].toLowerCase()}`
        }
        actions={
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <Button variant="secondary" icon={Save} onClick={handleSave} loading={isSaving}>
                {isNew ? 'Enregistrer' : 'Sauvegarder'}
              </Button>
            )}
            {!isNew && !isReadOnly && campaign?.status === 'brouillon' && (
              <Button
                variant="primary"
                icon={Send}
                onClick={() => setShowSendConfirm(true)}
                disabled={recipients.length === 0 || !subject.trim()}
              >
                Envoyer ({recipients.length})
              </Button>
            )}
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/relation/newsletters')}>
              Retour
            </Button>
          </div>
        }
      />

      {/* Status + info bar */}
      <div className="flex items-center gap-3 mb-4">
        {campaign && (
          <Badge variant={statusBadgeVariant[campaign.status]}>{statusLabels[campaign.status]}</Badge>
        )}
        {isNew && <Badge variant="neutral">Nouveau brouillon</Badge>}
        {recipients.length > 0 && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {recipients.length} destinataire{recipients.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabItems} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Legacy banner */}
      {isLegacy && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Info className="w-4 h-4 shrink-0" />
          Cette campagne a ete creee avec l'ancien editeur. L'apercu affiche le contenu HTML existant.
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Contenu — side-by-side layout */}
      {/* ================================================================= */}
      {activeTab === 'contenu' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Editor (3/5) */}
          <div className="xl:col-span-3 space-y-5">
            {/* Template selector */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Template</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {NEWSLETTER_TEMPLATES.map((tpl) => {
                  const TplIcon = templateIcons[tpl.key]
                  const colors = templateColors[tpl.key]
                  const isSelected = content.template === tpl.key
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleTemplateChange(tpl.key)}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? `${colors.border} ${colors.bg} ring-1 ${colors.ring}`
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      } disabled:opacity-50`}
                    >
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected ? colors.bg : 'bg-slate-100'
                        }`}
                      >
                        <TplIcon className={`w-4 h-4 ${isSelected ? colors.text : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isSelected ? colors.text : 'text-slate-700'}`}>
                          {tpl.label}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{tpl.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Subject */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-sm font-semibold text-slate-700">Sujet *</label>
                  {!isReadOnly && (
                    <AiAssistButton
                      context="newsletter_subject"
                      currentValue={subject}
                      onApply={(text) => setSubject(text)}
                    />
                  )}
                </div>
                <span className={`text-xs font-medium tabular-nums ${subjectColor}`}>{subjectLen}/70</span>
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Nouveautes de printemps — Mars 2026"
                disabled={isReadOnly}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
              <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${subjectBarColor}`}
                  style={{ width: `${Math.min(100, (subjectLen / 70) * 100)}%` }}
                />
              </div>
            </div>

            {/* Content fields — ADAPTIVE per template */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Contenu de l'email</h3>

              {/* Greeting — all templates */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Salutation
                </label>
                <input
                  type="text"
                  value={content.greeting}
                  onChange={(e) => updateField('greeting', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Variables : {'{{prenom}}'}, {'{{nom}}'}, {'{{entreprise}}'}
                </p>
              </div>

              {/* Highlight — PROMOTION only */}
              {currentTemplate.showHighlight && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <label className="block text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">
                    Texte de l'offre
                  </label>
                  <input
                    type="text"
                    value={content.highlight_text ?? ''}
                    onChange={(e) => updateField('highlight_text', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Ex: -20% sur l'entretien de printemps"
                    className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm font-bold text-amber-800 placeholder:font-normal placeholder:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50 bg-white"
                  />
                  <p className="text-[11px] text-amber-500 mt-1">
                    Ce texte sera mis en avant dans un encadre visible
                  </p>
                </div>
              )}

              {/* Intro — ANNONCE + ACTUALITES */}
              {currentTemplate.showIntro && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Introduction
                    </label>
                    {!isReadOnly && (
                      <AiAssistButton
                        context="newsletter_intro"
                        currentValue={content.intro}
                        onApply={(text) => updateField('intro', text)}
                      />
                    )}
                  </div>
                  <textarea
                    value={content.intro}
                    onChange={(e) => updateField('intro', e.target.value)}
                    rows={2}
                    disabled={isReadOnly}
                    placeholder="Presentez le contexte de votre email..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none disabled:bg-slate-50"
                  />
                </div>
              )}

              {/* Body — ANNONCE + PROMOTION + SIMPLE */}
              {currentTemplate.showBody && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Contenu principal
                    </label>
                    {!isReadOnly && (
                      <AiAssistButton
                        context="newsletter_body"
                        currentValue={content.body}
                        onApply={(text) => updateField('body', text)}
                      />
                    )}
                  </div>
                  <textarea
                    value={content.body}
                    onChange={(e) => updateField('body', e.target.value)}
                    rows={6}
                    disabled={isReadOnly}
                    placeholder="Redigez le contenu principal de votre newsletter..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y disabled:bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Ligne vide = nouveau paragraphe</p>
                </div>
              )}

              {/* Sections — ACTUALITES only */}
              {currentTemplate.showSections && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Sections
                  </label>
                  {(content.sections ?? []).map((section, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-green-500 rounded-full shrink-0" />
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(i, 'title', e.target.value)}
                          disabled={isReadOnly}
                          placeholder={`Titre de la section ${i + 1}`}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-100 bg-white"
                        />
                        {(content.sections ?? []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSection(i)}
                            disabled={isReadOnly}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[11px] text-slate-400">Contenu</span>
                        {!isReadOnly && (
                          <AiAssistButton
                            context="newsletter_section"
                            currentValue={section.content}
                            onApply={(text) => updateSection(i, 'content', text)}
                          />
                        )}
                      </div>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSection(i, 'content', e.target.value)}
                        rows={3}
                        disabled={isReadOnly}
                        placeholder="Contenu de cette section..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none disabled:bg-slate-100 bg-white"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSection}
                    disabled={isReadOnly}
                    className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une section
                  </button>
                </div>
              )}

              {/* CTA — ANNONCE + PROMOTION */}
              {currentTemplate.showCta && (
                <div className={`rounded-lg p-4 border ${
                  content.template === 'promotion'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center gap-1 mb-2">
                    <label className={`text-xs font-medium uppercase tracking-wide ${
                      content.template === 'promotion' ? 'text-amber-700' : 'text-green-700'
                    }`}>
                      Bouton d'action
                    </label>
                    {!isReadOnly && (
                      <AiAssistButton
                        context="newsletter_cta"
                        currentValue={content.cta_text ?? ''}
                        onApply={(text) => updateField('cta_text', text)}
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={content.cta_text ?? ''}
                      onChange={(e) => updateField('cta_text', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Texte du bouton"
                      className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 bg-white ${
                        content.template === 'promotion'
                          ? 'border-amber-200 focus:ring-amber-500'
                          : 'border-green-200 focus:ring-green-500'
                      }`}
                    />
                    <input
                      type="url"
                      value={content.cta_url ?? ''}
                      onChange={(e) => updateField('cta_url', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="https://..."
                      className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 bg-white ${
                        content.template === 'promotion'
                          ? 'border-amber-200 focus:ring-amber-500'
                          : 'border-green-200 focus:ring-green-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Valid until — PROMOTION only */}
              {currentTemplate.showValidUntil && (
                <div>
                  <label className="block text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">
                    Valable jusqu'au
                  </label>
                  <input
                    type="date"
                    value={content.valid_until ?? ''}
                    onChange={(e) => updateField('valid_until', e.target.value)}
                    disabled={isReadOnly}
                    className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    La date sera affichee sous le bouton d'action
                  </p>
                </div>
              )}

              {/* Closing — all templates */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Formule de cloture
                </label>
                <textarea
                  value={content.closing ?? ''}
                  onChange={(e) => updateField('closing', e.target.value)}
                  rows={2}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Right: Live mini-preview (2/5) */}
          <div className="xl:col-span-2">
            <div className="sticky top-6 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Apercu en direct</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('apercu')}
                    className="text-[11px] text-green-600 hover:text-green-700 font-medium"
                  >
                    Plein ecran
                  </button>
                </div>
                <div className="bg-slate-100 p-3">
                  {subject && (
                    <div className="bg-white rounded px-3 py-1.5 mb-2 border border-slate-200">
                      <p className="text-[10px] text-slate-400">Sujet</p>
                      <p className="text-xs font-medium text-slate-700 truncate">{subject}</p>
                    </div>
                  )}
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:8px;background:#f8fafc;}</style></head><body>${previewHtml}</body></html>`}
                    sandbox=""
                    title="Mini apercu"
                    className="w-full rounded border border-slate-200 bg-white"
                    style={{ height: 480, border: 'none' }}
                  />
                </div>
              </div>

              {/* Quick stats */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">
                      {loadingRecipients ? '...' : recipients.length}
                    </p>
                    <p className="text-[11px] text-slate-500">Destinataires</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">{selectedTagIds.length || 'Tous'}</p>
                    <p className="text-[11px] text-slate-500">Tags</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Destinataires */}
      {/* ================================================================= */}
      {activeTab === 'destinataires' && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Seuls les clients ayant donne leur consentement newsletter et possedant une adresse email valide sont
              inclus dans la liste des destinataires.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={Users}
              label="Destinataires"
              value={loadingRecipients ? '...' : recipients.length}
            />
            <StatCard
              icon={Mail}
              label="Avec email"
              value={loadingRecipients ? '...' : recipients.filter((r) => r.email).length}
            />
            <StatCard
              icon={Tag}
              label="Tags selectionnes"
              value={selectedTagIds.length || 'Tous'}
            />
          </div>

          {/* Tag filter */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <TagInput
              availableTags={tags}
              selectedTagIds={selectedTagIds}
              onChange={(ids) => !isReadOnly && setSelectedTagIds(ids)}
              label="Filtrer par tags"
            />
            <p className="text-xs text-slate-400 mt-2">
              Laissez vide pour cibler tous les clients consentants
            </p>
          </div>

          {/* Recipient list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Liste des destinataires ({recipients.length})
              </h3>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                placeholder="Rechercher un destinataire..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {loadingRecipients ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500">Chargement...</span>
              </div>
            ) : filteredRecipients.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun destinataire trouve</p>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {filteredRecipients.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 px-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {r.first_name} {r.last_name}
                        {r.company_name && (
                          <span className="font-normal text-slate-400"> — {r.company_name}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 ml-3">{r.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Apercu plein ecran */}
      {/* ================================================================= */}
      {activeTab === 'apercu' && (
        <div className="space-y-4">
          {/* Preview controls */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">Affichage :</span>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setPreviewMode('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    previewMode === 'desktop'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Desktop
                </button>
                <button
                  onClick={() => setPreviewMode('mobile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    previewMode === 'mobile'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mobile
                </button>
              </div>
            </div>
            <span className="text-[11px] text-slate-400">
              Largeur : {previewMode === 'desktop' ? '600px' : '360px'}
            </span>
          </div>

          {/* Subject bar */}
          {subject && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">De : {brand.name}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{subject}</p>
                </div>
              </div>
            </div>
          )}

          {/* Email preview */}
          <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 flex justify-center min-h-[550px]">
            {isLegacy ? (
              <div
                className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                style={{ width: previewMode === 'desktop' ? 600 : 360 }}
              >
                <div
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(campaign?.body_html ?? '') }}
                />
              </div>
            ) : (
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#f8fafc;}</style></head><body>${DOMPurify.sanitize(previewHtml)}</body></html>`}
                sandbox=""
                title="Apercu email"
                className="rounded-lg shadow-sm"
                style={{
                  width: previewMode === 'desktop' ? 632 : 392,
                  height: 600,
                  border: 'none',
                  background: '#f8fafc',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Send confirmation */}
      <ConfirmDialog
        open={showSendConfirm}
        title="Envoyer la campagne"
        message={`Vous allez envoyer cette campagne a ${recipients.length} destinataire${recipients.length !== 1 ? 's' : ''}. Cette action est irreversible.`}
        confirmLabel="Envoyer"
        variant="primary"
        loading={sendMutation.isPending}
        onConfirm={handleSend}
        onCancel={() => setShowSendConfirm(false)}
      />
    </div>
  )
}

export default NewsletterComposePage
