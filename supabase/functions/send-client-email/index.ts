// supabase/functions/send-client-email/index.ts
// Generic Edge Function — sends an email to a client or prospect via Brevo
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

    const {
      recipient_email,
      recipient_name,
      subject,
      html_content,
      client_id,
      prospect_id,
      email_type,
    } = await req.json()

    if (!recipient_email || !subject || !html_content) {
      return new Response(
        JSON.stringify({ error: "recipient_email, subject et html_content requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Fetch sender config
    const { data: configSetting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "relance_config")
      .single()

    const config = configSetting?.value ?? {
      sender_name: Deno.env.get("BRAND_NAME") || "CLIENT SERVICES",
      sender_email: Deno.env.get("BRAND_EMAIL") || "commercial@client.fr",
    }

    // Send via Brevo API v3
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
          to: [{ email: recipient_email, name: recipient_name || recipient_email }],
          subject,
          htmlContent: html_content,
        }),
      },
    )

    if (!brevoResponse.ok) {
      const errBody = await brevoResponse.text()
      throw new Error(`Erreur Brevo : ${errBody}`)
    }

    const brevoData = await brevoResponse.json()

    // Log communication for audit trail
    await supabaseClient.from("communications").insert({
      client_id: client_id || null,
      prospect_id: prospect_id || null,
      communication_type: "email",
      direction: "sortant",
      subject,
      body: html_content,
      recipient_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: user.id,
      brevo_message_id: brevoData?.messageId || null,
      metadata: { email_type: email_type || "generic" },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message_id: brevoData?.messageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
