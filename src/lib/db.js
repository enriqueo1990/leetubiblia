import { supabase } from './supabase.js'

// Helpers de datos de solo lectura del catálogo. Las mutaciones de perfil viven
// en el contexto de auth (updateProfile). Las de progreso/oración/grupos llegan
// en sus tareas respectivas (4, 5, 6).

// Orden curado del catálogo (la terna de lanzamiento primero; lo demás después).
// Da un orden estable y con intención, en vez de ordenar solo por duración —que
// dejaba el plan de 861 días primero y los cuatro de 365 en orden indefinido.
const PLAN_ORDER = [
  'mcheyne',
  'cronologico',
  'proverbios',
  'beginning',
  'at-nt',
  'nt-24-week',
  '40-dias-con-dios',
  'bcp-daily-office',
]

// Lista los planes activos del catálogo, en orden curado y determinista.
export async function getPlans() {
  const { data, error } = await supabase
    .from('reading_plans')
    .select('id, slug, name, description, duration_days')
    .eq('is_active', true)
  if (error) throw error
  const rank = (slug) => {
    const i = PLAN_ORDER.indexOf(slug)
    return i === -1 ? PLAN_ORDER.length : i
  }
  return [...data].sort((a, b) => {
    if (rank(a.slug) !== rank(b.slug)) return rank(a.slug) - rank(b.slug)
    if (a.duration_days !== b.duration_days) return b.duration_days - a.duration_days
    return a.slug.localeCompare(b.slug) // desempate final estable
  })
}

// Fecha local (YYYY-MM-DD) — el plan_start_date corta a la medianoche LOCAL,
// no UTC (regla canónica de day_number, documento maestro §5.1).
export function todayLocalISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

