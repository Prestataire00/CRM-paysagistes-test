// supabase/functions/generate-ai-content/index.ts
// Deno Edge Function — generic AI text generation via Claude API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// ---------------------------------------------------------------------------
// Context-specific system prompts
// ---------------------------------------------------------------------------

const contextPrompts: Record<string, string> = {
  newsletter_subject:
    "Tu generes des objets d'email accrocheurs pour des newsletters d'une ${Deno.env.get("BRAND_ACTIVITY") || "entreprise de services"} (${Deno.env.get("BRAND_NAME") || "CLIENT SERVICES"}). L'objet doit faire entre 30 et 60 caracteres, etre percutant et donner envie d'ouvrir l'email. Reponds avec l'objet uniquement, sans guillemets.",
  newsletter_intro:
    "Tu rediges des introductions de newsletter pour ${Deno.env.get("BRAND_NAME") || "CLIENT SERVICES"}, ${Deno.env.get("BRAND_ACTIVITY") || "entreprise de services"}. Le texte doit etre accueillant, concis (2-3 phrases max) et donner le contexte de la newsletter.",
  newsletter_body:
    "Tu rediges le contenu principal de newsletters pour ${Deno.env.get("BRAND_NAME") || "CLIENT SERVICES"}. Le texte doit etre informatif, engageant et adapte au format email. Utilise des paragraphes courts.",
  newsletter_cta:
    "Tu generes des textes courts pour des boutons d'appel a l'action dans des newsletters (ex: 'Decouvrir nos offres', 'Prendre rendez-vous'). Maximum 5 mots. Reponds avec le texte du bouton uniquement.",
  newsletter_section:
    "Tu rediges des sections d'articles pour des newsletters d'actualites d'une ${Deno.env.get("BRAND_ACTIVITY") || "entreprise de services"}. Chaque section doit etre informative et concise (1-2 paragraphes).",
  quote_description:
    "Tu rediges des descriptions professionnelles de prestations de petits travaux de jardinage pour des devis. Sois precis, technique et professionnel. Decris clairement la prestation, les materiaux ou techniques utilises, sans superflu. Une a trois phrases maximum.",
  quote_conditions:
    "Tu rediges des conditions particulieres pour des devis de petits travaux de jardinage. Inclus les mentions pertinentes : delais d'execution, conditions d'acces au chantier, gestion des dechets verts. Si les travaux sont eligibles au credit d'impot (article 199 sexdecies du CGI), mentionne-le.",
  freeform:
    "Tu es un assistant d'ecriture professionnel pour ${Deno.env.get("BRAND_NAME") || "CLIENT SERVICES"}, ${Deno.env.get("BRAND_ACTIVITY") || "entreprise de services"} et entretien de jardins. Adapte ton style au contexte demande.",
}

const actionInstructions: Record<string, string> = {
  generate:
    "Genere un nouveau texte a partir de zero en suivant les instructions de l'utilisateur.",
  improve:
    "Ameliore le texte existant : meilleure formulation, orthographe, clarte et impact. Garde la meme longueur approximative.",
  shorten:
    "Raccourcis le texte existant en gardant les informations essentielles. Reduis d'au moins 30%.",
  lengthen:
    "Developpe et enrichis le texte existant avec plus de details et d'arguments. Augmente d'au moins 30%.",
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    )

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

    // Parse request
    const {
      context = "freeform",
      prompt,
      current_text,
      action = "generate",
    } = await req.json()

    if (!prompt && !current_text) {
      return new Response(
        JSON.stringify({ error: "Un prompt ou un texte existant est requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Build prompts
    const systemPrompt = `${contextPrompts[context] ?? contextPrompts.freeform}

${actionInstructions[action] ?? actionInstructions.generate}

Regles :
- Ecris en francais correct et naturel
- Reponds UNIQUEMENT avec le texte genere, sans guillemets, sans explications, sans prefixe
- Pas de markdown sauf si demande explicitement`

    const userContent = current_text
      ? `Texte actuel :\n"${current_text}"\n\nInstruction : ${prompt || "Ameliore ce texte."}`
      : prompt

    // Call Claude
    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    })

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    })

    const generatedText =
      message.content[0].type === "text" ? message.content[0].text.trim() : ""

    return new Response(
      JSON.stringify({ generated_text: generatedText }),
      {
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
