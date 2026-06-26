// Edge Function: notify-intercession
// ---------------------------------------------------------------------------
// La dispara un trigger AFTER INSERT en prayer_intercessions (vía pg_net) cuando
// alguien se suma a orar por un pedido compartido. Avisa por Web Push al AUTOR
// del pedido (modelo de retorno: "alguien está orando por vos"), si tiene
// group_prayer_notifications_enabled = true.
//
// Para no spamear: el push usa tag `intercession-<prayerId>`, así el dispositivo
// reemplaza el aviso anterior por uno que actualiza el conteo (un solo aviso que
// dice "N personas están orando"), en vez de apilar uno por cada intercesor.
//
// Body esperado: { "record": <fila de prayer_intercessions> } (lo arma el trigger).
// Secrets: comparte los VAPID del proyecto (de send-reminders). SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY están en el runtime. verify_jwt por defecto (el
// trigger manda el service role como Bearer). Ver README de esta carpeta.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@leetubiblia.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let body: { record?: Record<string, unknown> } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const rec = body.record ?? (body as Record<string, unknown>)
  const prayerId = rec?.prayer_id as number | undefined
  const intercessorId = rec?.user_id as string | undefined
  if (!prayerId || !intercessorId) return json({ skipped: true })

  // El pedido: autor, grupo, visibilidad y estado.
  const { data: prayer } = await supabase
    .from('prayer_requests')
    .select('user_id, shared_group_id, visibility, status')
    .eq('id', prayerId)
    .maybeSingle()

  const authorId = prayer?.user_id as string | undefined
  // Solo pedidos compartidos y activos; nunca al propio autor.
  if (
    !authorId ||
    prayer?.visibility !== 'shared' ||
    prayer?.status !== 'active' ||
    authorId === intercessorId
  ) {
    return json({ skipped: true })
  }

  // El autor debe tener los avisos activados.
  const { data: author } = await supabase
    .from('profiles')
    .select('group_prayer_notifications_enabled')
    .eq('id', authorId)
    .maybeSingle()
  if (!author?.group_prayer_notifications_enabled) return json({ recipients: 0, sent: 0, removed: 0 })

  // Conteo actual de intercesores (para el texto que se actualiza por tag).
  const { count } = await supabase
    .from('prayer_intercessions')
    .select('*', { count: 'exact', head: true })
    .eq('prayer_id', prayerId)
  const n = count ?? 1

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', authorId)
  if (!subs?.length) return json({ recipients: 1, sent: 0, removed: 0 })

  const bodyText =
    n <= 1
      ? 'Alguien empezó a orar por tu pedido.'
      : `Ya son ${n} personas orando por tu pedido.`
  const payload = JSON.stringify({
    title: 'Están orando por vos 🙏',
    body: bodyText,
    url: `/oracion/${prayerId}`,
    tag: `intercession-${prayerId}`,
  })

  let sent = 0
  let removed = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        removed++
      }
    }
  }

  return json({ recipients: 1, sent, removed })
})