// Diferencia en días entre dos fechas YYYY-MM-DD, usando componentes UTC para
// no verse afectada por horario de verano. Devuelve b − a en días.
export function dateDiffDays(aISO, bISO) {
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

// Suma n días a una fecha YYYY-MM-DD local y devuelve YYYY-MM-DD.
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + n * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

// Fecha LOCAL (YYYY-MM-DD) de un timestamp ISO. El completed_at se guarda en UTC;
// para la racha por días reales hay que llevarlo a la fecha local del usuario.
export function localDateISO(ts) {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// REGLA CANÓNICA (documento maestro §5.1) — única forma de calcular el día:
//   día_de_hoy = (hoy − plan_start_date) + 1, en zona horaria LOCAL.
// Lo que "Hoy" muestra lo dicta SIEMPRE el calendario, sin importar lo leído.
export function dayNumberFor(planStartISO, todayISO = todayLocalISO()) {
  return dateDiffDays(planStartISO, todayISO) + 1
}

// Inversa de dayNumberFor: si hoy debe ser el día N, el plan empezó hace N−1
// días. Sirve para "engancharse" a un plan que el usuario ya venía leyendo.
export function startDateForDay(dayNumber, todayISO = todayLocalISO()) {
  return addDaysISO(todayISO, -(dayNumber - 1))
}

// Trae el plan activo (metadata) del perfil.
export async function getPlan(planId) {
  const { data, error } = await supabase
    .from('reading_plans')
    .select('id, slug, name, description, duration_days')
    .eq('id', planId)
    .single()
  if (error) throw error
  return data
}

// Refs estructuradas de un día puntual del plan.
export async function getPlanDay(planId, dayNumber) {
  const { data, error } = await supabase
    .from('plan_days')
    .select('day_number, refs')
    .eq('plan_id', planId)
    .eq('day_number', dayNumber)
    .maybeSingle()
  if (error) throw error
  return data // null si el day_number queda fuera del rango del plan
}

// Progreso del usuario en un plan: Map day_number → fecha local (YYYY-MM-DD) en
// que se marcó. Las claves sirven de "días leídos" (.has / .size, igual que un
// Set); los valores alimentan la racha por días reales (ver computeDateStreak).
export async function getCompletionMap(userId, planId) {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('day_number, completed_at')
    .eq('user_id', userId)
    .eq('plan_id', planId)
  if (error) throw error
  return new Map(data.map((r) => [r.day_number, localDateISO(r.completed_at)]))
}

// Marca un día como leído. Idempotente (UNIQUE user+plan+day; ignora duplicados).
export async function markRead(userId, planId, dayNumber) {
  const { error } = await supabase
    .from('reading_progress')
    .upsert(
      { user_id: userId, plan_id: planId, day_number: dayNumber },
      { onConflict: 'user_id,plan_id,day_number', ignoreDuplicates: true }
    )
  if (error) throw error
}

// Marca de una sola vez los días 1..hasta (inclusive) como leídos. Sirve para
// engancharse a un plan ya empezado: al entrar en el día N, los días previos
// (1..N−1) se dan por leídos. Idempotente (mismo UNIQUE que markRead).
export async function markDaysRead(userId, planId, hasta) {
  if (hasta < 1) return
  const rows = []
  for (let d = 1; d <= hasta; d++) {
    rows.push({ user_id: userId, plan_id: planId, day_number: d })
  }
  const { error } = await supabase
    .from('reading_progress')
    .upsert(rows, { onConflict: 'user_id,plan_id,day_number', ignoreDuplicates: true })
  if (error) throw error
}

// Desmarca un día (para el heatmap interactivo de Progreso).
export async function unmarkRead(userId, planId, dayNumber) {
  const { error } = await supabase
    .from('reading_progress')
    .delete()
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('day_number', dayNumber)
  if (error) throw error
}

// Desmarca de una sola vez los días `desde` (inclusive) en adelante. Es la mitad
// que faltaba para "volver atrás" al fijar el día en Ajustes: si ahora vas en el
// día N, los días N..fin dejan de estar leídos, así Hoy vuelve a ese día y no se
// queda en el próximo día ya marcado. Sin red lanza (el llamador lo absorbe).
export async function unmarkDaysFrom(userId, planId, desde) {
  if (desde < 1) desde = 1
  const { error } = await supabase
    .from('reading_progress')
    .delete()
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .gte('day_number', desde)
  if (error) throw error
}

// Primer día NO leído dentro de [1..hastaDía]. Si todo está leído, devuelve
// hastaDía + ... en realidad devuelve el primer hueco; si no hay, devuelve
// hastaDía (hoy aún sin leer no cuenta como atraso).
export function firstUnreadDay(completedSet, todayDay) {
  for (let d = 1; d <= todayDay; d++) {
    if (!completedSet.has(d)) return d
  }
  return todayDay + 1 // todo leído hasta hoy inclusive
}

// Racha por días REALES (documento maestro §5.2): cantidad de fechas de calendario
// consecutivas con al menos una lectura marcada, terminando hoy o ayer (si hoy aún
// no leíste, la racha sigue viva). Se basa en completed_at, no en day_number, así
// leer varios días de una sentada —o el backfill al engancharse a mitad de plan—
// cuenta como UN solo día de racha. dateSet = Set de fechas YYYY-MM-DD locales.
export function computeDateStreak(dateSet, todayISO = todayLocalISO()) {
  let end = todayISO
  if (!dateSet.has(end)) end = addDaysISO(todayISO, -1)
  if (!dateSet.has(end)) return 0
  let streak = 0
  for (let cur = end; dateSet.has(cur); cur = addDaysISO(cur, -1)) streak++
  return streak
}

// Racha MÁS LARGA del historial: el run más largo de fechas de calendario
// consecutivas, sin importar dónde termine (a diferencia de computeDateStreak,
// que mide la racha viva). dateSet = Set/Array de fechas YYYY-MM-DD locales.
export function longestStreak(dates) {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of sorted) {
    run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

// Guarda el logro de plan terminado. Idempotente por día (unique user+plan+fecha):
// re-abrir el festejo el mismo día no duplica. Llamar ANTES de borrar el progreso.
export async function recordPlanCompletion({ userId, planId, daysRead, totalDays, longestStreak: streak, startedOn }) {
  const { error } = await supabase.from('plan_completions').upsert(
    {
      user_id: userId,
      plan_id: planId,
      days_read: daysRead,
      total_days: totalDays,
      longest_streak: streak ?? 0,
      started_on: startedOn ?? null,
    },
    { onConflict: 'user_id,plan_id,completed_on', ignoreDuplicates: true }
  )
  if (error) throw error
}

// Borra el progreso de un plan (para "renovar": releerlo desde el día 1).
export async function clearPlanProgress(userId, planId) {
  const { error } = await supabase
    .from('reading_progress')
    .delete()
    .eq('user_id', userId)
    .eq('plan_id', planId)
  if (error) throw error
}

// Planes terminados (logros), más recientes primero. Cada registro es una vez que
// se completó un plan; incluye el nombre del plan.
export async function getCompletedPlans(userId) {
  const { data, error } = await supabase
    .from('plan_completions')
    .select('id, plan_id, days_read, total_days, longest_streak, started_on, completed_on, plan:reading_plans(name, slug)')
    .eq('user_id', userId)
    .order('completed_on', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => ({ ...c, plan_name: c.plan?.name ?? null, plan_slug: c.plan?.slug ?? null }))
}

// Números acumulados para "Tu recorrido". Días en la Palabra = fechas distintas con
// lectura (huella actual); racha más larga = máx entre la actual y la guardada en
// logros (renovar borra el progreso, pero el logro conserva su racha).
export async function getYearStats(userId) {
  const [prog, comps, answered] = await Promise.all([
    supabase.from('reading_progress').select('completed_at').eq('user_id', userId),
    supabase.from('plan_completions').select('longest_streak').eq('user_id', userId),
    supabase
      .from('prayer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'answered'),
  ])
  if (prog.error) throw prog.error
  if (comps.error) throw comps.error
  if (answered.error) throw answered.error

  const dates = new Set((prog.data ?? []).map((r) => localDateISO(r.completed_at)))
  const curStreak = longestStreak([...dates])
  const compStreak = Math.max(0, ...(comps.data ?? []).map((c) => c.longest_streak ?? 0))
  return {
    totalDaysRead: dates.size,
    longestStreak: Math.max(curStreak, compStreak),
    plansCompleted: (comps.data ?? []).length,
    prayersAnswered: answered.count ?? 0,
  }
}

// ============================================================================
// Oración (Tarea 5 — documento maestro §5.4 / §5.5)
// ============================================================================

// Mis grupos, con conteo de miembros. Sirve para el selector de Oración (usa
// id/name) y para la lista de Grupos (usa member_count/role).
export async function getMyGroups(userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('role, group:groups(id, name)')
    .eq('user_id', userId)
  if (error) throw error
  const groups = data.filter((r) => r.group).map((r) => ({ ...r.group, role: r.role }))

  if (groups.length) {
    // Conteo de miembros por grupo (RLS permite ver miembros de mis grupos).
    const ids = groups.map((g) => g.id)
    const { data: mem, error: me } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', ids)
    if (me) throw me
    const counts = {}
    for (const m of mem) counts[m.group_id] = (counts[m.group_id] || 0) + 1
    return groups.map((g) => ({ ...g, member_count: counts[g.id] || 0 }))
  }
  return groups
}

// Detalle de un grupo: datos + lista de miembros (con display_name vía 0004).
export async function getGroupDetail(groupId) {
  const { data: group, error: ge } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (ge) throw ge

  // '*' a propósito: incluye follow_plan cuando la migración 0028 está aplicada
  // y no rompe el detalle si todavía no lo está (mismo criterio que el grupo).
  const { data: members, error: me } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
  if (me) throw me

  const ids = members.map((m) => m.user_id)
  let names = {}
  if (ids.length) {
    const { data: profs, error: pe } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', ids)
    if (pe) throw pe
    names = Object.fromEntries(profs.map((p) => [p.id, p.display_name]))
  }
  return {
    group,
    members: members.map((m) => ({ ...m, display_name: names[m.user_id] || 'Miembro' })),
  }
}

// --- RPCs (security definer, ver migración 0005) ---
export async function createGroup(name) {
  const { data, error } = await supabase.rpc('create_group', { p_name: name })
  if (error) throw error
  return data
}

export async function joinGroupByCode(code) {
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code })
  if (error) throw error
  // Código inexistente: el RPC puede devolver null o una fila con id null
  // (RETURNS TABLE sin matches). Normalizamos a null para que ningún caller
  // navegue a /grupos/null creyendo que se unió.
  return data && data.id != null ? data : null
}

export async function regenerateInviteCode(groupId) {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_group_id: groupId })
  if (error) throw error
  return data
}

