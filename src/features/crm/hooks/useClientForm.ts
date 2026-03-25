import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useBlocker } from 'react-router'
import { clientFormSchema, type ClientFormData } from '../schemas/clientFormSchema'
import {
  useClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useCheckDuplicate,
  useClientTagAssignments,
  useSetClientTags,
} from '../../../queries/useClients'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { Client } from '../../../types'

function clientToFormData(client: Client): ClientFormData {
  return {
    company_name: client.company_name ?? '',
    client_type: client.client_type,
    contract_type: client.contract_type,
    geographic_zone: client.geographic_zone ?? null,
    code_bip: client.code_bip ?? '',
    code_interne: client.code_interne ?? '',
    civility: client.civility ?? null,
    first_name: client.first_name,
    last_name: client.last_name,
    address_line1: client.address_line1,
    address_line2: client.address_line2 ?? '',
    postal_code: client.postal_code,
    city: client.city,
    country: client.country,
    latitude: client.latitude,
    longitude: client.longitude,
    phone: client.phone ?? '',
    mobile: client.mobile ?? '',
    extra_phones: client.extra_phones ?? [],
    email: client.email ?? '',
    extra_emails: client.extra_emails ?? [],
    sms_consent: client.sms_consent ?? false,
    newsletter_consent: client.newsletter_consent ?? false,
    birthdays: client.birthdays ?? [],
    notes: client.notes ?? '',
    contract_start_date: client.contract_start_date ?? '',
    contract_end_date: client.contract_end_date ?? '',
    eligible_tax_credit: client.eligible_tax_credit,
    tax_credit_percentage: client.tax_credit_percentage,
    payment_terms_days: client.payment_terms_days,
    siret: client.siret ?? '',
    tva_number: client.tva_number ?? '',
    default_payment_method: client.default_payment_method as ClientFormData['default_payment_method'] ?? null,
    contract_hours: client.contract_hours ?? {},
    assigned_commercial_id: client.assigned_commercial_id ?? null,
  }
}

function formDataToPayload(data: ClientFormData) {
  return {
    company_name: data.company_name || null,
    client_type: data.client_type,
    contract_type: data.contract_type,
    geographic_zone: data.geographic_zone || null,
    code_bip: data.code_bip || null,
    code_interne: data.code_interne || null,
    civility: data.civility || null,
    first_name: data.first_name,
    last_name: data.last_name,
    address_line1: data.address_line1,
    address_line2: data.address_line2 || null,
    postal_code: data.postal_code,
    city: data.city,
    country: data.country || 'France',
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    phone: data.phone || null,
    mobile: data.mobile || null,
    extra_phones: data.extra_phones ?? [],
    email: data.email || null,
    extra_emails: data.extra_emails ?? [],
    sms_consent: data.sms_consent,
    newsletter_consent: data.newsletter_consent,
    birthdays: data.birthdays ?? [],
    notes: data.notes || null,
    contract_start_date: data.contract_start_date || null,
    contract_end_date: data.contract_end_date || null,
    eligible_tax_credit: data.eligible_tax_credit,
    tax_credit_percentage: data.tax_credit_percentage,
    payment_terms_days: data.payment_terms_days,
    siret: data.siret || null,
    tva_number: data.tva_number || null,
    default_payment_method: data.default_payment_method || null,
    contract_hours: data.contract_hours ?? {},
    assigned_commercial_id: data.assigned_commercial_id || null,
    is_active: true,
    created_by: null,
  }
}

