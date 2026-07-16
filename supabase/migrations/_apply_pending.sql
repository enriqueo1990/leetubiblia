-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Contiene las migraciones recientes 0025..0030; son idempotentes.
-- Pegá este archivo en el SQL Editor de Supabase y Run.
-- Para un deploy desde cero usá _apply_all.sql.
-- ============================================================

-- ===== 0025_profile_locale.sql =====
-- Idioma de la interfaz por usuario (Feature: i18n es/en/pt).
-- La columna es NULLABLE a propósito: null = "el usuario no eligió idioma
-- todavía". Así el cliente puede detectar el idioma del dispositivo
-- (navigator.language) en el primer uso y sembrarlo en el perfil vía
-- ProfilePrefSync, en vez de que un default 'es' pise la detección.
--   - Usuarios NUEVOS: el trigger crea el perfil sin locale → null → el
--     cliente detecta el idioma del celular y lo guarda.
--   - Usuarios EXISTENTES: backfill a 'es' acá abajo, así no se les cambia
--     el idioma de golpe (la app nació en español).
-- Cuando el usuario elige idioma en Ajustes, ese valor manda entre dispositivos.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'locale') then
    create type locale as enum ('es', 'en', 'pt');
  end if;
end $$;

alter table public.profiles
  add column if not exists locale locale;

-- Los usuarios que YA existen se quedan en español (no tocamos su experiencia).
update public.profiles set locale = 'es' where locale is null;

-- ===== 0026_prayer_updates.sql =====
-- ============================================================================
-- Lee Tu Biblia — Actualizaciones en pedidos de oración.
-- Migración 0026. Aplicar DESPUÉS de 0007 (usa el helper can_see_prayer).
--
-- Un pedido hoy tiene solo dos momentos: se crea y se responde. Esta tabla le
-- da historia en el medio — el autor cuenta cómo sigue ("entró a cirugía",
-- "salió bien, falta la biopsia") y el grupo acompaña los pedidos largos sin
-- que se apaguen. Idempotente: se puede reaplicar sin daño.
-- ============================================================================

create table if not exists public.prayer_updates (
  id         bigint generated always as identity primary key,
  prayer_id  bigint not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  body       text   not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists prayer_updates_prayer_idx on public.prayer_updates(prayer_id);

alter table public.prayer_updates enable row level security;

-- Ver: quien puede ver el pedido ve su historia (autor, o miembro del grupo
-- destino si es compartido — mismo criterio que las intercesiones).
drop policy if exists "updates visible" on public.prayer_updates;
create policy "updates visible" on public.prayer_updates
  for select using (public.can_see_prayer(prayer_id));

-- Agregar: solo el AUTOR del pedido, firmando como él mismo.
drop policy if exists "author adds updates" on public.prayer_updates;
create policy "author adds updates" on public.prayer_updates
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.prayer_requests p
      where p.id = prayer_id and p.user_id = auth.uid()
    )
  );

-- Borrar: el autor borra sus propias actualizaciones.
drop policy if exists "author deletes updates" on public.prayer_updates;
create policy "author deletes updates" on public.prayer_updates
  for delete using (user_id = auth.uid());

-- ===== 0027_group_plan.sql =====
-- ============================================================================
-- Lee Tu Biblia — Plan de grupo (leer lo mismo, juntos).
-- Migración 0027. Aplicar DESPUÉS de 0002 (usa is_group_owner).
--
-- El grupo puede adoptar un plan común: el administrador lo elige (arranca ese
-- día como día 1) y cada miembro decide sumarse — su plan activo pasa a ser el
-- del grupo, anclado a la MISMA fecha de inicio, así todos leen lo mismo el
-- mismo día y "3 leyeron hoy" pasa a significar "leímos lo mismo hoy".
-- Sumarse es SIEMPRE decisión del miembro (nada se cambia solo).
--
-- groups.plan_id / plan_start_date: el plan elegido y su día 1 compartido.
-- RPC set_group_plan: solo el owner; con plan null lo quita. La fecha de
-- inicio la manda el cliente (su "hoy" local); si no llega, current_date.
-- Idempotente: se puede reaplicar sin daño.
-- ============================================================================

alter table public.groups
  add column if not exists plan_id bigint references public.reading_plans(id) on delete set null,
  add column if not exists plan_start_date date;

