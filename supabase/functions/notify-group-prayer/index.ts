// Edge Function: notify-group-prayer
// ---------------------------------------------------------------------------
// La dispara un trigger AFTER INSERT en prayer_requests (vía pg_net) cuando el
// pedido es compartido a un grupo. Avisa por Web Push a los demás miembros del
// grupo (no al autor) que tengan group_prayer_notifications_enabled = true.
//
// Body esperado: { "record": <fila de prayer_requests> } (lo arma el trigger).
// Secrets: comparte los del proyecto (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT) ya seteados para send-reminders. SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY están en el runtime.
//
// Verificación: verify_jwt por defecto; el trigger manda el service role como
// Bearer (igual que el cron de send-reminders). Ver README de esta carpeta.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { requireServiceRole } from '../_shared/require-service-role.ts'

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
  const unauthorized = requireServiceRole(req, SERVICE_ROLE)
  if (unauthorized) return unauthorized

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let body: { record?: Record<string, unknown> } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const submitted = body.record ?? (body as Record<string, unknown>)
  const prayerId = submitted?.id as number | undefined
  if (!prayerId) return json({ skipped: true })

  // El body solo trae la identidad de la fila. El resto se vuelve a leer de la
  // base para no confiar en author/group/visibility aportados por HTTP.
  const { data: rec } = await supabase
    .from('prayer_requests')
    .select('id, user_id, shared_group_id, visibility')
    .eq('id', prayerId)
    .maybeSingle()
  const authorId = rec?.user_id as string | undefined
  const groupId = rec?.shared_group_id as number | undefined

  // Solo pedidos compartidos a un grupo.
  if (rec?.visibility !== 'shared' || !groupId || !authorId) {
    return json({ skipped: true })
  }

  // Autor + grupo para el texto del aviso.
  const [{ data: author }, { data: group }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', authorId).maybeSingle(),
    supabase.from('groups').select('name').eq('id', groupId).maybeSingle(),
  ])
  const authorName = author?.display_name || 'Alguien'
  const groupName = group?.name || 'tu grupo'

  // Miembros del grupo, menos el autor.
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', authorId)
  const memberIds = (members ?? []).map((m) => m.user_id as string)
  if (!memberIds.length) return json({ recipients: 0, sent: 0, removed: 0 })

  // De esos, los que tienen el aviso activado.
  const { data: optedIn } = await supabase
    .from('profiles')
    .select('id')
    .in('id', memberIds)
    .eq('group_prayer_notifications_enabled', true)
  const recipientIds = (optedIn ?? []).map((p) => p.id as string)
  if (!recipientIds.length) return json({ recipients: 0, sent: 0, removed: 0 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', recipientIds)

  const payload = JSON.stringify({
    title: 'Nuevo pedido de oración',
    body: `${authorName} pidió oración en ${groupName}.`,
    url: '/oracion',
    tag: `prayer-${prayerId}`,
  })

  let sent = 0
  let removed = 0
  for (const s of subs ?? []) {
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

  return json({ recipients: recipientIds.length, sent, removed })
})
