-- ============================================================================
-- Lee Tu Biblia — Medición de las páginas públicas: landing_view y landing_cta.
-- Migración 0039. Aplicar DESPUÉS de 0021 (usa public.is_admin()), 0035 y 0036
-- (redefinen los eventos de boot_diagnostics; esta los conserva todos). Idempotente.
--
-- Contexto: /info, /lideres, /ayuda y /privacidad registran dos eventos, sin datos
-- personales y sin cookies (ver src/lib/landingTrack.js y /privacidad):
--   landing_view : se abrió la página (una vez por dispositivo y página)
--   landing_cta  : se tocó «Empezar gratis» / «Entrar»
-- Ambos llevan detail.from (info | lideres | ayuda | privacidad), detail.device
-- (id anónimo del navegador, el mismo del embudo) y, el segundo, detail.where (en
-- qué botón: hero, header-empezar, cierre…).
--
-- 1) boot_diagnostics acepta los dos eventos nuevos, SIN quitar ninguno de los
--    anteriores (app_open, ob_*, goal_*). Hasta aplicar esta migración el servidor
--    los rechaza y el cliente lo asume en silencio (no reintenta ni rompe nada).
-- 2) admin_landing_funnel(days): por página de origen, dispositivos que la abrieron,
--    que tocaron un botón y que llegaron a la bienvenida de la app (ob_welcome con
--    el mismo `from`). Sin vistas nuevas en /admin todavía: se consulta desde el SQL
--    Editor o se enchufa después.
-- ============================================================================

-- ---- 1) Eventos permitidos --------------------------------------------------------
alter table public.boot_diagnostics
  drop constraint if exists boot_diagnostics_event_allowed;

alter table public.boot_diagnostics
  add constraint boot_diagnostics_event_allowed
    check (event in (
      'app_open', 'boot_reload', 'profile_retry', 'getsession_slow',
      'ob_welcome', 'ob_install_step', 'ob_install_skip', 'ob_explore',
      'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved',
      'ob_extras_done', 'ob_first_mark',
      'goal_shown', 'goal_open', 'goal_link',
      'landing_view', 'landing_cta'
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
      'goal_shown', 'goal_open', 'goal_link',
      'landing_view', 'landing_cta'
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
      'goal_shown', 'goal_open', 'goal_link',
      'landing_view', 'landing_cta'
    )
    and (user_agent is null or char_length(user_agent) <= 512)
    and (detail is null or pg_column_size(detail) <= 4096)
  );

-- ---- 2) Qué página convierte ----------------------------------------------------------
-- Dispositivos distintos por página de origen en los últimos `days` días:
--   views    : abrieron la página (landing_view)
--   clicks   : tocaron un botón de entrada (landing_cta)
--   welcomes : llegaron a la app con ese origen (ob_welcome; el cliente lo registra
--              también cuando se saltea la bienvenida)
-- La identidad es detail.device; si faltara, el usuario o la fila.
create or replace function public.admin_landing_funnel(days int default 30)
returns table(source text, views int, clicks int, welcomes int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;
  return query
    select s.source,
           coalesce(c.views, 0)::int,
           coalesce(c.clicks, 0)::int,
           coalesce(c.welcomes, 0)::int
    from unnest(array['info', 'lideres', 'ayuda', 'privacidad']) with ordinality as s(source, ord)
    left join (
      select d.detail->>'from' as source,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))
               filter (where d.event = 'landing_view') as views,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))
               filter (where d.event = 'landing_cta') as clicks,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))
               filter (where d.event = 'ob_welcome') as welcomes
      from boot_diagnostics d
      where d.event in ('landing_view', 'landing_cta', 'ob_welcome')
        and d.detail->>'from' is not null
        and d.created_at >= now() - greatest(days, 1) * interval '1 day'
      group by d.detail->>'from'
    ) c on c.source = s.source
    order by s.ord;
end $$;

grant execute on function public.admin_landing_funnel(int) to authenticated;