create or replace function public.set_group_plan(
  p_group_id bigint,
  p_plan_id bigint,
  p_start_date date default null
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el administrador puede elegir el plan del grupo';
  end if;

  if p_plan_id is null then
    update public.groups
       set plan_id = null, plan_start_date = null
     where id = p_group_id;
  else
    update public.groups
       set plan_id = p_plan_id,
           plan_start_date = coalesce(p_start_date, current_date)
     where id = p_group_id;
  end if;
end;
$$;
-- ===== 0028_group_plan_follow.sql =====
-- ============================================================================
-- Lee Tu Biblia — Seguir el plan del grupo como lectura adicional.
-- Migración 0028. Aplicar DESPUÉS de 0027 (extiende set_group_plan).
--
-- Sumarse al plan del grupo tenía un solo modo: hacerlo TU plan activo. Pero un
-- pastor puede acompañar 3 grupos (cada uno con su plan) sin resignar su plan
-- personal. Este modo liviano hace que la lectura del grupo aparezca en Hoy
-- como lectura adicional — sin racha ni progreso propio; el día lo dicta el
-- calendario del grupo. Marcarla escribe en reading_progress con el plan_id del
-- grupo, así el pulso "quién leyó hoy" (0017) la cuenta igual.
--
-- group_members.follow_plan: la elección vive en la membresía — se limpia sola
-- al salir del grupo, y si el admin cambia el plan todo deriva del grupo.
-- RPC follow_group_plan: cada miembro prende/apaga SOLO su propia fila (por eso
-- RPC y no una policy de UPDATE, que dejaría tocar role).
-- set_group_plan (reemplazo): al cambiar o quitar el plan, apaga los follow de
-- todos — nada aparece solo en el Hoy de nadie; cada plan nuevo invita de nuevo.
-- Idempotente: se puede reaplicar sin daño.
-- ============================================================================

alter table public.group_members
  add column if not exists follow_plan boolean not null default false;

create or replace function public.follow_group_plan(
  p_group_id bigint,
  p_follow boolean
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  update public.group_members
     set follow_plan = p_follow
   where group_id = p_group_id
     and user_id = auth.uid();
  if not found then
    raise exception 'No sos miembro de este grupo';
  end if;
end;
$$;

create or replace function public.set_group_plan(
  p_group_id bigint,
  p_plan_id bigint,
  p_start_date date default null
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el administrador puede elegir el plan del grupo';
  end if;

  if p_plan_id is null then
    update public.groups
       set plan_id = null, plan_start_date = null
     where id = p_group_id;
  else
    update public.groups
       set plan_id = p_plan_id,
           plan_start_date = coalesce(p_start_date, current_date)
     where id = p_group_id;
  end if;

  -- El plan que seguían ya no es este: cada miembro vuelve a decidir.
  update public.group_members
     set follow_plan = false
   where group_id = p_group_id;
end;
$$;

-- ===== 0029_security_hardening.sql =====
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

-- ===== 0030_reading_completed_on.sql =====
-- ============================================================================
-- Lee Tu Biblia — Fecha local estable para cada lectura.
-- Migración 0030. Aplicar DESPUÉS de 0029.
-- ============================================================================

-- completed_at conserva el instante UTC; completed_on conserva el día local que
-- el usuario marcó. Sin esta segunda columna, cambiar de zona horaria podía mover
-- lecturas históricas y alterar rachas o el pulso semanal.
alter table public.reading_progress
  add column if not exists completed_on date;

update public.reading_progress rp
set completed_on = (rp.completed_at at time zone coalesce(p.timezone, 'UTC'))::date
from public.profiles p
where p.id = rp.user_id
  and rp.completed_on is null;

-- Fallback defensivo para filas huérfanas/imprevistas; normalmente el update
-- anterior cubre todo porque user_id referencia auth.users y profiles es 1:1.
update public.reading_progress
set completed_on = completed_at::date
where completed_on is null;

alter table public.reading_progress
  alter column completed_on set default current_date,
  alter column completed_on set not null;

create index if not exists reading_progress_user_date_idx
  on public.reading_progress(user_id, completed_on);

-- Presencia de hoy: usa el día guardado, no vuelve a reinterpretar el timestamp
-- histórico con la zona horaria actual del miembro.
create or replace function public.group_reading_today(p_group_id bigint)
returns table (user_id uuid, has_read boolean)
language sql security definer stable set search_path = public as $$
  select p.id,
    exists (
      select 1 from public.reading_progress rp
      where rp.user_id = p.id
        and rp.completed_on = (now() at time zone coalesce(p.timezone, 'UTC'))::date
    ) as has_read
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.share_reading = true
    and public.is_group_member(p_group_id)
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;

-- Historial semanal: misma regla estable para los siete días.
create or replace function public.group_reading_week(p_group_id bigint)
returns table (user_id uuid, week boolean[])
language sql security definer stable set search_path = public as $$
  select p.id,
    (
      select array_agg(
        exists (
          select 1 from public.reading_progress rp
          where rp.user_id = p.id
            and rp.completed_on
              = (now() at time zone coalesce(p.timezone, 'UTC'))::date - (6 - d.i)
        )
        order by d.i
      )
      from generate_series(0, 6) as d(i)
    ) as week
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.share_reading = true
    and public.is_group_owner(p_group_id)
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;
