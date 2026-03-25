import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Controller } from 'react-hook-form'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import {
  Building2,
  User,
  MapPin,
  Phone,
  Heart,
  FileText,
  Tag,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog'
import { Collapse } from '../../../components/form/Collapse'
import { Toggle } from '../../../components/form/Toggle'
import { AddressAutocomplete, type AddressResult } from '../../../components/form/AddressAutocomplete'
import { CompanySearch } from '../../../components/form/CompanySearch'
import type { PappersCompanyResult } from '../../../services/pappers.service'
import { PhoneInput } from '../../../components/form/PhoneInput'
import { TagInput } from '../../../components/form/TagInput'
import { DateInput } from '../../../components/form/DateInput'
import { useClientForm } from '../hooks/useClientForm'
import { useClientTags, useCreateClientTag } from '../../../queries/useClients'
import { useUsers } from '../../../queries/useAdmin'
import type { ClientFormData } from '../schemas/clientFormSchema'

// ---------------------------------------------------------------------------
// Option constants
// ---------------------------------------------------------------------------
const clientTypeOptions = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'copropriete', label: 'Copropriété' },
  { value: 'collectivite', label: 'Collectivité' },
]

const contractTypeOptions = [
  { value: 'ponctuel', label: 'Ponctuel' },
  { value: 'annuel', label: 'Annuel' },
  { value: 'trimestriel', label: 'Trimestriel' },
  { value: 'mensuel', label: 'Mensuel' },
]

const zoneOptions = [
  { value: '', label: '— Aucune —' },
  { value: 'zone_1', label: 'Zone 1' },
  { value: 'zone_2', label: 'Zone 2' },
  { value: 'zone_3', label: 'Zone 3' },
  { value: 'zone_4', label: 'Zone 4' },
  { value: 'zone_5', label: 'Zone 5' },
]

const civilityOptions = [
  { value: '', label: '— Sélectionner —' },
  { value: 'M', label: 'M.' },
  { value: 'Mme', label: 'Mme' },
  { value: 'Société', label: 'Société' },
]

const paymentMethodOptions = [
  { value: '', label: '— Aucun —' },
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'carte_bancaire', label: 'Carte bancaire' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'especes', label: 'Espèces' },
]

// Year range for contract hours
const currentYear = new Date().getFullYear()
const hoursYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

