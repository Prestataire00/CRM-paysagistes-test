// supabase/functions/sign-quote/index.ts
// Deno Edge Function — public endpoint for clients to view and sign quotes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // Use service_role to bypass RLS — this is a public endpoint secured by token
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  try {
    // -----------------------------------------------------------------------
    // GET — Fetch quote data for the signing page
    // -----------------------------------------------------------------------
    if (req.method === "GET") {
      const url = new URL(req.url)
      const token = url.searchParams.get("token")

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token manquant" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Fetch quote by signing_token
      const { data: quote, error: fetchErr } = await supabaseAdmin
        .from("quotes")
        .select(
          `*,
          client:clients!client_id(id, first_name, last_name, company_name, email, address_line1, postal_code, city),
          lines:quote_lines(description, quantity, unit, unit_price_ht, tva_rate, total_ht, total_ttc, is_labor, sort_order)`,
        )
        .eq("signing_token", token)
        .single()

      if (fetchErr || !quote) {
        return new Response(
          JSON.stringify({ error: "Lien de signature invalide ou expiré." }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Check if already signed
      if (quote.signed_at) {
        return new Response(
          JSON.stringify({
            error: "already_signed",
            message: "Ce devis a déjà été signé.",
            signed_at: quote.signed_at,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Check expiration
      if (
        quote.signing_expires_at &&
        new Date(quote.signing_expires_at) < new Date()
      ) {
        return new Response(
          JSON.stringify({
            error: "expired",
            message:
              "Le lien de signature a expiré. Veuillez contacter votre commercial.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Sort lines
      const lines = (quote.lines ?? []).sort(
        (a: { sort_order: number }, b: { sort_order: number }) =>
          a.sort_order - b.sort_order,
      )

      // Return quote data (without sensitive fields)
      return new Response(
        JSON.stringify({
          reference: quote.reference,
          title: quote.title,
          description: quote.description,
          issue_date: quote.issue_date,
          validity_date: quote.validity_date,
          subtotal_ht: quote.subtotal_ht,
          tva_rate: quote.tva_rate,
          tva_amount: quote.tva_amount,
          total_ttc: quote.total_ttc,
          discount_percentage: quote.discount_percentage,
          discount_amount: quote.discount_amount,
          eligible_tax_credit: quote.eligible_tax_credit,
          tax_credit_amount: quote.tax_credit_amount,
          net_after_credit: quote.net_after_credit,
          payment_terms: quote.payment_terms,
          special_conditions: quote.special_conditions,
          client: quote.client
            ? {
                company_name: quote.client.company_name,
                first_name: quote.client.first_name,
                last_name: quote.client.last_name,
                address_line1: quote.client.address_line1,
                postal_code: quote.client.postal_code,
                city: quote.client.city,
              }
            : null,
          lines,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // -----------------------------------------------------------------------
    // POST — Sign the quote
    // -----------------------------------------------------------------------
    if (req.method === "POST") {
      const { token, signature_base64 } = await req.json()

      if (!token || !signature_base64) {
        return new Response(
          JSON.stringify({ error: "Token et signature requis" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Fetch quote
      const { data: quote, error: fetchErr } = await supabaseAdmin
        .from("quotes")
        .select(
          `*,
          client:clients!client_id(id, first_name, last_name, company_name, email),
          commercial:profiles!assigned_commercial_id(id, email, full_name)`,
        )
        .eq("signing_token", token)
        .single()

      if (fetchErr || !quote) {
        return new Response(
          JSON.stringify({ error: "Lien de signature invalide." }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Already signed?
      if (quote.signed_at) {
        return new Response(
          JSON.stringify({ error: "Ce devis a déjà été signé." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Expired?
      if (
        quote.signing_expires_at &&
        new Date(quote.signing_expires_at) < new Date()
      ) {
        return new Response(
          JSON.stringify({ error: "Le lien de signature a expiré." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Decode base64 signature to binary
      const base64Data = signature_base64.replace(
        /^data:image\/\w+;base64,/,
        "",
      )
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Upload signature to Storage
      const fileName = `signatures/quote_${quote.id}_${Date.now()}.png`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from("documents")
        .upload(fileName, bytes, {
          contentType: "image/png",
          upsert: false,
        })

      if (uploadErr) {
        throw new Error(`Erreur upload signature : ${uploadErr.message}`)
      }

      // Get signed URL (valid 10 years)
      const { data: signedUrlData } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10)

      const signatureUrl = signedUrlData?.signedUrl ?? fileName

      // Get signer IP
      const signerIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown"

      // Update quote: mark as accepted + store signature
      const { error: updateErr } = await supabaseAdmin
        .from("quotes")
        .update({
          status: "accepte",
          accepted_date: new Date().toISOString().split("T")[0],
          signed_at: new Date().toISOString(),
          signature_url: signatureUrl,
          signer_ip: signerIp,
        })
        .eq("id", quote.id)

      if (updateErr) {
        throw new Error(`Erreur mise à jour devis : ${updateErr.message}`)
      }

      // Send notification email to the commercial
      const commercialEmail =
        quote.commercial?.email || quote.client?.email
      const clientName = quote.client?.company_name ||
        `${quote.client?.first_name ?? ""} ${quote.client?.last_name ?? ""}`.trim()

      if (commercialEmail && quote.commercial?.email) {
        // Fetch sender config
        const { data: configSetting } = await supabaseAdmin
          .from("settings")
          .select("value")
          .eq("key", "relance_config")
          .single()

        const config = configSetting?.value ?? {
          sender_name: Deno.env.get("BRAND_NAME") || "CLIENT SERVICES",
          sender_email: Deno.env.get("BRAND_EMAIL") || "commercial@client.fr",
        }

        const notificationHtml = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
            <div style="background:#16a34a;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="margin:0;font-size:20px;color:white;font-weight:700">Devis signé !</h1>
            </div>
            <div style="background:white;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
              <p style="font-size:15px;margin:0 0 16px">Bonjour,</p>
              <p style="font-size:15px;margin:0 0 16px">
                Le client <strong>${clientName}</strong> a signé le devis <strong>${quote.reference}</strong> (${quote.title}).
              </p>
              <p style="font-size:14px;color:#64748b;margin:0 0 8px">
                Montant TTC : <strong>${formatAmount(quote.total_ttc)} €</strong>
              </p>
              <p style="font-size:14px;color:#64748b;margin:0 0 8px">
                Signé le : ${formatDate(new Date().toISOString())}
              </p>
              <p style="font-size:14px;color:#64748b;margin:0">
                IP du signataire : ${signerIp}
              </p>
            </div>
          </div>
        `

        const brevoApiKey = Deno.env.get("BREVO_API_KEY")
        if (brevoApiKey) {
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "api-key": brevoApiKey,
            },
            body: JSON.stringify({
              sender: {
                name: config.sender_name,
                email: config.sender_email,
              },
              to: [
                {
                  email: quote.commercial.email,
                  name: quote.commercial.full_name || "Commercial",
                },
              ],
              subject: `Devis ${quote.reference} signé par ${clientName}`,
              htmlContent: notificationHtml,
            }),
          })
        }
      }

      // Create audit trail
      if (quote.client_id) {
        await supabaseAdmin.from("communications").insert({
          client_id: quote.client_id,
          communication_type: "email",
          direction: "entrant",
          subject: `Signature électronique — Devis ${quote.reference}`,
          body: `Le client a signé électroniquement le devis ${quote.reference}. IP: ${signerIp}`,
          is_sent: true,
          sent_at: new Date().toISOString(),
          delivery_status: "sent",
        })
      }

      return new Response(
        JSON.stringify({ success: true, signed_at: new Date().toISOString() }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    return new Response(JSON.stringify({ error: "Méthode non supportée" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
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
