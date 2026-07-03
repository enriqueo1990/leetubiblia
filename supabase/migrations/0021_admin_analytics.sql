-- ============================================================================
-- Lee Tu Biblia — Panel admin (solo para el dueño).
-- Migración 0021. Aplicar DESPUÉS de 0001..0020.
--
-- Objetivo: alimentar una pantalla /admin privada con métricas agregadas
-- (instalaciones, países, planes, activación, retención, plataforma). Todo el
-- cálculo vive en el servidor con funciones SECURITY DEFINER que:
--   1) saltan RLS para poder contar filas de TODOS los usuarios, y
--   2) se cierran con is_admin(): solo responden si el email del JWT es el dueño.
-- El frontend usa la anon key normal; nunca toca el service role.
--
-- Columnas nuevas en profiles (estado por usuario, sin crecer en filas):
--   country        : ISO-2 del país (se captura al arrancar vía /cdn-cgi/trace
--                    de Cloudflare — sin guardar IP).
--   last_seen_at   : último arranque con sesión (activos 7/30 días, dormidos).
--   platform       : 'ios' | 'android' | 'desktop' (derivado del user agent).
--   standalone_seen: alguna vez abrió la app instalada (señal de instalación).
--
-- NOTA sobre boot_diagnostics (migración 0015): deja de ser "temporal". Ahora es
-- la bitácora permanente de arranques — además de los eventos de salud de boot,
-- registra 'app_open' (una vez por día por dispositivo) para contar aperturas.
-- ============================================================================

-- ---- Nuevas columnas en profiles ------------------------------------------
alter table public.profiles
  add column if not exists country         text,
  add column if not exists last_seen_at    timestamptz,
  add column if not exists platform        text,
  add column if not exists standalone_seen boolean;

-- ---- Guard de admin --------------------------------------------------------
-- Compara el email del JWT del que llama contra el dueño. En una función
-- SECURITY DEFINER el GUC request.jwt.claims sigue siendo el del CALLER (se fija
-- por request), así que esto identifica correctamente a quien invoca.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'enrique.o1990@gmail.com';
$$;

-- ---- Resumen general -------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

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

    -- Plataforma (del user agent): { ios, android, desktop, — }
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

    -- Dormidos: fueron activos alguna vez y no vuelven hace 14+ días.
    'dormant_14d', (
      select count(*) from profiles p
      where (p.last_seen_at is not null
             or exists (select 1 from reading_progress rp where rp.user_id = p.id))
        and coalesce(p.last_seen_at, '-infinity'::timestamptz) < now() - interval '14 days'
        and not exists (select 1 from reading_progress rp
                        where rp.user_id = p.id and rp.completed_at >= now() - interval '14 days')
    ),

    -- Constancia: distribución de usuarios por días distintos leídos.
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

    -- Diario / reflexiones.
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

    -- Salud por plan: empezaron (progreso o plan activo), activos ahora,
    -- terminados y día promedio en que se frenan los que no terminaron.
    'plans_health', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select rp.name, rp.slug,
          (select count(*) from profiles pf where pf.active_plan_id = rp.id)::int as active_now,
          (select count(distinct u) from (
             select user_id u from reading_progress where plan_id = rp.id
             union
             select id u from profiles where active_plan_id = rp.id
           ) s)::int as started,
          (select count(*) from plan_completions pc where pc.plan_id = rp.id)::int as completions,
          (select round(avg(m))::int from (
             select max(day_number) m from reading_progress rpg
             where rpg.plan_id = rp.id
               and not exists (select 1 from plan_completions pc
                               where pc.plan_id = rp.id and pc.user_id = rpg.user_id)
             group by rpg.user_id
           ) x) as stall_day
        from reading_plans rp
        where rp.is_active
        order by started desc, rp.name
      ) t
    ),

    'countries', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select coalesce(nullif(country, ''), '—') as country, count(*)::int as users
        from profiles group by 1 order by users desc, 1
      ) t
    ),

    -- Geografía aproximada AHORA (retroactiva) por timezone ya guardado.
    'timezones', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select coalesce(nullif(timezone, ''), '—') as tz, count(*)::int as users
        from profiles group by 1 order by users desc, 1 limit 20
      ) t
    )
  ) into result;

  return result;
end $$;

-- ---- Serie de altas por día ------------------------------------------------
create or replace function public.admin_signups_series(days int default 30)
returns table(day date, signups int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;
  return query
    select d::date, count(p.id)::int
    from generate_series(current_date - (greatest(days, 1) - 1), current_date, interval '1 day') d
    left join profiles p on p.created_at::date = d::date
    group by d
    order by d;
end $$;

-- Ejecutables por cualquier autenticado; el guard interno hace el resto.
grant execute on function public.admin_overview()          to authenticated;
grant execute on function public.admin_signups_series(int) to authenticated;
grant execute on function public.is_admin()                to authenticated;