export default function ClientFormPage() {
  const navigate = useNavigate()
  const {
    form,
    isEdit,
    isLoadingClient,
    existingTagIds,
    blocker,
    duplicateMatches,
    isSaving,
    isDeleting,
    onSubmit,
    onSaveAndCreateChantier,
    onDelete,
    onCancel,
  } = useClientForm()

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = form

  // Tags state (local until save)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const { data: allTags = [] } = useClientTags()
  const createTagMutation = useCreateClientTag()
  const { data: users = [] } = useUsers()

  // Sync existing tags when loaded
  useEffect(() => {
    if (isEdit && existingTagIds.length > 0) {
      setSelectedTagIds(existingTagIds)
    }
  }, [isEdit, existingTagIds])

  // Delete confirm dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Watch for map & client type
  const lat = watch('latitude')
  const lng = watch('longitude')
  const clientType = watch('client_type')

  const handlePappersSelect = useCallback(
    (company: PappersCompanyResult) => {
      setValue('company_name', company.nom_entreprise, { shouldDirty: true })
      setValue('siret', company.siret || company.siren, { shouldDirty: true })
      if (company.numero_tva) setValue('tva_number', company.numero_tva, { shouldDirty: true })
      if (company.adresse) setValue('address_line1', company.adresse, { shouldDirty: true })
      if (company.code_postal) setValue('postal_code', company.code_postal, { shouldDirty: true })
      if (company.ville) setValue('city', company.ville, { shouldDirty: true })
    },
    [setValue],
  )

  const handleAddressSelect = useCallback(
    (result: AddressResult) => {
      setValue('address_line1', result.address_line1, { shouldDirty: true })
      setValue('postal_code', result.postal_code, { shouldDirty: true })
      setValue('city', result.city, { shouldDirty: true })
      setValue('latitude', result.latitude, { shouldDirty: true })
      setValue('longitude', result.longitude, { shouldDirty: true })
    },
    [setValue],
  )

  const handleCreateTag = useCallback(
    async (name: string) => {
      const tag = await createTagMutation.mutateAsync({ name })
      setSelectedTagIds((prev) => [...prev, tag.id])
    },
    [createTagMutation],
  )

  // Commercial options for select
  const commercialOptions = [
    { value: '', label: '— Non attribué —' },
    ...users
      .filter((u) => u.is_active)
      .map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` })),
  ]

  const scrollToFirstError = useCallback(() => {
    setTimeout(() => {
      const firstError = document.querySelector('[aria-invalid="true"], .text-red-600')
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }, [])

  const doSubmit = handleSubmit(
    (data: ClientFormData) => onSubmit(data, selectedTagIds),
    () => scrollToFirstError(),
  )
  const doSubmitAndChantier = handleSubmit(
    (data: ClientFormData) => onSaveAndCreateChantier(data, selectedTagIds),
    () => scrollToFirstError(),
  )

  if (isEdit && isLoadingClient) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={isEdit ? 'Modifier le client' : 'Nouveau client'}
        description={isEdit ? 'Modifiez les informations du client.' : 'Remplissez les informations du nouveau client.'}
        actions={
          <Button variant="secondary" onClick={() => navigate('/crm/clients')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
        }
      />

      {/* Duplicate warning */}
      {duplicateMatches.length > 0 && (
        <div className="mb-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Doublon potentiel détecté</p>
            <ul className="mt-1 space-y-1">
              {duplicateMatches.map((m) => (
                <li key={m.id} className="text-sm text-amber-700">
                  <button
                    type="button"
                    onClick={() => navigate(`/crm/clients/${m.id}`)}
                    className="underline hover:no-underline"
                  >
                    {m.first_name} {m.last_name}
                    {m.company_name ? ` (${m.company_name})` : ''}
                    {m.email ? ` — ${m.email}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <form onSubmit={doSubmit} className="space-y-3">
        {/* ============================================================ */}
        {/* Section 1: Identification */}
        {/* ============================================================ */}
        <Collapse title="Identification" icon={Building2} defaultOpen>
          {clientType !== 'particulier' && (
            <div className="mb-4">
              <CompanySearch onSelect={handlePappersSelect} />
              <p className="mt-1 text-xs text-slate-400">
                Recherchez une entreprise pour pré-remplir automatiquement les informations (SIRET, TVA, adresse).
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nom de société"
              {...register('company_name')}
              error={errors.company_name?.message}
            />
            <Select
              label="Type de client"
              options={clientTypeOptions}
              {...register('client_type')}
              error={errors.client_type?.message}
            />
            <Select
              label="Zone géographique"
              options={zoneOptions}
              {...register('geographic_zone')}
              error={errors.geographic_zone?.message}
            />
            <Input
              label="Code BIP"
              {...register('code_bip')}
              error={errors.code_bip?.message}
            />
            <Input
              label="Code interne"
              {...register('code_interne')}
              error={errors.code_interne?.message}
            />
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Section 2: Identité du contact */}
        {/* ============================================================ */}
        <Collapse title="Identité du contact" icon={User} defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Civilité"
              options={civilityOptions}
              {...register('civility')}
              error={errors.civility?.message}
            />
            <Input
              label="Prénom"
              {...register('first_name')}
              error={errors.first_name?.message}
              required
            />
            <Input
              label="Nom"
              {...register('last_name')}
              error={errors.last_name?.message}
              required
            />
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Section 3: Adresse */}
        {/* ============================================================ */}
        <Collapse title="Adresse" icon={MapPin} defaultOpen>
          <div className="space-y-4">
            <Controller
              name="address_line1"
              control={control}
              render={({ field }) => (
                <AddressAutocomplete
                  label="Adresse"
                  value={field.value}
                  onChange={field.onChange}
                  onSelect={handleAddressSelect}
                  error={errors.address_line1?.message}
                />
              )}
            />
            <Input
              label="Complément d'adresse"
              {...register('address_line2')}
              error={errors.address_line2?.message}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Code postal"
                {...register('postal_code')}
                error={errors.postal_code?.message}
                required
              />
              <Input
                label="Ville"
                {...register('city')}
                error={errors.city?.message}
                required
              />
              <Input
                label="Pays"
                {...register('country')}
                error={errors.country?.message}
              />
            </div>

            {/* Mini map */}
            {lat && lng && (
              <div className="h-48 rounded-lg overflow-hidden border border-slate-200">
                <MapContainer
                  center={[lat, lng]}
                  zoom={15}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[lat, lng]} />
                </MapContainer>
              </div>
            )}
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Section 4: Coordonnées */}
        {/* ============================================================ */}
        <Collapse title="Coordonnées" icon={Phone}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    label="Téléphone fixe"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.phone?.message}
                  />
                )}
              />
              <Controller
                name="mobile"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    label="Mobile"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.mobile?.message}
                  />
                )}
              />
            </div>

            {/* Extra phones */}
            <Controller
              name="extra_phones"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  {(field.value ?? []).map((ep, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <Input
                        label={idx === 0 ? 'Label' : undefined}
                        placeholder="Bureau, Conjoint..."
                        value={ep.label}
                        onChange={(e) => {
                          const updated = [...(field.value ?? [])]
                          updated[idx] = { ...updated[idx], label: e.target.value }
                          field.onChange(updated)
                        }}
                      />
                      <PhoneInput
                        label={idx === 0 ? 'Numéro' : undefined}
                        value={ep.number}
                        onChange={(val) => {
                          const updated = [...(field.value ?? [])]
                          updated[idx] = { ...updated[idx], number: val }
                          field.onChange(updated)
                        }}
                        onRemove={() => {
                          field.onChange((field.value ?? []).filter((_, i) => i !== idx))
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.onChange([...(field.value ?? []), { label: '', number: '' }])}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter un téléphone
                  </Button>
                </div>
              )}
            />

            <hr className="border-slate-100" />

            <Input
              label="Email principal"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />

            {/* Extra emails */}
            <Controller
              name="extra_emails"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  {(field.value ?? []).map((ee, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <Input
                        label={idx === 0 ? 'Label' : undefined}
                        placeholder="Pro, Facturation..."
                        value={ee.label}
                        onChange={(e) => {
                          const updated = [...(field.value ?? [])]
                          updated[idx] = { ...updated[idx], label: e.target.value }
                          field.onChange(updated)
                        }}
                      />
                      <div className="sm:col-span-2 flex gap-2">
                        <Input
                          label={idx === 0 ? 'Email' : undefined}
                          type="email"
                          value={ee.email}
                          onChange={(e) => {
                            const updated = [...(field.value ?? [])]
                            updated[idx] = { ...updated[idx], email: e.target.value }
                            field.onChange(updated)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => field.onChange((field.value ?? []).filter((_, i) => i !== idx))}
                          className="shrink-0 px-2.5 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors self-end"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.onChange([...(field.value ?? []), { label: '', email: '' }])}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter un email
                  </Button>
                </div>
              )}
            />

            <hr className="border-slate-100" />

            <div className="flex flex-col sm:flex-row gap-4">
              <Controller
                name="sms_consent"
                control={control}
                render={({ field }) => (
                  <Toggle
                    label="Consentement SMS"
                    description="Le client accepte de recevoir des SMS"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="newsletter_consent"
                control={control}
                render={({ field }) => (
                  <Toggle
                    label="Newsletter"
                    description="Le client accepte de recevoir la newsletter"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Section 5: Infos personnelles */}
        {/* ============================================================ */}
        <Collapse title="Informations personnelles" icon={Heart}>
          <div className="space-y-4">
            <Controller
              name="birthdays"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  {(field.value ?? []).map((bd, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <Input
                        label={idx === 0 ? 'Label' : undefined}
                        placeholder="Anniversaire client, Conjoint..."
                        value={bd.label}
                        onChange={(e) => {
                          const updated = [...(field.value ?? [])]
                          updated[idx] = { ...updated[idx], label: e.target.value }
                          field.onChange(updated)
                        }}
                      />
                      <DateInput
                        label={idx === 0 ? 'Date' : undefined}
                        value={bd.date}
                        onChange={(e) => {
                          const updated = [...(field.value ?? [])]
                          updated[idx] = { ...updated[idx], date: e.target.value }
                          field.onChange(updated)
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => field.onChange((field.value ?? []).filter((_, i) => i !== idx))}
                        className="px-2.5 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors self-end"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.onChange([...(field.value ?? []), { label: '', date: '' }])}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter un anniversaire
                  </Button>
                </div>
              )}
            />

            <textarea
              {...register('notes')}
              rows={4}
              placeholder="Notes libres..."
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-green-500 focus:ring-green-500/20"
            />
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Section 6: Contrat & facturation */}
        {/* ============================================================ */}
        <Collapse title="Contrat & facturation" icon={FileText}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Type de contrat"
                options={contractTypeOptions}
                {...register('contract_type')}
                error={errors.contract_type?.message}
              />
              <DateInput
                label="Date début contrat"
                {...register('contract_start_date')}
                error={errors.contract_start_date?.message}
              />
              <DateInput
                label="Date fin contrat"
                {...register('contract_end_date')}
                error={errors.contract_end_date?.message}
              />
            </div>

            <Controller
              name="eligible_tax_credit"
              control={control}
              render={({ field }) => (
                <Toggle
                  label="Éligible crédit d'impôt"
                  description="Le client bénéficie du crédit d'impôt pour services à la personne"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Taux crédit d'impôt (%)"
                type="number"
                {...register('tax_credit_percentage', { valueAsNumber: true })}
                error={errors.tax_credit_percentage?.message}
              />
              <Input
                label="Délai paiement (jours)"
                type="number"
                {...register('payment_terms_days', { valueAsNumber: true })}
                error={errors.payment_terms_days?.message}
              />
              <Select
                label="Mode de paiement"
                options={paymentMethodOptions}
                {...register('default_payment_method')}
                error={errors.default_payment_method?.message}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="SIRET"
                {...register('siret')}
                error={errors.siret?.message}
              />
              <Input
                label="N° TVA"
                {...register('tva_number')}
                error={errors.tva_number?.message}
              />
            </div>

            {/* Contract hours grid */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Heures contrat par année
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {hoursYears.map((year) => (
                  <Controller
                    key={year}
                    name={`contract_hours.${year}`}
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={String(year)}
                        type="number"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        min={0}
                      />
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Section 7: Tags & attribution */}
        {/* ============================================================ */}
        <Collapse title="Tags & attribution" icon={Tag}>
          <div className="space-y-4">
            <TagInput
              label="Tags"
              availableTags={allTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              onCreateTag={handleCreateTag}
              isLoading={createTagMutation.isPending}
            />
            <Select
              label="Commercial attribué"
              options={commercialOptions}
              {...register('assigned_commercial_id')}
            />
          </div>
        </Collapse>

        {/* ============================================================ */}
        {/* Validation errors banner */}
        {/* ============================================================ */}
        {Object.keys(errors).length > 0 && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Veuillez corriger les erreurs suivantes :</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {Object.entries(errors).map(([field, err]) => (
                  <li key={field} className="text-sm text-red-700">
                    {(err as { message?: string })?.message || `Champ "${field}" invalide`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Action bar */}
        {/* ============================================================ */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 flex items-center gap-3 z-10">
          <Button type="submit" loading={isSaving}>
            <Save className="w-4 h-4 mr-1" />
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={doSubmitAndChantier}
            loading={isSaving}
          >
            <Plus className="w-4 h-4 mr-1" />
            Enregistrer et créer chantier
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>

          {isEdit && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              className="ml-auto"
              loading={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer
            </Button>
          )}
        </div>
      </form>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Supprimer le client"
        message="Cette action désactivera le client. Il ne sera plus visible dans les listes mais ses données seront conservées."
        confirmLabel="Supprimer"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onDelete()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={isDeleting}
      />

      {/* Unsaved changes blocker */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Modifications non sauvegardées"
        message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter cette page ?"
        confirmLabel="Quitter"
        cancelLabel="Rester"
        variant="danger"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}
