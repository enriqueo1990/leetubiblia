-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Contiene 0035 (0025..0034 ya están aplicadas). Idempotente.
-- Pegá este archivo en el SQL Editor de Supabase y Run.
-- Para un deploy desde cero usá _apply_all.sql.
-- ============================================================

-- ===== 0035_onboarding_funnel.sql =====
-- Embudo de onboarding + marca de onboarding terminado.
-- Migración 0035. Aplicar DESPUÉS de 0021 (usa public.is_admin()) y de 0029
-- (redefine las restricciones de boot_diagnostics). Idempotente.
--
-- 1) boot_diagnostics acepta los pasos del embudo ('ob_*'). El cliente los
--    registra una vez por dispositivo, con detail.device (id anónimo) para unir
--    los pasos sin cuenta (bienvenida, planes, código enviado) con los de después.
--    Hasta aplicar esta migración el servidor los rechaza; el cliente los manda en
--    un lote aparte para no trabar 'app_open'.
-- 2) profiles.onboarded_at: el paso 3 ("Casi listo") ya no depende de una bandera
--    en localStorage. Antes reaparecía en otro dispositivo, en la app instalada
--    en iPhone (no comparte almacenamiento con Safari) y tras cerrar sesión.
-- 3) admin_onboarding_funnel(days): dispositivos distintos por paso.

-- ---- 1) Eventos permitidos -----------------------------------------------------
alter table public.boot_diagnostics
  drop constraint if exists boot_diagnostics_event_allowed;

alter table public.boot_diagnostics
  add constraint boot_diagnostics_event_allowed
    check (event in (
      'app_open', 'boot_reload', 'profile_retry', 'getsession_slow',
      'ob_welcome', 'ob_install_step', 'ob_install_skip', 'ob_explore',
      'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved',
      'ob_extras_done', 'ob_first_mark'
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
      'ob_extras_done', 'ob_first_mark'
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
      'ob_extras_done', 'ob_first_mark'
    )
    and (user_agent is null or char_length(user_agent) <= 512)
    and (detail is null or pg_column_size(detail) <= 4096)
  );

-- ---- 2) Onboarding terminado, por cuenta ------------------------------------------
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Quien ya tiene nombre pasó por el onboarding (o lo dejó en el paso 3, que es
-- opcional): no se le vuelve a mostrar.
update public.profiles
  set onboarded_at = created_at
  where onboarded_at is null and display_name is not null;

-- ---- 3) Embudo para /admin -------------------------------------------------------
-- Cuenta dispositivos distintos por paso en los últimos `days` días. La identidad
-- es detail.device; si faltara, el usuario o la fila.
create or replace function public.admin_onboarding_funnel(days int default 30)
returns table(step text, devices int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;
  return query
    select s.step, coalesce(c.devices, 0)::int
    from unnest(array[
      'ob_welcome', 'ob_install_step', 'ob_install_skip', 'ob_explore',
      'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved',
      'ob_extras_done', 'ob_first_mark'
    ]) with ordinality as s(step, ord)
    left join (
      select d.event,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text)) as devices
      from boot_diagnostics d
      where d.event like 'ob\_%'
        and d.created_at >= now() - greatest(days, 1) * interval '1 day'
      group by d.event
    ) c on c.event = s.step
    order by s.ord;
end $$;

grant execute on function public.admin_onboarding_funnel(int) to authenticated;