export async function removeMember(groupId, userId) {
  const { error } = await supabase.rpc('remove_member', { p_group_id: groupId, p_user_id: userId })
  if (error) throw error
}

// Salir de un grupo (no-owner): borra la propia membresía. La RLS lo permite
// (policy "leave or owner removes": user_id = auth.uid()). El owner no usa esto
// —para irse debe reasignar/borrar el grupo, o eliminar la cuenta.
export async function leaveGroup(groupId, userId) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

// "Míos": todos los pedidos del usuario (privados y compartidos).
// Para los compartidos añade intercessor_count con una query batch (no N+1).
export async function getMyPrayers(userId) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*, group:groups(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const sharedIds = data.filter((p) => p.visibility === 'shared').map((p) => p.id)
  let countMap = {}
  if (sharedIds.length) {
    const { data: ints } = await supabase
      .from('prayer_intercessions')
      .select('prayer_id')
      .in('prayer_id', sharedIds)
    for (const r of ints ?? []) countMap[r.prayer_id] = (countMap[r.prayer_id] || 0) + 1
  }
  return data.map((p) => ({ ...p, intercessor_count: countMap[p.id] ?? 0 }))
}

// "De mis grupos": pedidos compartidos por OTROS a grupos a los que pertenezco.
// Adjunta nombre del autor e intercessor_count (batch, no N+1).
export async function getGroupPrayers(userId) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*, group:groups(name)')
    .eq('visibility', 'shared')
    .eq('status', 'active')
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  // RLS ya limita a pedidos de grupos donde soy miembro. Solo activos: los
  // respondidos viven en Testimonios, no se acumulan en "De mis grupos".
  const authorIds = [...new Set(data.map((p) => p.user_id))]
  let names = {}
  if (authorIds.length) {
    const { data: profs, error: pe } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', authorIds)
    if (pe) throw pe
    names = Object.fromEntries(profs.map((p) => [p.id, p.display_name]))
  }

  let countMap = {}
  if (data.length) {
    const { data: ints } = await supabase
      .from('prayer_intercessions')
      .select('prayer_id')
      .in('prayer_id', data.map((p) => p.id))
    for (const r of ints ?? []) countMap[r.prayer_id] = (countMap[r.prayer_id] || 0) + 1
  }
  return data.map((p) => ({
    ...p,
    author_name: names[p.user_id] || 'Alguien',
    intercessor_count: countMap[p.id] ?? 0,
  }))
}

