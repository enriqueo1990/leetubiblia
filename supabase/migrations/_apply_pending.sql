-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Contiene: 0025_profile_locale.sql (idioma de interfaz — si ya la aplicaste,
--             re-correrla no hace daño: es idempotente),
--           0026_prayer_updates.sql (historia del pedido de oración),
--           0027_group_plan.sql (plan común del grupo).
-- Pegá este archivo en el SQL Editor de Supabase y Run. Idempotente.
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
