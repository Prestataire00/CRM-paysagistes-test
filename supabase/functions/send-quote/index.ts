// supabase/functions/send-quote/index.ts
// Deno Edge Function — sends a quote email to the client via Brevo API v3
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr))
}

interface QuoteLine {
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  total_ht: number
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    )

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { quote_id } = await req.json()

    if (!quote_id) {
      return new Response(
        JSON.stringify({ error: "quote_id est requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 1. Fetch quote with client and lines
    const { data: quote, error: fetchErr } = await supabaseClient
      .from("quotes")
      .select(
        `*,
        client:clients!client_id(id, first_name, last_name, company_name, email),
        lines:quote_lines(description, quantity, unit, unit_price_ht, total_ht, sort_order)`,
      )
      .eq("id", quote_id)
      .single()

    if (fetchErr || !quote) {
      return new Response(
        JSON.stringify({ error: "Devis introuvable" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 2. Validate client has email
    if (!quote.client?.email) {
      return new Response(
        JSON.stringify({
          error:
            "Le client n'a pas d'adresse email. Veuillez ajouter un email au client avant d'envoyer le devis.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 3. Fetch sender config
    const { data: configSetting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "relance_config")
      .single()

    const config = configSetting?.value ?? {
      sender_name: Deno.env.get("BRAND_NAME") || "CLIENT SERVICES",
      sender_email: Deno.env.get("BRAND_EMAIL") || "commercial@client.fr",
    }

    // 4. Generate signing token BEFORE building email (used in CTA link)
    const signingToken = crypto.randomUUID()
    const signingExpiresAt = new Date()
    signingExpiresAt.setDate(signingExpiresAt.getDate() + 30)

    // 5. Sort lines and build email
    const lines: QuoteLine[] = (quote.lines ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order,
    )

    const clientName = quote.client.company_name
      ? quote.client.company_name
      : `${quote.client.first_name} ${quote.client.last_name}`

    const linesHtml = lines
      .map(
        (l: QuoteLine) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px">${l.description}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center">${l.quantity} ${l.unit}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right">${formatAmount(l.unit_price_ht)} €</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;font-weight:600">${formatAmount(l.total_ht)} €</td>
          </tr>`,
      )
      .join("")

    const taxCreditHtml = quote.eligible_tax_credit
      ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin-top:16px">
          <p style="margin:0;font-size:13px;color:#065f46;font-weight:600">Crédit d'impôt (50%)</p>
          <p style="margin:4px 0 0;font-size:14px;color:#047857;font-weight:700">-${formatAmount(quote.tax_credit_amount)} €</p>
          <p style="margin:4px 0 0;font-size:12px;color:#059669">Coût réel après crédit : ${formatAmount(quote.net_after_credit)} €</p>
        </div>`
      : ""

    const subject = `Devis ${quote.reference} — ${quote.title}`

    const bodyHtml = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:#16a34a;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px;color:white;font-weight:700">${Deno.env.get("BRAND_NAME") || "CLIENT SERVICES"}</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85)">Petits travaux de jardinage</p>
        </div>

        <div style="background:white;padding:32px;border:1px solid #e2e8f0;border-top:none">
          <p style="font-size:15px;margin:0 0 16px">Bonjour ${clientName},</p>
          <p style="font-size:15px;margin:0 0 24px">Veuillez trouver ci-dessous votre devis <strong>${quote.reference}</strong>.</p>

          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px">
            <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a">${quote.title}</h2>
            <p style="margin:0;font-size:13px;color:#64748b">
              Date : ${formatDate(quote.issue_date)}
              ${quote.validity_date ? ` — Valable jusqu'au : ${formatDate(quote.validity_date)}` : ""}
            </p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#475569;text-transform:uppercase">Description</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;font-weight:600;color:#475569;text-transform:uppercase">Qté</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#475569;text-transform:uppercase">PU HT</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#475569;text-transform:uppercase">Total HT</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>

          <div style="border-top:2px solid #e2e8f0;padding-top:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:14px;color:#64748b">Sous-total HT</span>
              <span style="font-size:14px;font-weight:500">${formatAmount(quote.subtotal_ht)} €</span>
            </div>
            ${quote.discount_percentage > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:14px;color:#64748b">Remise (${quote.discount_percentage}%)</span>
              <span style="font-size:14px;font-weight:500;color:#dc2626">-${formatAmount(quote.discount_amount)} €</span>
            </div>` : ""}
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:14px;color:#64748b">TVA (${quote.tva_rate}%)</span>
              <span style="font-size:14px;font-weight:500">${formatAmount(quote.tva_amount)} €</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:2px solid #0f172a">
              <span style="font-size:18px;font-weight:700;color:#0f172a">Total TTC</span>
              <span style="font-size:18px;font-weight:700;color:#0f172a">${formatAmount(quote.total_ttc)} €</span>
            </div>
          </div>

          ${taxCreditHtml}

          <div style="margin-top:32px;text-align:center">
            <a href="${Deno.env.get("FRONTEND_URL") || Deno.env.get("FRONTEND_URL") || "https://crm.client.fr"}/sign/${signingToken}"
               style="background-color:#16a34a;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;font-size:16px">
              Signer le devis
            </a>
            <p style="font-size:13px;color:#94a3b8;margin:12px 0 0">
              Ce lien est valable 30 jours.
            </p>
          </div>
        </div>

        <div style="background:#f8fafc;padding:16px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center">
          <p style="margin:0;font-size:12px;color:#94a3b8">
            ${config.sender_name} — Ce devis a été généré automatiquement par notre CRM.
          </p>
        </div>
      </div>
    `

    // 6. Send via Brevo API v3
    const recipientName = clientName

    const brevoResponse = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": Deno.env.get("BREVO_API_KEY")!,
        },
        body: JSON.stringify({
          sender: {
            name: config.sender_name,
            email: config.sender_email,
          },
          to: [{ email: quote.client.email, name: recipientName }],
          subject,
          htmlContent: bodyHtml,
        }),
      },
    )

    if (!brevoResponse.ok) {
      const errBody = await brevoResponse.text()
      throw new Error(`Erreur Brevo : ${errBody}`)
    }

    // 7. Update quote status + save signing token
    await supabaseClient
      .from("quotes")
      .update({
        status: "envoye",
        signing_token: signingToken,
        signing_expires_at: signingExpiresAt.toISOString(),
      })
      .eq("id", quote_id)

    // 7. Create communication audit trail
    const { data: communication } = await supabaseClient
      .from("communications")
      .insert({
        client_id: quote.client_id,
        communication_type: "email",
        direction: "sortant",
        subject,
        body: bodyHtml,
        recipient_email: quote.client.email,
        is_sent: true,
        sent_at: new Date().toISOString(),
        delivery_status: "sent",
        created_by: user.id,
      })
      .select()
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        communication_id: communication?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