// Computa la fecha de vencimiento según el tipo de duración elegido.
// 'forever' → null (sin vencimiento); el resto suma días desde ahora.
function computeExpiresAt(durationType) {
  const days = { day: 1, week: 7, month: 30 }[durationType]
  if (!days) return null
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export async function createPrayer({ userId, title, description, visibility, groupId, durationType = 'forever' }) {
  const row = {
    user_id: userId,
    title: title.trim(),
    description: description?.trim() || null,
    visibility,
    shared_group_id: visibility === 'shared' ? groupId : null,
    duration_type: durationType,
    expires_at: computeExpiresAt(durationType),
  }
  const { data, error } = await supabase.from('prayer_requests').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updatePrayer(id, patch) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePrayer(id) {
  const { error } = await supabase.from('prayer_requests').delete().eq('id', id)
  if (error) throw error
}

// Eliminar cuenta (Tarea 7 — RPC security definer, ver migración 0006).
// Reasigna/borra grupos propios y borra al usuario (cascade hace el resto).
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_account')
  if (error) throw error
}

// Todos los días de un plan (para el detalle del plan: listado día-por-día).
export async function getPlanDays(planId) {
  const { data, error } = await supabase
    .from('plan_days')
    .select('day_number, refs')
    .eq('plan_id', planId)
    .order('day_number', { ascending: true })
  if (error) throw error
  return data
}

// ============================================================================
// Fase 2 — Vida del pedido compartido (intercesión, testimonios, stats).
// Requiere la migración 0007.
// ============================================================================

// Resuelve display_name para un set de user_ids → { id: nombre }. RLS de
// co-miembros (0004) permite ver el nombre de quienes comparten grupo conmigo.
async function namesFor(userIds) {
  const ids = [...new Set(userIds)]
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
  if (error) throw error
  return Object.fromEntries(data.map((p) => [p.id, p.display_name]))
}

// Quiénes están orando por un pedido (orden de adhesión). Devuelve [{user_id, display_name}].
export async function getIntercessors(prayerId) {
  const { data, error } = await supabase
    .from('prayer_intercessions')
    .select('user_id, created_at')
    .eq('prayer_id', prayerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const names = await namesFor(data.map((r) => r.user_id))
  return data.map((r) => ({ user_id: r.user_id, display_name: names[r.user_id] || 'Miembro' }))
}

// Detalle de un pedido compartido (vista "estoy orando"): el pedido + grupo +
// autor + lista de intercesores + historia (actualizaciones del autor) + si el
// usuario actual ya intercede.
export async function getPrayerDetail(prayerId, userId) {
  const { data: p, error } = await supabase
    .from('prayer_requests')
    .select('*, group:groups(id, name)')
    .eq('id', prayerId)
    .single()
  if (error) throw error

  const [names, intercessors, updates] = await Promise.all([
    namesFor([p.user_id]),
    getIntercessors(prayerId),
    // Sin la migración 0026 la tabla no existe: el detalle degrada sin historia
    // en vez de romperse entero.
    getPrayerUpdates(prayerId).catch(() => []),
  ])
  return {
    ...p,
    author_name: names[p.user_id] || 'Alguien',
    intercessors,
    intercessor_count: intercessors.length,
    i_intercede: intercessors.some((x) => x.user_id === userId),
    updates,
  }
}

// Historia del pedido: actualizaciones del autor, más antiguas primero
// (se lee como una cronología). Requiere la migración 0026.
export async function getPrayerUpdates(prayerId) {
  const { data, error } = await supabase
    .from('prayer_updates')
    .select('id, body, created_at')
    .eq('prayer_id', prayerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Agrega una actualización al pedido (solo el autor; la RLS lo garantiza).
export async function addPrayerUpdate(prayerId, userId, body) {
  const { data, error } = await supabase
    .from('prayer_updates')
    .insert({ prayer_id: prayerId, user_id: userId, body: body.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

// Borra una actualización propia.
export async function deletePrayerUpdate(id) {
  const { error } = await supabase.from('prayer_updates').delete().eq('id', id)
  if (error) throw error
}

// Marca "estoy orando por esto". Idempotente (UNIQUE prayer+user).
export async function addIntercession(prayerId, userId) {
  const { error } = await supabase
    .from('prayer_intercessions')
    .upsert(
      { prayer_id: prayerId, user_id: userId },
      { onConflict: 'prayer_id,user_id', ignoreDuplicates: true }
    )
  if (error) throw error
}

// Retira la propia intercesión.
export async function removeIntercession(prayerId, userId) {
  const { error } = await supabase
    .from('prayer_intercessions')
    .delete()
    .eq('prayer_id', prayerId)
    .eq('user_id', userId)
  if (error) throw error
}

// Pedidos activos propios con más de `days` días sin revisarse (contados desde
// last_reviewed_at si existe, o desde created_at). Fuente de "Para revisar".
export async function getPrayersToReview(userId, days = 30) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return data.filter((p) => {
    // Pasó su fecha de vencimiento → entra a revisión sin importar antigüedad.
    if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return true
    // "Siempre" o sin vencimiento: entra si lleva más de `days` días sin revisarse.
    const anchor = p.last_reviewed_at ?? p.created_at
    return new Date(anchor).getTime() < cutoff
  })
}

// Mazo de "Orar ahora": pedidos activos para recorrer uno a uno. Primero los de
// OTROS (compartidos a mis grupos — ahí mi oración se registra como intercesión),
// ordenados por los que menos gente sostiene (más necesitan compañía) y, a
// igualdad, los más antiguos; después los MÍOS. Los respondidos no entran. Cada
// item lleva su última actualización ("cómo sigue") si existe. No agrega tablas:
// reutiliza getGroupPrayers / getMyPrayers.
export async function getPrayerDeck(userId) {
  const [others, mineAll] = await Promise.all([
    getGroupPrayers(userId),
    getMyPrayers(userId),
  ])
  const mine = mineAll.filter((p) => p.status === 'active')

  const othersSorted = [...others].sort((a, b) => {
    const ca = a.intercessor_count ?? 0
    const cb = b.intercessor_count ?? 0
    if (ca !== cb) return ca - cb
    return new Date(a.created_at) - new Date(b.created_at)
  })

  const deck = [
    ...othersSorted.map((p) => ({ ...p, mine: false })),
    ...mine.map((p) => ({ ...p, mine: true })),
  ]

  // Última actualización por pedido (batch). Sin la migración 0026 la tabla no
  // existe y la query devuelve error → sin historia, sin romper el mazo.
  const ids = deck.map((p) => p.id)
  const latest = {}
  if (ids.length) {
    const { data } = await supabase
      .from('prayer_updates')
      .select('prayer_id, body, created_at')
      .in('prayer_id', ids)
      .order('created_at', { ascending: false })
    for (const u of data ?? []) {
      if (!latest[u.prayer_id]) latest[u.prayer_id] = u // el primero = el más reciente
    }
  }
  return deck.map((p) => ({ ...p, latest_update: latest[p.id] ?? null }))
}

// "Sigue igual": reinicia el reloj de revisión sin cambiar el estado.
export async function markPrayerReviewed(id) {
  const { error } = await supabase
    .from('prayer_requests')
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Testimonios de un grupo: pedidos compartidos, respondidos y marcados para
// compartir, más recientes primero. Incluye el nombre del autor.
export async function getGroupTestimonies(groupId) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('shared_group_id', groupId)
    .eq('visibility', 'shared')
    .eq('status', 'answered')
    .eq('testimony_shared', true)
    .order('answered_at', { ascending: false })
  if (error) throw error
  const names = await namesFor(data.map((p) => p.user_id))
  return data.map((p) => ({ ...p, author_name: names[p.user_id] || 'Alguien' }))
}

// Datos mínimos de un grupo (para encabezados; RLS permite ver mis grupos).
export async function getGroup(groupId) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .eq('id', groupId)
    .single()
  if (error) throw error
  return data
}

export async function renameGroup(groupId, name) {
  const { error } = await supabase.rpc('rename_group', { p_group_id: groupId, p_name: name })
  if (error) throw error
}

// Fija (o quita, con planId null) el plan común del grupo. Solo el administrador
// (el RPC valida adentro). startDate = el "hoy" local del que lo elige, que pasa
// a ser el día 1 del grupo. Requiere la migración 0027.
export async function setGroupPlan(groupId, planId, startDate = null) {
  const { error } = await supabase.rpc('set_group_plan', {
    p_group_id: groupId,
    p_plan_id: planId,
    p_start_date: startDate,
  })
  if (error) throw error
}

// Prende/apaga MI seguimiento del plan del grupo como lectura adicional (el modo
// liviano: aparece en Hoy con el día que dicta el calendario del grupo, sin racha
// ni progreso propio). Solo toca la propia membresía. Requiere la migración 0028.
export async function followGroupPlan(groupId, follow) {
  const { error } = await supabase.rpc('follow_group_plan', {
    p_group_id: groupId,
    p_follow: follow,
  })
  if (error) throw error
}

// Lecturas de grupo que sigo como adicionales, listas para Hoy: por cada grupo
// seguido con plan vigente, el día que dicta SU calendario, las refs de ese día
// y si ya lo marqué (en reading_progress, con el plan_id del grupo — así el
// pulso "quién leyó hoy" del grupo la cuenta). Los planes terminados no vienen:
// en Hoy serían ruido (el cierre se ve en el detalle del grupo).
export async function getFollowedGroupReadings(userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(id, name, plan_id, plan_start_date)')
    .eq('user_id', userId)
    .eq('follow_plan', true)
  if (error) throw error

  const groups = (data ?? [])
    .map((r) => r.group)
    .filter((g) => g && g.plan_id && g.plan_start_date)

  const readings = await Promise.all(
    groups.map(async (g) => {
      const day = dayNumberFor(g.plan_start_date)
      if (day < 1) return null
      const [plan, planDay, prog] = await Promise.all([
        getPlan(g.plan_id),
        getPlanDay(g.plan_id, day),
        supabase
          .from('reading_progress')
          .select('day_number')
          .eq('user_id', userId)
          .eq('plan_id', g.plan_id)
          .eq('day_number', day)
          .maybeSingle(),
      ])
      if (day > plan.duration_days || !planDay) return null
      return {
        groupId: g.id,
        groupName: g.name,
        planId: g.plan_id,
        planStartDate: g.plan_start_date,
        day,
        totalDays: plan.duration_days,
        refs: planDay.refs ?? [],
        read: !prog.error && !!prog.data,
      }
    })
  )
  return readings.filter(Boolean)
}

// Pedidos compartidos del grupo con sus intercesores (para la vista pastoral del owner).
// Hace 3 queries en lugar de N+1.
export async function getGroupPrayersWithIntercessors(groupId) {
  const { data: prayers, error } = await supabase
    .from('prayer_requests')
    .select('id, title, status, user_id, created_at')
    .eq('shared_group_id', groupId)
    .eq('visibility', 'shared')
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!prayers.length) return []

  const prayerIds = prayers.map((p) => p.id)
  const { data: intercessions, error: ie } = await supabase
    .from('prayer_intercessions')
    .select('prayer_id, user_id, created_at')
    .in('prayer_id', prayerIds)
    .order('created_at', { ascending: true })
  if (ie) throw ie

  const allIds = [
    ...new Set([...prayers.map((p) => p.user_id), ...intercessions.map((i) => i.user_id)]),
  ]
  const names = await namesFor(allIds)

  const interByPrayer = {}
  for (const i of intercessions) {
    if (!interByPrayer[i.prayer_id]) interByPrayer[i.prayer_id] = []
    interByPrayer[i.prayer_id].push({
      user_id: i.user_id,
      display_name: names[i.user_id] || 'Miembro',
    })
  }

  return prayers.map((p) => ({
    ...p,
    author_name: names[p.user_id] || 'Alguien',
    intercessors: interByPrayer[p.id] || [],
  }))
}

// Resumen pastoral del grupo (solo owner; el RPC valida la propiedad adentro).
export async function getGroupStats(groupId) {
  const { data, error } = await supabase.rpc('group_prayer_stats', { p_group_id: groupId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    active: row?.active ?? 0,
    answered: row?.answered ?? 0,
    praying_week: row?.praying_week ?? 0,
  }
}

// ============================================================================
// Fase 3 — Reflexión de una línea ("Mi camino"). Requiere la migración 0015.
// La nota es el "fruto" de la lectura en palabras del usuario, NO la Escritura.
// ============================================================================

// Caché en memoria de la última reflexión conocida por usuario+plan+día. Deja que la
// pantalla Hoy pinte el botón correcto ("Editar tu nota") al instante al volver, sin
// el parpadeo de mostrar primero "Anotá…", mientras getReflection revalida por detrás
// (stale-while-revalidate). Vive en memoria: se vacía al recargar la página.
//   ausente (undefined) = nunca cargado   null = sin nota   objeto = hay nota
const reflectionCache = new Map()
const reflectionKey = (userId, planId, dayNumber) => `${userId}:${planId}:${dayNumber}`

// Última reflexión conocida sin tocar la red. undefined = todavía no lo sabemos.
export function getCachedReflection(userId, planId, dayNumber) {
  return reflectionCache.get(reflectionKey(userId, planId, dayNumber))
}

// Reflexión del usuario para un día puntual del plan (null si no hay).
export async function getReflection(userId, planId, dayNumber) {
  const { data, error } = await supabase
    .from('reading_reflections')
    .select('id, plan_id, day_number, body, created_at, updated_at')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('day_number', dayNumber)
    .maybeSingle()
  if (error) throw error
  reflectionCache.set(reflectionKey(userId, planId, dayNumber), data ?? null)
  return data
}

// Crea o actualiza la reflexión del día (una por usuario+plan+día).
export async function upsertReflection(userId, planId, dayNumber, body) {
  const { data, error } = await supabase
    .from('reading_reflections')
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        day_number: dayNumber,
        body: body.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,plan_id,day_number' }
    )
    .select()
    .single()
  if (error) throw error
  reflectionCache.set(reflectionKey(userId, planId, dayNumber), data)
  return data
}

// Borra la reflexión de un día.
export async function deleteReflection(userId, planId, dayNumber) {
  const { error } = await supabase
    .from('reading_reflections')
    .delete()
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('day_number', dayNumber)
  if (error) throw error
  reflectionCache.set(reflectionKey(userId, planId, dayNumber), null)
}

// Diario cross-plan, más recientes primero. Paginación por cursor de created_at
// (pasá el created_at de la última entrada como `before` para traer las siguientes).
export async function getReflectionJournal(userId, { limit = 30, before = null } = {}) {
  let q = supabase
    .from('reading_reflections')
    .select('id, plan_id, day_number, body, created_at, plan:reading_plans(name, slug)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)
  const { data, error } = await q
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    plan_id: r.plan_id,
    plan_name: r.plan?.name ?? null,
    plan_slug: r.plan?.slug ?? null,
    day_number: r.day_number,
    body: r.body,
    created_at: r.created_at,
  }))
}

// ============================================================================
// Fase 3 — Presencia de lectura en el grupo ("de panel a sala"). Requiere 0017.
// ============================================================================

// Quiénes del grupo (opt-in) leyeron hoy. Recíproco: devuelve [] si vos no
// compartís. Cada item: { user_id, has_read }. El nombre lo resuelve la pantalla
// con la lista de miembros que ya tiene.
export async function getGroupReadingToday(groupId) {
  const { data, error } = await supabase.rpc('group_reading_today', { p_group_id: groupId })
  if (error) throw error
  return data ?? []
}

// Historial de la semana (solo owner, recíproco; requiere 0023): por cada
// miembro que comparte, { user_id, week } con week[0]=hace 6 días … week[6]=hoy,
// cada día en la zona horaria del miembro.
export async function getGroupReadingWeek(groupId) {
  const { data, error } = await supabase.rpc('group_reading_week', { p_group_id: groupId })
  if (error) throw error
  return data ?? []
}

// Pedidos activos compartidos de UN grupo (la "sala", visible a todos los
// miembros; la RLS permite ver los shared del grupo). Incluye los propios. Con
// nombre del autor e intercessor_count (batch, no N+1).
export async function getGroupActivePrayers(groupId) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*, group:groups(name)')
    .eq('shared_group_id', groupId)
    .eq('visibility', 'shared')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error

  const authorIds = [...new Set(data.map((p) => p.user_id))]
  let names = {}
  if (authorIds.length) {
    const { data: profs, error: pe } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', authorIds)
    if (pe) throw pe
    names = Object.fromEntries(profs.map((p) => [p.id, p.display_name]))
  }

  const interByPrayer = {}
  if (data.length) {
    const { data: ints } = await supabase
      .from('prayer_intercessions')
      .select('prayer_id, user_id')
      .in('prayer_id', data.map((p) => p.id))
    const interNames = await namesFor((ints ?? []).map((i) => i.user_id))
    for (const i of ints ?? []) {
      ;(interByPrayer[i.prayer_id] ??= []).push({
        user_id: i.user_id,
        display_name: interNames[i.user_id] || 'Miembro',
      })
    }
  }

  return data.map((p) => ({
    ...p,
    author_name: names[p.user_id] || 'Alguien',
    intercessors: interByPrayer[p.id] || [],
    intercessor_count: (interByPrayer[p.id] || []).length,
  }))
}

// ---- Panel admin (solo dueño) ---------------------------------------------
// Ambas llaman a funciones SECURITY DEFINER gated por email en el servidor
// (migración 0021). Si el que llama no es el dueño, Postgres lanza "no autorizado".

// Resumen general: usuarios, instalaciones, activos, planes y países.
export async function getAdminOverview() {
  const { data, error } = await supabase.rpc('admin_overview')
  if (error) throw error
  return data
}

// Serie de altas por día para los últimos `days` días.
export async function getAdminSignupsSeries(days = 30) {
  const { data, error } = await supabase.rpc('admin_signups_series', { days })
  if (error) throw error
  return data || []
}
