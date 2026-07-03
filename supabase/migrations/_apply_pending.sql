-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Aplicar en Supabase SQL Editor. Luego vaciar este archivo.
-- ============================================================

-- 0022_fix_admin_plans_health.sql
-- ============================================================================
-- Lee Tu Biblia — Fix del panel admin.
-- Migración 0022. Aplicar DESPUÉS de 0021.
--
-- Arregla dos cosas:
--
-- (A) boot_diagnostics fue BORRADA (en 0015 estaba marcada como "temporal"). Su
--     ausencia rompía el flushDiag del cliente (POST 404) y admin_overview (que
--     lee count(*) de esa tabla para 'total_opens'). Como ahora es permanente
--     (registra 'app_open'), la recreamos idéntica a 0015. Idempotente.
--
-- (B) admin_overview(): el bloque 'plans_health' calculaba 'started'/'stall_day'
--     con subconsultas en el FROM que referenciaban la tabla externa `rp`
--     (correlación sin LATERAL, no permitida por Postgres → error en runtime).
--     No se detectó antes porque el guard is_admin() corta ANTES del cuerpo.
--     Fix: recalcular plans_health con CTEs por plan, sin correlación.
-- ============================================================================

-- ---- (A) Recrear boot_diagnostics (permanente) ----------------------------
create table if not exists public.boot_diagnostics (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  event      text not null,
  detail     jsonb,
  standalone boolean,
  user_agent text
);
create index if not exists boot_diag_event_idx on public.boot_diagnostics(event, created_at);

alter table public.boot_diagnostics enable row level security;

-- Cualquier cliente (anónimo o logueado) puede registrar su arranque; nadie lee
-- ni modifica desde el cliente (el panel lee con las funciones SECURITY DEFINER).
drop policy if exists "anyone can insert boot diagnostics" on public.boot_diagnostics;
create policy "anyone can insert boot diagnostics" on public.boot_diagnostics
  for insert to anon, authenticated with check (true);

-- ---- (B) admin_overview() sin correlación ilegal --------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  with
  -- Máximo día alcanzado por cada (usuario, plan).
  per_user_plan as (
    select user_id, plan_id, max(day_number) as maxday
    from reading_progress
    group by user_id, plan_id
  ),
  -- Día promedio de freno: entre quienes NO terminaron ese plan.
  stall as (
    select p.plan_id, round(avg(p.maxday))::int as stall_day
    from per_user_plan p
    where not exists (
      select 1 from plan_completions pc
      where pc.plan_id = p.plan_id and pc.user_id = p.user_id
    )
    group by p.plan_id
  ),
  -- Empezaron: tienen progreso en el plan o lo tienen activo ahora.
  started as (
    select plan_id, count(*)::int as started
    from (
      select distinct user_id, plan_id from reading_progress
      union
      select id, active_plan_id from profiles where active_plan_id is not null
    ) s
    group by plan_id
  ),
  comps as (
    select plan_id, count(*)::int as completions
    from plan_completions group by plan_id
  ),
  actives as (
    select active_plan_id as plan_id, count(*)::int as active_now
    from profiles where active_plan_id is not null
    group by active_plan_id
  ),
  ph as (
    select rp.name, rp.slug,
      coalesce(a.active_now, 0)   as active_now,
      coalesce(st.started, 0)     as started,
      coalesce(c.completions, 0)  as completions,
      stl.stall_day
    from reading_plans rp
    left join actives a  on a.plan_id  = rp.id
    left join started st on st.plan_id = rp.id
    left join comps   c  on c.plan_id  = rp.id
    left join stall   stl on stl.plan_id = rp.id
    where rp.is_active
  )
  select jsonb_build_object(
    'generated_at', now(),

    'users', jsonb_build_object(
      'total',         (select count(*) from profiles),
      'with_plan',     (select count(*) from profiles where active_plan_id is not null),
      'activated',     (select count(distinct user_id) from reading_progress),
      'with_reminder', (select count(*) from profiles where reminder_enabled),
      'new_7d',        (select count(*) from profiles where created_at >= now() - interval '7 days'),
      'new_30d',       (select count(*) from profiles where created_at >= now() - interval '30 days')
    ),

    'installs', jsonb_build_object(
      'standalone_users', (select count(*) from profiles where standalone_seen),
      'browser_only',     (select count(*) from profiles
                             where standalone_seen is not true and last_seen_at is not null),
      'total_opens',      (select count(*) from boot_diagnostics where event = 'app_open'),
      'push_devices',     (select count(*) from push_subscriptions)
    ),

    'platform', (
      select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) from (
        select coalesce(nullif(platform, ''), '—') as k, count(*)::int as c
        from profiles group by 1
      ) t
    ),

    'active', jsonb_build_object(
      'd7',  (select count(distinct u) from (
                select user_id u from reading_progress where completed_at >= now() - interval '7 days'
                union
                select id       u from profiles         where last_seen_at >= now() - interval '7 days'
              ) a),
      'd30', (select count(distinct u) from (
                select user_id u from reading_progress where completed_at >= now() - interval '30 days'
                union
                select id       u from profiles         where last_seen_at >= now() - interval '30 days'
              ) a)
    ),

    'dormant_14d', (
      select count(*) from profiles p
      where (p.last_seen_at is not null
             or exists (select 1 from reading_progress rp where rp.user_id = p.id))
        and coalesce(p.last_seen_at, '-infinity'::timestamptz) < now() - interval '14 days'
        and not exists (select 1 from reading_progress rp
                        where rp.user_id = p.id and rp.completed_at >= now() - interval '14 days')
    ),

    'constancy', jsonb_build_object(
      'd0',    (select count(*) from profiles)
                 - (select count(distinct user_id) from reading_progress),
      'd1_6',  (select count(*) from (
                  select count(distinct completed_at::date) c
                  from reading_progress group by user_id) t where c between 1 and 6),
      'd7_29', (select count(*) from (
                  select count(distinct completed_at::date) c
                  from reading_progress group by user_id) t where c between 7 and 29),
      'd30p',  (select count(*) from (
                  select count(distinct completed_at::date) c
                  from reading_progress group by user_id) t where c >= 30)
    ),

    'diary', jsonb_build_object(
      'users',   (select count(distinct user_id) from reading_reflections),
      'enabled', (select count(*) from profiles where reflections_enabled)
    ),

    'engagement', jsonb_build_object(
      'groups',           (select count(*) from groups),
      'group_members',    (select count(*) from group_members),
      'prayers',          (select count(*) from prayer_requests),
      'prayers_answered', (select count(*) from prayer_requests where status = 'answered'),
      'reflections',      (select count(*) from reading_reflections),
      'plans_completed',  (select count(*) from plan_completions)
    ),

    'plans_health', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.started desc, t.name), '[]'::jsonb)
      from ph t
    ),

    'countries', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select coalesce(nullif(country, ''), '—') as country, count(*)::int as users
        from profiles group by 1 order by users desc, 1
      ) t
    ),

    'timezones', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select coalesce(nullif(timezone, ''), '—') as tz, count(*)::int as users
        from profiles group by 1 order by users desc, 1 limit 20
      ) t
    )
  ) into result;

  return result;
end $$;
