// supabase/functions/send-relance/index.ts
// Deno Edge Function — sends a relance email via Brevo API v3
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const { relance_id, subject, body_html } = await req.json()

    // 1. Fetch the relance with prospect info
    const { data: relance, error: fetchErr } = await supabaseClient
      .from("relance_emails")
      .select(
        "*, prospect:prospects!prospect_id(id, first_name, last_name, company_name)",
      )
      .eq("id", relance_id)
      .single()

    if (fetchErr || !relance) {
      return new Response(
        JSON.stringify({ error: "Relance introuvable" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (relance.status === "sent") {
      return new Response(
        JSON.stringify({ error: "Cette relance a deja ete envoyee" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Apply user edits if provided
    const finalSubject = subject ?? relance.subject
    const finalBodyHtml = body_html ?? relance.body_html

    // 2. Mark as sending
    await supabaseClient
      .from("relance_emails")
      .update({ status: "sending" })
      .eq("id", relance_id)

    // 3. Fetch relance config for sender info
    const { data: configSetting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "relance_config")
      .single()

    const config = configSetting?.value ?? {
      sender_name: Deno.env.get("BRAND_NAME") || "CLIENT SERVICES",
      sender_email: Deno.env.get("BRAND_EMAIL") || "commercial@client.fr",
      auto_log_activity: true,
    }

    // 4. Send via Brevo API v3
    const recipientName = relance.prospect
      ? `${relance.prospect.first_name} ${relance.prospect.last_name}`
      : relance.recipient_email

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
          to: [{ email: relance.recipient_email, name: recipientName }],
          subject: finalSubject,
          htmlContent: finalBodyHtml,
        }),
      },
    )

    if (!brevoResponse.ok) {
      const errBody = await brevoResponse.text()
      // Mark as failed
      await supabaseClient
        .from("relance_emails")
        .update({ status: "failed", error_message: errBody })
        .eq("id", relance_id)

      throw new Error(`Erreur Brevo : ${errBody}`)
    }

    const brevoData = await brevoResponse.json()

    // 5. Create a communication record for audit trail
    const { data: communication } = await supabaseClient
      .from("communications")
      .insert({
        prospect_id: relance.prospect_id,
        communication_type: "email",
        direction: "sortant",
        subject: finalSubject,
        body: finalBodyHtml,
        recipient_email: relance.recipient_email,
        is_sent: true,
        sent_at: new Date().toISOString(),
        delivery_status: "sent",
        created_by: user.id,
      })
      .select()
      .single()

    // 6. Log as commercial activity (if enabled)
    if (config.auto_log_activity) {
      await supabaseClient.from("commercial_activities").insert({
        prospect_id: relance.prospect_id,
        activity_type: "email",
        subject: `Relance : ${finalSubject}`,
        description:
          "Email de relance envoye via le CRM",
        is_completed: true,
        completed_at: new Date().toISOString(),
        assigned_to: user.id,
        created_by: user.id,
      })
    }

    // 7. Update relance as sent
    const { data: updatedRelance } = await supabaseClient
      .from("relance_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_by: user.id,
        brevo_message_id: brevoData.messageId ?? null,
        communication_id: communication?.id ?? null,
        subject: finalSubject,
        body_html: finalBodyHtml,
      })
      .eq("id", relance_id)
      .select()
      .single()

    return new Response(
      JSON.stringify({
        relance: updatedRelance,
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
