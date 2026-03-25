// supabase/functions/ics-calendar/index.ts
// Deno Edge Function — generates an iCal (.ics) feed from planning_slots
// Authenticated by calendar_token (no Authorization header required)
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
    const url = new URL(req.url)
    const token = url.searchParams.get("token")

    if (!token) {
      return new Response("Missing token", { status: 400 })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find profile by calendar_token
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("calendar_token", token)
      .single()

    if (profileErr || !profile) {
      return new Response("Invalid token", { status: 403 })
    }

    // Fetch planning slots for this user (next 90 days + past 30 days)
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    const to = new Date(now)
    to.setDate(to.getDate() + 90)

    const { data: slots, error: slotsErr } = await supabase
      .from("planning_slots")
      .select(`
        id,
        date,
        start_time,
        end_time,
        chantiers(title, address_line1, postal_code, city),
        clients:chantiers(client:clients(first_name, last_name, company_name))
      `)
      .gte("date", from.toISOString().split("T")[0])
      .lte("date", to.toISOString().split("T")[0])

    if (slotsErr) {
      return new Response(`Error: ${slotsErr.message}`, { status: 500 })
    }

    // Generate iCal
    const calName = `Planning ${profile.first_name} ${profile.last_name}`
    const events = (slots ?? []).map((slot: Record<string, unknown>) => {
      const chantier = slot.chantiers as Record<string, unknown> | null
      const clientData = slot.clients as Record<string, unknown> | null
      const client = clientData?.client as Record<string, unknown> | null

      const title = chantier?.title ?? "Intervention"
      const clientName = client
        ? client.company_name
          ? String(client.company_name)
          : `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
        : ""
      const summary = clientName ? `${title} — ${clientName}` : String(title)

      const location = chantier
        ? [chantier.address_line1, chantier.postal_code, chantier.city]
            .filter(Boolean)
            .join(", ")
        : ""

      const date = String(slot.date).replace(/-/g, "")
      const startTime = String(slot.start_time ?? "08:00").replace(":", "") + "00"
      const endTime = String(slot.end_time ?? "17:00").replace(":", "") + "00"

      return [
        "BEGIN:VEVENT",
        `UID:${slot.id}@${Deno.env.get("BRAND_SLUG") || "crm"}`,
        `DTSTART;TZID=Europe/Paris:${date}T${startTime}`,
        `DTEND;TZID=Europe/Paris:${date}T${endTime}`,
        `SUMMARY:${escapeIcal(summary)}`,
        location ? `LOCATION:${escapeIcal(location)}` : "",
        `DTSTAMP:${formatIcalDate(now)}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n")
    })

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${Deno.env.get("BRAND_NAME") || "CLIENT SERVICES"}//CRM//FR`,
      `X-WR-CALNAME:${calName}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Paris",
      "BEGIN:STANDARD",
      "DTSTART:19701025T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0100",
      "TZNAME:CET",
      "END:STANDARD",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700329T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "TZNAME:CEST",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n")

    return new Response(ical, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="planning.ics"',
        "Cache-Control": "no-cache, max-age=0",
      },
    })
  } catch (err) {
    return new Response(`Server error: ${(err as Error).message}`, {
      status: 500,
      headers: corsHeaders,
    })
  }
})

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

function formatIcalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}
