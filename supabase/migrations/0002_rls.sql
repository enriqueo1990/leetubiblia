-- ============================================================================
-- Lee Tu Biblia — Row-Level Security (documento maestro §3 "Reglas RLS")
-- Migración 0002. Aplicar DESPUÉS de 0001.
--
-- Resumen:
--   reading_plans / plan_days : catálogo público de solo lectura.
--   profiles                  : cada quien el suyo.
--   reading_progress          : cada quien el suyo.
--   prayer_requests           : privados solo autor; compartidos visibles al
--                               grupo, pero solo el autor edita/borra.
--   groups / group_members    : visibles a miembros; solo el owner administra.
--
-- Las funciones helper son SECURITY DEFINER para romper la recursión que se da
-- si una policy de group_members consulta group_members (y viceversa con groups).
-- ============================================================================

-- ---- Helpers ---------------------------------------------------------------
create or replace function public.is_group_member(gid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ---- Habilitar RLS ---------------------------------------------------------
alter table public.reading_plans    enable row level security;
alter table public.plan_days        enable row level security;
alter table public.profiles         enable row level security;
alter table public.reading_progress enable row level security;
alter table public.groups           enable row level security;
alter table public.group_members    enable row level security;
alter table public.prayer_requests  enable row level security;

-- ---- reading_plans / plan_days: lectura pública, sin escritura de usuarios --
drop policy if exists "plans readable" on public.reading_plans;
create policy "plans readable" on public.reading_plans
  for select using (true);

drop policy if exists "plan_days readable" on public.plan_days;
create policy "plan_days readable" on public.plan_days
  for select using (true);

-- ---- profiles: cada usuario gestiona su fila -------------------------------
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "own profile delete" on public.profiles;
create policy "own profile delete" on public.profiles
  for delete using (id = auth.uid());

-- ---- reading_progress: solo lo propio --------------------------------------
drop policy if exists "own progress all" on public.reading_progress;
create policy "own progress all" on public.reading_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- groups: visibles a sus miembros; crea cualquiera autenticado ----------
drop policy if exists "groups visible to members" on public.groups;
create policy "groups visible to members" on public.groups
  for select using (public.is_group_member(id) or created_by = auth.uid());

drop policy if exists "groups insert by creator" on public.groups;
create policy "groups insert by creator" on public.groups
  for insert with check (created_by = auth.uid());

drop policy if exists "groups owner update" on public.groups;
create policy "groups owner update" on public.groups
  for update using (public.is_group_owner(id)) with check (public.is_group_owner(id));

drop policy if exists "groups owner delete" on public.groups;
create policy "groups owner delete" on public.groups
  for delete using (public.is_group_owner(id));

-- ---- group_members ---------------------------------------------------------
-- Ver: miembros del mismo grupo se ven entre sí.
drop policy if exists "members visible to group" on public.group_members;
create policy "members visible to group" on public.group_members
  for select using (public.is_group_member(group_id));

-- Unirse: un usuario inserta su propia membresía (validación del código en app).
-- El owner también puede insertar (p.ej. al crear el grupo se agrega a sí mismo).
drop policy if exists "join as self" on public.group_members;
create policy "join as self" on public.group_members
  for insert with check (user_id = auth.uid() or public.is_group_owner(group_id));

-- Salir uno mismo, o el owner quita miembros.
drop policy if exists "leave or owner removes" on public.group_members;
create policy "leave or owner removes" on public.group_members
  for delete using (user_id = auth.uid() or public.is_group_owner(group_id));

-- El owner puede cambiar roles (p.ej. reasignar owner).
drop policy if exists "owner updates members" on public.group_members;
create policy "owner updates members" on public.group_members
  for update using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

-- ---- prayer_requests -------------------------------------------------------
-- Ver: el autor siempre; si es compartido, los miembros del grupo destino.
drop policy if exists "prayers visible" on public.prayer_requests;
create policy "prayers visible" on public.prayer_requests
  for select using (
    user_id = auth.uid()
    or (visibility = 'shared' and public.is_group_member(shared_group_id))
  );

-- Crear: solo a nombre propio.
drop policy if exists "prayers insert own" on public.prayer_requests;
create policy "prayers insert own" on public.prayer_requests
  for insert with check (user_id = auth.uid());

-- Editar / borrar: solo el autor.
drop policy if exists "prayers update own" on public.prayer_requests;
create policy "prayers update own" on public.prayer_requests
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "prayers delete own" on public.prayer_requests;
create policy "prayers delete own" on public.prayer_requests
  for delete using (user_id = auth.uid());