export function useClientForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()

  const { data: existingClient, isLoading: isLoadingClient } = useClient(id)
  const { data: existingTagIds } = useClientTagAssignments(id)

  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()
  const setTagsMutation = useSetClientTags()

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema) as never,
    defaultValues: {
      company_name: '',
      client_type: 'particulier',
      contract_type: 'ponctuel',
      geographic_zone: null,
      code_bip: '',
      code_interne: '',
      civility: null,
      first_name: '',
      last_name: '',
      address_line1: '',
      address_line2: '',
      postal_code: '',
      city: '',
      country: 'France',
      latitude: null,
      longitude: null,
      phone: '',
      mobile: '',
      extra_phones: [],
      email: '',
      extra_emails: [],
      sms_consent: false,
      newsletter_consent: false,
      birthdays: [],
      notes: '',
      contract_start_date: '',
      contract_end_date: '',
      eligible_tax_credit: false,
      tax_credit_percentage: 50,
      payment_terms_days: 30,
      siret: '',
      tva_number: '',
      default_payment_method: null,
      contract_hours: {},
      assigned_commercial_id: null,
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (isEdit && existingClient) {
      form.reset(clientToFormData(existingClient))
    }
  }, [isEdit, existingClient, form])

  // Block navigation if form is dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      form.formState.isDirty && currentLocation.pathname !== nextLocation.pathname,
  )

  // Duplicate check
  const firstName = form.watch('first_name') ?? ''
  const lastName = form.watch('last_name') ?? ''
  const email = form.watch('email') ?? ''
  const duplicateCheck = useCheckDuplicate(firstName, lastName, email || undefined)

  // Filter out the current client from duplicate results when editing
  const duplicateMatches = isEdit
    ? (duplicateCheck.data?.matches ?? []).filter((m) => m.id !== id)
    : (duplicateCheck.data?.matches ?? [])

  const onSubmit = useCallback(
    async (data: ClientFormData, tagIds: string[]) => {
      const payload = formDataToPayload(data)
      try {
        if (isEdit && id) {
          await updateMutation.mutateAsync({ id, data: payload })
          if (tagIds.length > 0 || (existingTagIds && existingTagIds.length > 0)) {
            await setTagsMutation.mutateAsync({ clientId: id, tagIds })
          }
          toast.success('Client mis à jour avec succès')
          navigate(`/crm/clients/${id}`)
        } else {
          const created = await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
          if (tagIds.length > 0) {
            await setTagsMutation.mutateAsync({ clientId: created.id, tagIds })
          }
          toast.success('Client créé avec succès')
          navigate(`/crm/clients/${created.id}`)
        }
      } catch (err) {
        toast.error('Erreur lors de la sauvegarde', (err as Error).message)
      }
    },
    [isEdit, id, updateMutation, createMutation, setTagsMutation, existingTagIds, toast, navigate],
  )

  const onSaveAndCreateChantier = useCallback(
    async (data: ClientFormData, tagIds: string[]) => {
      const payload = formDataToPayload(data)
      try {
        if (isEdit && id) {
          await updateMutation.mutateAsync({ id, data: payload })
          if (tagIds.length > 0 || (existingTagIds && existingTagIds.length > 0)) {
            await setTagsMutation.mutateAsync({ clientId: id, tagIds })
          }
          toast.success('Client mis à jour')
          navigate(`/planning?client_id=${id}`)
        } else {
          const created = await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
          if (tagIds.length > 0) {
            await setTagsMutation.mutateAsync({ clientId: created.id, tagIds })
          }
          toast.success('Client créé')
          navigate(`/planning?client_id=${created.id}`)
        }
      } catch (err) {
        toast.error('Erreur lors de la sauvegarde', (err as Error).message)
      }
    },
    [isEdit, id, updateMutation, createMutation, setTagsMutation, existingTagIds, toast, navigate],
  )

  const onDelete = useCallback(async () => {
    if (!id) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Client supprimé')
      navigate('/crm/clients')
    } catch (err) {
      toast.error('Erreur lors de la suppression', (err as Error).message)
    }
  }, [id, deleteMutation, toast, navigate])

  const onCancel = useCallback(() => {
    navigate(isEdit && id ? `/crm/clients/${id}` : '/crm/clients')
  }, [navigate, isEdit, id])

  return {
    form,
    isEdit,
    isLoadingClient,
    existingClient,
    existingTagIds: existingTagIds ?? [],
    blocker,
    duplicateMatches,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    onSubmit,
    onSaveAndCreateChantier,
    onDelete,
    onCancel,
  }
}
