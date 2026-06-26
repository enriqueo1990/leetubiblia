// Edge Function: send-reminders
// ---------------------------------------------------------------------------
// La dispara pg_cron (cada minuto) vía pg_net. Manda el recordatorio diario por
// Web Push a los usuarios cuya hora local ya alcanzó su reminder_time y que no
// recibieron el aviso hoy (dedupe con profiles.reminder_last_sent).
//
// Secrets requeridos (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Presentes por defecto en el runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Verificación: se deja el verify_jwt por defecto; el cron envía el service role
// como Bearer, que es un JWT válido del proyecto (ver README de esta carpeta).
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@leetubiblia.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

// Fecha (YYYY-MM-DD) y minutos desde medianoche en una timezone IANA.
function localNow(tz: string, now: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  let hour = parseInt(parts.hour, 10)
  if (hour === 24) hour = 0 // algunos entornos devuelven 24 a medianoche
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + parseInt(parts.minute, 10),
  }
}

// "HH:MM:SS" | "HH:MM" -> minutos desde medianoche.
function toMinutes(t: string) {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10))
  return h * 60 + m
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const now = new Date()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, reminder_time, timezone, reminder_last_sent')
    .eq('reminder_enabled', true)
    .not('reminder_time', 'is', null)
    .not('timezone', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // A quién le toca: su hora local ya llegó hoy y todavía no se le envió hoy.
  const due = (profiles ?? []).filter((p) => {
    try {
      const { date, minutes } = localNow(p.timezone as string, now)
      return minutes >= toMinutes(p.reminder_time as string) && p.reminder_last_sent !== date
    } catch {
      return false
    }
  })

  const payload = JSON.stringify({
    title: 'Tu lectura de hoy te espera 📖',
    body: 'Tomate un momento para tu pasaje de hoy.',
    url: '/',
    tag: 'daily-reminder',
  })

  let sent = 0
  let removed = 0

  for (const p of due) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', p.id)

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
        sent++
      } catch (e) {
        // 404/410 = subscription muerta: la limpiamos.
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        }
      }
    }

    // Sellar el envío del día en la fecha local del usuario (aunque no tuviera
    // subscripciones) para no reintentar cada minuto.
    const { date } = localNow(p.timezone as string, now)
    await supabase.from('profiles').update({ reminder_last_sent: date }).eq('id', p.id)
  }

  return new Response(JSON.stringify({ due: due.length, sent, removed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
