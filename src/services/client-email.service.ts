import { brand } from '../config/brand'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SendEmailRequest {
  recipient_email: string
  recipient_name: string
  subject: string
  html_content: string
  client_id?: string | null
  prospect_id?: string | null
  email_type: 'rdv_confirmation' | 'rdv_reminder' | 'invoice' | 'generic'
}

// ---------------------------------------------------------------------------
// Edge Function call
// ---------------------------------------------------------------------------
async function invokeEdgeFunction<T>(functionName: string, body: unknown): Promise<T> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    },
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`)
  return data as T
}

// ---------------------------------------------------------------------------
// Send email
// ---------------------------------------------------------------------------
export async function sendClientEmail(request: SendEmailRequest): Promise<{ success: boolean; message_id?: string }> {
  return invokeEdgeFunction('send-client-email', request)
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

export function buildRdvConfirmationEmail(params: {
  clientName: string
  rdvDate: string
  rdvTime: string
  rdvType: string
  rdvSubject: string
  companyName?: string
}): { subject: string; html: string } {
  const { clientName, rdvDate, rdvTime, rdvType, rdvSubject, companyName = brand.name } = params

  return {
    subject: `Confirmation de votre rendez-vous — ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #7AB928; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">Bonjour ${clientName},</p>
          <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">Nous vous confirmons votre rendez-vous :</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
            <p style="margin: 0 0 8px; color: #166534; font-weight: 600; font-size: 16px;">📅 ${rdvDate} à ${rdvTime}</p>
            <p style="margin: 0 0 4px; color: #166534; font-size: 14px;">📋 ${rdvSubject}</p>
            <p style="margin: 0; color: #15803d; font-size: 13px;">Type : ${rdvType}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px;">N'hésitez pas à nous contacter si vous souhaitez modifier ou annuler ce rendez-vous.</p>
          <p style="color: #334155; font-size: 14px; margin: 20px 0 0;">Cordialement,<br/><strong>${companyName}</strong></p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          Cet email a été envoyé automatiquement par ${companyName}.
        </p>
      </div>
    `,
  }
}

export function buildRdvReminderEmail(params: {
  clientName: string
  rdvDate: string
  rdvTime: string
  rdvSubject: string
  companyName?: string
}): { subject: string; html: string } {
  const { clientName, rdvDate, rdvTime, rdvSubject, companyName = brand.name } = params

  return {
    subject: `Rappel : votre rendez-vous demain — ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #7AB928; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">Bonjour ${clientName},</p>
          <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">Nous vous rappelons votre rendez-vous prévu <strong>demain</strong> :</p>
          <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
            <p style="margin: 0 0 8px; color: #854d0e; font-weight: 600; font-size: 16px;">⏰ ${rdvDate} à ${rdvTime}</p>
            <p style="margin: 0; color: #854d0e; font-size: 14px;">📋 ${rdvSubject}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px;">Si vous ne pouvez pas être présent, merci de nous prévenir dès que possible.</p>
          <p style="color: #334155; font-size: 14px; margin: 20px 0 0;">À demain,<br/><strong>${companyName}</strong></p>
        </div>
      </div>
    `,
  }
}

export function buildInvoiceEmail(params: {
  clientName: string
  invoiceRef: string
  invoiceAmount: string
  dueDate: string
  companyName?: string
}): { subject: string; html: string } {
  const { clientName, invoiceRef, invoiceAmount, dueDate, companyName = brand.name } = params

  return {
    subject: `Facture ${invoiceRef} — ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #7AB928; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">Bonjour ${clientName},</p>
          <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">Veuillez trouver ci-dessous les détails de votre facture :</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
            <p style="margin: 0 0 8px; color: #1e293b; font-weight: 600; font-size: 16px;">Facture ${invoiceRef}</p>
            <p style="margin: 0 0 4px; color: #334155; font-size: 14px;">💰 Montant TTC : <strong>${invoiceAmount}</strong></p>
            <p style="margin: 0; color: #334155; font-size: 14px;">📅 Échéance : ${dueDate}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px;">Merci de procéder au règlement avant la date d'échéance indiquée.</p>
          <p style="color: #334155; font-size: 14px; margin: 20px 0 0;">Cordialement,<br/><strong>${companyName}</strong></p>
        </div>
      </div>
    `,
  }
}
