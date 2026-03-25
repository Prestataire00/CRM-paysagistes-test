// supabase/functions/create-user/index.ts
// Deno Edge Function — creates a new user (super_admin / admin only)
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
    // --- Auth: verify caller is authenticated ---
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
      data: { user: caller },
      error: authError,
    } = await supabaseClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // --- Check caller is super_admin or admin ---
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single()

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: "Profil introuvable" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!["super_admin", "admin"].includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ error: "Seuls les administrateurs peuvent créer des utilisateurs" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // --- Parse body ---
    const { email, password, first_name, last_name, phone, role } =
      await req.json()

    if (!email || !password || !first_name || !last_name || !role) {
      return new Response(
        JSON.stringify({ error: "Champs requis : email, password, first_name, last_name, role" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // --- Create user with service role (admin privileges) ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          phone: phone || null,
          role,
        },
      })

    if (createError) {
      const message =
        createError.message === "A user with this email address has already been registered"
          ? "Un utilisateur avec cet email existe déjà"
          : createError.message
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({ user: newUser.user }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erreur interne" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
