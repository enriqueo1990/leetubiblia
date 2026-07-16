-- ============================================================================
-- Lee Tu Biblia — Endurecimiento de autorización y telemetría.
-- Migración 0029. Aplicar DESPUÉS de 0028.
-- ============================================================================

-- Las membresías se crean únicamente dentro de las RPC SECURITY DEFINER
-- create_group() y join_group_by_code(). La policy anterior permitía insertar
-- la propia fila con cualquier group_id y hasta role='owner'.
drop policy if exists "join as self" on public.group_members;
revoke insert on table public.group_members from anon, authenticated;

-- Los grupos también se crean únicamente mediante create_group(), que genera el
-- código y la membresía owner en una sola transacción.
revoke insert on table public.groups from anon, authenticated;

-- Cerrar explícitamente las RPC de alta a usuarios autenticados. SECURITY
-- DEFINER conserva los permisos del owner de la función sobre las tablas.
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group_by_code(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;

-- Un pedido compartido solo puede apuntar a un grupo del que el autor forma
-- parte. Se valida tanto al crearlo como al editarlo/cambiar su visibilidad.
drop policy if exists "prayers insert own" on public.prayer_requests;
create policy "prayers insert own" on public.prayer_requests
  for insert with check (
    user_id = auth.uid()
    and (
      visibility = 'private'
      or (
        visibility = 'shared'
        and shared_group_id is not null
        and public.is_group_member(shared_group_id)
      )
    )
  );

drop policy if exists "prayers update own" on public.prayer_requests;
create policy "prayers update own" on public.prayer_requests
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      visibility = 'private'
      or (
        visibility = 'shared'
        and shared_group_id is not null
        and public.is_group_member(shared_group_id)
      )
    )
  );

-- La telemetría sigue aceptando arranques anónimos, pero solo con identidad nula,
-- eventos conocidos y payloads acotados. Así no sirve para falsificar usuarios ni
-- para hacer crecer la tabla con cuerpos arbitrarios.
alter table public.boot_diagnostics
  drop constraint if exists boot_diagnostics_event_allowed,
  drop constraint if exists boot_diagnostics_user_agent_size,
  drop constraint if exists boot_diagnostics_detail_size;

alter table public.boot_diagnostics
  add constraint boot_diagnostics_event_allowed
    check (event in ('app_open', 'boot_reload', 'profile_retry', 'getsession_slow')) not valid,
  add constraint boot_diagnostics_user_agent_size
    check (user_agent is null or char_length(user_agent) <= 512) not valid,
  add constraint boot_diagnostics_detail_size
    check (detail is null or pg_column_size(detail) <= 4096) not valid;

drop policy if exists "anyone can insert boot diagnostics" on public.boot_diagnostics;
drop policy if exists "anonymous boot diagnostics" on public.boot_diagnostics;
drop policy if exists "authenticated boot diagnostics" on public.boot_diagnostics;

create policy "anonymous boot diagnostics" on public.boot_diagnostics
  for insert to anon with check (
    user_id is null
    and event in ('app_open', 'boot_reload', 'profile_retry', 'getsession_slow')
    and (user_agent is null or char_length(user_agent) <= 512)
    and (detail is null or pg_column_size(detail) <= 4096)
  );

create policy "authenticated boot diagnostics" on public.boot_diagnostics
  for insert to authenticated with check (
    (user_id is null or user_id = auth.uid())
    and event in ('app_open', 'boot_reload', 'profile_retry', 'getsession_slow')
    and (user_agent is null or char_length(user_agent) <= 512)
    and (detail is null or pg_column_size(detail) <= 4096)
  );
