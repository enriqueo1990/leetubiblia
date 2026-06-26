import { supabase } from './supabase.js'

// Helpers de datos de solo lectura del catálogo. Las mutaciones de perfil viven
// en el contexto de auth (updateProfile). Las de progreso/oración/grupos llegan
// en sus tareas respectivas (4, 5, 6).

// Lista los planes activos del catálogo, ordenados de mayor a menor duración.
export async function getPlans() {
  const { data, error } = await supabase
    .from('reading_plans')
    .select('id, slug, name, description, duration_days')
    .eq('is_active', true)
    .order('duration_days', { ascending: false })
  if (error) throw error
  return data
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

  const { data: members, error: me } = await supabase
    .from('group_members')
    .select('user_id, role, joined_at')
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
  return data // null si el código no existe
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

// "Míos": todos los pedidos del usuario (privados y compartidos).
export async function getMyPrayers(userId) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*, group:groups(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// "De mis grupos": pedidos compartidos por OTROS a grupos a los que pertenezco.
// Adjunta el nombre del autor (requiere la política RLS de co-miembros, 0004).
export async function getGroupPrayers(userId) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*, group:groups(name)')
    .eq('visibility', 'shared')
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  // RLS ya limita a pedidos de grupos donde soy miembro.
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
  return data.map((p) => ({ ...p, author_name: names[p.user_id] || 'Alguien' }))
}

export async function createPrayer({ userId, title, description, visibility, groupId }) {
  const row = {
    user_id: userId,
    title: title.trim(),
    description: description?.trim() || null,
    visibility,
    shared_group_id: visibility === 'shared' ? groupId : null,
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
