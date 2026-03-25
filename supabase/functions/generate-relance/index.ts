// supabase/functions/generate-relance/index.ts
// Deno Edge Function — generates an AI relance email draft via Claude API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const toneInstructions: Record<string, string> = {
  professionnel:
    "Ton professionnel et courtois, formel mais chaleureux.",
  amical:
    "Ton amical et decontracte, tout en restant professionnel.",
  urgent:
    "Ton soulignant l'urgence ou la limite temporelle d'une offre.",
  relance_douce:
    "Ton doux et non-intrusif, simple rappel de votre existence.",
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
      prospect_id,
      tone = "professionnel",
      custom_instructions,
    } = await req.json()

    // 1. Fetch prospect
    const { data: prospect, error: prospectErr } = await supabaseClient
      .from("prospects")
      .select(
        "*, assigned_commercial:profiles!assigned_commercial_id(first_name, last_name)",
      )
      .eq("id", prospect_id)
      .single()

    if (prospectErr || !prospect) {
      return new Response(
        JSON.stringify({ error: "Prospect introuvable" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (!prospect.email) {
      return new Response(
        JSON.stringify({ error: "Le prospect n'a pas d'adresse email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 2. Fetch recent activities
    const { data: activities } = await supabaseClient
      .from("commercial_activities")
      .select("activity_type, subject, description, completed_at")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(5)

    // 3. Fetch previous relances (to avoid repetition)
    const { data: previousRelances } = await supabaseClient
      .from("relance_emails")
      .select("subject, created_at, status")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(3)

    // 4. Fetch relance config
    const { data: configSetting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "relance_config")
      .single()

    const relanceConfig = configSetting?.value ?? {
      sender_name: Deno.env.get("BRAND_NAME") || "CLIENT SERVICES",
      company_description:
        "Entreprise de petits travaux de jardinage",
    }

    // 5. Compute inactivity days
    const reference = prospect.last_activity_at ?? prospect.created_at
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24),
    )

    // 6. Build prompt
    const promptContext = {
      prospect: {
        name: `${prospect.first_name} ${prospect.last_name}`,
        company: prospect.company_name,
        email: prospect.email,
        stage: prospect.pipeline_stage,
        source: prospect.source,
        estimated_value: prospect.estimated_value,
        days_inactive: daysSinceActivity,
      },
      activities: activities ?? [],
      previous_relances: previousRelances ?? [],
      tone,
      custom_instructions: custom_instructions ?? null,
    }

    const systemPrompt = `Tu es un assistant commercial pour ${relanceConfig.company_description}.
Tu rediges des emails de relance pour des prospects dans le domaine des petits travaux de jardinage.

Regles strictes :
- Ecris en francais correct et naturel
- ${toneInstructions[tone] ?? toneInstructions.professionnel}
- L'email doit etre concis : 3-5 paragraphes maximum
- Inclus un objet (subject) accrocheur et court
- Personnalise avec le nom du prospect et son contexte
- Ne mentionne JAMAIS le mot "relance" ni "suivi" directement
- Propose une action concrete : rendez-vous, appel, devis gratuit, visite
- Signe au nom de l'equipe commerciale : ${relanceConfig.sender_name}
- Le HTML doit etre simple : <p>, <strong>, <br>, pas de CSS inline complexe
${custom_instructions ? `\nInstructions supplementaires de l'utilisateur : ${custom_instructions}` : ""}`

    const userPrompt = `Genere un email pour ce prospect :
- Nom : ${prospect.first_name} ${prospect.last_name}${prospect.company_name ? ` (${prospect.company_name})` : ""}
- Etape pipeline : ${prospect.pipeline_stage}
- Source d'acquisition : ${prospect.source ?? "inconnue"}
- Inactif depuis : ${daysSinceActivity} jours
- Valeur estimee : ${prospect.estimated_value ? `${prospect.estimated_value} EUR` : "non definie"}
${
  activities && activities.length > 0
    ? `\nDernieres activites :\n${activities.map((a: { activity_type: string; subject: string; completed_at: string | null }) => `- [${a.activity_type}] ${a.subject} (${a.completed_at ?? "non completee"})`).join("\n")}`
    : "\nAucune activite precedente."
}
${
  previousRelances && previousRelances.length > 0
    ? `\nRelances deja envoyees (evite de repeter) :\n${previousRelances.map((r: { subject: string; created_at: string; status: string }) => `- "${r.subject}" (${r.status}, ${new Date(r.created_at).toLocaleDateString("fr-FR")})`).join("\n")}`
    : ""
}

Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres :
{
  "subject": "Objet de l'email",
  "body_html": "<p>Corps de l'email en HTML simple</p>",
  "body_text": "Corps de l'email en texte brut"
}`

    // 7. Call Claude API
    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    })

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : ""

    // Parse JSON (with fallback extraction)
    let parsed: { subject: string; body_html: string; body_text?: string }
    try {
      parsed = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("Impossible de parser la reponse de l'IA")
      }
    }

    // 8. Save to relance_emails
    const { data: relance, error: insertErr } = await supabaseClient
      .from("relance_emails")
      .insert({
        prospect_id,
        recipient_email: prospect.email,
        subject: parsed.subject,
        body_html: parsed.body_html,
        body_text: parsed.body_text ?? null,
        ai_prompt_context: promptContext,
        ai_model: "claude-sonnet-4-20250514",
        tone,
        status: "generated",
        generated_by: user.id,
      })
      .select()
      .single()

    if (insertErr) {
      throw new Error(`Erreur sauvegarde : ${insertErr.message}`)
    }

    return new Response(JSON.stringify({ relance }), {
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
