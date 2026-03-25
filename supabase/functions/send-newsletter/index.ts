// supabase/functions/send-newsletter/index.ts
// Deno Edge Function — sends a newsletter campaign to all recipients via Brevo API v3
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

/** Replace {{prenom}}, {{nom}}, {{entreprise}} in text */
function replaceVariables(
  text: string,
  recipient: { first_name: string; last_name: string; company_name: string | null },
): string {
  return text
    .replace(/\{\{prenom\}\}/gi, recipient.first_name || "")
    .replace(/\{\{nom\}\}/gi, recipient.last_name || "")
    .replace(/\{\{entreprise\}\}/gi, recipient.company_name || "")
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

    const { campaign_id } = await req.json()
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 1. Fetch campaign
    const { data: campaign, error: campaignErr } = await supabaseClient
      .from("newsletter_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single()

    if (campaignErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campagne introuvable" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (campaign.status === "envoyee") {
      return new Response(
        JSON.stringify({ error: "Cette campagne a deja ete envoyee" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 2. Fetch recipients (clients with email, active)
    let recipientQuery = supabaseClient
      .from("clients")
      .select("id, first_name, last_name, company_name, email")
      .eq("is_active", true)
      .not("email", "is", null)

    // Filter by tags if tag_filter is set
    const tagFilter: string[] | null = campaign.tag_filter
    if (tagFilter && tagFilter.length > 0) {
      const { data: assignments } = await supabaseClient
        .from("client_tag_assignments")
        .select("client_id")
        .in("tag_id", tagFilter)

      const clientIds = [
        ...new Set((assignments ?? []).map((a: { client_id: string }) => a.client_id)),
      ]
      if (clientIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "Aucun destinataire ne correspond aux tags selectionnes" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }
      recipientQuery = recipientQuery.in("id", clientIds)
    }

    const { data: recipients, error: recipientErr } = await recipientQuery
    if (recipientErr) throw recipientErr

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun destinataire trouve" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 3. Mark campaign as en_cours
    await supabaseClient
      .from("newsletter_campaigns")
      .update({ status: "en_cours" })
      .eq("id", campaign_id)

    // 4. Fetch sender config
    const { data: configSetting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "relance_config")
      .single()

    const config = configSetting?.value ?? {
      sender_name: Deno.env.get("BRAND_NAME") || "CLIENT SERVICES",
      sender_email: Deno.env.get("BRAND_EMAIL") || "commercial@client.fr",
    }

    // 5. Send emails via Brevo API v3 (one per recipient for variable replacement)
    const brevoApiKey = Deno.env.get("BREVO_API_KEY")!
    let sentCount = 0
    const errors: string[] = []

    for (const recipient of recipients) {
      if (!recipient.email) continue

      const personalizedSubject = replaceVariables(campaign.subject, recipient)
      const personalizedHtml = replaceVariables(campaign.body_html, recipient)
      const recipientName = `${recipient.first_name} ${recipient.last_name}`

      try {
        const brevoResponse = await fetch(
          "https://api.brevo.com/v3/smtp/email",
          {
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
              to: [{ email: recipient.email, name: recipientName }],
              subject: personalizedSubject,
              htmlContent: personalizedHtml,
            }),
          },
        )

        if (brevoResponse.ok) {
          sentCount++
        } else {
          const errText = await brevoResponse.text()
          errors.push(`${recipient.email}: ${errText}`)
        }
      } catch (err) {
        errors.push(`${recipient.email}: ${(err as Error).message}`)
      }
    }

    // 6. Update campaign status
    const finalStatus = sentCount > 0 ? "envoyee" : "annulee"
    const { data: updatedCampaign } = await supabaseClient
      .from("newsletter_campaigns")
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        recipients_count: recipients.length,
        sent_count: sentCount,
      })
      .eq("id", campaign_id)
      .select()
      .single()

    return new Response(
      JSON.stringify({
        campaign: updatedCampaign,
        sent_count: sentCount,
        total_recipients: recipients.length,
        errors: errors.length > 0 ? errors : undefined,
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
