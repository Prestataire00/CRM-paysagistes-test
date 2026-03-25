// supabase/functions/generate-quote-relance/index.ts
// Deno Edge Function — generates an AI relance email draft for unsigned quotes
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
    "Ton soulignant l'urgence ou la limite temporelle de l'offre.",
  relance_douce:
    "Ton doux et non-intrusif, simple rappel bienveillant.",
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
      quote_id,
      tone = "professionnel",
      custom_instructions,
    } = await req.json()

    // 1. Fetch quote with client and lines
    const { data: quote, error: quoteErr } = await supabaseClient
      .from("quotes")
      .select("*, client:clients!client_id(id, first_name, last_name, company_name, email), lines:quote_lines(*)")
      .eq("id", quote_id)
      .single()

    if (quoteErr || !quote) {
      return new Response(
        JSON.stringify({ error: "Devis introuvable" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const client = quote.client
    if (!client?.email) {
      return new Response(
        JSON.stringify({ error: "Le client n'a pas d'adresse email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 2. Fetch previous relances for this quote (to avoid repetition)
    const { data: previousRelances } = await supabaseClient
      .from("quote_relances")
      .select("subject, created_at, status, relance_number")
      .eq("quote_id", quote_id)
      .order("created_at", { ascending: false })
      .limit(5)

    const relanceNumber = (previousRelances?.length ?? 0) + 1

    // 3. Fetch relance config
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

    // 4. Compute days since quote was sent
    const sentDate = quote.updated_at ?? quote.issue_date
    const daysSinceSent = Math.floor(
      (Date.now() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24),
    )

    // 5. Build prompt context
    const promptContext = {
      quote: {
        reference: quote.reference,
        title: quote.title,
        total_ttc: quote.total_ttc,
        subtotal_ht: quote.subtotal_ht,
        validity_date: quote.validity_date,
        issue_date: quote.issue_date,
        days_since_sent: daysSinceSent,
        eligible_tax_credit: quote.eligible_tax_credit,
        tax_credit_amount: quote.tax_credit_amount,
        net_after_credit: quote.net_after_credit,
        line_count: quote.lines?.length ?? 0,
      },
      client: {
        name: `${client.first_name} ${client.last_name}`,
        company: client.company_name,
        email: client.email,
      },
      previous_relances: previousRelances ?? [],
      relance_number: relanceNumber,
      tone,
      custom_instructions: custom_instructions ?? null,
    }

    const linesDescription = (quote.lines ?? [])
      .map((l: { description: string; total_ht: number }) => `- ${l.description} (${l.total_ht} EUR HT)`)
      .join("\n")

    const systemPrompt = `Tu es un assistant commercial pour ${relanceConfig.company_description}.
Tu rediges des emails de relance pour des devis non signes dans le domaine des petits travaux de jardinage.

Regles strictes :
- Ecris en francais correct et naturel
- ${toneInstructions[tone] ?? toneInstructions.professionnel}
- L'email doit etre concis : 3-5 paragraphes maximum
- Inclus un objet (subject) accrocheur et court
- Personnalise avec le nom du client et les details du devis
- Rappelle la reference du devis et le montant
- Si le devis est eligible au credit d'impot, mentionne-le comme avantage
- ${quote.validity_date ? `Mentionne la date de validite du devis (${new Date(quote.validity_date).toLocaleDateString("fr-FR")})` : ""}
- Propose une action concrete : valider le devis, poser des questions, planifier un rendez-vous
- Signe au nom de l'equipe commerciale : ${relanceConfig.sender_name}
- Le HTML doit etre simple : <p>, <strong>, <br>, pas de CSS inline complexe
- C'est la relance numero ${relanceNumber}${relanceNumber > 1 ? ", adapte le ton en consequence (plus insistant mais toujours respectueux)" : ""}
${custom_instructions ? `\nInstructions supplementaires de l'utilisateur : ${custom_instructions}` : ""}`

    const userPrompt = `Genere un email de relance pour ce devis non signe :
- Client : ${client.first_name} ${client.last_name}${client.company_name ? ` (${client.company_name})` : ""}
- Reference devis : ${quote.reference}
- Titre : ${quote.title}
- Montant TTC : ${quote.total_ttc} EUR
${quote.eligible_tax_credit ? `- Eligible credit d'impot : ${quote.tax_credit_amount} EUR (soit ${quote.net_after_credit} EUR apres credit)` : ""}
- Envoye il y a : ${daysSinceSent} jours
${quote.validity_date ? `- Date de validite : ${new Date(quote.validity_date).toLocaleDateString("fr-FR")}` : ""}
- Nombre de lignes : ${quote.lines?.length ?? 0}
${linesDescription ? `\nPrestations du devis :\n${linesDescription}` : ""}
${
  previousRelances && previousRelances.length > 0
    ? `\nRelances deja envoyees (evite de repeter les memes arguments) :\n${previousRelances.map((r: { subject: string; created_at: string; status: string; relance_number: number }) => `- #${r.relance_number} "${r.subject}" (${r.status}, ${new Date(r.created_at).toLocaleDateString("fr-FR")})`).join("\n")}`
    : ""
}

Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres :
{
  "subject": "Objet de l'email",
  "body_html": "<p>Corps de l'email en HTML simple</p>",
  "body_text": "Corps de l'email en texte brut"
}`

    // 6. Call Claude API
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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("Impossible de parser la reponse de l'IA")
      }
    }

    // 7. Save to quote_relances
    const { data: relance, error: insertErr } = await supabaseClient
      .from("quote_relances")
      .insert({
        quote_id,
        client_id: client.id,
        recipient_email: client.email,
        subject: parsed.subject,
        body_html: parsed.body_html,
        body_text: parsed.body_text ?? null,
        ai_prompt_context: promptContext,
        ai_model: "claude-sonnet-4-20250514",
        tone,
        status: "generated",
        relance_number: relanceNumber,
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
