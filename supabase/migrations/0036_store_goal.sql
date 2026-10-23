-- ============================================================================
-- Lee Tu Biblia — Meta de donación para las tiendas + señales de uso por plataforma.
-- Migración 0036. Aplicar DESPUÉS de 0021 (usa public.is_admin()), 0030
-- (reading_progress.completed_on) y 0035 (redefine los eventos de
-- boot_diagnostics). Idempotente.
--
-- Contexto: antes de pagar las cuentas de App Store (USD 99/año) y Play Store
-- (USD 25), se mide si la gente usa la app y si está dispuesta a costearlo.
--
-- 1) donation_goals: la meta visible en la app ("USD 0 de 124"). Las donaciones
--    llegan por PayPal / Mercado Pago, sin webhook: el dueño carga lo juntado a
--    mano desde /admin. Todos leen; solo el dueño escribe.
-- 2) boot_diagnostics acepta 'goal_shown' / 'goal_open' / 'goal_link' (una vez
--    por dispositivo): cuántos vieron la tarjeta, abrieron la hoja y tocaron un
--    link de donación.
-- 3) admin_store_signals(): por plataforma, cuántos leen de verdad, cuántos
--    vuelven después del primer día y cuántos son habituales (3+ días en la
--    última semana); más el embudo de la meta.
-- ============================================================================

-- ---- 1) Meta de donación ----------------------------------------------------------
create table if not exists public.donation_goals (
  key        text primary key,
  target     numeric(10, 2) not null check (target > 0),
  raised     numeric(10, 2) not null default 0 check (raised >= 0),
  currency   text not null default 'USD',
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- App Store (99/año) + Play Store (25, pago único) = el primer año.
insert into public.donation_goals (key, target)
values ('stores', 124)
on conflict (key) do nothing;

alter table public.donation_goals enable row level security;

drop policy if exists "goals readable" on public.donation_goals;
create policy "goals readable" on public.donation_goals
  for select to anon, authenticated
  using (true);

drop policy if exists "goals admin updates" on public.donation_goals;
create policy "goals admin updates" on public.donation_goals
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.donation_goals to anon, authenticated;
grant update (target, raised, active, updated_at) on public.donation_goals to authenticated;

-- ---- 2) Eventos permitidos --------------------------------------------------------
alter table public.boot_diagnostics
  drop constraint if exists boot_diagnostics_event_allowed;

alter table public.boot_diagnostics
  add constraint boot_diagnostics_event_allowed
    check (event in (
      'app_open', 'boot_reload', 'profile_retry', 'getsession_slow',
      'ob_welcome', 'ob_install_step', 'ob_install_skip', 'ob_explore',
      'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved',
      'ob_extras_done', 'ob_first_mark',
      'goal_shown', 'goal_open', 'goal_link'
    )) not valid;

drop policy if exists "anonymous boot diagnostics" on public.boot_diagnostics;
drop policy if exists "authenticated boot diagnostics" on public.boot_diagnostics;

create policy "anonymous boot diagnostics" on public.boot_diagnostics
  for insert to anon with check (
    user_id is null
    and event in (
      'app_open', 'boot_reload', 'profile_retry', 'getsession_slow',
      'ob_welcome', 'ob_install_step', 'ob_install_skip', 'ob_explore',
      'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved',
      'ob_extras_done', 'ob_first_mark',
      'goal_shown', 'goal_open', 'goal_link'
    )
    and (user_agent is null or char_length(user_agent) <= 512)
    and (detail is null or pg_column_size(detail) <= 4096)
  );

create policy "authenticated boot diagnostics" on public.boot_diagnostics
  for insert to authenticated with check (
    (user_id is null or user_id = auth.uid())
    and event in (
      'app_open', 'boot_reload', 'profile_retry', 'getsession_slow',
      'ob_welcome', 'ob_install_step', 'ob_install_skip', 'ob_explore',
      'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved',
      'ob_extras_done', 'ob_first_mark',
      'goal_shown', 'goal_open', 'goal_link'
    )
    and (user_agent is null or char_length(user_agent) <= 512)
    and (detail is null or pg_column_size(detail) <= 4096)
  );

-- ---- 3) Señales para decidir las tiendas --------------------------------------------
-- Por plataforma (la que registró el último arranque):
--   users     : registrados
--   read      : leyeron al menos un día
--   eligible  : registrados hace 2+ días (los únicos que pudieron "volver")
--   came_back : de eligible, volvieron otro día después del alta (abrieron la app
--               o leyeron en una fecha local posterior)
--   habitual  : leyeron 3+ días distintos en los últimos 7
--   installed : alguna vez abrieron la app instalada
--   push      : tienen al menos un dispositivo con recordatorio
create or replace function public.admin_store_signals()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  with per_user as (
    select
      coalesce(nullif(p.platform, ''), '—') as platform,
      p.created_at < now() - interval '2 days' as eligible,
      (select count(distinct rp.completed_on) from reading_progress rp
         where rp.user_id = p.id) as days_read,
      (select count(distinct rp.completed_on) from reading_progress rp
         where rp.user_id = p.id and rp.completed_on >= current_date - 6) as days_7,
      (
        (p.last_seen_at at time zone coalesce(p.timezone, 'UTC'))::date
          > (p.created_at at time zone coalesce(p.timezone, 'UTC'))::date
        or exists (
          select 1 from reading_progress rp
          where rp.user_id = p.id
            and rp.completed_on > (p.created_at at time zone coalesce(p.timezone, 'UTC'))::date
        )
      ) as came_back,
      coalesce(p.standalone_seen, false) as installed,
      exists (select 1 from push_subscriptions ps where ps.user_id = p.id) as push
    from profiles p
  ),
  by_platform as (
    select platform,
      count(*)::int                                          as users,
      count(*) filter (where days_read > 0)::int             as read,
      count(*) filter (where eligible)::int                  as eligible,
      count(*) filter (where eligible and came_back)::int    as came_back,
      count(*) filter (where days_7 >= 3)::int               as habitual,
      count(*) filter (where installed)::int                 as installed,
      count(*) filter (where push)::int                      as push
    from per_user
    group by platform
  ),
  goal_events as (
    select d.event,
           count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))::int as devices
    from boot_diagnostics d
    where d.event in ('goal_shown', 'goal_open', 'goal_link')
    group by d.event
  )
  select jsonb_build_object(
    'generated_at', now(),
    'platforms', (
      select coalesce(jsonb_agg(row_to_json(b) order by b.users desc, b.platform), '[]'::jsonb)
      from by_platform b
    ),
    'goal_funnel', jsonb_build_object(
      'shown',  coalesce((select devices from goal_events where event = 'goal_shown'), 0),
      'opened', coalesce((select devices from goal_events where event = 'goal_open'), 0),
      'link',   coalesce((select devices from goal_events where event = 'goal_link'), 0)
    )
  ) into result;

  return result;
end $$;

grant execute on function public.admin_store_signals() to authenticated;
