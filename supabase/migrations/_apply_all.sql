-- ============================================================
-- Lee Tu Biblia — APLICAR TODO (todas las migraciones, en orden).
-- GENERADO por scripts/bundle-migrations.mjs — no editar a mano.
-- Pegá este archivo COMPLETO en el SQL Editor de Supabase y Run.
-- Idempotente: se puede reejecutar sin romper nada.
--
-- Para que el push (0013) entregue, una sola vez con valores reales:
--   select vault.create_secret('https://<TU_PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');
-- y desplegar las Edge Functions send-reminders y notify-group-prayer.
-- ============================================================

-- ===== 0001_schema.sql =====
-- ============================================================================
-- Lee Tu Biblia — Esquema (documento maestro §3)
-- Migración 0001: tipos, tablas, índices, triggers.
-- Aplicar en el SQL Editor de Supabase (o vía CLI). Idempotente donde se puede.
-- ============================================================================

-- ---- Tipos enumerados ------------------------------------------------------
do $$ begin
  create type accent_color as enum
    ('sepia_base','sepia_clay','sepia_olive','sepia_stone','sepia_rose','sepia_slate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_pref as enum ('auto','light','dark');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prayer_visibility as enum ('private','shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prayer_status as enum ('active','answered');
exception when duplicate_object then null; end $$;

-- ---- reading_plans (catálogo curado, no editable por el usuario) ------------
create table if not exists public.reading_plans (
  id            bigint generated always as identity primary key,
  slug          text unique not null,
  name          text not null,
  description   text,
  duration_days integer not null check (duration_days > 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---- plan_days (qué se lee cada día de cada plan) --------------------------
-- references: jsonb estructurado. Array de items:
--   { "label": "...", "book_usfm": "JER", "chapter": 33, "chapter_end": 34? }
-- El parsing español→USFM se hace UNA vez al sembrar, no en runtime.
create table if not exists public.plan_days (
  id          bigint generated always as identity primary key,
  plan_id     bigint not null references public.reading_plans(id) on delete cascade,
  day_number  integer not null check (day_number >= 1),
  refs        jsonb not null,
  unique (plan_id, day_number)
);
create index if not exists plan_days_plan_idx on public.plan_days(plan_id, day_number);

-- ---- profiles (1:1 con auth.users) ----------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  accent_color     accent_color not null default 'sepia_base',
  theme_pref       theme_pref   not null default 'auto',
  reminder_enabled boolean      not null default false,
  reminder_time    time,
  active_plan_id   bigint references public.reading_plans(id) on delete set null,
  plan_start_date  date,
  created_at       timestamptz  not null default now()
);

-- ---- reading_progress (qué marcó cada usuario) ----------------------------
create table if not exists public.reading_progress (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan_id      bigint not null references public.reading_plans(id) on delete cascade,
  day_number   integer not null check (day_number >= 1),
  completed_at timestamptz not null default now(),
  unique (user_id, plan_id, day_number)
);
create index if not exists reading_progress_user_idx on public.reading_progress(user_id, plan_id);

-- ---- groups (cerrados, entrada por código) --------------------------------
create table if not exists public.groups (
  id          bigint generated always as identity primary key,
  name        text not null,
  invite_code text unique not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---- group_members --------------------------------------------------------
create table if not exists public.group_members (
  id        bigint generated always as identity primary key,
  group_id  bigint not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);
create index if not exists group_members_group_idx on public.group_members(group_id);

-- ---- prayer_requests ------------------------------------------------------
create table if not exists public.prayer_requests (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  description     text,
  visibility      prayer_visibility not null default 'private',
  shared_group_id bigint references public.groups(id) on delete cascade,
  status          prayer_status not null default 'active',
  created_at      timestamptz not null default now(),
  answered_at     timestamptz,
  -- Si es compartido, el grupo es obligatorio; si es privado, debe ir nulo.
  constraint shared_requires_group check (
    (visibility = 'shared' and shared_group_id is not null) or
    (visibility = 'private' and shared_group_id is null)
  )
);
create index if not exists prayer_user_idx  on public.prayer_requests(user_id);
create index if not exists prayer_group_idx on public.prayer_requests(shared_group_id);

-- ---- Crear profile automáticamente al registrarse -------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 0002_rls.sql =====
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

-- ===== 0003_seed_plans.sql =====
-- ====================================================================
-- Lee Tu Biblia — Seed de planes (GENERADO por scripts/seed.mjs)
-- No editar a mano. Regenerar con: node scripts/seed.mjs
-- ====================================================================

-- ---- Plan: M'Cheyne (365 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('mcheyne', 'M''Cheyne', 'Toda la Biblia en un año, cuatro pasajes por día.', 365, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'mcheyne');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Génesis 1","book_usfm":"GEN","chapter":1},{"label":"Mateo 1","book_usfm":"MAT","chapter":1},{"label":"Esdras 1","book_usfm":"EZR","chapter":1},{"label":"Hechos 1","book_usfm":"ACT","chapter":1}]'::jsonb),
  (2, '[{"label":"Génesis 2","book_usfm":"GEN","chapter":2},{"label":"Mateo 2","book_usfm":"MAT","chapter":2},{"label":"Esdras 2","book_usfm":"EZR","chapter":2},{"label":"Hechos 2","book_usfm":"ACT","chapter":2}]'::jsonb),
  (3, '[{"label":"Génesis 3","book_usfm":"GEN","chapter":3},{"label":"Mateo 3","book_usfm":"MAT","chapter":3},{"label":"Esdras 3","book_usfm":"EZR","chapter":3},{"label":"Hechos 3","book_usfm":"ACT","chapter":3}]'::jsonb),
  (4, '[{"label":"Génesis 4","book_usfm":"GEN","chapter":4},{"label":"Mateo 4","book_usfm":"MAT","chapter":4},{"label":"Esdras 4","book_usfm":"EZR","chapter":4},{"label":"Hechos 4","book_usfm":"ACT","chapter":4}]'::jsonb),
  (5, '[{"label":"Génesis 5","book_usfm":"GEN","chapter":5},{"label":"Mateo 5","book_usfm":"MAT","chapter":5},{"label":"Esdras 5","book_usfm":"EZR","chapter":5},{"label":"Hechos 5","book_usfm":"ACT","chapter":5}]'::jsonb),
  (6, '[{"label":"Génesis 6","book_usfm":"GEN","chapter":6},{"label":"Mateo 6","book_usfm":"MAT","chapter":6},{"label":"Esdras 6","book_usfm":"EZR","chapter":6},{"label":"Hechos 6","book_usfm":"ACT","chapter":6}]'::jsonb),
  (7, '[{"label":"Génesis 7","book_usfm":"GEN","chapter":7},{"label":"Mateo 7","book_usfm":"MAT","chapter":7},{"label":"Esdras 7","book_usfm":"EZR","chapter":7},{"label":"Hechos 7","book_usfm":"ACT","chapter":7}]'::jsonb),
  (8, '[{"label":"Génesis 8","book_usfm":"GEN","chapter":8},{"label":"Mateo 8","book_usfm":"MAT","chapter":8},{"label":"Esdras 8","book_usfm":"EZR","chapter":8},{"label":"Hechos 8","book_usfm":"ACT","chapter":8}]'::jsonb),
  (9, '[{"label":"Génesis 9-10","book_usfm":"GEN","chapter":9,"chapter_end":10},{"label":"Mateo 9","book_usfm":"MAT","chapter":9},{"label":"Esdras 9","book_usfm":"EZR","chapter":9},{"label":"Hechos 9","book_usfm":"ACT","chapter":9}]'::jsonb),
  (10, '[{"label":"Génesis 11","book_usfm":"GEN","chapter":11},{"label":"Mateo 10","book_usfm":"MAT","chapter":10},{"label":"Esdras 10","book_usfm":"EZR","chapter":10},{"label":"Hechos 10","book_usfm":"ACT","chapter":10}]'::jsonb),
  (11, '[{"label":"Génesis 12","book_usfm":"GEN","chapter":12},{"label":"Mateo 11","book_usfm":"MAT","chapter":11},{"label":"Nehemías 1","book_usfm":"NEH","chapter":1},{"label":"Hechos 11","book_usfm":"ACT","chapter":11}]'::jsonb),
  (12, '[{"label":"Génesis 13","book_usfm":"GEN","chapter":13},{"label":"Mateo 12","book_usfm":"MAT","chapter":12},{"label":"Nehemías 2","book_usfm":"NEH","chapter":2},{"label":"Hechos 12","book_usfm":"ACT","chapter":12}]'::jsonb),
  (13, '[{"label":"Génesis 14","book_usfm":"GEN","chapter":14},{"label":"Mateo 13","book_usfm":"MAT","chapter":13},{"label":"Nehemías 3","book_usfm":"NEH","chapter":3},{"label":"Hechos 13","book_usfm":"ACT","chapter":13}]'::jsonb),
  (14, '[{"label":"Génesis 15","book_usfm":"GEN","chapter":15},{"label":"Mateo 14","book_usfm":"MAT","chapter":14},{"label":"Nehemías 4","book_usfm":"NEH","chapter":4},{"label":"Hechos 14","book_usfm":"ACT","chapter":14}]'::jsonb),
  (15, '[{"label":"Génesis 16","book_usfm":"GEN","chapter":16},{"label":"Mateo 15","book_usfm":"MAT","chapter":15},{"label":"Nehemías 5","book_usfm":"NEH","chapter":5},{"label":"Hechos 15","book_usfm":"ACT","chapter":15}]'::jsonb),
  (16, '[{"label":"Génesis 17","book_usfm":"GEN","chapter":17},{"label":"Mateo 16","book_usfm":"MAT","chapter":16},{"label":"Nehemías 6","book_usfm":"NEH","chapter":6},{"label":"Hechos 16","book_usfm":"ACT","chapter":16}]'::jsonb),
  (17, '[{"label":"Génesis 18","book_usfm":"GEN","chapter":18},{"label":"Mateo 17","book_usfm":"MAT","chapter":17},{"label":"Nehemías 7","book_usfm":"NEH","chapter":7},{"label":"Hechos 17","book_usfm":"ACT","chapter":17}]'::jsonb),
  (18, '[{"label":"Génesis 19","book_usfm":"GEN","chapter":19},{"label":"Mateo 18","book_usfm":"MAT","chapter":18},{"label":"Nehemías 8","book_usfm":"NEH","chapter":8},{"label":"Hechos 18","book_usfm":"ACT","chapter":18}]'::jsonb),
  (19, '[{"label":"Génesis 20","book_usfm":"GEN","chapter":20},{"label":"Mateo 19","book_usfm":"MAT","chapter":19},{"label":"Nehemías 9","book_usfm":"NEH","chapter":9},{"label":"Hechos 19","book_usfm":"ACT","chapter":19}]'::jsonb),
  (20, '[{"label":"Génesis 21","book_usfm":"GEN","chapter":21},{"label":"Mateo 20","book_usfm":"MAT","chapter":20},{"label":"Nehemías 10","book_usfm":"NEH","chapter":10},{"label":"Hechos 20","book_usfm":"ACT","chapter":20}]'::jsonb),
  (21, '[{"label":"Génesis 22","book_usfm":"GEN","chapter":22},{"label":"Mateo 21","book_usfm":"MAT","chapter":21},{"label":"Nehemías 11","book_usfm":"NEH","chapter":11},{"label":"Hechos 21","book_usfm":"ACT","chapter":21}]'::jsonb),
  (22, '[{"label":"Génesis 23","book_usfm":"GEN","chapter":23},{"label":"Mateo 22","book_usfm":"MAT","chapter":22},{"label":"Nehemías 12","book_usfm":"NEH","chapter":12},{"label":"Hechos 22","book_usfm":"ACT","chapter":22}]'::jsonb),
  (23, '[{"label":"Génesis 24","book_usfm":"GEN","chapter":24},{"label":"Mateo 23","book_usfm":"MAT","chapter":23},{"label":"Nehemías 13","book_usfm":"NEH","chapter":13},{"label":"Hechos 23","book_usfm":"ACT","chapter":23}]'::jsonb),
  (24, '[{"label":"Génesis 25","book_usfm":"GEN","chapter":25},{"label":"Mateo 24","book_usfm":"MAT","chapter":24},{"label":"Ester 1","book_usfm":"EST","chapter":1},{"label":"Hechos 24","book_usfm":"ACT","chapter":24}]'::jsonb),
  (25, '[{"label":"Génesis 26","book_usfm":"GEN","chapter":26},{"label":"Mateo 25","book_usfm":"MAT","chapter":25},{"label":"Ester 2","book_usfm":"EST","chapter":2},{"label":"Hechos 25","book_usfm":"ACT","chapter":25}]'::jsonb),
  (26, '[{"label":"Génesis 27","book_usfm":"GEN","chapter":27},{"label":"Mateo 26","book_usfm":"MAT","chapter":26},{"label":"Ester 3","book_usfm":"EST","chapter":3},{"label":"Hechos 26","book_usfm":"ACT","chapter":26}]'::jsonb),
  (27, '[{"label":"Génesis 28","book_usfm":"GEN","chapter":28},{"label":"Mateo 27","book_usfm":"MAT","chapter":27},{"label":"Ester 4","book_usfm":"EST","chapter":4},{"label":"Hechos 27","book_usfm":"ACT","chapter":27}]'::jsonb),
  (28, '[{"label":"Génesis 29","book_usfm":"GEN","chapter":29},{"label":"Mateo 28","book_usfm":"MAT","chapter":28},{"label":"Ester 5","book_usfm":"EST","chapter":5},{"label":"Hechos 28","book_usfm":"ACT","chapter":28}]'::jsonb),
  (29, '[{"label":"Génesis 30","book_usfm":"GEN","chapter":30},{"label":"Marcos 1","book_usfm":"MRK","chapter":1},{"label":"Ester 6","book_usfm":"EST","chapter":6},{"label":"Romanos 1","book_usfm":"ROM","chapter":1}]'::jsonb),
  (30, '[{"label":"Génesis 31","book_usfm":"GEN","chapter":31},{"label":"Marcos 2","book_usfm":"MRK","chapter":2},{"label":"Ester 7","book_usfm":"EST","chapter":7},{"label":"Romanos 2","book_usfm":"ROM","chapter":2}]'::jsonb),
  (31, '[{"label":"Génesis 32","book_usfm":"GEN","chapter":32},{"label":"Marcos 3","book_usfm":"MRK","chapter":3},{"label":"Ester 8","book_usfm":"EST","chapter":8},{"label":"Romanos 3","book_usfm":"ROM","chapter":3}]'::jsonb),
  (32, '[{"label":"Génesis 33","book_usfm":"GEN","chapter":33},{"label":"Marcos 4","book_usfm":"MRK","chapter":4},{"label":"Ester 9-10","book_usfm":"EST","chapter":9,"chapter_end":10},{"label":"Romanos 4","book_usfm":"ROM","chapter":4}]'::jsonb),
  (33, '[{"label":"Génesis 34","book_usfm":"GEN","chapter":34},{"label":"Marcos 5","book_usfm":"MRK","chapter":5},{"label":"Job 1","book_usfm":"JOB","chapter":1},{"label":"Romanos 5","book_usfm":"ROM","chapter":5}]'::jsonb),
  (34, '[{"label":"Génesis 35-36","book_usfm":"GEN","chapter":35,"chapter_end":36},{"label":"Marcos 6","book_usfm":"MRK","chapter":6},{"label":"Job 2","book_usfm":"JOB","chapter":2},{"label":"Romanos 6","book_usfm":"ROM","chapter":6}]'::jsonb),
  (35, '[{"label":"Génesis 37","book_usfm":"GEN","chapter":37},{"label":"Marcos 7","book_usfm":"MRK","chapter":7},{"label":"Job 3","book_usfm":"JOB","chapter":3},{"label":"Romanos 7","book_usfm":"ROM","chapter":7}]'::jsonb),
  (36, '[{"label":"Génesis 38","book_usfm":"GEN","chapter":38},{"label":"Marcos 8","book_usfm":"MRK","chapter":8},{"label":"Job 4","book_usfm":"JOB","chapter":4},{"label":"Romanos 8","book_usfm":"ROM","chapter":8}]'::jsonb),
  (37, '[{"label":"Génesis 39","book_usfm":"GEN","chapter":39},{"label":"Marcos 9","book_usfm":"MRK","chapter":9},{"label":"Job 5","book_usfm":"JOB","chapter":5},{"label":"Romanos 9","book_usfm":"ROM","chapter":9}]'::jsonb),
  (38, '[{"label":"Génesis 40","book_usfm":"GEN","chapter":40},{"label":"Marcos 10","book_usfm":"MRK","chapter":10},{"label":"Job 6","book_usfm":"JOB","chapter":6},{"label":"Romanos 10","book_usfm":"ROM","chapter":10}]'::jsonb),
  (39, '[{"label":"Génesis 41","book_usfm":"GEN","chapter":41},{"label":"Marcos 11","book_usfm":"MRK","chapter":11},{"label":"Job 7","book_usfm":"JOB","chapter":7},{"label":"Romanos 11","book_usfm":"ROM","chapter":11}]'::jsonb),
  (40, '[{"label":"Génesis 42","book_usfm":"GEN","chapter":42},{"label":"Marcos 12","book_usfm":"MRK","chapter":12},{"label":"Job 8","book_usfm":"JOB","chapter":8},{"label":"Romanos 12","book_usfm":"ROM","chapter":12}]'::jsonb),
  (41, '[{"label":"Génesis 43","book_usfm":"GEN","chapter":43},{"label":"Marcos 13","book_usfm":"MRK","chapter":13},{"label":"Job 9","book_usfm":"JOB","chapter":9},{"label":"Romanos 13","book_usfm":"ROM","chapter":13}]'::jsonb),
  (42, '[{"label":"Génesis 44","book_usfm":"GEN","chapter":44},{"label":"Marcos 14","book_usfm":"MRK","chapter":14},{"label":"Job 10","book_usfm":"JOB","chapter":10},{"label":"Romanos 14","book_usfm":"ROM","chapter":14}]'::jsonb),
  (43, '[{"label":"Génesis 45","book_usfm":"GEN","chapter":45},{"label":"Marcos 15","book_usfm":"MRK","chapter":15},{"label":"Job 11","book_usfm":"JOB","chapter":11},{"label":"Romanos 15","book_usfm":"ROM","chapter":15}]'::jsonb),
  (44, '[{"label":"Génesis 46","book_usfm":"GEN","chapter":46},{"label":"Marcos 16","book_usfm":"MRK","chapter":16},{"label":"Job 12","book_usfm":"JOB","chapter":12},{"label":"Romanos 16","book_usfm":"ROM","chapter":16}]'::jsonb),
  (45, '[{"label":"Génesis 47","book_usfm":"GEN","chapter":47},{"label":"Lucas 1:1-38","book_usfm":"LUK","chapter":1},{"label":"Job 13","book_usfm":"JOB","chapter":13},{"label":"1 Corintios 1","book_usfm":"1CO","chapter":1}]'::jsonb),
  (46, '[{"label":"Génesis 48","book_usfm":"GEN","chapter":48},{"label":"Lucas 1:39-80","book_usfm":"LUK","chapter":1},{"label":"Job 14","book_usfm":"JOB","chapter":14},{"label":"1 Corintios 2","book_usfm":"1CO","chapter":2}]'::jsonb),
  (47, '[{"label":"Génesis 49","book_usfm":"GEN","chapter":49},{"label":"Lucas 2","book_usfm":"LUK","chapter":2},{"label":"Job 15","book_usfm":"JOB","chapter":15},{"label":"1 Corintios 3","book_usfm":"1CO","chapter":3}]'::jsonb),
  (48, '[{"label":"Génesis 50","book_usfm":"GEN","chapter":50},{"label":"Lucas 3","book_usfm":"LUK","chapter":3},{"label":"Job 16-17","book_usfm":"JOB","chapter":16,"chapter_end":17},{"label":"1 Corintios 4","book_usfm":"1CO","chapter":4}]'::jsonb),
  (49, '[{"label":"Éxodo 1","book_usfm":"EXO","chapter":1},{"label":"Lucas 4","book_usfm":"LUK","chapter":4},{"label":"Job 18","book_usfm":"JOB","chapter":18},{"label":"1 Corintios 5","book_usfm":"1CO","chapter":5}]'::jsonb),
  (50, '[{"label":"Éxodo 2","book_usfm":"EXO","chapter":2},{"label":"Lucas 5","book_usfm":"LUK","chapter":5},{"label":"Job 19","book_usfm":"JOB","chapter":19},{"label":"1 Corintios 6","book_usfm":"1CO","chapter":6}]'::jsonb),
  (51, '[{"label":"Éxodo 3","book_usfm":"EXO","chapter":3},{"label":"Lucas 6","book_usfm":"LUK","chapter":6},{"label":"Job 20","book_usfm":"JOB","chapter":20},{"label":"1 Corintios 7","book_usfm":"1CO","chapter":7}]'::jsonb),
  (52, '[{"label":"Éxodo 4","book_usfm":"EXO","chapter":4},{"label":"Lucas 7","book_usfm":"LUK","chapter":7},{"label":"Job 21","book_usfm":"JOB","chapter":21},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8}]'::jsonb),
  (53, '[{"label":"Éxodo 5","book_usfm":"EXO","chapter":5},{"label":"Lucas 8","book_usfm":"LUK","chapter":8},{"label":"Job 22","book_usfm":"JOB","chapter":22},{"label":"1 Corintios 9","book_usfm":"1CO","chapter":9}]'::jsonb),
  (54, '[{"label":"Éxodo 6","book_usfm":"EXO","chapter":6},{"label":"Lucas 9","book_usfm":"LUK","chapter":9},{"label":"Job 23","book_usfm":"JOB","chapter":23},{"label":"1 Corintios 10","book_usfm":"1CO","chapter":10}]'::jsonb),
  (55, '[{"label":"Éxodo 7","book_usfm":"EXO","chapter":7},{"label":"Lucas 10","book_usfm":"LUK","chapter":10},{"label":"Job 24","book_usfm":"JOB","chapter":24},{"label":"1 Corintios 11","book_usfm":"1CO","chapter":11}]'::jsonb),
  (56, '[{"label":"Éxodo 8","book_usfm":"EXO","chapter":8},{"label":"Lucas 11","book_usfm":"LUK","chapter":11},{"label":"Job 25-26","book_usfm":"JOB","chapter":25,"chapter_end":26},{"label":"1 Corintios 12","book_usfm":"1CO","chapter":12}]'::jsonb),
  (57, '[{"label":"Éxodo 9","book_usfm":"EXO","chapter":9},{"label":"Lucas 12","book_usfm":"LUK","chapter":12},{"label":"Job 27","book_usfm":"JOB","chapter":27},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13}]'::jsonb),
  (58, '[{"label":"Éxodo 10","book_usfm":"EXO","chapter":10},{"label":"Lucas 13","book_usfm":"LUK","chapter":13},{"label":"Job 28","book_usfm":"JOB","chapter":28},{"label":"1 Corintios 14","book_usfm":"1CO","chapter":14}]'::jsonb),
  (59, '[{"label":"Éxodo 11:1-12:20","book_usfm":"EXO","chapter":11,"chapter_end":12},{"label":"Lucas 14","book_usfm":"LUK","chapter":14},{"label":"Job 29","book_usfm":"JOB","chapter":29},{"label":"1 Corintios 15","book_usfm":"1CO","chapter":15}]'::jsonb),
  (60, '[{"label":"Éxodo 12:21-50","book_usfm":"EXO","chapter":12},{"label":"Lucas 15","book_usfm":"LUK","chapter":15},{"label":"Job 30","book_usfm":"JOB","chapter":30},{"label":"1 Corintios 16","book_usfm":"1CO","chapter":16}]'::jsonb),
  (61, '[{"label":"Éxodo 13","book_usfm":"EXO","chapter":13},{"label":"Lucas 16","book_usfm":"LUK","chapter":16},{"label":"Job 31","book_usfm":"JOB","chapter":31},{"label":"2 Corintios 1","book_usfm":"2CO","chapter":1}]'::jsonb),
  (62, '[{"label":"Éxodo 14","book_usfm":"EXO","chapter":14},{"label":"Lucas 17","book_usfm":"LUK","chapter":17},{"label":"Job 32","book_usfm":"JOB","chapter":32},{"label":"2 Corintios 2","book_usfm":"2CO","chapter":2}]'::jsonb),
  (63, '[{"label":"Éxodo 15","book_usfm":"EXO","chapter":15},{"label":"Lucas 18","book_usfm":"LUK","chapter":18},{"label":"Job 33","book_usfm":"JOB","chapter":33},{"label":"2 Corintios 3","book_usfm":"2CO","chapter":3}]'::jsonb),
  (64, '[{"label":"Éxodo 16","book_usfm":"EXO","chapter":16},{"label":"Lucas 19","book_usfm":"LUK","chapter":19},{"label":"Job 34","book_usfm":"JOB","chapter":34},{"label":"2 Corintios 4","book_usfm":"2CO","chapter":4}]'::jsonb),
  (65, '[{"label":"Éxodo 17","book_usfm":"EXO","chapter":17},{"label":"Lucas 20","book_usfm":"LUK","chapter":20},{"label":"Job 35","book_usfm":"JOB","chapter":35},{"label":"2 Corintios 5","book_usfm":"2CO","chapter":5}]'::jsonb),
  (66, '[{"label":"Éxodo 18","book_usfm":"EXO","chapter":18},{"label":"Lucas 21","book_usfm":"LUK","chapter":21},{"label":"Job 36","book_usfm":"JOB","chapter":36},{"label":"2 Corintios 6","book_usfm":"2CO","chapter":6}]'::jsonb),
  (67, '[{"label":"Éxodo 19","book_usfm":"EXO","chapter":19},{"label":"Lucas 22","book_usfm":"LUK","chapter":22},{"label":"Job 37","book_usfm":"JOB","chapter":37},{"label":"2 Corintios 7","book_usfm":"2CO","chapter":7}]'::jsonb),
  (68, '[{"label":"Éxodo 20","book_usfm":"EXO","chapter":20},{"label":"Lucas 23","book_usfm":"LUK","chapter":23},{"label":"Job 38","book_usfm":"JOB","chapter":38},{"label":"2 Corintios 8","book_usfm":"2CO","chapter":8}]'::jsonb),
  (69, '[{"label":"Éxodo 21","book_usfm":"EXO","chapter":21},{"label":"Lucas 24","book_usfm":"LUK","chapter":24},{"label":"Job 39","book_usfm":"JOB","chapter":39},{"label":"2 Corintios 9","book_usfm":"2CO","chapter":9}]'::jsonb),
  (70, '[{"label":"Éxodo 22","book_usfm":"EXO","chapter":22},{"label":"Juan 1","book_usfm":"JHN","chapter":1},{"label":"Job 40","book_usfm":"JOB","chapter":40},{"label":"2 Corintios 10","book_usfm":"2CO","chapter":10}]'::jsonb),
  (71, '[{"label":"Éxodo 23","book_usfm":"EXO","chapter":23},{"label":"Juan 2","book_usfm":"JHN","chapter":2},{"label":"Job 41","book_usfm":"JOB","chapter":41},{"label":"2 Corintios 11","book_usfm":"2CO","chapter":11}]'::jsonb),
  (72, '[{"label":"Éxodo 24","book_usfm":"EXO","chapter":24},{"label":"Juan 3","book_usfm":"JHN","chapter":3},{"label":"Job 42","book_usfm":"JOB","chapter":42},{"label":"2 Corintios 12","book_usfm":"2CO","chapter":12}]'::jsonb),
  (73, '[{"label":"Éxodo 25","book_usfm":"EXO","chapter":25},{"label":"Juan 4","book_usfm":"JHN","chapter":4},{"label":"Proverbios 1","book_usfm":"PRO","chapter":1},{"label":"2 Corintios 13","book_usfm":"2CO","chapter":13}]'::jsonb),
  (74, '[{"label":"Éxodo 26","book_usfm":"EXO","chapter":26},{"label":"Juan 5","book_usfm":"JHN","chapter":5},{"label":"Proverbios 2","book_usfm":"PRO","chapter":2},{"label":"Gálatas 1","book_usfm":"GAL","chapter":1}]'::jsonb),
  (75, '[{"label":"Éxodo 27","book_usfm":"EXO","chapter":27},{"label":"Juan 6","book_usfm":"JHN","chapter":6},{"label":"Proverbios 3","book_usfm":"PRO","chapter":3},{"label":"Gálatas 2","book_usfm":"GAL","chapter":2}]'::jsonb),
  (76, '[{"label":"Éxodo 28","book_usfm":"EXO","chapter":28},{"label":"Juan 7","book_usfm":"JHN","chapter":7},{"label":"Proverbios 4","book_usfm":"PRO","chapter":4},{"label":"Gálatas 3","book_usfm":"GAL","chapter":3}]'::jsonb),
  (77, '[{"label":"Éxodo 29","book_usfm":"EXO","chapter":29},{"label":"Juan 8","book_usfm":"JHN","chapter":8},{"label":"Proverbios 5","book_usfm":"PRO","chapter":5},{"label":"Gálatas 4","book_usfm":"GAL","chapter":4}]'::jsonb),
  (78, '[{"label":"Éxodo 30","book_usfm":"EXO","chapter":30},{"label":"Juan 9","book_usfm":"JHN","chapter":9},{"label":"Proverbios 6","book_usfm":"PRO","chapter":6},{"label":"Gálatas 5","book_usfm":"GAL","chapter":5}]'::jsonb),
  (79, '[{"label":"Éxodo 31","book_usfm":"EXO","chapter":31},{"label":"Juan 10","book_usfm":"JHN","chapter":10},{"label":"Proverbios 7","book_usfm":"PRO","chapter":7},{"label":"Gálatas 6","book_usfm":"GAL","chapter":6}]'::jsonb),
  (80, '[{"label":"Éxodo 32","book_usfm":"EXO","chapter":32},{"label":"Juan 11","book_usfm":"JHN","chapter":11},{"label":"Proverbios 8","book_usfm":"PRO","chapter":8},{"label":"Efesios 1","book_usfm":"EPH","chapter":1}]'::jsonb),
  (81, '[{"label":"Éxodo 33","book_usfm":"EXO","chapter":33},{"label":"Juan 12","book_usfm":"JHN","chapter":12},{"label":"Proverbios 9","book_usfm":"PRO","chapter":9},{"label":"Efesios 2","book_usfm":"EPH","chapter":2}]'::jsonb),
  (82, '[{"label":"Éxodo 34","book_usfm":"EXO","chapter":34},{"label":"Juan 13","book_usfm":"JHN","chapter":13},{"label":"Proverbios 10","book_usfm":"PRO","chapter":10},{"label":"Efesios 3","book_usfm":"EPH","chapter":3}]'::jsonb),
  (83, '[{"label":"Éxodo 35","book_usfm":"EXO","chapter":35},{"label":"Juan 14","book_usfm":"JHN","chapter":14},{"label":"Proverbios 11","book_usfm":"PRO","chapter":11},{"label":"Efesios 4","book_usfm":"EPH","chapter":4}]'::jsonb),
  (84, '[{"label":"Éxodo 36","book_usfm":"EXO","chapter":36},{"label":"Juan 15","book_usfm":"JHN","chapter":15},{"label":"Proverbios 12","book_usfm":"PRO","chapter":12},{"label":"Efesios 5","book_usfm":"EPH","chapter":5}]'::jsonb),
  (85, '[{"label":"Éxodo 37","book_usfm":"EXO","chapter":37},{"label":"Juan 16","book_usfm":"JHN","chapter":16},{"label":"Proverbios 13","book_usfm":"PRO","chapter":13},{"label":"Efesios 6","book_usfm":"EPH","chapter":6}]'::jsonb),
  (86, '[{"label":"Éxodo 38","book_usfm":"EXO","chapter":38},{"label":"Juan 17","book_usfm":"JHN","chapter":17},{"label":"Proverbios 14","book_usfm":"PRO","chapter":14},{"label":"Filipenses 1","book_usfm":"PHP","chapter":1}]'::jsonb),
  (87, '[{"label":"Éxodo 39","book_usfm":"EXO","chapter":39},{"label":"Juan 18","book_usfm":"JHN","chapter":18},{"label":"Proverbios 15","book_usfm":"PRO","chapter":15},{"label":"Filipenses 2","book_usfm":"PHP","chapter":2}]'::jsonb),
  (88, '[{"label":"Éxodo 40","book_usfm":"EXO","chapter":40},{"label":"Juan 19","book_usfm":"JHN","chapter":19},{"label":"Proverbios 16","book_usfm":"PRO","chapter":16},{"label":"Filipenses 3","book_usfm":"PHP","chapter":3}]'::jsonb),
  (89, '[{"label":"Levítico 1","book_usfm":"LEV","chapter":1},{"label":"Juan 20","book_usfm":"JHN","chapter":20},{"label":"Proverbios 17","book_usfm":"PRO","chapter":17},{"label":"Filipenses 4","book_usfm":"PHP","chapter":4}]'::jsonb),
  (90, '[{"label":"Levítico 2-3","book_usfm":"LEV","chapter":2,"chapter_end":3},{"label":"Juan 21","book_usfm":"JHN","chapter":21},{"label":"Proverbios 18","book_usfm":"PRO","chapter":18},{"label":"Colosenses 1","book_usfm":"COL","chapter":1}]'::jsonb),
  (91, '[{"label":"Levítico 4","book_usfm":"LEV","chapter":4},{"label":"Salmos 1-2","book_usfm":"PSA","chapter":1,"chapter_end":2},{"label":"Proverbios 19","book_usfm":"PRO","chapter":19},{"label":"Colosenses 2","book_usfm":"COL","chapter":2}]'::jsonb),
  (92, '[{"label":"Levítico 5","book_usfm":"LEV","chapter":5},{"label":"Salmos 3-4","book_usfm":"PSA","chapter":3,"chapter_end":4},{"label":"Proverbios 20","book_usfm":"PRO","chapter":20},{"label":"Colosenses 3","book_usfm":"COL","chapter":3}]'::jsonb),
  (93, '[{"label":"Levítico 6","book_usfm":"LEV","chapter":6},{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Proverbios 21","book_usfm":"PRO","chapter":21},{"label":"Colosenses 4","book_usfm":"COL","chapter":4}]'::jsonb),
  (94, '[{"label":"Levítico 7","book_usfm":"LEV","chapter":7},{"label":"Salmos 7-8","book_usfm":"PSA","chapter":7,"chapter_end":8},{"label":"Proverbios 22","book_usfm":"PRO","chapter":22},{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1}]'::jsonb),
  (95, '[{"label":"Levítico 8","book_usfm":"LEV","chapter":8},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Proverbios 23","book_usfm":"PRO","chapter":23},{"label":"1 Tesalonicenses 2","book_usfm":"1TH","chapter":2}]'::jsonb),
  (96, '[{"label":"Levítico 9","book_usfm":"LEV","chapter":9},{"label":"Salmos 10","book_usfm":"PSA","chapter":10},{"label":"Proverbios 24","book_usfm":"PRO","chapter":24},{"label":"1 Tesalonicenses 3","book_usfm":"1TH","chapter":3}]'::jsonb),
  (97, '[{"label":"Levítico 10","book_usfm":"LEV","chapter":10},{"label":"Salmos 11-12","book_usfm":"PSA","chapter":11,"chapter_end":12},{"label":"Proverbios 25","book_usfm":"PRO","chapter":25},{"label":"1 Tesalonicenses 4","book_usfm":"1TH","chapter":4}]'::jsonb),
  (98, '[{"label":"Levítico 11-12","book_usfm":"LEV","chapter":11,"chapter_end":12},{"label":"Salmos 13-14","book_usfm":"PSA","chapter":13,"chapter_end":14},{"label":"Proverbios 26","book_usfm":"PRO","chapter":26},{"label":"1 Tesalonicenses 5","book_usfm":"1TH","chapter":5}]'::jsonb),
  (99, '[{"label":"Levítico 13","book_usfm":"LEV","chapter":13},{"label":"Salmos 15-16","book_usfm":"PSA","chapter":15,"chapter_end":16},{"label":"Proverbios 27","book_usfm":"PRO","chapter":27},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1}]'::jsonb),
  (100, '[{"label":"Levítico 14","book_usfm":"LEV","chapter":14},{"label":"Salmos 17","book_usfm":"PSA","chapter":17},{"label":"Proverbios 28","book_usfm":"PRO","chapter":28},{"label":"2 Tesalonicenses 2","book_usfm":"2TH","chapter":2}]'::jsonb),
  (101, '[{"label":"Levítico 15","book_usfm":"LEV","chapter":15},{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Proverbios 29","book_usfm":"PRO","chapter":29},{"label":"2 Tesalonicenses 3","book_usfm":"2TH","chapter":3}]'::jsonb),
  (102, '[{"label":"Levítico 16","book_usfm":"LEV","chapter":16},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Proverbios 30","book_usfm":"PRO","chapter":30},{"label":"1 Timoteo 1","book_usfm":"1TI","chapter":1}]'::jsonb),
  (103, '[{"label":"Levítico 17","book_usfm":"LEV","chapter":17},{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Proverbios 31","book_usfm":"PRO","chapter":31},{"label":"1 Timoteo 2","book_usfm":"1TI","chapter":2}]'::jsonb),
  (104, '[{"label":"Levítico 18","book_usfm":"LEV","chapter":18},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Eclesiastés 1","book_usfm":"ECC","chapter":1},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3}]'::jsonb),
  (105, '[{"label":"Levítico 19","book_usfm":"LEV","chapter":19},{"label":"Salmos 23-24","book_usfm":"PSA","chapter":23,"chapter_end":24},{"label":"Eclesiastés 2","book_usfm":"ECC","chapter":2},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4}]'::jsonb),
  (106, '[{"label":"Levítico 20","book_usfm":"LEV","chapter":20},{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Eclesiastés 3","book_usfm":"ECC","chapter":3},{"label":"1 Timoteo 5","book_usfm":"1TI","chapter":5}]'::jsonb),
  (107, '[{"label":"Levítico 21","book_usfm":"LEV","chapter":21},{"label":"Salmos 26-27","book_usfm":"PSA","chapter":26,"chapter_end":27},{"label":"Eclesiastés 4","book_usfm":"ECC","chapter":4},{"label":"1 Timoteo 6","book_usfm":"1TI","chapter":6}]'::jsonb),
  (108, '[{"label":"Levítico 22","book_usfm":"LEV","chapter":22},{"label":"Salmos 28-29","book_usfm":"PSA","chapter":28,"chapter_end":29},{"label":"Eclesiastés 5","book_usfm":"ECC","chapter":5},{"label":"2 Timoteo 1","book_usfm":"2TI","chapter":1}]'::jsonb),
  (109, '[{"label":"Levítico 23","book_usfm":"LEV","chapter":23},{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Eclesiastés 6","book_usfm":"ECC","chapter":6},{"label":"2 Timoteo 2","book_usfm":"2TI","chapter":2}]'::jsonb),
  (110, '[{"label":"Levítico 24","book_usfm":"LEV","chapter":24},{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Eclesiastés 7","book_usfm":"ECC","chapter":7},{"label":"2 Timoteo 3","book_usfm":"2TI","chapter":3}]'::jsonb),
  (111, '[{"label":"Levítico 25","book_usfm":"LEV","chapter":25},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Eclesiastés 8","book_usfm":"ECC","chapter":8},{"label":"2 Timoteo 4","book_usfm":"2TI","chapter":4}]'::jsonb),
  (112, '[{"label":"Levítico 26","book_usfm":"LEV","chapter":26},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Eclesiastés 9","book_usfm":"ECC","chapter":9},{"label":"Tito 1","book_usfm":"TIT","chapter":1}]'::jsonb),
  (113, '[{"label":"Levítico 27","book_usfm":"LEV","chapter":27},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Eclesiastés 10","book_usfm":"ECC","chapter":10},{"label":"Tito 2","book_usfm":"TIT","chapter":2}]'::jsonb),
  (114, '[{"label":"Números 1","book_usfm":"NUM","chapter":1},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Eclesiastés 11","book_usfm":"ECC","chapter":11},{"label":"Tito 3","book_usfm":"TIT","chapter":3}]'::jsonb),
  (115, '[{"label":"Números 2","book_usfm":"NUM","chapter":2},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Eclesiastés 12","book_usfm":"ECC","chapter":12},{"label":"Filemón 1","book_usfm":"PHM","chapter":1}]'::jsonb),
  (116, '[{"label":"Números 3","book_usfm":"NUM","chapter":3},{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Cantares 1","book_usfm":"SNG","chapter":1},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1}]'::jsonb),
  (117, '[{"label":"Números 4","book_usfm":"NUM","chapter":4},{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Cantares 2","book_usfm":"SNG","chapter":2},{"label":"Hebreos 2","book_usfm":"HEB","chapter":2}]'::jsonb),
  (118, '[{"label":"Números 5","book_usfm":"NUM","chapter":5},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Cantares 3","book_usfm":"SNG","chapter":3},{"label":"Hebreos 3","book_usfm":"HEB","chapter":3}]'::jsonb),
  (119, '[{"label":"Números 6","book_usfm":"NUM","chapter":6},{"label":"Salmos 40-41","book_usfm":"PSA","chapter":40,"chapter_end":41},{"label":"Cantares 4","book_usfm":"SNG","chapter":4},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4}]'::jsonb),
  (120, '[{"label":"Números 7","book_usfm":"NUM","chapter":7},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Cantares 5","book_usfm":"SNG","chapter":5},{"label":"Hebreos 5","book_usfm":"HEB","chapter":5}]'::jsonb),
  (121, '[{"label":"Números 8","book_usfm":"NUM","chapter":8},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Cantares 6","book_usfm":"SNG","chapter":6},{"label":"Hebreos 6","book_usfm":"HEB","chapter":6}]'::jsonb),
  (122, '[{"label":"Números 9","book_usfm":"NUM","chapter":9},{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Cantares 7","book_usfm":"SNG","chapter":7},{"label":"Hebreos 7","book_usfm":"HEB","chapter":7}]'::jsonb),
  (123, '[{"label":"Números 10","book_usfm":"NUM","chapter":10},{"label":"Salmos 46-47","book_usfm":"PSA","chapter":46,"chapter_end":47},{"label":"Cantares 8","book_usfm":"SNG","chapter":8},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8}]'::jsonb),
  (124, '[{"label":"Números 11","book_usfm":"NUM","chapter":11},{"label":"Salmos 48","book_usfm":"PSA","chapter":48},{"label":"Isaías 1","book_usfm":"ISA","chapter":1},{"label":"Hebreos 9","book_usfm":"HEB","chapter":9}]'::jsonb),
  (125, '[{"label":"Números 12-13","book_usfm":"NUM","chapter":12,"chapter_end":13},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Isaías 2","book_usfm":"ISA","chapter":2},{"label":"Hebreos 10","book_usfm":"HEB","chapter":10}]'::jsonb),
  (126, '[{"label":"Números 14","book_usfm":"NUM","chapter":14},{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Isaías 3-4","book_usfm":"ISA","chapter":3,"chapter_end":4},{"label":"Hebreos 11","book_usfm":"HEB","chapter":11}]'::jsonb),
  (127, '[{"label":"Números 15","book_usfm":"NUM","chapter":15},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Isaías 5","book_usfm":"ISA","chapter":5},{"label":"Hebreos 12","book_usfm":"HEB","chapter":12}]'::jsonb),
  (128, '[{"label":"Números 16","book_usfm":"NUM","chapter":16},{"label":"Salmos 52-54","book_usfm":"PSA","chapter":52,"chapter_end":54},{"label":"Isaías 6","book_usfm":"ISA","chapter":6},{"label":"Hebreos 13","book_usfm":"HEB","chapter":13}]'::jsonb),
  (129, '[{"label":"Números 17-18","book_usfm":"NUM","chapter":17,"chapter_end":18},{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Isaías 7","book_usfm":"ISA","chapter":7},{"label":"Santiago 1","book_usfm":"JAS","chapter":1}]'::jsonb),
  (130, '[{"label":"Números 19","book_usfm":"NUM","chapter":19},{"label":"Salmos 56-57","book_usfm":"PSA","chapter":56,"chapter_end":57},{"label":"Isaías 8:1-9:7","book_usfm":"ISA","chapter":8,"chapter_end":9},{"label":"Santiago 2","book_usfm":"JAS","chapter":2}]'::jsonb),
  (131, '[{"label":"Números 20","book_usfm":"NUM","chapter":20},{"label":"Salmos 58-59","book_usfm":"PSA","chapter":58,"chapter_end":59},{"label":"Isaías 9:8-10:4","book_usfm":"ISA","chapter":9,"chapter_end":10},{"label":"Santiago 3","book_usfm":"JAS","chapter":3}]'::jsonb),
  (132, '[{"label":"Números 21","book_usfm":"NUM","chapter":21},{"label":"Salmos 60-61","book_usfm":"PSA","chapter":60,"chapter_end":61},{"label":"Isaías 10:5-34","book_usfm":"ISA","chapter":10},{"label":"Santiago 4","book_usfm":"JAS","chapter":4}]'::jsonb),
  (133, '[{"label":"Números 22","book_usfm":"NUM","chapter":22},{"label":"Salmos 62-63","book_usfm":"PSA","chapter":62,"chapter_end":63},{"label":"Isaías 11-12","book_usfm":"ISA","chapter":11,"chapter_end":12},{"label":"Santiago 5","book_usfm":"JAS","chapter":5}]'::jsonb),
  (134, '[{"label":"Números 23","book_usfm":"NUM","chapter":23},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Isaías 13","book_usfm":"ISA","chapter":13},{"label":"1 Pedro 1","book_usfm":"1PE","chapter":1}]'::jsonb),
  (135, '[{"label":"Números 24","book_usfm":"NUM","chapter":24},{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Isaías 14","book_usfm":"ISA","chapter":14},{"label":"1 Pedro 2","book_usfm":"1PE","chapter":2}]'::jsonb),
  (136, '[{"label":"Números 25","book_usfm":"NUM","chapter":25},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Isaías 15","book_usfm":"ISA","chapter":15},{"label":"1 Pedro 3","book_usfm":"1PE","chapter":3}]'::jsonb),
  (137, '[{"label":"Números 26","book_usfm":"NUM","chapter":26},{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Isaías 16","book_usfm":"ISA","chapter":16},{"label":"1 Pedro 4","book_usfm":"1PE","chapter":4}]'::jsonb),
  (138, '[{"label":"Números 27","book_usfm":"NUM","chapter":27},{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Isaías 17-18","book_usfm":"ISA","chapter":17,"chapter_end":18},{"label":"1 Pedro 5","book_usfm":"1PE","chapter":5}]'::jsonb),
  (139, '[{"label":"Números 28","book_usfm":"NUM","chapter":28},{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Isaías 19-20","book_usfm":"ISA","chapter":19,"chapter_end":20},{"label":"2 Pedro 1","book_usfm":"2PE","chapter":1}]'::jsonb),
  (140, '[{"label":"Números 29","book_usfm":"NUM","chapter":29},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Isaías 21","book_usfm":"ISA","chapter":21},{"label":"2 Pedro 2","book_usfm":"2PE","chapter":2}]'::jsonb),
  (141, '[{"label":"Números 30","book_usfm":"NUM","chapter":30},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Isaías 22","book_usfm":"ISA","chapter":22},{"label":"2 Pedro 3","book_usfm":"2PE","chapter":3}]'::jsonb),
  (142, '[{"label":"Números 31","book_usfm":"NUM","chapter":31},{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Isaías 23","book_usfm":"ISA","chapter":23},{"label":"1 Juan 1","book_usfm":"1JN","chapter":1}]'::jsonb),
  (143, '[{"label":"Números 32","book_usfm":"NUM","chapter":32},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Isaías 24","book_usfm":"ISA","chapter":24},{"label":"1 Juan 2","book_usfm":"1JN","chapter":2}]'::jsonb),
  (144, '[{"label":"Números 33","book_usfm":"NUM","chapter":33},{"label":"Salmos 78:1-39","book_usfm":"PSA","chapter":78},{"label":"Isaías 25","book_usfm":"ISA","chapter":25},{"label":"1 Juan 3","book_usfm":"1JN","chapter":3}]'::jsonb),
  (145, '[{"label":"Números 34","book_usfm":"NUM","chapter":34},{"label":"Salmos 78:40-72","book_usfm":"PSA","chapter":78},{"label":"Isaías 26","book_usfm":"ISA","chapter":26},{"label":"1 Juan 4","book_usfm":"1JN","chapter":4}]'::jsonb),
  (146, '[{"label":"Números 35","book_usfm":"NUM","chapter":35},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Isaías 27","book_usfm":"ISA","chapter":27},{"label":"1 Juan 5","book_usfm":"1JN","chapter":5}]'::jsonb),
  (147, '[{"label":"Números 36","book_usfm":"NUM","chapter":36},{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Isaías 28","book_usfm":"ISA","chapter":28},{"label":"2 Juan 1","book_usfm":"2JN","chapter":1}]'::jsonb),
  (148, '[{"label":"Deuteronomio 1","book_usfm":"DEU","chapter":1},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Isaías 29","book_usfm":"ISA","chapter":29},{"label":"3 Juan 1","book_usfm":"3JN","chapter":1}]'::jsonb),
  (149, '[{"label":"Deuteronomio 2","book_usfm":"DEU","chapter":2},{"label":"Salmos 83-84","book_usfm":"PSA","chapter":83,"chapter_end":84},{"label":"Isaías 30","book_usfm":"ISA","chapter":30},{"label":"Judas 1","book_usfm":"JUD","chapter":1}]'::jsonb),
  (150, '[{"label":"Deuteronomio 3","book_usfm":"DEU","chapter":3},{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Isaías 31","book_usfm":"ISA","chapter":31},{"label":"Apocalipsis 1","book_usfm":"REV","chapter":1}]'::jsonb),
  (151, '[{"label":"Deuteronomio 4","book_usfm":"DEU","chapter":4},{"label":"Salmos 86-87","book_usfm":"PSA","chapter":86,"chapter_end":87},{"label":"Isaías 32","book_usfm":"ISA","chapter":32},{"label":"Apocalipsis 2","book_usfm":"REV","chapter":2}]'::jsonb),
  (152, '[{"label":"Deuteronomio 5","book_usfm":"DEU","chapter":5},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Isaías 33","book_usfm":"ISA","chapter":33},{"label":"Apocalipsis 3","book_usfm":"REV","chapter":3}]'::jsonb),
  (153, '[{"label":"Deuteronomio 6","book_usfm":"DEU","chapter":6},{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Isaías 34","book_usfm":"ISA","chapter":34},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4}]'::jsonb),
  (154, '[{"label":"Deuteronomio 7","book_usfm":"DEU","chapter":7},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Isaías 35","book_usfm":"ISA","chapter":35},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5}]'::jsonb),
  (155, '[{"label":"Deuteronomio 8","book_usfm":"DEU","chapter":8},{"label":"Salmos 91","book_usfm":"PSA","chapter":91},{"label":"Isaías 36","book_usfm":"ISA","chapter":36},{"label":"Apocalipsis 6","book_usfm":"REV","chapter":6}]'::jsonb),
  (156, '[{"label":"Deuteronomio 9","book_usfm":"DEU","chapter":9},{"label":"Salmos 92-93","book_usfm":"PSA","chapter":92,"chapter_end":93},{"label":"Isaías 37","book_usfm":"ISA","chapter":37},{"label":"Apocalipsis 7","book_usfm":"REV","chapter":7}]'::jsonb),
  (157, '[{"label":"Deuteronomio 10","book_usfm":"DEU","chapter":10},{"label":"Salmos 94","book_usfm":"PSA","chapter":94},{"label":"Isaías 38","book_usfm":"ISA","chapter":38},{"label":"Apocalipsis 8","book_usfm":"REV","chapter":8}]'::jsonb),
  (158, '[{"label":"Deuteronomio 11","book_usfm":"DEU","chapter":11},{"label":"Salmos 95-96","book_usfm":"PSA","chapter":95,"chapter_end":96},{"label":"Isaías 39","book_usfm":"ISA","chapter":39},{"label":"Apocalipsis 9","book_usfm":"REV","chapter":9}]'::jsonb),
  (159, '[{"label":"Deuteronomio 12","book_usfm":"DEU","chapter":12},{"label":"Salmos 97-98","book_usfm":"PSA","chapter":97,"chapter_end":98},{"label":"Isaías 40","book_usfm":"ISA","chapter":40},{"label":"Apocalipsis 10","book_usfm":"REV","chapter":10}]'::jsonb),
  (160, '[{"label":"Deuteronomio 13-14","book_usfm":"DEU","chapter":13,"chapter_end":14},{"label":"Salmos 99-101","book_usfm":"PSA","chapter":99,"chapter_end":101},{"label":"Isaías 41","book_usfm":"ISA","chapter":41},{"label":"Apocalipsis 11","book_usfm":"REV","chapter":11}]'::jsonb),
  (161, '[{"label":"Deuteronomio 15","book_usfm":"DEU","chapter":15},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Isaías 42","book_usfm":"ISA","chapter":42},{"label":"Apocalipsis 12","book_usfm":"REV","chapter":12}]'::jsonb),
  (162, '[{"label":"Deuteronomio 16","book_usfm":"DEU","chapter":16},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Isaías 43","book_usfm":"ISA","chapter":43},{"label":"Apocalipsis 13","book_usfm":"REV","chapter":13}]'::jsonb),
  (163, '[{"label":"Deuteronomio 17","book_usfm":"DEU","chapter":17},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Isaías 44","book_usfm":"ISA","chapter":44},{"label":"Apocalipsis 14","book_usfm":"REV","chapter":14}]'::jsonb),
  (164, '[{"label":"Deuteronomio 18","book_usfm":"DEU","chapter":18},{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Isaías 45","book_usfm":"ISA","chapter":45},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15}]'::jsonb),
  (165, '[{"label":"Deuteronomio 19","book_usfm":"DEU","chapter":19},{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Isaías 46","book_usfm":"ISA","chapter":46},{"label":"Apocalipsis 16","book_usfm":"REV","chapter":16}]'::jsonb),
  (166, '[{"label":"Deuteronomio 20","book_usfm":"DEU","chapter":20},{"label":"Salmos 107","book_usfm":"PSA","chapter":107},{"label":"Isaías 47","book_usfm":"ISA","chapter":47},{"label":"Apocalipsis 17","book_usfm":"REV","chapter":17}]'::jsonb),
  (167, '[{"label":"Deuteronomio 21","book_usfm":"DEU","chapter":21},{"label":"Salmos 108-109","book_usfm":"PSA","chapter":108,"chapter_end":109},{"label":"Isaías 48","book_usfm":"ISA","chapter":48},{"label":"Apocalipsis 18","book_usfm":"REV","chapter":18}]'::jsonb),
  (168, '[{"label":"Deuteronomio 22","book_usfm":"DEU","chapter":22},{"label":"Salmos 110-111","book_usfm":"PSA","chapter":110,"chapter_end":111},{"label":"Isaías 49","book_usfm":"ISA","chapter":49},{"label":"Apocalipsis 19","book_usfm":"REV","chapter":19}]'::jsonb),
  (169, '[{"label":"Deuteronomio 23","book_usfm":"DEU","chapter":23},{"label":"Salmos 112-113","book_usfm":"PSA","chapter":112,"chapter_end":113},{"label":"Isaías 50","book_usfm":"ISA","chapter":50},{"label":"Apocalipsis 20","book_usfm":"REV","chapter":20}]'::jsonb),
  (170, '[{"label":"Deuteronomio 24","book_usfm":"DEU","chapter":24},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Isaías 51","book_usfm":"ISA","chapter":51},{"label":"Apocalipsis 21","book_usfm":"REV","chapter":21}]'::jsonb),
  (171, '[{"label":"Deuteronomio 25","book_usfm":"DEU","chapter":25},{"label":"Salmos 116","book_usfm":"PSA","chapter":116},{"label":"Isaías 52","book_usfm":"ISA","chapter":52},{"label":"Apocalipsis 22","book_usfm":"REV","chapter":22}]'::jsonb),
  (172, '[{"label":"Deuteronomio 26","book_usfm":"DEU","chapter":26},{"label":"Salmos 117-118","book_usfm":"PSA","chapter":117,"chapter_end":118},{"label":"Isaías 53","book_usfm":"ISA","chapter":53},{"label":"Mateo 1","book_usfm":"MAT","chapter":1}]'::jsonb),
  (173, '[{"label":"Deuteronomio 27:1-28:19","book_usfm":"DEU","chapter":27,"chapter_end":28},{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Isaías 54","book_usfm":"ISA","chapter":54},{"label":"Mateo 2","book_usfm":"MAT","chapter":2}]'::jsonb),
  (174, '[{"label":"Deuteronomio 28:20-68","book_usfm":"DEU","chapter":28},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Isaías 55","book_usfm":"ISA","chapter":55},{"label":"Mateo 3","book_usfm":"MAT","chapter":3}]'::jsonb),
  (175, '[{"label":"Deuteronomio 29","book_usfm":"DEU","chapter":29},{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Isaías 56","book_usfm":"ISA","chapter":56},{"label":"Mateo 4","book_usfm":"MAT","chapter":4}]'::jsonb),
  (176, '[{"label":"Deuteronomio 30","book_usfm":"DEU","chapter":30},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Isaías 57","book_usfm":"ISA","chapter":57},{"label":"Mateo 5","book_usfm":"MAT","chapter":5}]'::jsonb),
  (177, '[{"label":"Deuteronomio 31","book_usfm":"DEU","chapter":31},{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Isaías 58","book_usfm":"ISA","chapter":58},{"label":"Mateo 6","book_usfm":"MAT","chapter":6}]'::jsonb),
  (178, '[{"label":"Deuteronomio 32","book_usfm":"DEU","chapter":32},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Isaías 59","book_usfm":"ISA","chapter":59},{"label":"Mateo 7","book_usfm":"MAT","chapter":7}]'::jsonb),
  (179, '[{"label":"Deuteronomio 33-34","book_usfm":"DEU","chapter":33,"chapter_end":34},{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Isaías 60","book_usfm":"ISA","chapter":60},{"label":"Mateo 8","book_usfm":"MAT","chapter":8}]'::jsonb),
  (180, '[{"label":"Josué 1","book_usfm":"JOS","chapter":1},{"label":"Salmos 120-122","book_usfm":"PSA","chapter":120,"chapter_end":122},{"label":"Isaías 61","book_usfm":"ISA","chapter":61},{"label":"Mateo 9","book_usfm":"MAT","chapter":9}]'::jsonb),
  (181, '[{"label":"Josué 2","book_usfm":"JOS","chapter":2},{"label":"Salmos 123-125","book_usfm":"PSA","chapter":123,"chapter_end":125},{"label":"Isaías 62","book_usfm":"ISA","chapter":62},{"label":"Mateo 10","book_usfm":"MAT","chapter":10}]'::jsonb),
  (182, '[{"label":"Josué 3","book_usfm":"JOS","chapter":3},{"label":"Salmos 126-128","book_usfm":"PSA","chapter":126,"chapter_end":128},{"label":"Isaías 63","book_usfm":"ISA","chapter":63},{"label":"Mateo 11","book_usfm":"MAT","chapter":11}]'::jsonb),
  (183, '[{"label":"Josué 4","book_usfm":"JOS","chapter":4},{"label":"Salmos 129-131","book_usfm":"PSA","chapter":129,"chapter_end":131},{"label":"Isaías 64","book_usfm":"ISA","chapter":64},{"label":"Mateo 12","book_usfm":"MAT","chapter":12}]'::jsonb),
  (184, '[{"label":"Josué 5","book_usfm":"JOS","chapter":5},{"label":"Salmos 132-134","book_usfm":"PSA","chapter":132,"chapter_end":134},{"label":"Isaías 65","book_usfm":"ISA","chapter":65},{"label":"Mateo 13","book_usfm":"MAT","chapter":13}]'::jsonb),
  (185, '[{"label":"Josué 6","book_usfm":"JOS","chapter":6},{"label":"Salmos 135-136","book_usfm":"PSA","chapter":135,"chapter_end":136},{"label":"Isaías 66","book_usfm":"ISA","chapter":66},{"label":"Mateo 14","book_usfm":"MAT","chapter":14}]'::jsonb),
  (186, '[{"label":"Josué 7","book_usfm":"JOS","chapter":7},{"label":"Salmos 137-138","book_usfm":"PSA","chapter":137,"chapter_end":138},{"label":"Jeremías 1","book_usfm":"JER","chapter":1},{"label":"Mateo 15","book_usfm":"MAT","chapter":15}]'::jsonb),
  (187, '[{"label":"Josué 8","book_usfm":"JOS","chapter":8},{"label":"Salmos 139","book_usfm":"PSA","chapter":139},{"label":"Jeremías 2","book_usfm":"JER","chapter":2},{"label":"Mateo 16","book_usfm":"MAT","chapter":16}]'::jsonb),
  (188, '[{"label":"Josué 9","book_usfm":"JOS","chapter":9},{"label":"Salmos 140-141","book_usfm":"PSA","chapter":140,"chapter_end":141},{"label":"Jeremías 3","book_usfm":"JER","chapter":3},{"label":"Mateo 17","book_usfm":"MAT","chapter":17}]'::jsonb),
  (189, '[{"label":"Josué 10","book_usfm":"JOS","chapter":10},{"label":"Salmos 142-143","book_usfm":"PSA","chapter":142,"chapter_end":143},{"label":"Jeremías 4","book_usfm":"JER","chapter":4},{"label":"Mateo 18","book_usfm":"MAT","chapter":18}]'::jsonb),
  (190, '[{"label":"Josué 11","book_usfm":"JOS","chapter":11},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Jeremías 5","book_usfm":"JER","chapter":5},{"label":"Mateo 19","book_usfm":"MAT","chapter":19}]'::jsonb),
  (191, '[{"label":"Josué 12-13","book_usfm":"JOS","chapter":12,"chapter_end":13},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Jeremías 6","book_usfm":"JER","chapter":6},{"label":"Mateo 20","book_usfm":"MAT","chapter":20}]'::jsonb),
  (192, '[{"label":"Josué 14-15","book_usfm":"JOS","chapter":14,"chapter_end":15},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Jeremías 7","book_usfm":"JER","chapter":7},{"label":"Mateo 21","book_usfm":"MAT","chapter":21}]'::jsonb),
  (193, '[{"label":"Josué 16-17","book_usfm":"JOS","chapter":16,"chapter_end":17},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Jeremías 8","book_usfm":"JER","chapter":8},{"label":"Mateo 22","book_usfm":"MAT","chapter":22}]'::jsonb),
  (194, '[{"label":"Josué 18-19","book_usfm":"JOS","chapter":18,"chapter_end":19},{"label":"Salmos 149-150","book_usfm":"PSA","chapter":149,"chapter_end":150},{"label":"Jeremías 9","book_usfm":"JER","chapter":9},{"label":"Mateo 23","book_usfm":"MAT","chapter":23}]'::jsonb),
  (195, '[{"label":"Josué 20-21","book_usfm":"JOS","chapter":20,"chapter_end":21},{"label":"Hechos 1","book_usfm":"ACT","chapter":1},{"label":"Jeremías 10","book_usfm":"JER","chapter":10},{"label":"Mateo 24","book_usfm":"MAT","chapter":24}]'::jsonb),
  (196, '[{"label":"Josué 22","book_usfm":"JOS","chapter":22},{"label":"Hechos 2","book_usfm":"ACT","chapter":2},{"label":"Jeremías 11","book_usfm":"JER","chapter":11},{"label":"Mateo 25","book_usfm":"MAT","chapter":25}]'::jsonb),
  (197, '[{"label":"Josué 23","book_usfm":"JOS","chapter":23},{"label":"Hechos 3","book_usfm":"ACT","chapter":3},{"label":"Jeremías 12","book_usfm":"JER","chapter":12},{"label":"Mateo 26","book_usfm":"MAT","chapter":26}]'::jsonb),
  (198, '[{"label":"Josué 24","book_usfm":"JOS","chapter":24},{"label":"Hechos 4","book_usfm":"ACT","chapter":4},{"label":"Jeremías 13","book_usfm":"JER","chapter":13},{"label":"Mateo 27","book_usfm":"MAT","chapter":27}]'::jsonb),
  (199, '[{"label":"Jueces 1","book_usfm":"JDG","chapter":1},{"label":"Hechos 5","book_usfm":"ACT","chapter":5},{"label":"Jeremías 14","book_usfm":"JER","chapter":14},{"label":"Mateo 28","book_usfm":"MAT","chapter":28}]'::jsonb),
  (200, '[{"label":"Jueces 2","book_usfm":"JDG","chapter":2},{"label":"Hechos 6","book_usfm":"ACT","chapter":6},{"label":"Jeremías 15","book_usfm":"JER","chapter":15},{"label":"Marcos 1","book_usfm":"MRK","chapter":1}]'::jsonb),
  (201, '[{"label":"Jueces 3","book_usfm":"JDG","chapter":3},{"label":"Hechos 7","book_usfm":"ACT","chapter":7},{"label":"Jeremías 16","book_usfm":"JER","chapter":16},{"label":"Marcos 2","book_usfm":"MRK","chapter":2}]'::jsonb),
  (202, '[{"label":"Jueces 4","book_usfm":"JDG","chapter":4},{"label":"Hechos 8","book_usfm":"ACT","chapter":8},{"label":"Jeremías 17","book_usfm":"JER","chapter":17},{"label":"Marcos 3","book_usfm":"MRK","chapter":3}]'::jsonb),
  (203, '[{"label":"Jueces 5","book_usfm":"JDG","chapter":5},{"label":"Hechos 9","book_usfm":"ACT","chapter":9},{"label":"Jeremías 18","book_usfm":"JER","chapter":18},{"label":"Marcos 4","book_usfm":"MRK","chapter":4}]'::jsonb),
  (204, '[{"label":"Jueces 6","book_usfm":"JDG","chapter":6},{"label":"Hechos 10","book_usfm":"ACT","chapter":10},{"label":"Jeremías 19","book_usfm":"JER","chapter":19},{"label":"Marcos 5","book_usfm":"MRK","chapter":5}]'::jsonb),
  (205, '[{"label":"Jueces 7","book_usfm":"JDG","chapter":7},{"label":"Hechos 11","book_usfm":"ACT","chapter":11},{"label":"Jeremías 20","book_usfm":"JER","chapter":20},{"label":"Marcos 6","book_usfm":"MRK","chapter":6}]'::jsonb),
  (206, '[{"label":"Jueces 8","book_usfm":"JDG","chapter":8},{"label":"Hechos 12","book_usfm":"ACT","chapter":12},{"label":"Jeremías 21","book_usfm":"JER","chapter":21},{"label":"Marcos 7","book_usfm":"MRK","chapter":7}]'::jsonb),
  (207, '[{"label":"Jueces 9","book_usfm":"JDG","chapter":9},{"label":"Hechos 13","book_usfm":"ACT","chapter":13},{"label":"Jeremías 22","book_usfm":"JER","chapter":22},{"label":"Marcos 8","book_usfm":"MRK","chapter":8}]'::jsonb),
  (208, '[{"label":"Jueces 10","book_usfm":"JDG","chapter":10},{"label":"Hechos 14","book_usfm":"ACT","chapter":14},{"label":"Jeremías 23","book_usfm":"JER","chapter":23},{"label":"Marcos 9","book_usfm":"MRK","chapter":9}]'::jsonb),
  (209, '[{"label":"Jueces 11","book_usfm":"JDG","chapter":11},{"label":"Hechos 15","book_usfm":"ACT","chapter":15},{"label":"Jeremías 24","book_usfm":"JER","chapter":24},{"label":"Marcos 10","book_usfm":"MRK","chapter":10}]'::jsonb),
  (210, '[{"label":"Jueces 12","book_usfm":"JDG","chapter":12},{"label":"Hechos 16","book_usfm":"ACT","chapter":16},{"label":"Jeremías 25","book_usfm":"JER","chapter":25},{"label":"Marcos 11","book_usfm":"MRK","chapter":11}]'::jsonb),
  (211, '[{"label":"Jueces 13","book_usfm":"JDG","chapter":13},{"label":"Hechos 17","book_usfm":"ACT","chapter":17},{"label":"Jeremías 26","book_usfm":"JER","chapter":26},{"label":"Marcos 12","book_usfm":"MRK","chapter":12}]'::jsonb),
  (212, '[{"label":"Jueces 14","book_usfm":"JDG","chapter":14},{"label":"Hechos 18","book_usfm":"ACT","chapter":18},{"label":"Jeremías 27","book_usfm":"JER","chapter":27},{"label":"Marcos 13","book_usfm":"MRK","chapter":13}]'::jsonb),
  (213, '[{"label":"Jueces 15","book_usfm":"JDG","chapter":15},{"label":"Hechos 19","book_usfm":"ACT","chapter":19},{"label":"Jeremías 28","book_usfm":"JER","chapter":28},{"label":"Marcos 14","book_usfm":"MRK","chapter":14}]'::jsonb),
  (214, '[{"label":"Jueces 16","book_usfm":"JDG","chapter":16},{"label":"Hechos 20","book_usfm":"ACT","chapter":20},{"label":"Jeremías 29","book_usfm":"JER","chapter":29},{"label":"Marcos 15","book_usfm":"MRK","chapter":15}]'::jsonb),
  (215, '[{"label":"Jueces 17","book_usfm":"JDG","chapter":17},{"label":"Hechos 21","book_usfm":"ACT","chapter":21},{"label":"Jeremías 30-31","book_usfm":"JER","chapter":30,"chapter_end":31},{"label":"Marcos 16","book_usfm":"MRK","chapter":16}]'::jsonb),
  (216, '[{"label":"Jueces 18","book_usfm":"JDG","chapter":18},{"label":"Hechos 22","book_usfm":"ACT","chapter":22},{"label":"Jeremías 32","book_usfm":"JER","chapter":32},{"label":"Salmos 1-2","book_usfm":"PSA","chapter":1,"chapter_end":2}]'::jsonb),
  (217, '[{"label":"Jueces 19","book_usfm":"JDG","chapter":19},{"label":"Hechos 23","book_usfm":"ACT","chapter":23},{"label":"Jeremías 33","book_usfm":"JER","chapter":33},{"label":"Salmos 3-4","book_usfm":"PSA","chapter":3,"chapter_end":4}]'::jsonb),
  (218, '[{"label":"Jueces 20","book_usfm":"JDG","chapter":20},{"label":"Hechos 24","book_usfm":"ACT","chapter":24},{"label":"Jeremías 34","book_usfm":"JER","chapter":34},{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6}]'::jsonb),
  (219, '[{"label":"Jueces 21","book_usfm":"JDG","chapter":21},{"label":"Hechos 25","book_usfm":"ACT","chapter":25},{"label":"Jeremías 35","book_usfm":"JER","chapter":35},{"label":"Salmos 7-8","book_usfm":"PSA","chapter":7,"chapter_end":8}]'::jsonb),
  (220, '[{"label":"Rut 1","book_usfm":"RUT","chapter":1},{"label":"Hechos 26","book_usfm":"ACT","chapter":26},{"label":"Jeremías 36","book_usfm":"JER","chapter":36},{"label":"Jeremías 45","book_usfm":"JER","chapter":45},{"label":"Salmos 9","book_usfm":"PSA","chapter":9}]'::jsonb),
  (221, '[{"label":"Rut 2","book_usfm":"RUT","chapter":2},{"label":"Hechos 27","book_usfm":"ACT","chapter":27},{"label":"Jeremías 37","book_usfm":"JER","chapter":37},{"label":"Salmos 10","book_usfm":"PSA","chapter":10}]'::jsonb),
  (222, '[{"label":"Rut 3-4","book_usfm":"RUT","chapter":3,"chapter_end":4},{"label":"Hechos 28","book_usfm":"ACT","chapter":28},{"label":"Jeremías 38","book_usfm":"JER","chapter":38},{"label":"Salmos 11-12","book_usfm":"PSA","chapter":11,"chapter_end":12}]'::jsonb),
  (223, '[{"label":"1 Samuel 1","book_usfm":"1SA","chapter":1},{"label":"Romanos 1","book_usfm":"ROM","chapter":1},{"label":"Jeremías 39","book_usfm":"JER","chapter":39},{"label":"Salmos 13-14","book_usfm":"PSA","chapter":13,"chapter_end":14}]'::jsonb),
  (224, '[{"label":"1 Samuel 2","book_usfm":"1SA","chapter":2},{"label":"Romanos 2","book_usfm":"ROM","chapter":2},{"label":"Jeremías 40","book_usfm":"JER","chapter":40},{"label":"Salmos 15-16","book_usfm":"PSA","chapter":15,"chapter_end":16}]'::jsonb),
  (225, '[{"label":"1 Samuel 3","book_usfm":"1SA","chapter":3},{"label":"Romanos 3","book_usfm":"ROM","chapter":3},{"label":"Jeremías 41","book_usfm":"JER","chapter":41},{"label":"Salmos 17","book_usfm":"PSA","chapter":17}]'::jsonb),
  (226, '[{"label":"1 Samuel 4","book_usfm":"1SA","chapter":4},{"label":"Romanos 4","book_usfm":"ROM","chapter":4},{"label":"Jeremías 42","book_usfm":"JER","chapter":42},{"label":"Salmos 18","book_usfm":"PSA","chapter":18}]'::jsonb),
  (227, '[{"label":"1 Samuel 5-6","book_usfm":"1SA","chapter":5,"chapter_end":6},{"label":"Romanos 5","book_usfm":"ROM","chapter":5},{"label":"Jeremías 43","book_usfm":"JER","chapter":43},{"label":"Salmos 19","book_usfm":"PSA","chapter":19}]'::jsonb),
  (228, '[{"label":"1 Samuel 7-8","book_usfm":"1SA","chapter":7,"chapter_end":8},{"label":"Romanos 6","book_usfm":"ROM","chapter":6},{"label":"Jeremías 44","book_usfm":"JER","chapter":44},{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21}]'::jsonb),
  (229, '[{"label":"1 Samuel 9","book_usfm":"1SA","chapter":9},{"label":"Romanos 7","book_usfm":"ROM","chapter":7},{"label":"Jeremías 46","book_usfm":"JER","chapter":46},{"label":"Salmos 22","book_usfm":"PSA","chapter":22}]'::jsonb),
  (230, '[{"label":"1 Samuel 10","book_usfm":"1SA","chapter":10},{"label":"Romanos 8","book_usfm":"ROM","chapter":8},{"label":"Jeremías 47","book_usfm":"JER","chapter":47},{"label":"Salmos 23-24","book_usfm":"PSA","chapter":23,"chapter_end":24}]'::jsonb),
  (231, '[{"label":"1 Samuel 11","book_usfm":"1SA","chapter":11},{"label":"Romanos 9","book_usfm":"ROM","chapter":9},{"label":"Jeremías 48","book_usfm":"JER","chapter":48},{"label":"Salmos 25","book_usfm":"PSA","chapter":25}]'::jsonb),
  (232, '[{"label":"1 Samuel 12","book_usfm":"1SA","chapter":12},{"label":"Romanos 10","book_usfm":"ROM","chapter":10},{"label":"Jeremías 49","book_usfm":"JER","chapter":49},{"label":"Salmos 26-27","book_usfm":"PSA","chapter":26,"chapter_end":27}]'::jsonb),
  (233, '[{"label":"1 Samuel 13","book_usfm":"1SA","chapter":13},{"label":"Romanos 11","book_usfm":"ROM","chapter":11},{"label":"Jeremías 50","book_usfm":"JER","chapter":50},{"label":"Salmos 28-29","book_usfm":"PSA","chapter":28,"chapter_end":29}]'::jsonb),
  (234, '[{"label":"1 Samuel 14","book_usfm":"1SA","chapter":14},{"label":"Romanos 12","book_usfm":"ROM","chapter":12},{"label":"Jeremías 51","book_usfm":"JER","chapter":51},{"label":"Salmos 30","book_usfm":"PSA","chapter":30}]'::jsonb),
  (235, '[{"label":"1 Samuel 15","book_usfm":"1SA","chapter":15},{"label":"Romanos 13","book_usfm":"ROM","chapter":13},{"label":"Jeremías 52","book_usfm":"JER","chapter":52},{"label":"Salmos 31","book_usfm":"PSA","chapter":31}]'::jsonb),
  (236, '[{"label":"1 Samuel 16","book_usfm":"1SA","chapter":16},{"label":"Romanos 14","book_usfm":"ROM","chapter":14},{"label":"Lamentaciones 1","book_usfm":"LAM","chapter":1},{"label":"Salmos 32","book_usfm":"PSA","chapter":32}]'::jsonb),
  (237, '[{"label":"1 Samuel 17","book_usfm":"1SA","chapter":17},{"label":"Romanos 15","book_usfm":"ROM","chapter":15},{"label":"Lamentaciones 2","book_usfm":"LAM","chapter":2},{"label":"Salmos 33","book_usfm":"PSA","chapter":33}]'::jsonb),
  (238, '[{"label":"1 Samuel 18","book_usfm":"1SA","chapter":18},{"label":"Romanos 16","book_usfm":"ROM","chapter":16},{"label":"Lamentaciones 3","book_usfm":"LAM","chapter":3},{"label":"Salmos 34","book_usfm":"PSA","chapter":34}]'::jsonb),
  (239, '[{"label":"1 Samuel 19","book_usfm":"1SA","chapter":19},{"label":"1 Corintios 1","book_usfm":"1CO","chapter":1},{"label":"Lamentaciones 4","book_usfm":"LAM","chapter":4},{"label":"Salmos 35","book_usfm":"PSA","chapter":35}]'::jsonb),
  (240, '[{"label":"1 Samuel 20","book_usfm":"1SA","chapter":20},{"label":"1 Corintios 2","book_usfm":"1CO","chapter":2},{"label":"Lamentaciones 5","book_usfm":"LAM","chapter":5},{"label":"Salmos 36","book_usfm":"PSA","chapter":36}]'::jsonb),
  (241, '[{"label":"1 Samuel 21-22","book_usfm":"1SA","chapter":21,"chapter_end":22},{"label":"1 Corintios 3","book_usfm":"1CO","chapter":3},{"label":"Ezequiel 1","book_usfm":"EZK","chapter":1},{"label":"Salmos 37","book_usfm":"PSA","chapter":37}]'::jsonb),
  (242, '[{"label":"1 Samuel 23","book_usfm":"1SA","chapter":23},{"label":"1 Corintios 4","book_usfm":"1CO","chapter":4},{"label":"Ezequiel 2","book_usfm":"EZK","chapter":2},{"label":"Salmos 38","book_usfm":"PSA","chapter":38}]'::jsonb),
  (243, '[{"label":"1 Samuel 24","book_usfm":"1SA","chapter":24},{"label":"1 Corintios 5","book_usfm":"1CO","chapter":5},{"label":"Ezequiel 3","book_usfm":"EZK","chapter":3},{"label":"Salmos 39","book_usfm":"PSA","chapter":39}]'::jsonb),
  (244, '[{"label":"1 Samuel 25","book_usfm":"1SA","chapter":25},{"label":"1 Corintios 6","book_usfm":"1CO","chapter":6},{"label":"Ezequiel 4","book_usfm":"EZK","chapter":4},{"label":"Salmos 40-41","book_usfm":"PSA","chapter":40,"chapter_end":41}]'::jsonb),
  (245, '[{"label":"1 Samuel 26","book_usfm":"1SA","chapter":26},{"label":"1 Corintios 7","book_usfm":"1CO","chapter":7},{"label":"Ezequiel 5","book_usfm":"EZK","chapter":5},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43}]'::jsonb),
  (246, '[{"label":"1 Samuel 27","book_usfm":"1SA","chapter":27},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8},{"label":"Ezequiel 6","book_usfm":"EZK","chapter":6},{"label":"Salmos 44","book_usfm":"PSA","chapter":44}]'::jsonb),
  (247, '[{"label":"1 Samuel 28","book_usfm":"1SA","chapter":28},{"label":"1 Corintios 9","book_usfm":"1CO","chapter":9},{"label":"Ezequiel 7","book_usfm":"EZK","chapter":7},{"label":"Salmos 45","book_usfm":"PSA","chapter":45}]'::jsonb),
  (248, '[{"label":"1 Samuel 29-30","book_usfm":"1SA","chapter":29,"chapter_end":30},{"label":"1 Corintios 10","book_usfm":"1CO","chapter":10},{"label":"Ezequiel 8","book_usfm":"EZK","chapter":8},{"label":"Salmos 46-47","book_usfm":"PSA","chapter":46,"chapter_end":47}]'::jsonb),
  (249, '[{"label":"1 Samuel 31","book_usfm":"1SA","chapter":31},{"label":"1 Corintios 11","book_usfm":"1CO","chapter":11},{"label":"Ezequiel 9","book_usfm":"EZK","chapter":9},{"label":"Salmos 48","book_usfm":"PSA","chapter":48}]'::jsonb),
  (250, '[{"label":"2 Samuel 1","book_usfm":"2SA","chapter":1},{"label":"1 Corintios 12","book_usfm":"1CO","chapter":12},{"label":"Ezequiel 10","book_usfm":"EZK","chapter":10},{"label":"Salmos 49","book_usfm":"PSA","chapter":49}]'::jsonb),
  (251, '[{"label":"2 Samuel 2","book_usfm":"2SA","chapter":2},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13},{"label":"Ezequiel 11","book_usfm":"EZK","chapter":11},{"label":"Salmos 50","book_usfm":"PSA","chapter":50}]'::jsonb),
  (252, '[{"label":"2 Samuel 3","book_usfm":"2SA","chapter":3},{"label":"1 Corintios 14","book_usfm":"1CO","chapter":14},{"label":"Ezequiel 12","book_usfm":"EZK","chapter":12},{"label":"Salmos 51","book_usfm":"PSA","chapter":51}]'::jsonb),
  (253, '[{"label":"2 Samuel 4-5","book_usfm":"2SA","chapter":4,"chapter_end":5},{"label":"1 Corintios 15","book_usfm":"1CO","chapter":15},{"label":"Ezequiel 13","book_usfm":"EZK","chapter":13},{"label":"Salmos 52-54","book_usfm":"PSA","chapter":52,"chapter_end":54}]'::jsonb),
  (254, '[{"label":"2 Samuel 6","book_usfm":"2SA","chapter":6},{"label":"1 Corintios 16","book_usfm":"1CO","chapter":16},{"label":"Ezequiel 14","book_usfm":"EZK","chapter":14},{"label":"Salmos 55","book_usfm":"PSA","chapter":55}]'::jsonb),
  (255, '[{"label":"2 Samuel 7","book_usfm":"2SA","chapter":7},{"label":"2 Corintios 1","book_usfm":"2CO","chapter":1},{"label":"Ezequiel 15","book_usfm":"EZK","chapter":15},{"label":"Salmos 56-57","book_usfm":"PSA","chapter":56,"chapter_end":57}]'::jsonb),
  (256, '[{"label":"2 Samuel 8-9","book_usfm":"2SA","chapter":8,"chapter_end":9},{"label":"2 Corintios 2","book_usfm":"2CO","chapter":2},{"label":"Ezequiel 16","book_usfm":"EZK","chapter":16},{"label":"Salmos 58-59","book_usfm":"PSA","chapter":58,"chapter_end":59}]'::jsonb),
  (257, '[{"label":"2 Samuel 10","book_usfm":"2SA","chapter":10},{"label":"2 Corintios 3","book_usfm":"2CO","chapter":3},{"label":"Ezequiel 17","book_usfm":"EZK","chapter":17},{"label":"Salmos 60-61","book_usfm":"PSA","chapter":60,"chapter_end":61}]'::jsonb),
  (258, '[{"label":"2 Samuel 11","book_usfm":"2SA","chapter":11},{"label":"2 Corintios 4","book_usfm":"2CO","chapter":4},{"label":"Ezequiel 18","book_usfm":"EZK","chapter":18},{"label":"Salmos 62-63","book_usfm":"PSA","chapter":62,"chapter_end":63}]'::jsonb),
  (259, '[{"label":"2 Samuel 12","book_usfm":"2SA","chapter":12},{"label":"2 Corintios 5","book_usfm":"2CO","chapter":5},{"label":"Ezequiel 19","book_usfm":"EZK","chapter":19},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65}]'::jsonb),
  (260, '[{"label":"2 Samuel 13","book_usfm":"2SA","chapter":13},{"label":"2 Corintios 6","book_usfm":"2CO","chapter":6},{"label":"Ezequiel 20","book_usfm":"EZK","chapter":20},{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67}]'::jsonb),
  (261, '[{"label":"2 Samuel 14","book_usfm":"2SA","chapter":14},{"label":"2 Corintios 7","book_usfm":"2CO","chapter":7},{"label":"Ezequiel 21","book_usfm":"EZK","chapter":21},{"label":"Salmos 68","book_usfm":"PSA","chapter":68}]'::jsonb),
  (262, '[{"label":"2 Samuel 15","book_usfm":"2SA","chapter":15},{"label":"2 Corintios 8","book_usfm":"2CO","chapter":8},{"label":"Ezequiel 22","book_usfm":"EZK","chapter":22},{"label":"Salmos 69","book_usfm":"PSA","chapter":69}]'::jsonb),
  (263, '[{"label":"2 Samuel 16","book_usfm":"2SA","chapter":16},{"label":"2 Corintios 9","book_usfm":"2CO","chapter":9},{"label":"Ezequiel 23","book_usfm":"EZK","chapter":23},{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71}]'::jsonb),
  (264, '[{"label":"2 Samuel 17","book_usfm":"2SA","chapter":17},{"label":"2 Corintios 10","book_usfm":"2CO","chapter":10},{"label":"Ezequiel 24","book_usfm":"EZK","chapter":24},{"label":"Salmos 72","book_usfm":"PSA","chapter":72}]'::jsonb),
  (265, '[{"label":"2 Samuel 18","book_usfm":"2SA","chapter":18},{"label":"2 Corintios 11","book_usfm":"2CO","chapter":11},{"label":"Ezequiel 25","book_usfm":"EZK","chapter":25},{"label":"Salmos 73","book_usfm":"PSA","chapter":73}]'::jsonb),
  (266, '[{"label":"2 Samuel 19","book_usfm":"2SA","chapter":19},{"label":"2 Corintios 12","book_usfm":"2CO","chapter":12},{"label":"Ezequiel 26","book_usfm":"EZK","chapter":26},{"label":"Salmos 74","book_usfm":"PSA","chapter":74}]'::jsonb),
  (267, '[{"label":"2 Samuel 20","book_usfm":"2SA","chapter":20},{"label":"2 Corintios 13","book_usfm":"2CO","chapter":13},{"label":"Ezequiel 27","book_usfm":"EZK","chapter":27},{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76}]'::jsonb),
  (268, '[{"label":"2 Samuel 21","book_usfm":"2SA","chapter":21},{"label":"Gálatas 1","book_usfm":"GAL","chapter":1},{"label":"Ezequiel 28","book_usfm":"EZK","chapter":28},{"label":"Salmos 77","book_usfm":"PSA","chapter":77}]'::jsonb),
  (269, '[{"label":"2 Samuel 22","book_usfm":"2SA","chapter":22},{"label":"Gálatas 2","book_usfm":"GAL","chapter":2},{"label":"Ezequiel 29","book_usfm":"EZK","chapter":29},{"label":"Salmos 78:1-39","book_usfm":"PSA","chapter":78}]'::jsonb),
  (270, '[{"label":"2 Samuel 23","book_usfm":"2SA","chapter":23},{"label":"Gálatas 3","book_usfm":"GAL","chapter":3},{"label":"Ezequiel 30","book_usfm":"EZK","chapter":30},{"label":"Salmos 78:40-72","book_usfm":"PSA","chapter":78}]'::jsonb),
  (271, '[{"label":"2 Samuel 24","book_usfm":"2SA","chapter":24},{"label":"Gálatas 4","book_usfm":"GAL","chapter":4},{"label":"Ezequiel 31","book_usfm":"EZK","chapter":31},{"label":"Salmos 79","book_usfm":"PSA","chapter":79}]'::jsonb),
  (272, '[{"label":"1 Reyes 1","book_usfm":"1KI","chapter":1},{"label":"Gálatas 5","book_usfm":"GAL","chapter":5},{"label":"Ezequiel 32","book_usfm":"EZK","chapter":32},{"label":"Salmos 80","book_usfm":"PSA","chapter":80}]'::jsonb),
  (273, '[{"label":"1 Reyes 2","book_usfm":"1KI","chapter":2},{"label":"Gálatas 6","book_usfm":"GAL","chapter":6},{"label":"Ezequiel 33","book_usfm":"EZK","chapter":33},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82}]'::jsonb),
  (274, '[{"label":"1 Reyes 3","book_usfm":"1KI","chapter":3},{"label":"Efesios 1","book_usfm":"EPH","chapter":1},{"label":"Ezequiel 34","book_usfm":"EZK","chapter":34},{"label":"Salmos 83-84","book_usfm":"PSA","chapter":83,"chapter_end":84}]'::jsonb),
  (275, '[{"label":"1 Reyes 4-5","book_usfm":"1KI","chapter":4,"chapter_end":5},{"label":"Efesios 2","book_usfm":"EPH","chapter":2},{"label":"Ezequiel 35","book_usfm":"EZK","chapter":35},{"label":"Salmos 85","book_usfm":"PSA","chapter":85}]'::jsonb),
  (276, '[{"label":"1 Reyes 6","book_usfm":"1KI","chapter":6},{"label":"Efesios 3","book_usfm":"EPH","chapter":3},{"label":"Ezequiel 36","book_usfm":"EZK","chapter":36},{"label":"Salmos 86","book_usfm":"PSA","chapter":86}]'::jsonb),
  (277, '[{"label":"1 Reyes 7","book_usfm":"1KI","chapter":7},{"label":"Efesios 4","book_usfm":"EPH","chapter":4},{"label":"Ezequiel 37","book_usfm":"EZK","chapter":37},{"label":"Salmos 87-88","book_usfm":"PSA","chapter":87,"chapter_end":88}]'::jsonb),
  (278, '[{"label":"1 Reyes 8","book_usfm":"1KI","chapter":8},{"label":"Efesios 5","book_usfm":"EPH","chapter":5},{"label":"Ezequiel 38","book_usfm":"EZK","chapter":38},{"label":"Salmos 89","book_usfm":"PSA","chapter":89}]'::jsonb),
  (279, '[{"label":"1 Reyes 9","book_usfm":"1KI","chapter":9},{"label":"Efesios 6","book_usfm":"EPH","chapter":6},{"label":"Ezequiel 39","book_usfm":"EZK","chapter":39},{"label":"Salmos 90","book_usfm":"PSA","chapter":90}]'::jsonb),
  (280, '[{"label":"1 Reyes 10","book_usfm":"1KI","chapter":10},{"label":"Filipenses 1","book_usfm":"PHP","chapter":1},{"label":"Ezequiel 40","book_usfm":"EZK","chapter":40},{"label":"Salmos 91","book_usfm":"PSA","chapter":91}]'::jsonb),
  (281, '[{"label":"1 Reyes 11","book_usfm":"1KI","chapter":11},{"label":"Filipenses 2","book_usfm":"PHP","chapter":2},{"label":"Ezequiel 41","book_usfm":"EZK","chapter":41},{"label":"Salmos 92-93","book_usfm":"PSA","chapter":92,"chapter_end":93}]'::jsonb),
  (282, '[{"label":"1 Reyes 12","book_usfm":"1KI","chapter":12},{"label":"Filipenses 3","book_usfm":"PHP","chapter":3},{"label":"Ezequiel 42","book_usfm":"EZK","chapter":42},{"label":"Salmos 94","book_usfm":"PSA","chapter":94}]'::jsonb),
  (283, '[{"label":"1 Reyes 13","book_usfm":"1KI","chapter":13},{"label":"Filipenses 4","book_usfm":"PHP","chapter":4},{"label":"Ezequiel 43","book_usfm":"EZK","chapter":43},{"label":"Salmos 95-96","book_usfm":"PSA","chapter":95,"chapter_end":96}]'::jsonb),
  (284, '[{"label":"1 Reyes 14","book_usfm":"1KI","chapter":14},{"label":"Colosenses 1","book_usfm":"COL","chapter":1},{"label":"Ezequiel 44","book_usfm":"EZK","chapter":44},{"label":"Salmos 97-98","book_usfm":"PSA","chapter":97,"chapter_end":98}]'::jsonb),
  (285, '[{"label":"1 Reyes 15","book_usfm":"1KI","chapter":15},{"label":"Colosenses 2","book_usfm":"COL","chapter":2},{"label":"Ezequiel 45","book_usfm":"EZK","chapter":45},{"label":"Salmos 99-101","book_usfm":"PSA","chapter":99,"chapter_end":101}]'::jsonb),
  (286, '[{"label":"1 Reyes 16","book_usfm":"1KI","chapter":16},{"label":"Colosenses 3","book_usfm":"COL","chapter":3},{"label":"Ezequiel 46","book_usfm":"EZK","chapter":46},{"label":"Salmos 102","book_usfm":"PSA","chapter":102}]'::jsonb),
  (287, '[{"label":"1 Reyes 17","book_usfm":"1KI","chapter":17},{"label":"Colosenses 4","book_usfm":"COL","chapter":4},{"label":"Ezequiel 47","book_usfm":"EZK","chapter":47},{"label":"Salmos 103","book_usfm":"PSA","chapter":103}]'::jsonb),
  (288, '[{"label":"1 Reyes 18","book_usfm":"1KI","chapter":18},{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1},{"label":"Ezequiel 48","book_usfm":"EZK","chapter":48},{"label":"Salmos 104","book_usfm":"PSA","chapter":104}]'::jsonb),
  (289, '[{"label":"1 Reyes 19","book_usfm":"1KI","chapter":19},{"label":"1 Tesalonicenses 2","book_usfm":"1TH","chapter":2},{"label":"Daniel 1","book_usfm":"DAN","chapter":1},{"label":"Salmos 105","book_usfm":"PSA","chapter":105}]'::jsonb),
  (290, '[{"label":"1 Reyes 20","book_usfm":"1KI","chapter":20},{"label":"1 Tesalonicenses 3","book_usfm":"1TH","chapter":3},{"label":"Daniel 2","book_usfm":"DAN","chapter":2},{"label":"Salmos 106","book_usfm":"PSA","chapter":106}]'::jsonb),
  (291, '[{"label":"1 Reyes 21","book_usfm":"1KI","chapter":21},{"label":"1 Tesalonicenses 4","book_usfm":"1TH","chapter":4},{"label":"Daniel 3","book_usfm":"DAN","chapter":3},{"label":"Salmos 107","book_usfm":"PSA","chapter":107}]'::jsonb),
  (292, '[{"label":"1 Reyes 22","book_usfm":"1KI","chapter":22},{"label":"1 Tesalonicenses 5","book_usfm":"1TH","chapter":5},{"label":"Daniel 4","book_usfm":"DAN","chapter":4},{"label":"Salmos 108-109","book_usfm":"PSA","chapter":108,"chapter_end":109}]'::jsonb),
  (293, '[{"label":"2 Reyes 1","book_usfm":"2KI","chapter":1},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1},{"label":"Daniel 5","book_usfm":"DAN","chapter":5},{"label":"Salmos 110-111","book_usfm":"PSA","chapter":110,"chapter_end":111}]'::jsonb),
  (294, '[{"label":"2 Reyes 2","book_usfm":"2KI","chapter":2},{"label":"2 Tesalonicenses 2","book_usfm":"2TH","chapter":2},{"label":"Daniel 6","book_usfm":"DAN","chapter":6},{"label":"Salmos 112-113","book_usfm":"PSA","chapter":112,"chapter_end":113}]'::jsonb),
  (295, '[{"label":"2 Reyes 3","book_usfm":"2KI","chapter":3},{"label":"2 Tesalonicenses 3","book_usfm":"2TH","chapter":3},{"label":"Daniel 7","book_usfm":"DAN","chapter":7},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115}]'::jsonb),
  (296, '[{"label":"2 Reyes 4","book_usfm":"2KI","chapter":4},{"label":"1 Timoteo 1","book_usfm":"1TI","chapter":1},{"label":"Daniel 8","book_usfm":"DAN","chapter":8},{"label":"Salmos 116","book_usfm":"PSA","chapter":116}]'::jsonb),
  (297, '[{"label":"2 Reyes 5","book_usfm":"2KI","chapter":5},{"label":"1 Timoteo 2","book_usfm":"1TI","chapter":2},{"label":"Daniel 9","book_usfm":"DAN","chapter":9},{"label":"Salmos 117-118","book_usfm":"PSA","chapter":117,"chapter_end":118}]'::jsonb),
  (298, '[{"label":"2 Reyes 6","book_usfm":"2KI","chapter":6},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3},{"label":"Daniel 10","book_usfm":"DAN","chapter":10},{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119}]'::jsonb),
  (299, '[{"label":"2 Reyes 7","book_usfm":"2KI","chapter":7},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4},{"label":"Daniel 11","book_usfm":"DAN","chapter":11},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119}]'::jsonb),
  (300, '[{"label":"2 Reyes 8","book_usfm":"2KI","chapter":8},{"label":"1 Timoteo 5","book_usfm":"1TI","chapter":5},{"label":"Daniel 12","book_usfm":"DAN","chapter":12},{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119}]'::jsonb),
  (301, '[{"label":"2 Reyes 9","book_usfm":"2KI","chapter":9},{"label":"1 Timoteo 6","book_usfm":"1TI","chapter":6},{"label":"Oseas 1","book_usfm":"HOS","chapter":1},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119}]'::jsonb),
  (302, '[{"label":"2 Reyes 10-11","book_usfm":"2KI","chapter":10,"chapter_end":11},{"label":"2 Timoteo 1","book_usfm":"2TI","chapter":1},{"label":"Oseas 2","book_usfm":"HOS","chapter":2},{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119}]'::jsonb),
  (303, '[{"label":"2 Reyes 12","book_usfm":"2KI","chapter":12},{"label":"2 Timoteo 2","book_usfm":"2TI","chapter":2},{"label":"Oseas 3-4","book_usfm":"HOS","chapter":3,"chapter_end":4},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119}]'::jsonb),
  (304, '[{"label":"2 Reyes 13","book_usfm":"2KI","chapter":13},{"label":"2 Timoteo 3","book_usfm":"2TI","chapter":3},{"label":"Oseas 5-6","book_usfm":"HOS","chapter":5,"chapter_end":6},{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119}]'::jsonb),
  (305, '[{"label":"2 Reyes 14","book_usfm":"2KI","chapter":14},{"label":"2 Timoteo 4","book_usfm":"2TI","chapter":4},{"label":"Oseas 7","book_usfm":"HOS","chapter":7},{"label":"Salmos 120-122","book_usfm":"PSA","chapter":120,"chapter_end":122}]'::jsonb),
  (306, '[{"label":"2 Reyes 15","book_usfm":"2KI","chapter":15},{"label":"Tito 1","book_usfm":"TIT","chapter":1},{"label":"Oseas 8","book_usfm":"HOS","chapter":8},{"label":"Salmos 123-125","book_usfm":"PSA","chapter":123,"chapter_end":125}]'::jsonb),
  (307, '[{"label":"2 Reyes 16","book_usfm":"2KI","chapter":16},{"label":"Tito 2","book_usfm":"TIT","chapter":2},{"label":"Oseas 9","book_usfm":"HOS","chapter":9},{"label":"Salmos 126-128","book_usfm":"PSA","chapter":126,"chapter_end":128}]'::jsonb),
  (308, '[{"label":"2 Reyes 17","book_usfm":"2KI","chapter":17},{"label":"Tito 3","book_usfm":"TIT","chapter":3},{"label":"Oseas 10","book_usfm":"HOS","chapter":10},{"label":"Salmos 129-131","book_usfm":"PSA","chapter":129,"chapter_end":131}]'::jsonb),
  (309, '[{"label":"2 Reyes 18","book_usfm":"2KI","chapter":18},{"label":"Filemón 1","book_usfm":"PHM","chapter":1},{"label":"Oseas 11","book_usfm":"HOS","chapter":11},{"label":"Salmos 132-134","book_usfm":"PSA","chapter":132,"chapter_end":134}]'::jsonb),
  (310, '[{"label":"2 Reyes 19","book_usfm":"2KI","chapter":19},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Oseas 12","book_usfm":"HOS","chapter":12},{"label":"Salmos 135-136","book_usfm":"PSA","chapter":135,"chapter_end":136}]'::jsonb),
  (311, '[{"label":"2 Reyes 20","book_usfm":"2KI","chapter":20},{"label":"Hebreos 2","book_usfm":"HEB","chapter":2},{"label":"Oseas 13","book_usfm":"HOS","chapter":13},{"label":"Salmos 137-138","book_usfm":"PSA","chapter":137,"chapter_end":138}]'::jsonb),
  (312, '[{"label":"2 Reyes 21","book_usfm":"2KI","chapter":21},{"label":"Hebreos 3","book_usfm":"HEB","chapter":3},{"label":"Oseas 14","book_usfm":"HOS","chapter":14},{"label":"Salmos 139","book_usfm":"PSA","chapter":139}]'::jsonb),
  (313, '[{"label":"2 Reyes 22","book_usfm":"2KI","chapter":22},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4},{"label":"Joel 1","book_usfm":"JOL","chapter":1},{"label":"Salmos 140-141","book_usfm":"PSA","chapter":140,"chapter_end":141}]'::jsonb),
  (314, '[{"label":"2 Reyes 23","book_usfm":"2KI","chapter":23},{"label":"Hebreos 5","book_usfm":"HEB","chapter":5},{"label":"Joel 2","book_usfm":"JOL","chapter":2},{"label":"Salmos 142","book_usfm":"PSA","chapter":142}]'::jsonb),
  (315, '[{"label":"2 Reyes 24","book_usfm":"2KI","chapter":24},{"label":"Hebreos 6","book_usfm":"HEB","chapter":6},{"label":"Joel 3","book_usfm":"JOL","chapter":3},{"label":"Salmos 143","book_usfm":"PSA","chapter":143}]'::jsonb),
  (316, '[{"label":"2 Reyes 25","book_usfm":"2KI","chapter":25},{"label":"Hebreos 7","book_usfm":"HEB","chapter":7},{"label":"Amós 1","book_usfm":"AMO","chapter":1},{"label":"Salmos 144","book_usfm":"PSA","chapter":144}]'::jsonb),
  (317, '[{"label":"1 Crónicas 1-2","book_usfm":"1CH","chapter":1,"chapter_end":2},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8},{"label":"Amós 2","book_usfm":"AMO","chapter":2},{"label":"Salmos 145","book_usfm":"PSA","chapter":145}]'::jsonb),
  (318, '[{"label":"1 Crónicas 3-4","book_usfm":"1CH","chapter":3,"chapter_end":4},{"label":"Hebreos 9","book_usfm":"HEB","chapter":9},{"label":"Amós 3","book_usfm":"AMO","chapter":3},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147}]'::jsonb),
  (319, '[{"label":"1 Crónicas 5-6","book_usfm":"1CH","chapter":5,"chapter_end":6},{"label":"Hebreos 10","book_usfm":"HEB","chapter":10},{"label":"Amós 4","book_usfm":"AMO","chapter":4},{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150}]'::jsonb),
  (320, '[{"label":"1 Crónicas 7-8","book_usfm":"1CH","chapter":7,"chapter_end":8},{"label":"Hebreos 11","book_usfm":"HEB","chapter":11},{"label":"Amós 5","book_usfm":"AMO","chapter":5},{"label":"Lucas 1:1-38","book_usfm":"LUK","chapter":1}]'::jsonb),
  (321, '[{"label":"1 Crónicas 9-10","book_usfm":"1CH","chapter":9,"chapter_end":10},{"label":"Hebreos 12","book_usfm":"HEB","chapter":12},{"label":"Amós 6","book_usfm":"AMO","chapter":6},{"label":"Lucas 1:39-80","book_usfm":"LUK","chapter":1}]'::jsonb),
  (322, '[{"label":"1 Crónicas 11-12","book_usfm":"1CH","chapter":11,"chapter_end":12},{"label":"Hebreos 13","book_usfm":"HEB","chapter":13},{"label":"Amós 7","book_usfm":"AMO","chapter":7},{"label":"Lucas 2","book_usfm":"LUK","chapter":2}]'::jsonb),
  (323, '[{"label":"1 Crónicas 13-14","book_usfm":"1CH","chapter":13,"chapter_end":14},{"label":"Santiago 1","book_usfm":"JAS","chapter":1},{"label":"Amós 8","book_usfm":"AMO","chapter":8},{"label":"Lucas 3","book_usfm":"LUK","chapter":3}]'::jsonb),
  (324, '[{"label":"1 Crónicas 15","book_usfm":"1CH","chapter":15},{"label":"Santiago 2","book_usfm":"JAS","chapter":2},{"label":"Amós 9","book_usfm":"AMO","chapter":9},{"label":"Lucas 4","book_usfm":"LUK","chapter":4}]'::jsonb),
  (325, '[{"label":"1 Crónicas 16","book_usfm":"1CH","chapter":16},{"label":"Santiago 3","book_usfm":"JAS","chapter":3},{"label":"Abdías 1","book_usfm":"OBA","chapter":1},{"label":"Lucas 5","book_usfm":"LUK","chapter":5}]'::jsonb),
  (326, '[{"label":"1 Crónicas 17","book_usfm":"1CH","chapter":17},{"label":"Santiago 4","book_usfm":"JAS","chapter":4},{"label":"Jonás 1","book_usfm":"JON","chapter":1},{"label":"Lucas 6","book_usfm":"LUK","chapter":6}]'::jsonb),
  (327, '[{"label":"1 Crónicas 18","book_usfm":"1CH","chapter":18},{"label":"Santiago 5","book_usfm":"JAS","chapter":5},{"label":"Jonás 2","book_usfm":"JON","chapter":2},{"label":"Lucas 7","book_usfm":"LUK","chapter":7}]'::jsonb),
  (328, '[{"label":"1 Crónicas 19-20","book_usfm":"1CH","chapter":19,"chapter_end":20},{"label":"1 Pedro 1","book_usfm":"1PE","chapter":1},{"label":"Jonás 3","book_usfm":"JON","chapter":3},{"label":"Lucas 8","book_usfm":"LUK","chapter":8}]'::jsonb),
  (329, '[{"label":"1 Crónicas 21","book_usfm":"1CH","chapter":21},{"label":"1 Pedro 2","book_usfm":"1PE","chapter":2},{"label":"Jonás 4","book_usfm":"JON","chapter":4},{"label":"Lucas 9","book_usfm":"LUK","chapter":9}]'::jsonb),
  (330, '[{"label":"1 Crónicas 22","book_usfm":"1CH","chapter":22},{"label":"1 Pedro 3","book_usfm":"1PE","chapter":3},{"label":"Miqueas 1","book_usfm":"MIC","chapter":1},{"label":"Lucas 10","book_usfm":"LUK","chapter":10}]'::jsonb),
  (331, '[{"label":"1 Crónicas 23","book_usfm":"1CH","chapter":23},{"label":"1 Pedro 4","book_usfm":"1PE","chapter":4},{"label":"Miqueas 2","book_usfm":"MIC","chapter":2},{"label":"Lucas 11","book_usfm":"LUK","chapter":11}]'::jsonb),
  (332, '[{"label":"1 Crónicas 24-25","book_usfm":"1CH","chapter":24,"chapter_end":25},{"label":"1 Pedro 5","book_usfm":"1PE","chapter":5},{"label":"Miqueas 3","book_usfm":"MIC","chapter":3},{"label":"Lucas 12","book_usfm":"LUK","chapter":12}]'::jsonb),
  (333, '[{"label":"1 Crónicas 26-27","book_usfm":"1CH","chapter":26,"chapter_end":27},{"label":"2 Pedro 1","book_usfm":"2PE","chapter":1},{"label":"Miqueas 4","book_usfm":"MIC","chapter":4},{"label":"Lucas 13","book_usfm":"LUK","chapter":13}]'::jsonb),
  (334, '[{"label":"1 Crónicas 28","book_usfm":"1CH","chapter":28},{"label":"2 Pedro 2","book_usfm":"2PE","chapter":2},{"label":"Miqueas 5","book_usfm":"MIC","chapter":5},{"label":"Lucas 14","book_usfm":"LUK","chapter":14}]'::jsonb),
  (335, '[{"label":"1 Crónicas 29","book_usfm":"1CH","chapter":29},{"label":"2 Pedro 3","book_usfm":"2PE","chapter":3},{"label":"Miqueas 6","book_usfm":"MIC","chapter":6},{"label":"Lucas 15","book_usfm":"LUK","chapter":15}]'::jsonb),
  (336, '[{"label":"2 Crónicas 1","book_usfm":"2CH","chapter":1},{"label":"1 Juan 1","book_usfm":"1JN","chapter":1},{"label":"Miqueas 7","book_usfm":"MIC","chapter":7},{"label":"Lucas 16","book_usfm":"LUK","chapter":16}]'::jsonb),
  (337, '[{"label":"2 Crónicas 2","book_usfm":"2CH","chapter":2},{"label":"1 Juan 2","book_usfm":"1JN","chapter":2},{"label":"Nahúm 1","book_usfm":"NAM","chapter":1},{"label":"Lucas 17","book_usfm":"LUK","chapter":17}]'::jsonb),
  (338, '[{"label":"2 Crónicas 3-4","book_usfm":"2CH","chapter":3,"chapter_end":4},{"label":"1 Juan 3","book_usfm":"1JN","chapter":3},{"label":"Nahúm 2","book_usfm":"NAM","chapter":2},{"label":"Lucas 18","book_usfm":"LUK","chapter":18}]'::jsonb),
  (339, '[{"label":"2 Crónicas 5:1-6:11","book_usfm":"2CH","chapter":5,"chapter_end":6},{"label":"1 Juan 4","book_usfm":"1JN","chapter":4},{"label":"Nahúm 3","book_usfm":"NAM","chapter":3},{"label":"Lucas 19","book_usfm":"LUK","chapter":19}]'::jsonb),
  (340, '[{"label":"2 Crónicas 6:12-42","book_usfm":"2CH","chapter":6},{"label":"1 Juan 5","book_usfm":"1JN","chapter":5},{"label":"Habacuc 1","book_usfm":"HAB","chapter":1},{"label":"Lucas 20","book_usfm":"LUK","chapter":20}]'::jsonb),
  (341, '[{"label":"2 Crónicas 7","book_usfm":"2CH","chapter":7},{"label":"2 Juan 1","book_usfm":"2JN","chapter":1},{"label":"Habacuc 2","book_usfm":"HAB","chapter":2},{"label":"Lucas 21","book_usfm":"LUK","chapter":21}]'::jsonb),
  (342, '[{"label":"2 Crónicas 8","book_usfm":"2CH","chapter":8},{"label":"3 Juan 1","book_usfm":"3JN","chapter":1},{"label":"Habacuc 3","book_usfm":"HAB","chapter":3},{"label":"Lucas 22","book_usfm":"LUK","chapter":22}]'::jsonb),
  (343, '[{"label":"2 Crónicas 9","book_usfm":"2CH","chapter":9},{"label":"Judas 1","book_usfm":"JUD","chapter":1},{"label":"Sofonías 1","book_usfm":"ZEP","chapter":1},{"label":"Lucas 23","book_usfm":"LUK","chapter":23}]'::jsonb),
  (344, '[{"label":"2 Crónicas 10","book_usfm":"2CH","chapter":10},{"label":"Apocalipsis 1","book_usfm":"REV","chapter":1},{"label":"Sofonías 2","book_usfm":"ZEP","chapter":2},{"label":"Lucas 24","book_usfm":"LUK","chapter":24}]'::jsonb),
  (345, '[{"label":"2 Crónicas 11-12","book_usfm":"2CH","chapter":11,"chapter_end":12},{"label":"Apocalipsis 2","book_usfm":"REV","chapter":2},{"label":"Sofonías 3","book_usfm":"ZEP","chapter":3},{"label":"Juan 1","book_usfm":"JHN","chapter":1}]'::jsonb),
  (346, '[{"label":"2 Crónicas 13","book_usfm":"2CH","chapter":13},{"label":"Apocalipsis 3","book_usfm":"REV","chapter":3},{"label":"Hageo 1","book_usfm":"HAG","chapter":1},{"label":"Juan 2","book_usfm":"JHN","chapter":2}]'::jsonb),
  (347, '[{"label":"2 Crónicas 14-15","book_usfm":"2CH","chapter":14,"chapter_end":15},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4},{"label":"Hageo 2","book_usfm":"HAG","chapter":2},{"label":"Juan 3","book_usfm":"JHN","chapter":3}]'::jsonb),
  (348, '[{"label":"2 Crónicas 16","book_usfm":"2CH","chapter":16},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5},{"label":"Zacarías 1","book_usfm":"ZEC","chapter":1},{"label":"Juan 4","book_usfm":"JHN","chapter":4}]'::jsonb),
  (349, '[{"label":"2 Crónicas 17","book_usfm":"2CH","chapter":17},{"label":"Apocalipsis 6","book_usfm":"REV","chapter":6},{"label":"Zacarías 2","book_usfm":"ZEC","chapter":2},{"label":"Juan 5","book_usfm":"JHN","chapter":5}]'::jsonb),
  (350, '[{"label":"2 Crónicas 18","book_usfm":"2CH","chapter":18},{"label":"Apocalipsis 7","book_usfm":"REV","chapter":7},{"label":"Zacarías 3","book_usfm":"ZEC","chapter":3},{"label":"Juan 6","book_usfm":"JHN","chapter":6}]'::jsonb),
  (351, '[{"label":"2 Crónicas 19-20","book_usfm":"2CH","chapter":19,"chapter_end":20},{"label":"Apocalipsis 8","book_usfm":"REV","chapter":8},{"label":"Zacarías 4","book_usfm":"ZEC","chapter":4},{"label":"Juan 7","book_usfm":"JHN","chapter":7}]'::jsonb),
  (352, '[{"label":"2 Crónicas 21","book_usfm":"2CH","chapter":21},{"label":"Apocalipsis 9","book_usfm":"REV","chapter":9},{"label":"Zacarías 5","book_usfm":"ZEC","chapter":5},{"label":"Juan 8","book_usfm":"JHN","chapter":8}]'::jsonb),
  (353, '[{"label":"2 Crónicas 22-23","book_usfm":"2CH","chapter":22,"chapter_end":23},{"label":"Apocalipsis 10","book_usfm":"REV","chapter":10},{"label":"Zacarías 6","book_usfm":"ZEC","chapter":6},{"label":"Juan 9","book_usfm":"JHN","chapter":9}]'::jsonb),
  (354, '[{"label":"2 Crónicas 24","book_usfm":"2CH","chapter":24},{"label":"Apocalipsis 11","book_usfm":"REV","chapter":11},{"label":"Zacarías 7","book_usfm":"ZEC","chapter":7},{"label":"Juan 10","book_usfm":"JHN","chapter":10}]'::jsonb),
  (355, '[{"label":"2 Crónicas 25","book_usfm":"2CH","chapter":25},{"label":"Apocalipsis 12","book_usfm":"REV","chapter":12},{"label":"Zacarías 8","book_usfm":"ZEC","chapter":8},{"label":"Juan 11","book_usfm":"JHN","chapter":11}]'::jsonb),
  (356, '[{"label":"2 Crónicas 26","book_usfm":"2CH","chapter":26},{"label":"Apocalipsis 13","book_usfm":"REV","chapter":13},{"label":"Zacarías 9","book_usfm":"ZEC","chapter":9},{"label":"Juan 12","book_usfm":"JHN","chapter":12}]'::jsonb),
  (357, '[{"label":"2 Crónicas 27-28","book_usfm":"2CH","chapter":27,"chapter_end":28},{"label":"Apocalipsis 14","book_usfm":"REV","chapter":14},{"label":"Zacarías 10","book_usfm":"ZEC","chapter":10},{"label":"Juan 13","book_usfm":"JHN","chapter":13}]'::jsonb),
  (358, '[{"label":"2 Crónicas 29","book_usfm":"2CH","chapter":29},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15},{"label":"Zacarías 11","book_usfm":"ZEC","chapter":11},{"label":"Juan 14","book_usfm":"JHN","chapter":14}]'::jsonb),
  (359, '[{"label":"2 Crónicas 30","book_usfm":"2CH","chapter":30},{"label":"Apocalipsis 16","book_usfm":"REV","chapter":16},{"label":"Zacarías 12:1-13:1","book_usfm":"ZEC","chapter":12,"chapter_end":13},{"label":"Juan 15","book_usfm":"JHN","chapter":15}]'::jsonb),
  (360, '[{"label":"2 Crónicas 31","book_usfm":"2CH","chapter":31},{"label":"Apocalipsis 17","book_usfm":"REV","chapter":17},{"label":"Zacarías 13:2-9","book_usfm":"ZEC","chapter":13},{"label":"Juan 16","book_usfm":"JHN","chapter":16}]'::jsonb),
  (361, '[{"label":"2 Crónicas 32","book_usfm":"2CH","chapter":32},{"label":"Apocalipsis 18","book_usfm":"REV","chapter":18},{"label":"Zacarías 14","book_usfm":"ZEC","chapter":14},{"label":"Juan 17","book_usfm":"JHN","chapter":17}]'::jsonb),
  (362, '[{"label":"2 Crónicas 33","book_usfm":"2CH","chapter":33},{"label":"Apocalipsis 19","book_usfm":"REV","chapter":19},{"label":"Malaquías 1","book_usfm":"MAL","chapter":1},{"label":"Juan 18","book_usfm":"JHN","chapter":18}]'::jsonb),
  (363, '[{"label":"2 Crónicas 34","book_usfm":"2CH","chapter":34},{"label":"Apocalipsis 20","book_usfm":"REV","chapter":20},{"label":"Malaquías 2","book_usfm":"MAL","chapter":2},{"label":"Juan 19","book_usfm":"JHN","chapter":19}]'::jsonb),
  (364, '[{"label":"2 Crónicas 35","book_usfm":"2CH","chapter":35},{"label":"Apocalipsis 21","book_usfm":"REV","chapter":21},{"label":"Malaquías 3","book_usfm":"MAL","chapter":3},{"label":"Juan 20","book_usfm":"JHN","chapter":20}]'::jsonb),
  (365, '[{"label":"2 Crónicas 36","book_usfm":"2CH","chapter":36},{"label":"Apocalipsis 22","book_usfm":"REV","chapter":22},{"label":"Malaquías 4","book_usfm":"MAL","chapter":4},{"label":"Juan 21","book_usfm":"JHN","chapter":21}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'mcheyne';

-- ---- Plan: Cronológico (365 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('cronologico', 'Cronológico', 'La Biblia en el orden en que ocurrieron los hechos, en un año.', 365, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'cronologico');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Génesis 1","book_usfm":"GEN","chapter":1},{"label":"Génesis 2","book_usfm":"GEN","chapter":2},{"label":"Génesis 3","book_usfm":"GEN","chapter":3}]'::jsonb),
  (2, '[{"label":"Génesis 4","book_usfm":"GEN","chapter":4},{"label":"Génesis 5","book_usfm":"GEN","chapter":5},{"label":"Génesis 6","book_usfm":"GEN","chapter":6},{"label":"Génesis 7","book_usfm":"GEN","chapter":7}]'::jsonb),
  (3, '[{"label":"Génesis 8","book_usfm":"GEN","chapter":8},{"label":"Génesis 9","book_usfm":"GEN","chapter":9},{"label":"Génesis 10","book_usfm":"GEN","chapter":10},{"label":"Génesis 11","book_usfm":"GEN","chapter":11}]'::jsonb),
  (4, '[{"label":"Job 1","book_usfm":"JOB","chapter":1},{"label":"Job 2","book_usfm":"JOB","chapter":2},{"label":"Job 3","book_usfm":"JOB","chapter":3},{"label":"Job 4","book_usfm":"JOB","chapter":4},{"label":"Job 5","book_usfm":"JOB","chapter":5}]'::jsonb),
  (5, '[{"label":"Job 6","book_usfm":"JOB","chapter":6},{"label":"Job 7","book_usfm":"JOB","chapter":7},{"label":"Job 8","book_usfm":"JOB","chapter":8},{"label":"Job 9","book_usfm":"JOB","chapter":9}]'::jsonb),
  (6, '[{"label":"Job 10","book_usfm":"JOB","chapter":10},{"label":"Job 11","book_usfm":"JOB","chapter":11},{"label":"Job 12","book_usfm":"JOB","chapter":12},{"label":"Job 13","book_usfm":"JOB","chapter":13}]'::jsonb),
  (7, '[{"label":"Job 14","book_usfm":"JOB","chapter":14},{"label":"Job 15","book_usfm":"JOB","chapter":15},{"label":"Job 16","book_usfm":"JOB","chapter":16}]'::jsonb),
  (8, '[{"label":"Job 17","book_usfm":"JOB","chapter":17},{"label":"Job 18","book_usfm":"JOB","chapter":18},{"label":"Job 19","book_usfm":"JOB","chapter":19},{"label":"Job 20","book_usfm":"JOB","chapter":20}]'::jsonb),
  (9, '[{"label":"Job 21","book_usfm":"JOB","chapter":21},{"label":"Job 22","book_usfm":"JOB","chapter":22},{"label":"Job 23","book_usfm":"JOB","chapter":23}]'::jsonb),
  (10, '[{"label":"Job 24","book_usfm":"JOB","chapter":24},{"label":"Job 25","book_usfm":"JOB","chapter":25},{"label":"Job 26","book_usfm":"JOB","chapter":26},{"label":"Job 27","book_usfm":"JOB","chapter":27},{"label":"Job 28","book_usfm":"JOB","chapter":28}]'::jsonb),
  (11, '[{"label":"Job 29","book_usfm":"JOB","chapter":29},{"label":"Job 30","book_usfm":"JOB","chapter":30},{"label":"Job 31","book_usfm":"JOB","chapter":31}]'::jsonb),
  (12, '[{"label":"Job 32","book_usfm":"JOB","chapter":32},{"label":"Job 33","book_usfm":"JOB","chapter":33},{"label":"Job 34","book_usfm":"JOB","chapter":34}]'::jsonb),
  (13, '[{"label":"Job 35","book_usfm":"JOB","chapter":35},{"label":"Job 36","book_usfm":"JOB","chapter":36},{"label":"Job 37","book_usfm":"JOB","chapter":37}]'::jsonb),
  (14, '[{"label":"Job 38","book_usfm":"JOB","chapter":38},{"label":"Job 39","book_usfm":"JOB","chapter":39}]'::jsonb),
  (15, '[{"label":"Job 40","book_usfm":"JOB","chapter":40},{"label":"Job 41","book_usfm":"JOB","chapter":41},{"label":"Job 42","book_usfm":"JOB","chapter":42}]'::jsonb),
  (16, '[{"label":"Génesis 12","book_usfm":"GEN","chapter":12},{"label":"Génesis 13","book_usfm":"GEN","chapter":13},{"label":"Génesis 14","book_usfm":"GEN","chapter":14},{"label":"Génesis 15","book_usfm":"GEN","chapter":15}]'::jsonb),
  (17, '[{"label":"Génesis 16","book_usfm":"GEN","chapter":16},{"label":"Génesis 17","book_usfm":"GEN","chapter":17},{"label":"Génesis 18","book_usfm":"GEN","chapter":18}]'::jsonb),
  (18, '[{"label":"Génesis 19","book_usfm":"GEN","chapter":19},{"label":"Génesis 20","book_usfm":"GEN","chapter":20},{"label":"Génesis 21","book_usfm":"GEN","chapter":21}]'::jsonb),
  (19, '[{"label":"Génesis 22","book_usfm":"GEN","chapter":22},{"label":"Génesis 23","book_usfm":"GEN","chapter":23},{"label":"Génesis 24","book_usfm":"GEN","chapter":24}]'::jsonb),
  (20, '[{"label":"Génesis 25","book_usfm":"GEN","chapter":25},{"label":"Génesis 26","book_usfm":"GEN","chapter":26}]'::jsonb),
  (21, '[{"label":"Génesis 27","book_usfm":"GEN","chapter":27},{"label":"Génesis 28","book_usfm":"GEN","chapter":28},{"label":"Génesis 29","book_usfm":"GEN","chapter":29}]'::jsonb),
  (22, '[{"label":"Génesis 30","book_usfm":"GEN","chapter":30},{"label":"Génesis 31","book_usfm":"GEN","chapter":31}]'::jsonb),
  (23, '[{"label":"Génesis 32","book_usfm":"GEN","chapter":32},{"label":"Génesis 33","book_usfm":"GEN","chapter":33},{"label":"Génesis 34","book_usfm":"GEN","chapter":34}]'::jsonb),
  (24, '[{"label":"Génesis 35","book_usfm":"GEN","chapter":35},{"label":"Génesis 36","book_usfm":"GEN","chapter":36},{"label":"Génesis 37","book_usfm":"GEN","chapter":37}]'::jsonb),
  (25, '[{"label":"Génesis 38","book_usfm":"GEN","chapter":38},{"label":"Génesis 39","book_usfm":"GEN","chapter":39},{"label":"Génesis 40","book_usfm":"GEN","chapter":40}]'::jsonb),
  (26, '[{"label":"Génesis 41","book_usfm":"GEN","chapter":41},{"label":"Génesis 42","book_usfm":"GEN","chapter":42}]'::jsonb),
  (27, '[{"label":"Génesis 43","book_usfm":"GEN","chapter":43},{"label":"Génesis 44","book_usfm":"GEN","chapter":44},{"label":"Génesis 45","book_usfm":"GEN","chapter":45}]'::jsonb),
  (28, '[{"label":"Génesis 46","book_usfm":"GEN","chapter":46},{"label":"Génesis 47","book_usfm":"GEN","chapter":47}]'::jsonb),
  (29, '[{"label":"Génesis 48","book_usfm":"GEN","chapter":48},{"label":"Génesis 49","book_usfm":"GEN","chapter":49},{"label":"Génesis 50","book_usfm":"GEN","chapter":50}]'::jsonb),
  (30, '[{"label":"Éxodo 1","book_usfm":"EXO","chapter":1},{"label":"Éxodo 2","book_usfm":"EXO","chapter":2},{"label":"Éxodo 3","book_usfm":"EXO","chapter":3}]'::jsonb),
  (31, '[{"label":"Éxodo 4","book_usfm":"EXO","chapter":4},{"label":"Éxodo 5","book_usfm":"EXO","chapter":5},{"label":"Éxodo 6","book_usfm":"EXO","chapter":6}]'::jsonb),
  (32, '[{"label":"Éxodo 7","book_usfm":"EXO","chapter":7},{"label":"Éxodo 8","book_usfm":"EXO","chapter":8},{"label":"Éxodo 9","book_usfm":"EXO","chapter":9}]'::jsonb),
  (33, '[{"label":"Éxodo 10","book_usfm":"EXO","chapter":10},{"label":"Éxodo 11","book_usfm":"EXO","chapter":11},{"label":"Éxodo 12","book_usfm":"EXO","chapter":12}]'::jsonb),
  (34, '[{"label":"Éxodo 13","book_usfm":"EXO","chapter":13},{"label":"Éxodo 14","book_usfm":"EXO","chapter":14},{"label":"Éxodo 15","book_usfm":"EXO","chapter":15}]'::jsonb),
  (35, '[{"label":"Éxodo 16","book_usfm":"EXO","chapter":16},{"label":"Éxodo 17","book_usfm":"EXO","chapter":17},{"label":"Éxodo 18","book_usfm":"EXO","chapter":18}]'::jsonb),
  (36, '[{"label":"Éxodo 19","book_usfm":"EXO","chapter":19},{"label":"Éxodo 20","book_usfm":"EXO","chapter":20},{"label":"Éxodo 21","book_usfm":"EXO","chapter":21}]'::jsonb),
  (37, '[{"label":"Éxodo 22","book_usfm":"EXO","chapter":22},{"label":"Éxodo 23","book_usfm":"EXO","chapter":23},{"label":"Éxodo 24","book_usfm":"EXO","chapter":24}]'::jsonb),
  (38, '[{"label":"Éxodo 25","book_usfm":"EXO","chapter":25},{"label":"Éxodo 26","book_usfm":"EXO","chapter":26},{"label":"Éxodo 27","book_usfm":"EXO","chapter":27}]'::jsonb),
  (39, '[{"label":"Éxodo 28","book_usfm":"EXO","chapter":28},{"label":"Éxodo 29","book_usfm":"EXO","chapter":29}]'::jsonb),
  (40, '[{"label":"Éxodo 30","book_usfm":"EXO","chapter":30},{"label":"Éxodo 31","book_usfm":"EXO","chapter":31},{"label":"Éxodo 32","book_usfm":"EXO","chapter":32}]'::jsonb),
  (41, '[{"label":"Éxodo 33","book_usfm":"EXO","chapter":33},{"label":"Éxodo 34","book_usfm":"EXO","chapter":34},{"label":"Éxodo 35","book_usfm":"EXO","chapter":35}]'::jsonb),
  (42, '[{"label":"Éxodo 36","book_usfm":"EXO","chapter":36},{"label":"Éxodo 37","book_usfm":"EXO","chapter":37},{"label":"Éxodo 38","book_usfm":"EXO","chapter":38}]'::jsonb),
  (43, '[{"label":"Éxodo 39","book_usfm":"EXO","chapter":39},{"label":"Éxodo 40","book_usfm":"EXO","chapter":40}]'::jsonb),
  (44, '[{"label":"Levítico 1","book_usfm":"LEV","chapter":1},{"label":"Levítico 2","book_usfm":"LEV","chapter":2},{"label":"Levítico 3","book_usfm":"LEV","chapter":3},{"label":"Levítico 4","book_usfm":"LEV","chapter":4}]'::jsonb),
  (45, '[{"label":"Levítico 5","book_usfm":"LEV","chapter":5},{"label":"Levítico 6","book_usfm":"LEV","chapter":6},{"label":"Levítico 7","book_usfm":"LEV","chapter":7}]'::jsonb),
  (46, '[{"label":"Levítico 8","book_usfm":"LEV","chapter":8},{"label":"Levítico 9","book_usfm":"LEV","chapter":9},{"label":"Levítico 10","book_usfm":"LEV","chapter":10}]'::jsonb),
  (47, '[{"label":"Levítico 11","book_usfm":"LEV","chapter":11},{"label":"Levítico 12","book_usfm":"LEV","chapter":12},{"label":"Levítico 13","book_usfm":"LEV","chapter":13}]'::jsonb),
  (48, '[{"label":"Levítico 14","book_usfm":"LEV","chapter":14},{"label":"Levítico 15","book_usfm":"LEV","chapter":15}]'::jsonb),
  (49, '[{"label":"Levítico 16","book_usfm":"LEV","chapter":16},{"label":"Levítico 17","book_usfm":"LEV","chapter":17},{"label":"Levítico 18","book_usfm":"LEV","chapter":18}]'::jsonb),
  (50, '[{"label":"Levítico 19","book_usfm":"LEV","chapter":19},{"label":"Levítico 20","book_usfm":"LEV","chapter":20},{"label":"Levítico 21","book_usfm":"LEV","chapter":21}]'::jsonb),
  (51, '[{"label":"Levítico 22","book_usfm":"LEV","chapter":22},{"label":"Levítico 23","book_usfm":"LEV","chapter":23}]'::jsonb),
  (52, '[{"label":"Levítico 24","book_usfm":"LEV","chapter":24},{"label":"Levítico 25","book_usfm":"LEV","chapter":25}]'::jsonb),
  (53, '[{"label":"Levítico 26","book_usfm":"LEV","chapter":26},{"label":"Levítico 27","book_usfm":"LEV","chapter":27}]'::jsonb),
  (54, '[{"label":"Números 1","book_usfm":"NUM","chapter":1},{"label":"Números 2","book_usfm":"NUM","chapter":2}]'::jsonb),
  (55, '[{"label":"Números 3","book_usfm":"NUM","chapter":3},{"label":"Números 4","book_usfm":"NUM","chapter":4}]'::jsonb),
  (56, '[{"label":"Números 5","book_usfm":"NUM","chapter":5},{"label":"Números 6","book_usfm":"NUM","chapter":6}]'::jsonb),
  (57, '[{"label":"Números 7","book_usfm":"NUM","chapter":7}]'::jsonb),
  (58, '[{"label":"Números 8","book_usfm":"NUM","chapter":8},{"label":"Números 9","book_usfm":"NUM","chapter":9},{"label":"Números 10","book_usfm":"NUM","chapter":10}]'::jsonb),
  (59, '[{"label":"Números 11","book_usfm":"NUM","chapter":11},{"label":"Números 12","book_usfm":"NUM","chapter":12},{"label":"Números 13","book_usfm":"NUM","chapter":13}]'::jsonb),
  (60, '[{"label":"Números 14","book_usfm":"NUM","chapter":14},{"label":"Números 15","book_usfm":"NUM","chapter":15},{"label":"Salmos 90","book_usfm":"PSA","chapter":90}]'::jsonb),
  (61, '[{"label":"Números 16","book_usfm":"NUM","chapter":16},{"label":"Números 17","book_usfm":"NUM","chapter":17}]'::jsonb),
  (62, '[{"label":"Números 18","book_usfm":"NUM","chapter":18},{"label":"Números 19","book_usfm":"NUM","chapter":19},{"label":"Números 20","book_usfm":"NUM","chapter":20}]'::jsonb),
  (63, '[{"label":"Números 21","book_usfm":"NUM","chapter":21},{"label":"Números 22","book_usfm":"NUM","chapter":22}]'::jsonb),
  (64, '[{"label":"Números 23","book_usfm":"NUM","chapter":23},{"label":"Números 24","book_usfm":"NUM","chapter":24},{"label":"Números 25","book_usfm":"NUM","chapter":25}]'::jsonb),
  (65, '[{"label":"Números 26","book_usfm":"NUM","chapter":26},{"label":"Números 27","book_usfm":"NUM","chapter":27}]'::jsonb),
  (66, '[{"label":"Números 28","book_usfm":"NUM","chapter":28},{"label":"Números 29","book_usfm":"NUM","chapter":29},{"label":"Números 30","book_usfm":"NUM","chapter":30}]'::jsonb),
  (67, '[{"label":"Números 31","book_usfm":"NUM","chapter":31},{"label":"Números 32","book_usfm":"NUM","chapter":32}]'::jsonb),
  (68, '[{"label":"Números 33","book_usfm":"NUM","chapter":33},{"label":"Números 34","book_usfm":"NUM","chapter":34}]'::jsonb),
  (69, '[{"label":"Números 35","book_usfm":"NUM","chapter":35},{"label":"Números 36","book_usfm":"NUM","chapter":36}]'::jsonb),
  (70, '[{"label":"Deuteronomio 1","book_usfm":"DEU","chapter":1},{"label":"Deuteronomio 2","book_usfm":"DEU","chapter":2}]'::jsonb),
  (71, '[{"label":"Deuteronomio 3","book_usfm":"DEU","chapter":3},{"label":"Deuteronomio 4","book_usfm":"DEU","chapter":4}]'::jsonb),
  (72, '[{"label":"Deuteronomio 5","book_usfm":"DEU","chapter":5},{"label":"Deuteronomio 6","book_usfm":"DEU","chapter":6},{"label":"Deuteronomio 7","book_usfm":"DEU","chapter":7}]'::jsonb),
  (73, '[{"label":"Deuteronomio 8","book_usfm":"DEU","chapter":8},{"label":"Deuteronomio 9","book_usfm":"DEU","chapter":9},{"label":"Deuteronomio 10","book_usfm":"DEU","chapter":10}]'::jsonb),
  (74, '[{"label":"Deuteronomio 11","book_usfm":"DEU","chapter":11},{"label":"Deuteronomio 12","book_usfm":"DEU","chapter":12},{"label":"Deuteronomio 13","book_usfm":"DEU","chapter":13}]'::jsonb),
  (75, '[{"label":"Deuteronomio 14","book_usfm":"DEU","chapter":14},{"label":"Deuteronomio 15","book_usfm":"DEU","chapter":15},{"label":"Deuteronomio 16","book_usfm":"DEU","chapter":16}]'::jsonb),
  (76, '[{"label":"Deuteronomio 17","book_usfm":"DEU","chapter":17},{"label":"Deuteronomio 18","book_usfm":"DEU","chapter":18},{"label":"Deuteronomio 19","book_usfm":"DEU","chapter":19},{"label":"Deuteronomio 20","book_usfm":"DEU","chapter":20}]'::jsonb),
  (77, '[{"label":"Deuteronomio 21","book_usfm":"DEU","chapter":21},{"label":"Deuteronomio 22","book_usfm":"DEU","chapter":22},{"label":"Deuteronomio 23","book_usfm":"DEU","chapter":23}]'::jsonb),
  (78, '[{"label":"Deuteronomio 24","book_usfm":"DEU","chapter":24},{"label":"Deuteronomio 25","book_usfm":"DEU","chapter":25},{"label":"Deuteronomio 26","book_usfm":"DEU","chapter":26},{"label":"Deuteronomio 27","book_usfm":"DEU","chapter":27}]'::jsonb),
  (79, '[{"label":"Deuteronomio 28","book_usfm":"DEU","chapter":28},{"label":"Deuteronomio 29","book_usfm":"DEU","chapter":29}]'::jsonb),
  (80, '[{"label":"Deuteronomio 30","book_usfm":"DEU","chapter":30},{"label":"Deuteronomio 31","book_usfm":"DEU","chapter":31}]'::jsonb),
  (81, '[{"label":"Deuteronomio 32","book_usfm":"DEU","chapter":32},{"label":"Deuteronomio 33","book_usfm":"DEU","chapter":33},{"label":"Deuteronomio 34","book_usfm":"DEU","chapter":34},{"label":"Salmos 91","book_usfm":"PSA","chapter":91}]'::jsonb),
  (82, '[{"label":"Josué 1","book_usfm":"JOS","chapter":1},{"label":"Josué 2","book_usfm":"JOS","chapter":2},{"label":"Josué 3","book_usfm":"JOS","chapter":3},{"label":"Josué 4","book_usfm":"JOS","chapter":4}]'::jsonb),
  (83, '[{"label":"Josué 5","book_usfm":"JOS","chapter":5},{"label":"Josué 6","book_usfm":"JOS","chapter":6},{"label":"Josué 7","book_usfm":"JOS","chapter":7},{"label":"Josué 8","book_usfm":"JOS","chapter":8}]'::jsonb),
  (84, '[{"label":"Josué 9","book_usfm":"JOS","chapter":9},{"label":"Josué 10","book_usfm":"JOS","chapter":10},{"label":"Josué 11","book_usfm":"JOS","chapter":11}]'::jsonb),
  (85, '[{"label":"Josué 12","book_usfm":"JOS","chapter":12},{"label":"Josué 13","book_usfm":"JOS","chapter":13},{"label":"Josué 14","book_usfm":"JOS","chapter":14},{"label":"Josué 15","book_usfm":"JOS","chapter":15}]'::jsonb),
  (86, '[{"label":"Josué 16","book_usfm":"JOS","chapter":16},{"label":"Josué 17","book_usfm":"JOS","chapter":17},{"label":"Josué 18","book_usfm":"JOS","chapter":18}]'::jsonb),
  (87, '[{"label":"Josué 19","book_usfm":"JOS","chapter":19},{"label":"Josué 20","book_usfm":"JOS","chapter":20},{"label":"Josué 21","book_usfm":"JOS","chapter":21}]'::jsonb),
  (88, '[{"label":"Josué 22","book_usfm":"JOS","chapter":22},{"label":"Josué 23","book_usfm":"JOS","chapter":23},{"label":"Josué 24","book_usfm":"JOS","chapter":24}]'::jsonb),
  (89, '[{"label":"Jueces 1","book_usfm":"JDG","chapter":1},{"label":"Jueces 2","book_usfm":"JDG","chapter":2}]'::jsonb),
  (90, '[{"label":"Jueces 3","book_usfm":"JDG","chapter":3},{"label":"Jueces 4","book_usfm":"JDG","chapter":4},{"label":"Jueces 5","book_usfm":"JDG","chapter":5}]'::jsonb),
  (91, '[{"label":"Jueces 6","book_usfm":"JDG","chapter":6},{"label":"Jueces 7","book_usfm":"JDG","chapter":7}]'::jsonb),
  (92, '[{"label":"Jueces 8","book_usfm":"JDG","chapter":8},{"label":"Jueces 9","book_usfm":"JDG","chapter":9}]'::jsonb),
  (93, '[{"label":"Jueces 10","book_usfm":"JDG","chapter":10},{"label":"Jueces 11","book_usfm":"JDG","chapter":11},{"label":"Jueces 12","book_usfm":"JDG","chapter":12}]'::jsonb),
  (94, '[{"label":"Jueces 13","book_usfm":"JDG","chapter":13},{"label":"Jueces 14","book_usfm":"JDG","chapter":14},{"label":"Jueces 15","book_usfm":"JDG","chapter":15}]'::jsonb),
  (95, '[{"label":"Jueces 16","book_usfm":"JDG","chapter":16},{"label":"Jueces 17","book_usfm":"JDG","chapter":17},{"label":"Jueces 18","book_usfm":"JDG","chapter":18}]'::jsonb),
  (96, '[{"label":"Jueces 19","book_usfm":"JDG","chapter":19},{"label":"Jueces 20","book_usfm":"JDG","chapter":20},{"label":"Jueces 21","book_usfm":"JDG","chapter":21}]'::jsonb),
  (97, '[{"label":"Rut 1","book_usfm":"RUT","chapter":1},{"label":"Rut 2","book_usfm":"RUT","chapter":2},{"label":"Rut 3","book_usfm":"RUT","chapter":3},{"label":"Rut 4","book_usfm":"RUT","chapter":4}]'::jsonb),
  (98, '[{"label":"1 Samuel 1","book_usfm":"1SA","chapter":1},{"label":"1 Samuel 2","book_usfm":"1SA","chapter":2},{"label":"1 Samuel 3","book_usfm":"1SA","chapter":3}]'::jsonb),
  (99, '[{"label":"1 Samuel 4","book_usfm":"1SA","chapter":4},{"label":"1 Samuel 5","book_usfm":"1SA","chapter":5},{"label":"1 Samuel 6","book_usfm":"1SA","chapter":6},{"label":"1 Samuel 7","book_usfm":"1SA","chapter":7},{"label":"1 Samuel 8","book_usfm":"1SA","chapter":8}]'::jsonb),
  (100, '[{"label":"1 Samuel 9","book_usfm":"1SA","chapter":9},{"label":"1 Samuel 10","book_usfm":"1SA","chapter":10},{"label":"1 Samuel 11","book_usfm":"1SA","chapter":11},{"label":"1 Samuel 12","book_usfm":"1SA","chapter":12}]'::jsonb),
  (101, '[{"label":"1 Samuel 13","book_usfm":"1SA","chapter":13},{"label":"1 Samuel 14","book_usfm":"1SA","chapter":14}]'::jsonb),
  (102, '[{"label":"1 Samuel 15","book_usfm":"1SA","chapter":15},{"label":"1 Samuel 16","book_usfm":"1SA","chapter":16},{"label":"1 Samuel 17","book_usfm":"1SA","chapter":17}]'::jsonb),
  (103, '[{"label":"1 Samuel 18","book_usfm":"1SA","chapter":18},{"label":"1 Samuel 19","book_usfm":"1SA","chapter":19},{"label":"1 Samuel 20","book_usfm":"1SA","chapter":20},{"label":"Salmos 11","book_usfm":"PSA","chapter":11},{"label":"Salmos 59","book_usfm":"PSA","chapter":59}]'::jsonb),
  (104, '[{"label":"1 Samuel 21","book_usfm":"1SA","chapter":21},{"label":"1 Samuel 22","book_usfm":"1SA","chapter":22},{"label":"1 Samuel 23","book_usfm":"1SA","chapter":23},{"label":"1 Samuel 24","book_usfm":"1SA","chapter":24}]'::jsonb),
  (105, '[{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 52","book_usfm":"PSA","chapter":52}]'::jsonb),
  (106, '[{"label":"Salmos 56","book_usfm":"PSA","chapter":56},{"label":"Salmos 120","book_usfm":"PSA","chapter":120},{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 142","book_usfm":"PSA","chapter":142}]'::jsonb),
  (107, '[{"label":"1 Samuel 25","book_usfm":"1SA","chapter":25},{"label":"1 Samuel 26","book_usfm":"1SA","chapter":26},{"label":"1 Samuel 27","book_usfm":"1SA","chapter":27}]'::jsonb),
  (108, '[{"label":"Salmos 17","book_usfm":"PSA","chapter":17},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 63","book_usfm":"PSA","chapter":63}]'::jsonb),
  (109, '[{"label":"1 Samuel 28","book_usfm":"1SA","chapter":28},{"label":"1 Samuel 29","book_usfm":"1SA","chapter":29},{"label":"1 Samuel 30","book_usfm":"1SA","chapter":30},{"label":"1 Samuel 31","book_usfm":"1SA","chapter":31},{"label":"Salmos 18","book_usfm":"PSA","chapter":18}]'::jsonb),
  (110, '[{"label":"Salmos 121","book_usfm":"PSA","chapter":121},{"label":"Salmos 123","book_usfm":"PSA","chapter":123},{"label":"Salmos 124","book_usfm":"PSA","chapter":124},{"label":"Salmos 125","book_usfm":"PSA","chapter":125},{"label":"Salmos 128","book_usfm":"PSA","chapter":128},{"label":"Salmos 129","book_usfm":"PSA","chapter":129},{"label":"Salmos 130","book_usfm":"PSA","chapter":130}]'::jsonb),
  (111, '[{"label":"2 Samuel 1","book_usfm":"2SA","chapter":1},{"label":"2 Samuel 2","book_usfm":"2SA","chapter":2},{"label":"2 Samuel 3","book_usfm":"2SA","chapter":3},{"label":"2 Samuel 4","book_usfm":"2SA","chapter":4}]'::jsonb),
  (112, '[{"label":"Salmos 6","book_usfm":"PSA","chapter":6},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 10","book_usfm":"PSA","chapter":10},{"label":"Salmos 14","book_usfm":"PSA","chapter":14},{"label":"Salmos 16","book_usfm":"PSA","chapter":16},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 21","book_usfm":"PSA","chapter":21}]'::jsonb),
  (113, '[{"label":"1 Crónicas 1","book_usfm":"1CH","chapter":1},{"label":"1 Crónicas 2","book_usfm":"1CH","chapter":2}]'::jsonb),
  (114, '[{"label":"Salmos 43","book_usfm":"PSA","chapter":43},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Salmos 87","book_usfm":"PSA","chapter":87}]'::jsonb),
  (115, '[{"label":"1 Crónicas 3","book_usfm":"1CH","chapter":3},{"label":"1 Crónicas 4","book_usfm":"1CH","chapter":4},{"label":"1 Crónicas 5","book_usfm":"1CH","chapter":5}]'::jsonb),
  (116, '[{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 78","book_usfm":"PSA","chapter":78}]'::jsonb),
  (117, '[{"label":"1 Crónicas 6","book_usfm":"1CH","chapter":6}]'::jsonb),
  (118, '[{"label":"Salmos 81","book_usfm":"PSA","chapter":81},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 92","book_usfm":"PSA","chapter":92},{"label":"Salmos 93","book_usfm":"PSA","chapter":93}]'::jsonb),
  (119, '[{"label":"1 Crónicas 7","book_usfm":"1CH","chapter":7},{"label":"1 Crónicas 8","book_usfm":"1CH","chapter":8},{"label":"1 Crónicas 9","book_usfm":"1CH","chapter":9},{"label":"1 Crónicas 10","book_usfm":"1CH","chapter":10}]'::jsonb),
  (120, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 104","book_usfm":"PSA","chapter":104}]'::jsonb),
  (121, '[{"label":"2 Samuel 5:1-10","book_usfm":"2SA","chapter":5},{"label":"1 Crónicas 11","book_usfm":"1CH","chapter":11},{"label":"1 Crónicas 12","book_usfm":"1CH","chapter":12}]'::jsonb),
  (122, '[{"label":"Salmos 133","book_usfm":"PSA","chapter":133}]'::jsonb),
  (123, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Salmos 107","book_usfm":"PSA","chapter":107}]'::jsonb),
  (124, '[{"label":"2 Samuel 5:11-25","book_usfm":"2SA","chapter":5},{"label":"2 Samuel 6","book_usfm":"2SA","chapter":6},{"label":"1 Crónicas 13","book_usfm":"1CH","chapter":13},{"label":"1 Crónicas 14","book_usfm":"1CH","chapter":14},{"label":"1 Crónicas 15","book_usfm":"1CH","chapter":15},{"label":"1 Crónicas 16","book_usfm":"1CH","chapter":16}]'::jsonb),
  (125, '[{"label":"Salmos 1","book_usfm":"PSA","chapter":1},{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 47","book_usfm":"PSA","chapter":47},{"label":"Salmos 68","book_usfm":"PSA","chapter":68}]'::jsonb),
  (126, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Salmos 132","book_usfm":"PSA","chapter":132}]'::jsonb),
  (127, '[{"label":"2 Samuel 7","book_usfm":"2SA","chapter":7},{"label":"1 Crónicas 17","book_usfm":"1CH","chapter":17}]'::jsonb),
  (128, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39}]'::jsonb),
  (129, '[{"label":"2 Samuel 8","book_usfm":"2SA","chapter":8},{"label":"2 Samuel 9","book_usfm":"2SA","chapter":9},{"label":"1 Crónicas 18","book_usfm":"1CH","chapter":18}]'::jsonb),
  (130, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Salmos 60","book_usfm":"PSA","chapter":60},{"label":"Salmos 75","book_usfm":"PSA","chapter":75}]'::jsonb),
  (131, '[{"label":"2 Samuel 10","book_usfm":"2SA","chapter":10},{"label":"1 Crónicas 19","book_usfm":"1CH","chapter":19},{"label":"Salmos 20","book_usfm":"PSA","chapter":20}]'::jsonb),
  (132, '[{"label":"Salmos 65","book_usfm":"PSA","chapter":65},{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 70","book_usfm":"PSA","chapter":70}]'::jsonb),
  (133, '[{"label":"2 Samuel 11","book_usfm":"2SA","chapter":11},{"label":"2 Samuel 12","book_usfm":"2SA","chapter":12},{"label":"1 Crónicas 20","book_usfm":"1CH","chapter":20}]'::jsonb),
  (134, '[{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Salmos 86","book_usfm":"PSA","chapter":86},{"label":"Salmos 122","book_usfm":"PSA","chapter":122}]'::jsonb),
  (135, '[{"label":"2 Samuel 13","book_usfm":"2SA","chapter":13},{"label":"2 Samuel 14","book_usfm":"2SA","chapter":14},{"label":"2 Samuel 15","book_usfm":"2SA","chapter":15}]'::jsonb),
  (136, '[{"label":"Salmos 3","book_usfm":"PSA","chapter":3},{"label":"Salmos 4","book_usfm":"PSA","chapter":4},{"label":"Salmos 12","book_usfm":"PSA","chapter":12},{"label":"Salmos 13","book_usfm":"PSA","chapter":13},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 55","book_usfm":"PSA","chapter":55}]'::jsonb),
  (137, '[{"label":"2 Samuel 16","book_usfm":"2SA","chapter":16},{"label":"2 Samuel 17","book_usfm":"2SA","chapter":17},{"label":"2 Samuel 18","book_usfm":"2SA","chapter":18}]'::jsonb),
  (138, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 58","book_usfm":"PSA","chapter":58},{"label":"Salmos 61","book_usfm":"PSA","chapter":61},{"label":"Salmos 62","book_usfm":"PSA","chapter":62},{"label":"Salmos 64","book_usfm":"PSA","chapter":64}]'::jsonb),
  (139, '[{"label":"2 Samuel 19","book_usfm":"2SA","chapter":19},{"label":"2 Samuel 20","book_usfm":"2SA","chapter":20},{"label":"2 Samuel 21","book_usfm":"2SA","chapter":21}]'::jsonb),
  (140, '[{"label":"Salmos 5","book_usfm":"PSA","chapter":5},{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 42","book_usfm":"PSA","chapter":42}]'::jsonb),
  (141, '[{"label":"2 Samuel 22","book_usfm":"2SA","chapter":22},{"label":"2 Samuel 23","book_usfm":"2SA","chapter":23},{"label":"Salmos 57","book_usfm":"PSA","chapter":57}]'::jsonb),
  (142, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 99","book_usfm":"PSA","chapter":99}]'::jsonb),
  (143, '[{"label":"2 Samuel 24","book_usfm":"2SA","chapter":24},{"label":"1 Crónicas 21","book_usfm":"1CH","chapter":21},{"label":"1 Crónicas 22","book_usfm":"1CH","chapter":22},{"label":"Salmos 30","book_usfm":"PSA","chapter":30}]'::jsonb),
  (144, '[{"label":"Salmos 108","book_usfm":"PSA","chapter":108},{"label":"Salmos 109","book_usfm":"PSA","chapter":109},{"label":"Salmos 110","book_usfm":"PSA","chapter":110}]'::jsonb),
  (145, '[{"label":"1 Crónicas 23","book_usfm":"1CH","chapter":23},{"label":"1 Crónicas 24","book_usfm":"1CH","chapter":24},{"label":"1 Crónicas 25","book_usfm":"1CH","chapter":25}]'::jsonb),
  (146, '[{"label":"Salmos 131","book_usfm":"PSA","chapter":131},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Salmos 139","book_usfm":"PSA","chapter":139},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 145","book_usfm":"PSA","chapter":145}]'::jsonb),
  (147, '[{"label":"1 Crónicas 26","book_usfm":"1CH","chapter":26},{"label":"1 Crónicas 27","book_usfm":"1CH","chapter":27},{"label":"1 Crónicas 28","book_usfm":"1CH","chapter":28},{"label":"1 Crónicas 29","book_usfm":"1CH","chapter":29},{"label":"Salmos 127","book_usfm":"PSA","chapter":127}]'::jsonb),
  (148, '[{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 114","book_usfm":"PSA","chapter":114},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"Salmos 116","book_usfm":"PSA","chapter":116},{"label":"Salmos 117","book_usfm":"PSA","chapter":117},{"label":"Salmos 118","book_usfm":"PSA","chapter":118}]'::jsonb),
  (149, '[{"label":"1 Reyes 1","book_usfm":"1KI","chapter":1},{"label":"1 Reyes 2","book_usfm":"1KI","chapter":2},{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Salmos 71","book_usfm":"PSA","chapter":71},{"label":"Salmos 94","book_usfm":"PSA","chapter":94}]'::jsonb),
  (150, '[{"label":"Salmos 119:1-88","book_usfm":"PSA","chapter":119}]'::jsonb),
  (151, '[{"label":"1 Reyes 3","book_usfm":"1KI","chapter":3},{"label":"1 Reyes 4","book_usfm":"1KI","chapter":4},{"label":"2 Crónicas 1","book_usfm":"2CH","chapter":1},{"label":"Salmos 72","book_usfm":"PSA","chapter":72}]'::jsonb),
  (152, '[{"label":"Salmos 119:89-176","book_usfm":"PSA","chapter":119}]'::jsonb),
  (153, '[{"label":"Cantares 1","book_usfm":"SNG","chapter":1},{"label":"Cantares 2","book_usfm":"SNG","chapter":2},{"label":"Cantares 3","book_usfm":"SNG","chapter":3},{"label":"Cantares 4","book_usfm":"SNG","chapter":4},{"label":"Cantares 5","book_usfm":"SNG","chapter":5},{"label":"Cantares 6","book_usfm":"SNG","chapter":6},{"label":"Cantares 7","book_usfm":"SNG","chapter":7},{"label":"Cantares 8","book_usfm":"SNG","chapter":8}]'::jsonb),
  (154, '[{"label":"Proverbios 1","book_usfm":"PRO","chapter":1},{"label":"Proverbios 2","book_usfm":"PRO","chapter":2},{"label":"Proverbios 3","book_usfm":"PRO","chapter":3}]'::jsonb),
  (155, '[{"label":"Proverbios 4","book_usfm":"PRO","chapter":4},{"label":"Proverbios 5","book_usfm":"PRO","chapter":5},{"label":"Proverbios 6","book_usfm":"PRO","chapter":6}]'::jsonb),
  (156, '[{"label":"Proverbios 7","book_usfm":"PRO","chapter":7},{"label":"Proverbios 8","book_usfm":"PRO","chapter":8},{"label":"Proverbios 9","book_usfm":"PRO","chapter":9}]'::jsonb),
  (157, '[{"label":"Proverbios 10","book_usfm":"PRO","chapter":10},{"label":"Proverbios 11","book_usfm":"PRO","chapter":11},{"label":"Proverbios 12","book_usfm":"PRO","chapter":12}]'::jsonb),
  (158, '[{"label":"Proverbios 13","book_usfm":"PRO","chapter":13},{"label":"Proverbios 14","book_usfm":"PRO","chapter":14},{"label":"Proverbios 15","book_usfm":"PRO","chapter":15}]'::jsonb),
  (159, '[{"label":"Proverbios 16","book_usfm":"PRO","chapter":16},{"label":"Proverbios 17","book_usfm":"PRO","chapter":17},{"label":"Proverbios 18","book_usfm":"PRO","chapter":18}]'::jsonb),
  (160, '[{"label":"Proverbios 19","book_usfm":"PRO","chapter":19},{"label":"Proverbios 20","book_usfm":"PRO","chapter":20},{"label":"Proverbios 21","book_usfm":"PRO","chapter":21}]'::jsonb),
  (161, '[{"label":"Proverbios 22","book_usfm":"PRO","chapter":22},{"label":"Proverbios 23","book_usfm":"PRO","chapter":23},{"label":"Proverbios 24","book_usfm":"PRO","chapter":24}]'::jsonb),
  (162, '[{"label":"1 Reyes 5","book_usfm":"1KI","chapter":5},{"label":"1 Reyes 6","book_usfm":"1KI","chapter":6},{"label":"2 Crónicas 2","book_usfm":"2CH","chapter":2},{"label":"2 Crónicas 3","book_usfm":"2CH","chapter":3}]'::jsonb),
  (163, '[{"label":"1 Reyes 7","book_usfm":"1KI","chapter":7},{"label":"2 Crónicas 4","book_usfm":"2CH","chapter":4}]'::jsonb),
  (164, '[{"label":"1 Reyes 8","book_usfm":"1KI","chapter":8},{"label":"2 Crónicas 5","book_usfm":"2CH","chapter":5}]'::jsonb),
  (165, '[{"label":"2 Crónicas 6","book_usfm":"2CH","chapter":6},{"label":"2 Crónicas 7","book_usfm":"2CH","chapter":7},{"label":"Salmos 136","book_usfm":"PSA","chapter":136}]'::jsonb),
  (166, '[{"label":"Salmos 134","book_usfm":"PSA","chapter":134},{"label":"Salmos 146","book_usfm":"PSA","chapter":146},{"label":"Salmos 147","book_usfm":"PSA","chapter":147},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Salmos 149","book_usfm":"PSA","chapter":149},{"label":"Salmos 150","book_usfm":"PSA","chapter":150}]'::jsonb),
  (167, '[{"label":"1 Reyes 9","book_usfm":"1KI","chapter":9},{"label":"2 Crónicas 8","book_usfm":"2CH","chapter":8}]'::jsonb),
  (168, '[{"label":"Proverbios 25","book_usfm":"PRO","chapter":25},{"label":"Proverbios 26","book_usfm":"PRO","chapter":26}]'::jsonb),
  (169, '[{"label":"Proverbios 27","book_usfm":"PRO","chapter":27},{"label":"Proverbios 28","book_usfm":"PRO","chapter":28},{"label":"Proverbios 29","book_usfm":"PRO","chapter":29}]'::jsonb),
  (170, '[{"label":"Eclesiastés 1","book_usfm":"ECC","chapter":1},{"label":"Eclesiastés 2","book_usfm":"ECC","chapter":2},{"label":"Eclesiastés 3","book_usfm":"ECC","chapter":3},{"label":"Eclesiastés 4","book_usfm":"ECC","chapter":4},{"label":"Eclesiastés 5","book_usfm":"ECC","chapter":5},{"label":"Eclesiastés 6","book_usfm":"ECC","chapter":6}]'::jsonb),
  (171, '[{"label":"Eclesiastés 7","book_usfm":"ECC","chapter":7},{"label":"Eclesiastés 8","book_usfm":"ECC","chapter":8},{"label":"Eclesiastés 9","book_usfm":"ECC","chapter":9},{"label":"Eclesiastés 10","book_usfm":"ECC","chapter":10},{"label":"Eclesiastés 11","book_usfm":"ECC","chapter":11},{"label":"Eclesiastés 12","book_usfm":"ECC","chapter":12}]'::jsonb),
  (172, '[{"label":"1 Reyes 10","book_usfm":"1KI","chapter":10},{"label":"1 Reyes 11","book_usfm":"1KI","chapter":11},{"label":"2 Crónicas 9","book_usfm":"2CH","chapter":9}]'::jsonb),
  (173, '[{"label":"Proverbios 30","book_usfm":"PRO","chapter":30},{"label":"Proverbios 31","book_usfm":"PRO","chapter":31}]'::jsonb),
  (174, '[{"label":"1 Reyes 12","book_usfm":"1KI","chapter":12},{"label":"1 Reyes 13","book_usfm":"1KI","chapter":13},{"label":"1 Reyes 14","book_usfm":"1KI","chapter":14}]'::jsonb),
  (175, '[{"label":"2 Crónicas 10","book_usfm":"2CH","chapter":10},{"label":"2 Crónicas 11","book_usfm":"2CH","chapter":11},{"label":"2 Crónicas 12","book_usfm":"2CH","chapter":12}]'::jsonb),
  (176, '[{"label":"1 Reyes 15:1-24","book_usfm":"1KI","chapter":15},{"label":"2 Crónicas 13","book_usfm":"2CH","chapter":13},{"label":"2 Crónicas 14","book_usfm":"2CH","chapter":14},{"label":"2 Crónicas 15","book_usfm":"2CH","chapter":15},{"label":"2 Crónicas 16","book_usfm":"2CH","chapter":16}]'::jsonb),
  (177, '[{"label":"1 Reyes 15:25-34","book_usfm":"1KI","chapter":15},{"label":"1 Reyes 16","book_usfm":"1KI","chapter":16},{"label":"2 Crónicas 17","book_usfm":"2CH","chapter":17}]'::jsonb),
  (178, '[{"label":"1 Reyes 17","book_usfm":"1KI","chapter":17},{"label":"1 Reyes 18","book_usfm":"1KI","chapter":18},{"label":"1 Reyes 19","book_usfm":"1KI","chapter":19}]'::jsonb),
  (179, '[{"label":"1 Reyes 20","book_usfm":"1KI","chapter":20},{"label":"1 Reyes 21","book_usfm":"1KI","chapter":21}]'::jsonb),
  (180, '[{"label":"1 Reyes 22","book_usfm":"1KI","chapter":22},{"label":"2 Crónicas 18","book_usfm":"2CH","chapter":18}]'::jsonb),
  (181, '[{"label":"2 Crónicas 19","book_usfm":"2CH","chapter":19},{"label":"2 Crónicas 20","book_usfm":"2CH","chapter":20},{"label":"2 Crónicas 21","book_usfm":"2CH","chapter":21},{"label":"2 Crónicas 22","book_usfm":"2CH","chapter":22},{"label":"2 Crónicas 23","book_usfm":"2CH","chapter":23}]'::jsonb),
  (182, '[{"label":"Abdías 1","book_usfm":"OBA","chapter":1},{"label":"Salmos 82","book_usfm":"PSA","chapter":82},{"label":"Salmos 83","book_usfm":"PSA","chapter":83}]'::jsonb),
  (183, '[{"label":"2 Reyes 1","book_usfm":"2KI","chapter":1},{"label":"2 Reyes 2","book_usfm":"2KI","chapter":2},{"label":"2 Reyes 3","book_usfm":"2KI","chapter":3},{"label":"2 Reyes 4","book_usfm":"2KI","chapter":4}]'::jsonb),
  (184, '[{"label":"2 Reyes 5","book_usfm":"2KI","chapter":5},{"label":"2 Reyes 6","book_usfm":"2KI","chapter":6},{"label":"2 Reyes 7","book_usfm":"2KI","chapter":7},{"label":"2 Reyes 8","book_usfm":"2KI","chapter":8}]'::jsonb),
  (185, '[{"label":"2 Reyes 9","book_usfm":"2KI","chapter":9},{"label":"2 Reyes 10","book_usfm":"2KI","chapter":10},{"label":"2 Reyes 11","book_usfm":"2KI","chapter":11}]'::jsonb),
  (186, '[{"label":"2 Reyes 12","book_usfm":"2KI","chapter":12},{"label":"2 Reyes 13","book_usfm":"2KI","chapter":13},{"label":"2 Crónicas 24","book_usfm":"2CH","chapter":24}]'::jsonb),
  (187, '[{"label":"2 Reyes 14","book_usfm":"2KI","chapter":14},{"label":"2 Crónicas 25","book_usfm":"2CH","chapter":25}]'::jsonb),
  (188, '[{"label":"Jonás 1","book_usfm":"JON","chapter":1},{"label":"Jonás 2","book_usfm":"JON","chapter":2},{"label":"Jonás 3","book_usfm":"JON","chapter":3},{"label":"Jonás 4","book_usfm":"JON","chapter":4}]'::jsonb),
  (189, '[{"label":"2 Reyes 15","book_usfm":"2KI","chapter":15},{"label":"2 Crónicas 26","book_usfm":"2CH","chapter":26}]'::jsonb),
  (190, '[{"label":"Isaías 1","book_usfm":"ISA","chapter":1},{"label":"Isaías 2","book_usfm":"ISA","chapter":2},{"label":"Isaías 3","book_usfm":"ISA","chapter":3},{"label":"Isaías 4","book_usfm":"ISA","chapter":4}]'::jsonb),
  (191, '[{"label":"Isaías 5","book_usfm":"ISA","chapter":5},{"label":"Isaías 6","book_usfm":"ISA","chapter":6},{"label":"Isaías 7","book_usfm":"ISA","chapter":7},{"label":"Isaías 8","book_usfm":"ISA","chapter":8}]'::jsonb),
  (192, '[{"label":"Amós 1","book_usfm":"AMO","chapter":1},{"label":"Amós 2","book_usfm":"AMO","chapter":2},{"label":"Amós 3","book_usfm":"AMO","chapter":3},{"label":"Amós 4","book_usfm":"AMO","chapter":4},{"label":"Amós 5","book_usfm":"AMO","chapter":5}]'::jsonb),
  (193, '[{"label":"Amós 6","book_usfm":"AMO","chapter":6},{"label":"Amós 7","book_usfm":"AMO","chapter":7},{"label":"Amós 8","book_usfm":"AMO","chapter":8},{"label":"Amós 9","book_usfm":"AMO","chapter":9}]'::jsonb),
  (194, '[{"label":"2 Crónicas 27","book_usfm":"2CH","chapter":27},{"label":"Isaías 9","book_usfm":"ISA","chapter":9},{"label":"Isaías 10","book_usfm":"ISA","chapter":10},{"label":"Isaías 11","book_usfm":"ISA","chapter":11},{"label":"Isaías 12","book_usfm":"ISA","chapter":12}]'::jsonb),
  (195, '[{"label":"Miqueas 1","book_usfm":"MIC","chapter":1},{"label":"Miqueas 2","book_usfm":"MIC","chapter":2},{"label":"Miqueas 3","book_usfm":"MIC","chapter":3},{"label":"Miqueas 4","book_usfm":"MIC","chapter":4},{"label":"Miqueas 5","book_usfm":"MIC","chapter":5},{"label":"Miqueas 6","book_usfm":"MIC","chapter":6},{"label":"Miqueas 7","book_usfm":"MIC","chapter":7}]'::jsonb),
  (196, '[{"label":"2 Crónicas 28","book_usfm":"2CH","chapter":28},{"label":"2 Reyes 16","book_usfm":"2KI","chapter":16},{"label":"2 Reyes 17","book_usfm":"2KI","chapter":17}]'::jsonb),
  (197, '[{"label":"Isaías 13","book_usfm":"ISA","chapter":13},{"label":"Isaías 14","book_usfm":"ISA","chapter":14},{"label":"Isaías 15","book_usfm":"ISA","chapter":15},{"label":"Isaías 16","book_usfm":"ISA","chapter":16},{"label":"Isaías 17","book_usfm":"ISA","chapter":17}]'::jsonb),
  (198, '[{"label":"Isaías 18","book_usfm":"ISA","chapter":18},{"label":"Isaías 19","book_usfm":"ISA","chapter":19},{"label":"Isaías 20","book_usfm":"ISA","chapter":20},{"label":"Isaías 21","book_usfm":"ISA","chapter":21},{"label":"Isaías 22","book_usfm":"ISA","chapter":22}]'::jsonb),
  (199, '[{"label":"Isaías 23","book_usfm":"ISA","chapter":23},{"label":"Isaías 24","book_usfm":"ISA","chapter":24},{"label":"Isaías 25","book_usfm":"ISA","chapter":25},{"label":"Isaías 26","book_usfm":"ISA","chapter":26},{"label":"Isaías 27","book_usfm":"ISA","chapter":27}]'::jsonb),
  (200, '[{"label":"2 Reyes 18:1-8","book_usfm":"2KI","chapter":18},{"label":"2 Crónicas 29","book_usfm":"2CH","chapter":29},{"label":"2 Crónicas 30","book_usfm":"2CH","chapter":30},{"label":"2 Crónicas 31","book_usfm":"2CH","chapter":31},{"label":"Salmos 48","book_usfm":"PSA","chapter":48}]'::jsonb),
  (201, '[{"label":"Oseas 1","book_usfm":"HOS","chapter":1},{"label":"Oseas 2","book_usfm":"HOS","chapter":2},{"label":"Oseas 3","book_usfm":"HOS","chapter":3},{"label":"Oseas 4","book_usfm":"HOS","chapter":4},{"label":"Oseas 5","book_usfm":"HOS","chapter":5},{"label":"Oseas 6","book_usfm":"HOS","chapter":6},{"label":"Oseas 7","book_usfm":"HOS","chapter":7}]'::jsonb),
  (202, '[{"label":"Oseas 8","book_usfm":"HOS","chapter":8},{"label":"Oseas 9","book_usfm":"HOS","chapter":9},{"label":"Oseas 10","book_usfm":"HOS","chapter":10},{"label":"Oseas 11","book_usfm":"HOS","chapter":11},{"label":"Oseas 12","book_usfm":"HOS","chapter":12},{"label":"Oseas 13","book_usfm":"HOS","chapter":13},{"label":"Oseas 14","book_usfm":"HOS","chapter":14}]'::jsonb),
  (203, '[{"label":"Isaías 28","book_usfm":"ISA","chapter":28},{"label":"Isaías 29","book_usfm":"ISA","chapter":29},{"label":"Isaías 30","book_usfm":"ISA","chapter":30}]'::jsonb),
  (204, '[{"label":"Isaías 31","book_usfm":"ISA","chapter":31},{"label":"Isaías 32","book_usfm":"ISA","chapter":32},{"label":"Isaías 33","book_usfm":"ISA","chapter":33},{"label":"Isaías 34","book_usfm":"ISA","chapter":34}]'::jsonb),
  (205, '[{"label":"Isaías 35","book_usfm":"ISA","chapter":35},{"label":"Isaías 36","book_usfm":"ISA","chapter":36}]'::jsonb),
  (206, '[{"label":"Isaías 37","book_usfm":"ISA","chapter":37},{"label":"Isaías 38","book_usfm":"ISA","chapter":38},{"label":"Isaías 39","book_usfm":"ISA","chapter":39},{"label":"Salmos 76","book_usfm":"PSA","chapter":76}]'::jsonb),
  (207, '[{"label":"Isaías 40","book_usfm":"ISA","chapter":40},{"label":"Isaías 41","book_usfm":"ISA","chapter":41},{"label":"Isaías 42","book_usfm":"ISA","chapter":42},{"label":"Isaías 43","book_usfm":"ISA","chapter":43}]'::jsonb),
  (208, '[{"label":"Isaías 44","book_usfm":"ISA","chapter":44},{"label":"Isaías 45","book_usfm":"ISA","chapter":45},{"label":"Isaías 46","book_usfm":"ISA","chapter":46},{"label":"Isaías 47","book_usfm":"ISA","chapter":47},{"label":"Isaías 48","book_usfm":"ISA","chapter":48}]'::jsonb),
  (209, '[{"label":"2 Reyes 18:9-37","book_usfm":"2KI","chapter":18},{"label":"2 Reyes 19","book_usfm":"2KI","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 135","book_usfm":"PSA","chapter":135}]'::jsonb),
  (210, '[{"label":"Isaías 49","book_usfm":"ISA","chapter":49},{"label":"Isaías 50","book_usfm":"ISA","chapter":50},{"label":"Isaías 51","book_usfm":"ISA","chapter":51},{"label":"Isaías 52","book_usfm":"ISA","chapter":52},{"label":"Isaías 53","book_usfm":"ISA","chapter":53}]'::jsonb),
  (211, '[{"label":"Isaías 54","book_usfm":"ISA","chapter":54},{"label":"Isaías 55","book_usfm":"ISA","chapter":55},{"label":"Isaías 56","book_usfm":"ISA","chapter":56},{"label":"Isaías 57","book_usfm":"ISA","chapter":57},{"label":"Isaías 58","book_usfm":"ISA","chapter":58}]'::jsonb),
  (212, '[{"label":"Isaías 59","book_usfm":"ISA","chapter":59},{"label":"Isaías 60","book_usfm":"ISA","chapter":60},{"label":"Isaías 61","book_usfm":"ISA","chapter":61},{"label":"Isaías 62","book_usfm":"ISA","chapter":62},{"label":"Isaías 63","book_usfm":"ISA","chapter":63}]'::jsonb),
  (213, '[{"label":"Isaías 64","book_usfm":"ISA","chapter":64},{"label":"Isaías 65","book_usfm":"ISA","chapter":65},{"label":"Isaías 66","book_usfm":"ISA","chapter":66}]'::jsonb),
  (214, '[{"label":"2 Reyes 20","book_usfm":"2KI","chapter":20},{"label":"2 Reyes 21","book_usfm":"2KI","chapter":21}]'::jsonb),
  (215, '[{"label":"2 Crónicas 32","book_usfm":"2CH","chapter":32},{"label":"2 Crónicas 33","book_usfm":"2CH","chapter":33}]'::jsonb),
  (216, '[{"label":"Nahúm 1","book_usfm":"NAM","chapter":1},{"label":"Nahúm 2","book_usfm":"NAM","chapter":2},{"label":"Nahúm 3","book_usfm":"NAM","chapter":3}]'::jsonb),
  (217, '[{"label":"2 Reyes 22","book_usfm":"2KI","chapter":22},{"label":"2 Reyes 23","book_usfm":"2KI","chapter":23},{"label":"2 Crónicas 34","book_usfm":"2CH","chapter":34},{"label":"2 Crónicas 35","book_usfm":"2CH","chapter":35}]'::jsonb),
  (218, '[{"label":"Sofonías 1","book_usfm":"ZEP","chapter":1},{"label":"Sofonías 2","book_usfm":"ZEP","chapter":2},{"label":"Sofonías 3","book_usfm":"ZEP","chapter":3}]'::jsonb),
  (219, '[{"label":"Jeremías 1","book_usfm":"JER","chapter":1},{"label":"Jeremías 2","book_usfm":"JER","chapter":2},{"label":"Jeremías 3","book_usfm":"JER","chapter":3}]'::jsonb),
  (220, '[{"label":"Jeremías 4","book_usfm":"JER","chapter":4},{"label":"Jeremías 5","book_usfm":"JER","chapter":5},{"label":"Jeremías 6","book_usfm":"JER","chapter":6}]'::jsonb),
  (221, '[{"label":"Jeremías 7","book_usfm":"JER","chapter":7},{"label":"Jeremías 8","book_usfm":"JER","chapter":8},{"label":"Jeremías 9","book_usfm":"JER","chapter":9}]'::jsonb),
  (222, '[{"label":"Jeremías 10","book_usfm":"JER","chapter":10},{"label":"Jeremías 11","book_usfm":"JER","chapter":11},{"label":"Jeremías 12","book_usfm":"JER","chapter":12},{"label":"Jeremías 13","book_usfm":"JER","chapter":13}]'::jsonb),
  (223, '[{"label":"Jeremías 14","book_usfm":"JER","chapter":14},{"label":"Jeremías 15","book_usfm":"JER","chapter":15},{"label":"Jeremías 16","book_usfm":"JER","chapter":16},{"label":"Jeremías 17","book_usfm":"JER","chapter":17}]'::jsonb),
  (224, '[{"label":"Jeremías 18","book_usfm":"JER","chapter":18},{"label":"Jeremías 19","book_usfm":"JER","chapter":19},{"label":"Jeremías 20","book_usfm":"JER","chapter":20},{"label":"Jeremías 21","book_usfm":"JER","chapter":21},{"label":"Jeremías 22","book_usfm":"JER","chapter":22}]'::jsonb),
  (225, '[{"label":"Jeremías 23","book_usfm":"JER","chapter":23},{"label":"Jeremías 24","book_usfm":"JER","chapter":24},{"label":"Jeremías 25","book_usfm":"JER","chapter":25}]'::jsonb),
  (226, '[{"label":"Jeremías 26","book_usfm":"JER","chapter":26},{"label":"Jeremías 27","book_usfm":"JER","chapter":27},{"label":"Jeremías 28","book_usfm":"JER","chapter":28},{"label":"Jeremías 29","book_usfm":"JER","chapter":29}]'::jsonb),
  (227, '[{"label":"Jeremías 30","book_usfm":"JER","chapter":30},{"label":"Jeremías 31","book_usfm":"JER","chapter":31}]'::jsonb),
  (228, '[{"label":"Jeremías 32","book_usfm":"JER","chapter":32},{"label":"Jeremías 33","book_usfm":"JER","chapter":33},{"label":"Jeremías 34","book_usfm":"JER","chapter":34}]'::jsonb),
  (229, '[{"label":"Jeremías 35","book_usfm":"JER","chapter":35},{"label":"Jeremías 36","book_usfm":"JER","chapter":36},{"label":"Jeremías 37","book_usfm":"JER","chapter":37}]'::jsonb),
  (230, '[{"label":"Jeremías 38","book_usfm":"JER","chapter":38},{"label":"Jeremías 39","book_usfm":"JER","chapter":39},{"label":"Jeremías 40","book_usfm":"JER","chapter":40},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Salmos 79","book_usfm":"PSA","chapter":79}]'::jsonb),
  (231, '[{"label":"2 Reyes 24","book_usfm":"2KI","chapter":24},{"label":"2 Reyes 25","book_usfm":"2KI","chapter":25},{"label":"2 Crónicas 36","book_usfm":"2CH","chapter":36}]'::jsonb),
  (232, '[{"label":"Habacuc 1","book_usfm":"HAB","chapter":1},{"label":"Habacuc 2","book_usfm":"HAB","chapter":2},{"label":"Habacuc 3","book_usfm":"HAB","chapter":3}]'::jsonb),
  (233, '[{"label":"Jeremías 41","book_usfm":"JER","chapter":41},{"label":"Jeremías 42","book_usfm":"JER","chapter":42},{"label":"Jeremías 43","book_usfm":"JER","chapter":43},{"label":"Jeremías 44","book_usfm":"JER","chapter":44},{"label":"Jeremías 45","book_usfm":"JER","chapter":45}]'::jsonb),
  (234, '[{"label":"Jeremías 46","book_usfm":"JER","chapter":46},{"label":"Jeremías 47","book_usfm":"JER","chapter":47},{"label":"Jeremías 48","book_usfm":"JER","chapter":48}]'::jsonb),
  (235, '[{"label":"Jeremías 49","book_usfm":"JER","chapter":49},{"label":"Jeremías 50","book_usfm":"JER","chapter":50}]'::jsonb),
  (236, '[{"label":"Jeremías 51","book_usfm":"JER","chapter":51},{"label":"Jeremías 52","book_usfm":"JER","chapter":52}]'::jsonb),
  (237, '[{"label":"Lamentaciones 1","book_usfm":"LAM","chapter":1},{"label":"Lamentaciones 2","book_usfm":"LAM","chapter":2},{"label":"Lamentaciones 3:1-36","book_usfm":"LAM","chapter":3}]'::jsonb),
  (238, '[{"label":"Lamentaciones 3:37-66","book_usfm":"LAM","chapter":3},{"label":"Lamentaciones 4","book_usfm":"LAM","chapter":4},{"label":"Lamentaciones 5","book_usfm":"LAM","chapter":5}]'::jsonb),
  (239, '[{"label":"Ezequiel 1","book_usfm":"EZK","chapter":1},{"label":"Ezequiel 2","book_usfm":"EZK","chapter":2},{"label":"Ezequiel 3","book_usfm":"EZK","chapter":3},{"label":"Ezequiel 4","book_usfm":"EZK","chapter":4}]'::jsonb),
  (240, '[{"label":"Ezequiel 5","book_usfm":"EZK","chapter":5},{"label":"Ezequiel 6","book_usfm":"EZK","chapter":6},{"label":"Ezequiel 7","book_usfm":"EZK","chapter":7},{"label":"Ezequiel 8","book_usfm":"EZK","chapter":8}]'::jsonb),
  (241, '[{"label":"Ezequiel 9","book_usfm":"EZK","chapter":9},{"label":"Ezequiel 10","book_usfm":"EZK","chapter":10},{"label":"Ezequiel 11","book_usfm":"EZK","chapter":11},{"label":"Ezequiel 12","book_usfm":"EZK","chapter":12}]'::jsonb),
  (242, '[{"label":"Ezequiel 13","book_usfm":"EZK","chapter":13},{"label":"Ezequiel 14","book_usfm":"EZK","chapter":14},{"label":"Ezequiel 15","book_usfm":"EZK","chapter":15}]'::jsonb),
  (243, '[{"label":"Ezequiel 16","book_usfm":"EZK","chapter":16},{"label":"Ezequiel 17","book_usfm":"EZK","chapter":17}]'::jsonb),
  (244, '[{"label":"Ezequiel 18","book_usfm":"EZK","chapter":18},{"label":"Ezequiel 19","book_usfm":"EZK","chapter":19}]'::jsonb),
  (245, '[{"label":"Ezequiel 20","book_usfm":"EZK","chapter":20},{"label":"Ezequiel 21","book_usfm":"EZK","chapter":21}]'::jsonb),
  (246, '[{"label":"Ezequiel 22","book_usfm":"EZK","chapter":22},{"label":"Ezequiel 23","book_usfm":"EZK","chapter":23}]'::jsonb),
  (247, '[{"label":"Ezequiel 24","book_usfm":"EZK","chapter":24},{"label":"Ezequiel 25","book_usfm":"EZK","chapter":25},{"label":"Ezequiel 26","book_usfm":"EZK","chapter":26},{"label":"Ezequiel 27","book_usfm":"EZK","chapter":27}]'::jsonb),
  (248, '[{"label":"Ezequiel 28","book_usfm":"EZK","chapter":28},{"label":"Ezequiel 29","book_usfm":"EZK","chapter":29},{"label":"Ezequiel 30","book_usfm":"EZK","chapter":30},{"label":"Ezequiel 31","book_usfm":"EZK","chapter":31}]'::jsonb),
  (249, '[{"label":"Ezequiel 32","book_usfm":"EZK","chapter":32},{"label":"Ezequiel 33","book_usfm":"EZK","chapter":33},{"label":"Ezequiel 34","book_usfm":"EZK","chapter":34}]'::jsonb),
  (250, '[{"label":"Ezequiel 35","book_usfm":"EZK","chapter":35},{"label":"Ezequiel 36","book_usfm":"EZK","chapter":36},{"label":"Ezequiel 37","book_usfm":"EZK","chapter":37}]'::jsonb),
  (251, '[{"label":"Ezequiel 38","book_usfm":"EZK","chapter":38},{"label":"Ezequiel 39","book_usfm":"EZK","chapter":39}]'::jsonb),
  (252, '[{"label":"Ezequiel 40","book_usfm":"EZK","chapter":40},{"label":"Ezequiel 41","book_usfm":"EZK","chapter":41}]'::jsonb),
  (253, '[{"label":"Ezequiel 42","book_usfm":"EZK","chapter":42},{"label":"Ezequiel 43","book_usfm":"EZK","chapter":43}]'::jsonb),
  (254, '[{"label":"Ezequiel 44","book_usfm":"EZK","chapter":44},{"label":"Ezequiel 45","book_usfm":"EZK","chapter":45}]'::jsonb),
  (255, '[{"label":"Ezequiel 46","book_usfm":"EZK","chapter":46},{"label":"Ezequiel 47","book_usfm":"EZK","chapter":47},{"label":"Ezequiel 48","book_usfm":"EZK","chapter":48}]'::jsonb),
  (256, '[{"label":"Joel 1","book_usfm":"JOL","chapter":1},{"label":"Joel 2","book_usfm":"JOL","chapter":2},{"label":"Joel 3","book_usfm":"JOL","chapter":3}]'::jsonb),
  (257, '[{"label":"Daniel 1","book_usfm":"DAN","chapter":1},{"label":"Daniel 2","book_usfm":"DAN","chapter":2},{"label":"Daniel 3","book_usfm":"DAN","chapter":3}]'::jsonb),
  (258, '[{"label":"Daniel 4","book_usfm":"DAN","chapter":4},{"label":"Daniel 5","book_usfm":"DAN","chapter":5},{"label":"Daniel 6","book_usfm":"DAN","chapter":6}]'::jsonb),
  (259, '[{"label":"Daniel 7","book_usfm":"DAN","chapter":7},{"label":"Daniel 8","book_usfm":"DAN","chapter":8},{"label":"Daniel 9","book_usfm":"DAN","chapter":9}]'::jsonb),
  (260, '[{"label":"Daniel 10","book_usfm":"DAN","chapter":10},{"label":"Daniel 11","book_usfm":"DAN","chapter":11},{"label":"Daniel 12","book_usfm":"DAN","chapter":12}]'::jsonb),
  (261, '[{"label":"Esdras 1","book_usfm":"EZR","chapter":1},{"label":"Esdras 2","book_usfm":"EZR","chapter":2},{"label":"Esdras 3","book_usfm":"EZR","chapter":3}]'::jsonb),
  (262, '[{"label":"Esdras 4","book_usfm":"EZR","chapter":4},{"label":"Esdras 5","book_usfm":"EZR","chapter":5},{"label":"Esdras 6","book_usfm":"EZR","chapter":6},{"label":"Salmos 137","book_usfm":"PSA","chapter":137}]'::jsonb),
  (263, '[{"label":"Hageo 1","book_usfm":"HAG","chapter":1},{"label":"Hageo 2","book_usfm":"HAG","chapter":2}]'::jsonb),
  (264, '[{"label":"Zacarías 1","book_usfm":"ZEC","chapter":1},{"label":"Zacarías 2","book_usfm":"ZEC","chapter":2},{"label":"Zacarías 3","book_usfm":"ZEC","chapter":3},{"label":"Zacarías 4","book_usfm":"ZEC","chapter":4},{"label":"Zacarías 5","book_usfm":"ZEC","chapter":5},{"label":"Zacarías 6","book_usfm":"ZEC","chapter":6},{"label":"Zacarías 7","book_usfm":"ZEC","chapter":7}]'::jsonb),
  (265, '[{"label":"Zacarías 8","book_usfm":"ZEC","chapter":8},{"label":"Zacarías 9","book_usfm":"ZEC","chapter":9},{"label":"Zacarías 10","book_usfm":"ZEC","chapter":10},{"label":"Zacarías 11","book_usfm":"ZEC","chapter":11},{"label":"Zacarías 12","book_usfm":"ZEC","chapter":12},{"label":"Zacarías 13","book_usfm":"ZEC","chapter":13},{"label":"Zacarías 14","book_usfm":"ZEC","chapter":14}]'::jsonb),
  (266, '[{"label":"Ester 1","book_usfm":"EST","chapter":1},{"label":"Ester 2","book_usfm":"EST","chapter":2},{"label":"Ester 3","book_usfm":"EST","chapter":3},{"label":"Ester 4","book_usfm":"EST","chapter":4},{"label":"Ester 5","book_usfm":"EST","chapter":5}]'::jsonb),
  (267, '[{"label":"Ester 6","book_usfm":"EST","chapter":6},{"label":"Ester 7","book_usfm":"EST","chapter":7},{"label":"Ester 8","book_usfm":"EST","chapter":8},{"label":"Ester 9","book_usfm":"EST","chapter":9},{"label":"Ester 10","book_usfm":"EST","chapter":10}]'::jsonb),
  (268, '[{"label":"Esdras 7","book_usfm":"EZR","chapter":7},{"label":"Esdras 8","book_usfm":"EZR","chapter":8},{"label":"Esdras 9","book_usfm":"EZR","chapter":9},{"label":"Esdras 10","book_usfm":"EZR","chapter":10}]'::jsonb),
  (269, '[{"label":"Nehemías 1","book_usfm":"NEH","chapter":1},{"label":"Nehemías 2","book_usfm":"NEH","chapter":2},{"label":"Nehemías 3","book_usfm":"NEH","chapter":3},{"label":"Nehemías 4","book_usfm":"NEH","chapter":4},{"label":"Nehemías 5","book_usfm":"NEH","chapter":5}]'::jsonb),
  (270, '[{"label":"Nehemías 6","book_usfm":"NEH","chapter":6},{"label":"Nehemías 7","book_usfm":"NEH","chapter":7}]'::jsonb),
  (271, '[{"label":"Nehemías 8","book_usfm":"NEH","chapter":8},{"label":"Nehemías 9","book_usfm":"NEH","chapter":9},{"label":"Nehemías 10","book_usfm":"NEH","chapter":10}]'::jsonb),
  (272, '[{"label":"Nehemías 11","book_usfm":"NEH","chapter":11},{"label":"Nehemías 12","book_usfm":"NEH","chapter":12},{"label":"Nehemías 13","book_usfm":"NEH","chapter":13},{"label":"Salmos 126","book_usfm":"PSA","chapter":126}]'::jsonb),
  (273, '[{"label":"Malaquías 1","book_usfm":"MAL","chapter":1},{"label":"Malaquías 2","book_usfm":"MAL","chapter":2},{"label":"Malaquías 3","book_usfm":"MAL","chapter":3},{"label":"Malaquías 4","book_usfm":"MAL","chapter":4}]'::jsonb),
  (274, '[{"label":"Lucas 1","book_usfm":"LUK","chapter":1},{"label":"Juan 1:1-14","book_usfm":"JHN","chapter":1}]'::jsonb),
  (275, '[{"label":"Mateo 1","book_usfm":"MAT","chapter":1},{"label":"Lucas 2:1-38","book_usfm":"LUK","chapter":2}]'::jsonb),
  (276, '[{"label":"Mateo 2","book_usfm":"MAT","chapter":2},{"label":"Lucas 2:39-52","book_usfm":"LUK","chapter":2}]'::jsonb),
  (277, '[{"label":"Mateo 3","book_usfm":"MAT","chapter":3},{"label":"Marcos 1","book_usfm":"MRK","chapter":1},{"label":"Lucas 3","book_usfm":"LUK","chapter":3}]'::jsonb),
  (278, '[{"label":"Mateo 4","book_usfm":"MAT","chapter":4},{"label":"Lucas 4","book_usfm":"LUK","chapter":4},{"label":"Lucas 5","book_usfm":"LUK","chapter":5},{"label":"Juan 1:15-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (279, '[{"label":"Juan 2","book_usfm":"JHN","chapter":2},{"label":"Juan 3","book_usfm":"JHN","chapter":3},{"label":"Juan 4","book_usfm":"JHN","chapter":4}]'::jsonb),
  (280, '[{"label":"Marcos 2","book_usfm":"MRK","chapter":2}]'::jsonb),
  (281, '[{"label":"Juan 5","book_usfm":"JHN","chapter":5}]'::jsonb),
  (282, '[{"label":"Mateo 12:1-21","book_usfm":"MAT","chapter":12},{"label":"Marcos 3","book_usfm":"MRK","chapter":3},{"label":"Lucas 6","book_usfm":"LUK","chapter":6}]'::jsonb),
  (283, '[{"label":"Mateo 5","book_usfm":"MAT","chapter":5},{"label":"Mateo 6","book_usfm":"MAT","chapter":6},{"label":"Mateo 7","book_usfm":"MAT","chapter":7}]'::jsonb),
  (284, '[{"label":"Mateo 8:1-13","book_usfm":"MAT","chapter":8},{"label":"Lucas 7","book_usfm":"LUK","chapter":7}]'::jsonb),
  (285, '[{"label":"Mateo 11","book_usfm":"MAT","chapter":11}]'::jsonb),
  (286, '[{"label":"Mateo 12:22-50","book_usfm":"MAT","chapter":12},{"label":"Lucas 11:1-54","book_usfm":"LUK","chapter":11}]'::jsonb),
  (287, '[{"label":"Mateo 13","book_usfm":"MAT","chapter":13},{"label":"Lucas 8","book_usfm":"LUK","chapter":8}]'::jsonb),
  (288, '[{"label":"Mateo 8:14-34","book_usfm":"MAT","chapter":8},{"label":"Marcos 4","book_usfm":"MRK","chapter":4},{"label":"Marcos 5","book_usfm":"MRK","chapter":5}]'::jsonb),
  (289, '[{"label":"Mateo 9","book_usfm":"MAT","chapter":9},{"label":"Mateo 10","book_usfm":"MAT","chapter":10}]'::jsonb),
  (290, '[{"label":"Mateo 14","book_usfm":"MAT","chapter":14},{"label":"Marcos 6","book_usfm":"MRK","chapter":6},{"label":"Lucas 9:1-17","book_usfm":"LUK","chapter":9}]'::jsonb),
  (291, '[{"label":"Juan 6","book_usfm":"JHN","chapter":6}]'::jsonb),
  (292, '[{"label":"Mateo 15","book_usfm":"MAT","chapter":15},{"label":"Marcos 7","book_usfm":"MRK","chapter":7}]'::jsonb),
  (293, '[{"label":"Mateo 16","book_usfm":"MAT","chapter":16},{"label":"Marcos 8","book_usfm":"MRK","chapter":8},{"label":"Lucas 9:18-27","book_usfm":"LUK","chapter":9}]'::jsonb),
  (294, '[{"label":"Mateo 17","book_usfm":"MAT","chapter":17},{"label":"Marcos 9","book_usfm":"MRK","chapter":9},{"label":"Lucas 9:28-62","book_usfm":"LUK","chapter":9}]'::jsonb),
  (295, '[{"label":"Mateo 18","book_usfm":"MAT","chapter":18}]'::jsonb),
  (296, '[{"label":"Juan 7","book_usfm":"JHN","chapter":7},{"label":"Juan 8","book_usfm":"JHN","chapter":8}]'::jsonb),
  (297, '[{"label":"Juan 9","book_usfm":"JHN","chapter":9},{"label":"Juan 10:1-21","book_usfm":"JHN","chapter":10}]'::jsonb),
  (298, '[{"label":"Lucas 10","book_usfm":"LUK","chapter":10},{"label":"Lucas 11:1-54","book_usfm":"LUK","chapter":11},{"label":"Juan 10:22-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (299, '[{"label":"Lucas 12","book_usfm":"LUK","chapter":12},{"label":"Lucas 13","book_usfm":"LUK","chapter":13}]'::jsonb),
  (300, '[{"label":"Lucas 14","book_usfm":"LUK","chapter":14},{"label":"Lucas 15","book_usfm":"LUK","chapter":15}]'::jsonb),
  (301, '[{"label":"Lucas 16","book_usfm":"LUK","chapter":16},{"label":"Lucas 17:1-10","book_usfm":"LUK","chapter":17}]'::jsonb),
  (302, '[{"label":"Juan 11","book_usfm":"JHN","chapter":11}]'::jsonb),
  (303, '[{"label":"Lucas 17:11-37","book_usfm":"LUK","chapter":17},{"label":"Lucas 18:1-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (304, '[{"label":"Mateo 19","book_usfm":"MAT","chapter":19},{"label":"Marcos 10","book_usfm":"MRK","chapter":10}]'::jsonb),
  (305, '[{"label":"Mateo 20","book_usfm":"MAT","chapter":20},{"label":"Mateo 21","book_usfm":"MAT","chapter":21}]'::jsonb),
  (306, '[{"label":"Lucas 18:15-43","book_usfm":"LUK","chapter":18},{"label":"Lucas 19","book_usfm":"LUK","chapter":19}]'::jsonb),
  (307, '[{"label":"Marcos 11","book_usfm":"MRK","chapter":11},{"label":"Juan 12","book_usfm":"JHN","chapter":12}]'::jsonb),
  (308, '[{"label":"Mateo 22","book_usfm":"MAT","chapter":22},{"label":"Marcos 12","book_usfm":"MRK","chapter":12}]'::jsonb),
  (309, '[{"label":"Mateo 23","book_usfm":"MAT","chapter":23},{"label":"Lucas 20","book_usfm":"LUK","chapter":20},{"label":"Lucas 21","book_usfm":"LUK","chapter":21}]'::jsonb),
  (310, '[{"label":"Marcos 13","book_usfm":"MRK","chapter":13}]'::jsonb),
  (311, '[{"label":"Mateo 24","book_usfm":"MAT","chapter":24}]'::jsonb),
  (312, '[{"label":"Mateo 25","book_usfm":"MAT","chapter":25}]'::jsonb),
  (313, '[{"label":"Mateo 26","book_usfm":"MAT","chapter":26},{"label":"Marcos 14","book_usfm":"MRK","chapter":14}]'::jsonb),
  (314, '[{"label":"Lucas 22","book_usfm":"LUK","chapter":22},{"label":"Juan 13","book_usfm":"JHN","chapter":13}]'::jsonb),
  (315, '[{"label":"Juan 14","book_usfm":"JHN","chapter":14},{"label":"Juan 15","book_usfm":"JHN","chapter":15},{"label":"Juan 16","book_usfm":"JHN","chapter":16},{"label":"Juan 17","book_usfm":"JHN","chapter":17}]'::jsonb),
  (316, '[{"label":"Mateo 27","book_usfm":"MAT","chapter":27},{"label":"Marcos 15","book_usfm":"MRK","chapter":15}]'::jsonb),
  (317, '[{"label":"Lucas 23","book_usfm":"LUK","chapter":23},{"label":"Juan 18","book_usfm":"JHN","chapter":18},{"label":"Juan 19","book_usfm":"JHN","chapter":19}]'::jsonb),
  (318, '[{"label":"Mateo 28","book_usfm":"MAT","chapter":28},{"label":"Marcos 16","book_usfm":"MRK","chapter":16}]'::jsonb),
  (319, '[{"label":"Lucas 24","book_usfm":"LUK","chapter":24},{"label":"Juan 20","book_usfm":"JHN","chapter":20},{"label":"Juan 21","book_usfm":"JHN","chapter":21}]'::jsonb),
  (320, '[{"label":"Hechos 1","book_usfm":"ACT","chapter":1},{"label":"Hechos 2","book_usfm":"ACT","chapter":2},{"label":"Hechos 3","book_usfm":"ACT","chapter":3}]'::jsonb),
  (321, '[{"label":"Hechos 4","book_usfm":"ACT","chapter":4},{"label":"Hechos 5","book_usfm":"ACT","chapter":5},{"label":"Hechos 6","book_usfm":"ACT","chapter":6}]'::jsonb),
  (322, '[{"label":"Hechos 7","book_usfm":"ACT","chapter":7},{"label":"Hechos 8","book_usfm":"ACT","chapter":8}]'::jsonb),
  (323, '[{"label":"Hechos 9","book_usfm":"ACT","chapter":9},{"label":"Hechos 10","book_usfm":"ACT","chapter":10}]'::jsonb),
  (324, '[{"label":"Hechos 11","book_usfm":"ACT","chapter":11},{"label":"Hechos 12","book_usfm":"ACT","chapter":12}]'::jsonb),
  (325, '[{"label":"Hechos 13","book_usfm":"ACT","chapter":13},{"label":"Hechos 14","book_usfm":"ACT","chapter":14}]'::jsonb),
  (326, '[{"label":"Santiago 1","book_usfm":"JAS","chapter":1},{"label":"Santiago 2","book_usfm":"JAS","chapter":2},{"label":"Santiago 3","book_usfm":"JAS","chapter":3},{"label":"Santiago 4","book_usfm":"JAS","chapter":4},{"label":"Santiago 5","book_usfm":"JAS","chapter":5}]'::jsonb),
  (327, '[{"label":"Hechos 15","book_usfm":"ACT","chapter":15},{"label":"Hechos 16","book_usfm":"ACT","chapter":16}]'::jsonb),
  (328, '[{"label":"Gálatas 1","book_usfm":"GAL","chapter":1},{"label":"Gálatas 2","book_usfm":"GAL","chapter":2},{"label":"Gálatas 3","book_usfm":"GAL","chapter":3}]'::jsonb),
  (329, '[{"label":"Gálatas 4","book_usfm":"GAL","chapter":4},{"label":"Gálatas 5","book_usfm":"GAL","chapter":5},{"label":"Gálatas 6","book_usfm":"GAL","chapter":6}]'::jsonb),
  (330, '[{"label":"Hechos 17","book_usfm":"ACT","chapter":17},{"label":"Hechos 18:1-18","book_usfm":"ACT","chapter":18}]'::jsonb),
  (331, '[{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1},{"label":"1 Tesalonicenses 2","book_usfm":"1TH","chapter":2},{"label":"1 Tesalonicenses 3","book_usfm":"1TH","chapter":3},{"label":"1 Tesalonicenses 4","book_usfm":"1TH","chapter":4},{"label":"1 Tesalonicenses 5","book_usfm":"1TH","chapter":5},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1},{"label":"2 Tesalonicenses 2","book_usfm":"2TH","chapter":2},{"label":"2 Tesalonicenses 3","book_usfm":"2TH","chapter":3}]'::jsonb),
  (332, '[{"label":"Hechos 18:19-28","book_usfm":"ACT","chapter":18},{"label":"Hechos 19","book_usfm":"ACT","chapter":19}]'::jsonb),
  (333, '[{"label":"1 Corintios 1","book_usfm":"1CO","chapter":1},{"label":"1 Corintios 2","book_usfm":"1CO","chapter":2},{"label":"1 Corintios 3","book_usfm":"1CO","chapter":3},{"label":"1 Corintios 4","book_usfm":"1CO","chapter":4}]'::jsonb),
  (334, '[{"label":"1 Corintios 5","book_usfm":"1CO","chapter":5},{"label":"1 Corintios 6","book_usfm":"1CO","chapter":6},{"label":"1 Corintios 7","book_usfm":"1CO","chapter":7},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8}]'::jsonb),
  (335, '[{"label":"1 Corintios 9","book_usfm":"1CO","chapter":9},{"label":"1 Corintios 10","book_usfm":"1CO","chapter":10},{"label":"1 Corintios 11","book_usfm":"1CO","chapter":11}]'::jsonb),
  (336, '[{"label":"1 Corintios 12","book_usfm":"1CO","chapter":12},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13},{"label":"1 Corintios 14","book_usfm":"1CO","chapter":14}]'::jsonb),
  (337, '[{"label":"1 Corintios 15","book_usfm":"1CO","chapter":15},{"label":"1 Corintios 16","book_usfm":"1CO","chapter":16}]'::jsonb),
  (338, '[{"label":"2 Corintios 1","book_usfm":"2CO","chapter":1},{"label":"2 Corintios 2","book_usfm":"2CO","chapter":2},{"label":"2 Corintios 3","book_usfm":"2CO","chapter":3},{"label":"2 Corintios 4","book_usfm":"2CO","chapter":4}]'::jsonb),
  (339, '[{"label":"2 Corintios 5","book_usfm":"2CO","chapter":5},{"label":"2 Corintios 6","book_usfm":"2CO","chapter":6},{"label":"2 Corintios 7","book_usfm":"2CO","chapter":7},{"label":"2 Corintios 8","book_usfm":"2CO","chapter":8},{"label":"2 Corintios 9","book_usfm":"2CO","chapter":9}]'::jsonb),
  (340, '[{"label":"2 Corintios 10","book_usfm":"2CO","chapter":10},{"label":"2 Corintios 11","book_usfm":"2CO","chapter":11},{"label":"2 Corintios 12","book_usfm":"2CO","chapter":12},{"label":"2 Corintios 13","book_usfm":"2CO","chapter":13}]'::jsonb),
  (341, '[{"label":"Hechos 20:1-3","book_usfm":"ACT","chapter":20},{"label":"Romanos 1","book_usfm":"ROM","chapter":1},{"label":"Romanos 2","book_usfm":"ROM","chapter":2},{"label":"Romanos 3","book_usfm":"ROM","chapter":3}]'::jsonb),
  (342, '[{"label":"Romanos 4","book_usfm":"ROM","chapter":4},{"label":"Romanos 5","book_usfm":"ROM","chapter":5},{"label":"Romanos 6","book_usfm":"ROM","chapter":6},{"label":"Romanos 7","book_usfm":"ROM","chapter":7}]'::jsonb),
  (343, '[{"label":"Romanos 8","book_usfm":"ROM","chapter":8},{"label":"Romanos 9","book_usfm":"ROM","chapter":9},{"label":"Romanos 10","book_usfm":"ROM","chapter":10}]'::jsonb),
  (344, '[{"label":"Romanos 11","book_usfm":"ROM","chapter":11},{"label":"Romanos 12","book_usfm":"ROM","chapter":12},{"label":"Romanos 13","book_usfm":"ROM","chapter":13}]'::jsonb),
  (345, '[{"label":"Romanos 14","book_usfm":"ROM","chapter":14},{"label":"Romanos 15","book_usfm":"ROM","chapter":15},{"label":"Romanos 16","book_usfm":"ROM","chapter":16}]'::jsonb),
  (346, '[{"label":"Hechos 20:4-38","book_usfm":"ACT","chapter":20},{"label":"Hechos 21","book_usfm":"ACT","chapter":21},{"label":"Hechos 22","book_usfm":"ACT","chapter":22},{"label":"Hechos 23","book_usfm":"ACT","chapter":23}]'::jsonb),
  (347, '[{"label":"Hechos 24","book_usfm":"ACT","chapter":24},{"label":"Hechos 25","book_usfm":"ACT","chapter":25},{"label":"Hechos 26","book_usfm":"ACT","chapter":26}]'::jsonb),
  (348, '[{"label":"Hechos 27","book_usfm":"ACT","chapter":27},{"label":"Hechos 28","book_usfm":"ACT","chapter":28}]'::jsonb),
  (349, '[{"label":"Colosenses 1","book_usfm":"COL","chapter":1},{"label":"Colosenses 2","book_usfm":"COL","chapter":2},{"label":"Colosenses 3","book_usfm":"COL","chapter":3},{"label":"Colosenses 4","book_usfm":"COL","chapter":4},{"label":"Filemón 1","book_usfm":"PHM","chapter":1}]'::jsonb),
  (350, '[{"label":"Efesios 1","book_usfm":"EPH","chapter":1},{"label":"Efesios 2","book_usfm":"EPH","chapter":2},{"label":"Efesios 3","book_usfm":"EPH","chapter":3},{"label":"Efesios 4","book_usfm":"EPH","chapter":4},{"label":"Efesios 5","book_usfm":"EPH","chapter":5},{"label":"Efesios 6","book_usfm":"EPH","chapter":6}]'::jsonb),
  (351, '[{"label":"Filipenses 1","book_usfm":"PHP","chapter":1},{"label":"Filipenses 2","book_usfm":"PHP","chapter":2},{"label":"Filipenses 3","book_usfm":"PHP","chapter":3},{"label":"Filipenses 4","book_usfm":"PHP","chapter":4}]'::jsonb),
  (352, '[{"label":"1 Timoteo 1","book_usfm":"1TI","chapter":1},{"label":"1 Timoteo 2","book_usfm":"1TI","chapter":2},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4},{"label":"1 Timoteo 5","book_usfm":"1TI","chapter":5},{"label":"1 Timoteo 6","book_usfm":"1TI","chapter":6}]'::jsonb),
  (353, '[{"label":"Tito 1","book_usfm":"TIT","chapter":1},{"label":"Tito 2","book_usfm":"TIT","chapter":2},{"label":"Tito 3","book_usfm":"TIT","chapter":3}]'::jsonb),
  (354, '[{"label":"1 Pedro 1","book_usfm":"1PE","chapter":1},{"label":"1 Pedro 2","book_usfm":"1PE","chapter":2},{"label":"1 Pedro 3","book_usfm":"1PE","chapter":3},{"label":"1 Pedro 4","book_usfm":"1PE","chapter":4},{"label":"1 Pedro 5","book_usfm":"1PE","chapter":5}]'::jsonb),
  (355, '[{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Hebreos 2","book_usfm":"HEB","chapter":2},{"label":"Hebreos 3","book_usfm":"HEB","chapter":3},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4},{"label":"Hebreos 5","book_usfm":"HEB","chapter":5},{"label":"Hebreos 6","book_usfm":"HEB","chapter":6}]'::jsonb),
  (356, '[{"label":"Hebreos 7","book_usfm":"HEB","chapter":7},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8},{"label":"Hebreos 9","book_usfm":"HEB","chapter":9},{"label":"Hebreos 10","book_usfm":"HEB","chapter":10}]'::jsonb),
  (357, '[{"label":"Hebreos 11","book_usfm":"HEB","chapter":11},{"label":"Hebreos 12","book_usfm":"HEB","chapter":12},{"label":"Hebreos 13","book_usfm":"HEB","chapter":13}]'::jsonb),
  (358, '[{"label":"2 Timoteo 1","book_usfm":"2TI","chapter":1},{"label":"2 Timoteo 2","book_usfm":"2TI","chapter":2},{"label":"2 Timoteo 3","book_usfm":"2TI","chapter":3},{"label":"2 Timoteo 4","book_usfm":"2TI","chapter":4}]'::jsonb),
  (359, '[{"label":"2 Pedro 1","book_usfm":"2PE","chapter":1},{"label":"2 Pedro 2","book_usfm":"2PE","chapter":2},{"label":"2 Pedro 3","book_usfm":"2PE","chapter":3},{"label":"Judas 1","book_usfm":"JUD","chapter":1}]'::jsonb),
  (360, '[{"label":"1 Juan 1","book_usfm":"1JN","chapter":1},{"label":"1 Juan 2","book_usfm":"1JN","chapter":2},{"label":"1 Juan 3","book_usfm":"1JN","chapter":3},{"label":"1 Juan 4","book_usfm":"1JN","chapter":4},{"label":"1 Juan 5","book_usfm":"1JN","chapter":5}]'::jsonb),
  (361, '[{"label":"2 Juan 1","book_usfm":"2JN","chapter":1},{"label":"3 Juan 1","book_usfm":"3JN","chapter":1}]'::jsonb),
  (362, '[{"label":"Apocalipsis 1","book_usfm":"REV","chapter":1},{"label":"Apocalipsis 2","book_usfm":"REV","chapter":2},{"label":"Apocalipsis 3","book_usfm":"REV","chapter":3},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5}]'::jsonb),
  (363, '[{"label":"Apocalipsis 6","book_usfm":"REV","chapter":6},{"label":"Apocalipsis 7","book_usfm":"REV","chapter":7},{"label":"Apocalipsis 8","book_usfm":"REV","chapter":8},{"label":"Apocalipsis 9","book_usfm":"REV","chapter":9},{"label":"Apocalipsis 10","book_usfm":"REV","chapter":10},{"label":"Apocalipsis 11","book_usfm":"REV","chapter":11}]'::jsonb),
  (364, '[{"label":"Apocalipsis 12","book_usfm":"REV","chapter":12},{"label":"Apocalipsis 13","book_usfm":"REV","chapter":13},{"label":"Apocalipsis 14","book_usfm":"REV","chapter":14},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15},{"label":"Apocalipsis 16","book_usfm":"REV","chapter":16},{"label":"Apocalipsis 17","book_usfm":"REV","chapter":17},{"label":"Apocalipsis 18","book_usfm":"REV","chapter":18}]'::jsonb),
  (365, '[{"label":"Apocalipsis 19","book_usfm":"REV","chapter":19},{"label":"Apocalipsis 20","book_usfm":"REV","chapter":20},{"label":"Apocalipsis 21","book_usfm":"REV","chapter":21},{"label":"Apocalipsis 22","book_usfm":"REV","chapter":22}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'cronologico';

-- ---- Plan: Antiguo y Nuevo Testamento (365 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('at-nt', 'Antiguo y Nuevo Testamento', 'Un pasaje del Antiguo y uno del Nuevo Testamento cada día, toda la Biblia en un año.', 365, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'at-nt');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Génesis 1-3","book_usfm":"GEN","chapter":1,"chapter_end":3},{"label":"Mateo 1","book_usfm":"MAT","chapter":1}]'::jsonb),
  (2, '[{"label":"Génesis 4-6","book_usfm":"GEN","chapter":4,"chapter_end":6},{"label":"Mateo 2","book_usfm":"MAT","chapter":2}]'::jsonb),
  (3, '[{"label":"Génesis 7-9","book_usfm":"GEN","chapter":7,"chapter_end":9},{"label":"Mateo 3","book_usfm":"MAT","chapter":3}]'::jsonb),
  (4, '[{"label":"Génesis 10-12","book_usfm":"GEN","chapter":10,"chapter_end":12},{"label":"Mateo 4","book_usfm":"MAT","chapter":4}]'::jsonb),
  (5, '[{"label":"Génesis 13-15","book_usfm":"GEN","chapter":13,"chapter_end":15},{"label":"Mateo 5:1-26","book_usfm":"MAT","chapter":5}]'::jsonb),
  (6, '[{"label":"Génesis 16-17","book_usfm":"GEN","chapter":16,"chapter_end":17},{"label":"Mateo 5:27-48","book_usfm":"MAT","chapter":5}]'::jsonb),
  (7, '[{"label":"Génesis 18-19","book_usfm":"GEN","chapter":18,"chapter_end":19},{"label":"Mateo 6:1-18","book_usfm":"MAT","chapter":6}]'::jsonb),
  (8, '[{"label":"Génesis 20-22","book_usfm":"GEN","chapter":20,"chapter_end":22},{"label":"Mateo 6:19-34","book_usfm":"MAT","chapter":6}]'::jsonb),
  (9, '[{"label":"Génesis 23-24","book_usfm":"GEN","chapter":23,"chapter_end":24},{"label":"Mateo 7","book_usfm":"MAT","chapter":7}]'::jsonb),
  (10, '[{"label":"Génesis 25-26","book_usfm":"GEN","chapter":25,"chapter_end":26},{"label":"Mateo 8:1-17","book_usfm":"MAT","chapter":8}]'::jsonb),
  (11, '[{"label":"Génesis 27-28","book_usfm":"GEN","chapter":27,"chapter_end":28},{"label":"Mateo 8:18-34","book_usfm":"MAT","chapter":8}]'::jsonb),
  (12, '[{"label":"Génesis 29-30","book_usfm":"GEN","chapter":29,"chapter_end":30},{"label":"Mateo 9:1-17","book_usfm":"MAT","chapter":9}]'::jsonb),
  (13, '[{"label":"Génesis 31-32","book_usfm":"GEN","chapter":31,"chapter_end":32},{"label":"Mateo 9:18-38","book_usfm":"MAT","chapter":9}]'::jsonb),
  (14, '[{"label":"Génesis 33-35","book_usfm":"GEN","chapter":33,"chapter_end":35},{"label":"Mateo 10:1-20","book_usfm":"MAT","chapter":10}]'::jsonb),
  (15, '[{"label":"Génesis 36-38","book_usfm":"GEN","chapter":36,"chapter_end":38},{"label":"Mateo 10:21-42","book_usfm":"MAT","chapter":10}]'::jsonb),
  (16, '[{"label":"Génesis 39-40","book_usfm":"GEN","chapter":39,"chapter_end":40},{"label":"Mateo 11","book_usfm":"MAT","chapter":11}]'::jsonb),
  (17, '[{"label":"Génesis 41-42","book_usfm":"GEN","chapter":41,"chapter_end":42},{"label":"Mateo 12:1-23","book_usfm":"MAT","chapter":12}]'::jsonb),
  (18, '[{"label":"Génesis 43-45","book_usfm":"GEN","chapter":43,"chapter_end":45},{"label":"Mateo 12:24-50","book_usfm":"MAT","chapter":12}]'::jsonb),
  (19, '[{"label":"Génesis 46-48","book_usfm":"GEN","chapter":46,"chapter_end":48},{"label":"Mateo 13:1-30","book_usfm":"MAT","chapter":13}]'::jsonb),
  (20, '[{"label":"Génesis 49-50","book_usfm":"GEN","chapter":49,"chapter_end":50},{"label":"Mateo 13:31-58","book_usfm":"MAT","chapter":13}]'::jsonb),
  (21, '[{"label":"Éxodo 1-3","book_usfm":"EXO","chapter":1,"chapter_end":3},{"label":"Mateo 14:1-21","book_usfm":"MAT","chapter":14}]'::jsonb),
  (22, '[{"label":"Éxodo 4-6","book_usfm":"EXO","chapter":4,"chapter_end":6},{"label":"Mateo 14:22-36","book_usfm":"MAT","chapter":14}]'::jsonb),
  (23, '[{"label":"Éxodo 7-8","book_usfm":"EXO","chapter":7,"chapter_end":8},{"label":"Mateo 15:1-20","book_usfm":"MAT","chapter":15}]'::jsonb),
  (24, '[{"label":"Éxodo 9-11","book_usfm":"EXO","chapter":9,"chapter_end":11},{"label":"Mateo 15:21-39","book_usfm":"MAT","chapter":15}]'::jsonb),
  (25, '[{"label":"Éxodo 12-13","book_usfm":"EXO","chapter":12,"chapter_end":13},{"label":"Mateo 16","book_usfm":"MAT","chapter":16}]'::jsonb),
  (26, '[{"label":"Éxodo 14-15","book_usfm":"EXO","chapter":14,"chapter_end":15},{"label":"Mateo 17","book_usfm":"MAT","chapter":17}]'::jsonb),
  (27, '[{"label":"Éxodo 16-18","book_usfm":"EXO","chapter":16,"chapter_end":18},{"label":"Mateo 18:1-20","book_usfm":"MAT","chapter":18}]'::jsonb),
  (28, '[{"label":"Éxodo 19-20","book_usfm":"EXO","chapter":19,"chapter_end":20},{"label":"Mateo 18:21-35","book_usfm":"MAT","chapter":18}]'::jsonb),
  (29, '[{"label":"Éxodo 21-22","book_usfm":"EXO","chapter":21,"chapter_end":22},{"label":"Mateo 19","book_usfm":"MAT","chapter":19}]'::jsonb),
  (30, '[{"label":"Éxodo 23-24","book_usfm":"EXO","chapter":23,"chapter_end":24},{"label":"Mateo 20:1-16","book_usfm":"MAT","chapter":20}]'::jsonb),
  (31, '[{"label":"Éxodo 25-26","book_usfm":"EXO","chapter":25,"chapter_end":26},{"label":"Mateo 20:17-34","book_usfm":"MAT","chapter":20}]'::jsonb),
  (32, '[{"label":"Éxodo 27-28","book_usfm":"EXO","chapter":27,"chapter_end":28},{"label":"Mateo 21:1-22","book_usfm":"MAT","chapter":21}]'::jsonb),
  (33, '[{"label":"Éxodo 29-30","book_usfm":"EXO","chapter":29,"chapter_end":30},{"label":"Mateo 21:23-46","book_usfm":"MAT","chapter":21}]'::jsonb),
  (34, '[{"label":"Éxodo 31-33","book_usfm":"EXO","chapter":31,"chapter_end":33},{"label":"Mateo 22:1-22","book_usfm":"MAT","chapter":22}]'::jsonb),
  (35, '[{"label":"Éxodo 34-35","book_usfm":"EXO","chapter":34,"chapter_end":35},{"label":"Mateo 22:23-46","book_usfm":"MAT","chapter":22}]'::jsonb),
  (36, '[{"label":"Éxodo 36-38","book_usfm":"EXO","chapter":36,"chapter_end":38},{"label":"Mateo 23:1-22","book_usfm":"MAT","chapter":23}]'::jsonb),
  (37, '[{"label":"Éxodo 39-40","book_usfm":"EXO","chapter":39,"chapter_end":40},{"label":"Mateo 23:23-39","book_usfm":"MAT","chapter":23}]'::jsonb),
  (38, '[{"label":"Levítico 1-3","book_usfm":"LEV","chapter":1,"chapter_end":3},{"label":"Mateo 24:1-28","book_usfm":"MAT","chapter":24}]'::jsonb),
  (39, '[{"label":"Levítico 4-5","book_usfm":"LEV","chapter":4,"chapter_end":5},{"label":"Mateo 24:29-51","book_usfm":"MAT","chapter":24}]'::jsonb),
  (40, '[{"label":"Levítico 6-7","book_usfm":"LEV","chapter":6,"chapter_end":7},{"label":"Mateo 25:1-30","book_usfm":"MAT","chapter":25}]'::jsonb),
  (41, '[{"label":"Levítico 8-10","book_usfm":"LEV","chapter":8,"chapter_end":10},{"label":"Mateo 25:31-46","book_usfm":"MAT","chapter":25}]'::jsonb),
  (42, '[{"label":"Levítico 11-12","book_usfm":"LEV","chapter":11,"chapter_end":12},{"label":"Mateo 26:1-25","book_usfm":"MAT","chapter":26}]'::jsonb),
  (43, '[{"label":"Levítico 13","book_usfm":"LEV","chapter":13},{"label":"Mateo 26:26-50","book_usfm":"MAT","chapter":26}]'::jsonb),
  (44, '[{"label":"Levítico 14","book_usfm":"LEV","chapter":14},{"label":"Mateo 26:51-75","book_usfm":"MAT","chapter":26}]'::jsonb),
  (45, '[{"label":"Levítico 15-16","book_usfm":"LEV","chapter":15,"chapter_end":16},{"label":"Mateo 27:1-26","book_usfm":"MAT","chapter":27}]'::jsonb),
  (46, '[{"label":"Levítico 17-18","book_usfm":"LEV","chapter":17,"chapter_end":18},{"label":"Mateo 27:27-50","book_usfm":"MAT","chapter":27}]'::jsonb),
  (47, '[{"label":"Levítico 19-20","book_usfm":"LEV","chapter":19,"chapter_end":20},{"label":"Mateo 27:51-66","book_usfm":"MAT","chapter":27}]'::jsonb),
  (48, '[{"label":"Levítico 21-22","book_usfm":"LEV","chapter":21,"chapter_end":22},{"label":"Mateo 28","book_usfm":"MAT","chapter":28}]'::jsonb),
  (49, '[{"label":"Levítico 23-24","book_usfm":"LEV","chapter":23,"chapter_end":24},{"label":"Marcos 1:1-22","book_usfm":"MRK","chapter":1}]'::jsonb),
  (50, '[{"label":"Levítico 25","book_usfm":"LEV","chapter":25},{"label":"Marcos 1:23-45","book_usfm":"MRK","chapter":1}]'::jsonb),
  (51, '[{"label":"Levítico 26-27","book_usfm":"LEV","chapter":26,"chapter_end":27},{"label":"Marcos 2","book_usfm":"MRK","chapter":2}]'::jsonb),
  (52, '[{"label":"Números 1-2","book_usfm":"NUM","chapter":1,"chapter_end":2},{"label":"Marcos 3:1-19","book_usfm":"MRK","chapter":3}]'::jsonb),
  (53, '[{"label":"Números 3-4","book_usfm":"NUM","chapter":3,"chapter_end":4},{"label":"Marcos 3:20-35","book_usfm":"MRK","chapter":3}]'::jsonb),
  (54, '[{"label":"Números 5-6","book_usfm":"NUM","chapter":5,"chapter_end":6},{"label":"Marcos 4:1-20","book_usfm":"MRK","chapter":4}]'::jsonb),
  (55, '[{"label":"Números 7-8","book_usfm":"NUM","chapter":7,"chapter_end":8},{"label":"Marcos 4:21-41","book_usfm":"MRK","chapter":4}]'::jsonb),
  (56, '[{"label":"Números 9-11","book_usfm":"NUM","chapter":9,"chapter_end":11},{"label":"Marcos 5:1-20","book_usfm":"MRK","chapter":5}]'::jsonb),
  (57, '[{"label":"Números 12-14","book_usfm":"NUM","chapter":12,"chapter_end":14},{"label":"Marcos 5:21-43","book_usfm":"MRK","chapter":5}]'::jsonb),
  (58, '[{"label":"Números 15-16","book_usfm":"NUM","chapter":15,"chapter_end":16},{"label":"Marcos 6:1-29","book_usfm":"MRK","chapter":6}]'::jsonb),
  (59, '[{"label":"Números 17-19","book_usfm":"NUM","chapter":17,"chapter_end":19},{"label":"Marcos 6:30-56","book_usfm":"MRK","chapter":6}]'::jsonb),
  (60, '[{"label":"Números 20-22","book_usfm":"NUM","chapter":20,"chapter_end":22},{"label":"Marcos 7:1-13","book_usfm":"MRK","chapter":7}]'::jsonb),
  (61, '[{"label":"Números 23-25","book_usfm":"NUM","chapter":23,"chapter_end":25},{"label":"Marcos 7:14-37","book_usfm":"MRK","chapter":7}]'::jsonb),
  (62, '[{"label":"Números 26-28","book_usfm":"NUM","chapter":26,"chapter_end":28},{"label":"Marcos 8","book_usfm":"MRK","chapter":8}]'::jsonb),
  (63, '[{"label":"Números 29-31","book_usfm":"NUM","chapter":29,"chapter_end":31},{"label":"Marcos 9:1-29","book_usfm":"MRK","chapter":9}]'::jsonb),
  (64, '[{"label":"Números 32-34","book_usfm":"NUM","chapter":32,"chapter_end":34},{"label":"Marcos 9:30-50","book_usfm":"MRK","chapter":9}]'::jsonb),
  (65, '[{"label":"Números 35-36","book_usfm":"NUM","chapter":35,"chapter_end":36},{"label":"Marcos 10:1-31","book_usfm":"MRK","chapter":10}]'::jsonb),
  (66, '[{"label":"Deuteronomio 1-3","book_usfm":"DEU","chapter":1,"chapter_end":3},{"label":"Marcos 10:32-52","book_usfm":"MRK","chapter":10}]'::jsonb),
  (67, '[{"label":"Deuteronomio 4-6","book_usfm":"DEU","chapter":4,"chapter_end":6},{"label":"Marcos 11:1-18","book_usfm":"MRK","chapter":11}]'::jsonb),
  (68, '[{"label":"Deuteronomio 7-9","book_usfm":"DEU","chapter":7,"chapter_end":9},{"label":"Marcos 11:19-33","book_usfm":"MRK","chapter":11}]'::jsonb),
  (69, '[{"label":"Deuteronomio 10-12","book_usfm":"DEU","chapter":10,"chapter_end":12},{"label":"Marcos 12:1-27","book_usfm":"MRK","chapter":12}]'::jsonb),
  (70, '[{"label":"Deuteronomio 13-15","book_usfm":"DEU","chapter":13,"chapter_end":15},{"label":"Marcos 12:28-44","book_usfm":"MRK","chapter":12}]'::jsonb),
  (71, '[{"label":"Deuteronomio 16-18","book_usfm":"DEU","chapter":16,"chapter_end":18},{"label":"Marcos 13:1-20","book_usfm":"MRK","chapter":13}]'::jsonb),
  (72, '[{"label":"Deuteronomio 19-21","book_usfm":"DEU","chapter":19,"chapter_end":21},{"label":"Marcos 13:21-37","book_usfm":"MRK","chapter":13}]'::jsonb),
  (73, '[{"label":"Deuteronomio 22-24","book_usfm":"DEU","chapter":22,"chapter_end":24},{"label":"Marcos 14:1-26","book_usfm":"MRK","chapter":14}]'::jsonb),
  (74, '[{"label":"Deuteronomio 25-27","book_usfm":"DEU","chapter":25,"chapter_end":27},{"label":"Marcos 14:27-53","book_usfm":"MRK","chapter":14}]'::jsonb),
  (75, '[{"label":"Deuteronomio 28-29","book_usfm":"DEU","chapter":28,"chapter_end":29},{"label":"Marcos 14:54-72","book_usfm":"MRK","chapter":14}]'::jsonb),
  (76, '[{"label":"Deuteronomio 30-31","book_usfm":"DEU","chapter":30,"chapter_end":31},{"label":"Marcos 15:1-25","book_usfm":"MRK","chapter":15}]'::jsonb),
  (77, '[{"label":"Deuteronomio 32-34","book_usfm":"DEU","chapter":32,"chapter_end":34},{"label":"Marcos 15:26-47","book_usfm":"MRK","chapter":15}]'::jsonb),
  (78, '[{"label":"Josué 1-3","book_usfm":"JOS","chapter":1,"chapter_end":3},{"label":"Marcos 16","book_usfm":"MRK","chapter":16}]'::jsonb),
  (79, '[{"label":"Josué 4-6","book_usfm":"JOS","chapter":4,"chapter_end":6},{"label":"Lucas 1:1-20","book_usfm":"LUK","chapter":1}]'::jsonb),
  (80, '[{"label":"Josué 7-9","book_usfm":"JOS","chapter":7,"chapter_end":9},{"label":"Lucas 1:21-38","book_usfm":"LUK","chapter":1}]'::jsonb),
  (81, '[{"label":"Josué 10-12","book_usfm":"JOS","chapter":10,"chapter_end":12},{"label":"Lucas 1:39-56","book_usfm":"LUK","chapter":1}]'::jsonb),
  (82, '[{"label":"Josué 13-15","book_usfm":"JOS","chapter":13,"chapter_end":15},{"label":"Lucas 1:57-80","book_usfm":"LUK","chapter":1}]'::jsonb),
  (83, '[{"label":"Josué 16-18","book_usfm":"JOS","chapter":16,"chapter_end":18},{"label":"Lucas 2:1-24","book_usfm":"LUK","chapter":2}]'::jsonb),
  (84, '[{"label":"Josué 19-21","book_usfm":"JOS","chapter":19,"chapter_end":21},{"label":"Lucas 2:25-52","book_usfm":"LUK","chapter":2}]'::jsonb),
  (85, '[{"label":"Josué 22-24","book_usfm":"JOS","chapter":22,"chapter_end":24},{"label":"Lucas 3","book_usfm":"LUK","chapter":3}]'::jsonb),
  (86, '[{"label":"Jueces 1-3","book_usfm":"JDG","chapter":1,"chapter_end":3},{"label":"Lucas 4:1-30","book_usfm":"LUK","chapter":4}]'::jsonb),
  (87, '[{"label":"Jueces 4-6","book_usfm":"JDG","chapter":4,"chapter_end":6},{"label":"Lucas 4:31-44","book_usfm":"LUK","chapter":4}]'::jsonb),
  (88, '[{"label":"Jueces 7-8","book_usfm":"JDG","chapter":7,"chapter_end":8},{"label":"Lucas 5:1-16","book_usfm":"LUK","chapter":5}]'::jsonb),
  (89, '[{"label":"Jueces 9-10","book_usfm":"JDG","chapter":9,"chapter_end":10},{"label":"Lucas 5:17-39","book_usfm":"LUK","chapter":5}]'::jsonb),
  (90, '[{"label":"Jueces 11-12","book_usfm":"JDG","chapter":11,"chapter_end":12},{"label":"Lucas 6:1-26","book_usfm":"LUK","chapter":6}]'::jsonb),
  (91, '[{"label":"Jueces 13-15","book_usfm":"JDG","chapter":13,"chapter_end":15},{"label":"Lucas 6:27-49","book_usfm":"LUK","chapter":6}]'::jsonb),
  (92, '[{"label":"Jueces 16-18","book_usfm":"JDG","chapter":16,"chapter_end":18},{"label":"Lucas 7:1-30","book_usfm":"LUK","chapter":7}]'::jsonb),
  (93, '[{"label":"Jueces 19-21","book_usfm":"JDG","chapter":19,"chapter_end":21},{"label":"Lucas 7:31-50","book_usfm":"LUK","chapter":7}]'::jsonb),
  (94, '[{"label":"Rut 1-4","book_usfm":"RUT","chapter":1,"chapter_end":4},{"label":"Lucas 8:1-25","book_usfm":"LUK","chapter":8}]'::jsonb),
  (95, '[{"label":"1 Samuel 1-3","book_usfm":"1SA","chapter":1,"chapter_end":3},{"label":"Lucas 8:26-56","book_usfm":"LUK","chapter":8}]'::jsonb),
  (96, '[{"label":"1 Samuel 4-6","book_usfm":"1SA","chapter":4,"chapter_end":6},{"label":"Lucas 9:1-17","book_usfm":"LUK","chapter":9}]'::jsonb),
  (97, '[{"label":"1 Samuel 7-9","book_usfm":"1SA","chapter":7,"chapter_end":9},{"label":"Lucas 9:18-36","book_usfm":"LUK","chapter":9}]'::jsonb),
  (98, '[{"label":"1 Samuel 10-12","book_usfm":"1SA","chapter":10,"chapter_end":12},{"label":"Lucas 9:37-62","book_usfm":"LUK","chapter":9}]'::jsonb),
  (99, '[{"label":"1 Samuel 13-14","book_usfm":"1SA","chapter":13,"chapter_end":14},{"label":"Lucas 10:1-24","book_usfm":"LUK","chapter":10}]'::jsonb),
  (100, '[{"label":"1 Samuel 15-16","book_usfm":"1SA","chapter":15,"chapter_end":16},{"label":"Lucas 10:25-42","book_usfm":"LUK","chapter":10}]'::jsonb),
  (101, '[{"label":"1 Samuel 17-18","book_usfm":"1SA","chapter":17,"chapter_end":18},{"label":"Lucas 11:1-28","book_usfm":"LUK","chapter":11}]'::jsonb),
  (102, '[{"label":"1 Samuel 19-21","book_usfm":"1SA","chapter":19,"chapter_end":21},{"label":"Lucas 11:29-54","book_usfm":"LUK","chapter":11}]'::jsonb),
  (103, '[{"label":"1 Samuel 22-24","book_usfm":"1SA","chapter":22,"chapter_end":24},{"label":"Lucas 12:1-31","book_usfm":"LUK","chapter":12}]'::jsonb),
  (104, '[{"label":"1 Samuel 25-26","book_usfm":"1SA","chapter":25,"chapter_end":26},{"label":"Lucas 12:32-59","book_usfm":"LUK","chapter":12}]'::jsonb),
  (105, '[{"label":"1 Samuel 27-29","book_usfm":"1SA","chapter":27,"chapter_end":29},{"label":"Lucas 13:1-22","book_usfm":"LUK","chapter":13}]'::jsonb),
  (106, '[{"label":"1 Samuel 30-31","book_usfm":"1SA","chapter":30,"chapter_end":31},{"label":"Lucas 13:23-35","book_usfm":"LUK","chapter":13}]'::jsonb),
  (107, '[{"label":"2 Samuel 1-2","book_usfm":"2SA","chapter":1,"chapter_end":2},{"label":"Lucas 14:1-24","book_usfm":"LUK","chapter":14}]'::jsonb),
  (108, '[{"label":"2 Samuel 3-5","book_usfm":"2SA","chapter":3,"chapter_end":5},{"label":"Lucas 14:25-35","book_usfm":"LUK","chapter":14}]'::jsonb),
  (109, '[{"label":"2 Samuel 6-8","book_usfm":"2SA","chapter":6,"chapter_end":8},{"label":"Lucas 15:1-10","book_usfm":"LUK","chapter":15}]'::jsonb),
  (110, '[{"label":"2 Samuel 9-11","book_usfm":"2SA","chapter":9,"chapter_end":11},{"label":"Lucas 15:11-32","book_usfm":"LUK","chapter":15}]'::jsonb),
  (111, '[{"label":"2 Samuel 12-13","book_usfm":"2SA","chapter":12,"chapter_end":13},{"label":"Lucas 16","book_usfm":"LUK","chapter":16}]'::jsonb),
  (112, '[{"label":"2 Samuel 14-15","book_usfm":"2SA","chapter":14,"chapter_end":15},{"label":"Lucas 17:1-19","book_usfm":"LUK","chapter":17}]'::jsonb),
  (113, '[{"label":"2 Samuel 16-18","book_usfm":"2SA","chapter":16,"chapter_end":18},{"label":"Lucas 17:20-37","book_usfm":"LUK","chapter":17}]'::jsonb),
  (114, '[{"label":"2 Samuel 19-20","book_usfm":"2SA","chapter":19,"chapter_end":20},{"label":"Lucas 18:1-23","book_usfm":"LUK","chapter":18}]'::jsonb),
  (115, '[{"label":"2 Samuel 21-22","book_usfm":"2SA","chapter":21,"chapter_end":22},{"label":"Lucas 18:24-43","book_usfm":"LUK","chapter":18}]'::jsonb),
  (116, '[{"label":"2 Samuel 23-24","book_usfm":"2SA","chapter":23,"chapter_end":24},{"label":"Lucas 19:1-27","book_usfm":"LUK","chapter":19}]'::jsonb),
  (117, '[{"label":"1 Reyes 1-2","book_usfm":"1KI","chapter":1,"chapter_end":2},{"label":"Lucas 19:28-48","book_usfm":"LUK","chapter":19}]'::jsonb),
  (118, '[{"label":"1 Reyes 3-5","book_usfm":"1KI","chapter":3,"chapter_end":5},{"label":"Lucas 20:1-26","book_usfm":"LUK","chapter":20}]'::jsonb),
  (119, '[{"label":"1 Reyes 6-7","book_usfm":"1KI","chapter":6,"chapter_end":7},{"label":"Lucas 20:27-47","book_usfm":"LUK","chapter":20}]'::jsonb),
  (120, '[{"label":"1 Reyes 8-9","book_usfm":"1KI","chapter":8,"chapter_end":9},{"label":"Lucas 21:1-19","book_usfm":"LUK","chapter":21}]'::jsonb),
  (121, '[{"label":"1 Reyes 10-11","book_usfm":"1KI","chapter":10,"chapter_end":11},{"label":"Lucas 21:20-38","book_usfm":"LUK","chapter":21}]'::jsonb),
  (122, '[{"label":"1 Reyes 12-13","book_usfm":"1KI","chapter":12,"chapter_end":13},{"label":"Lucas 22:1-30","book_usfm":"LUK","chapter":22}]'::jsonb),
  (123, '[{"label":"1 Reyes 14-15","book_usfm":"1KI","chapter":14,"chapter_end":15},{"label":"Lucas 22:31-46","book_usfm":"LUK","chapter":22}]'::jsonb),
  (124, '[{"label":"1 Reyes 16-18","book_usfm":"1KI","chapter":16,"chapter_end":18},{"label":"Lucas 22:47-71","book_usfm":"LUK","chapter":22}]'::jsonb),
  (125, '[{"label":"1 Reyes 19-20","book_usfm":"1KI","chapter":19,"chapter_end":20},{"label":"Lucas 23:1-25","book_usfm":"LUK","chapter":23}]'::jsonb),
  (126, '[{"label":"1 Reyes 21-22","book_usfm":"1KI","chapter":21,"chapter_end":22},{"label":"Lucas 23:26-56","book_usfm":"LUK","chapter":23}]'::jsonb),
  (127, '[{"label":"2 Reyes 1-3","book_usfm":"2KI","chapter":1,"chapter_end":3},{"label":"Lucas 24:1-35","book_usfm":"LUK","chapter":24}]'::jsonb),
  (128, '[{"label":"2 Reyes 4-6","book_usfm":"2KI","chapter":4,"chapter_end":6},{"label":"Lucas 24:36-53","book_usfm":"LUK","chapter":24}]'::jsonb),
  (129, '[{"label":"2 Reyes 7-9","book_usfm":"2KI","chapter":7,"chapter_end":9},{"label":"Juan 1:1-28","book_usfm":"JHN","chapter":1}]'::jsonb),
  (130, '[{"label":"2 Reyes 10-12","book_usfm":"2KI","chapter":10,"chapter_end":12},{"label":"Juan 1:29-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (131, '[{"label":"2 Reyes 13-14","book_usfm":"2KI","chapter":13,"chapter_end":14},{"label":"Juan 2","book_usfm":"JHN","chapter":2}]'::jsonb),
  (132, '[{"label":"2 Reyes 15-16","book_usfm":"2KI","chapter":15,"chapter_end":16},{"label":"Juan 3:1-18","book_usfm":"JHN","chapter":3}]'::jsonb),
  (133, '[{"label":"2 Reyes 17-18","book_usfm":"2KI","chapter":17,"chapter_end":18},{"label":"Juan 3:19-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (134, '[{"label":"2 Reyes 19-21","book_usfm":"2KI","chapter":19,"chapter_end":21},{"label":"Juan 4:1-30","book_usfm":"JHN","chapter":4}]'::jsonb),
  (135, '[{"label":"2 Reyes 22-23","book_usfm":"2KI","chapter":22,"chapter_end":23},{"label":"Juan 4:31-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (136, '[{"label":"2 Reyes 24-25","book_usfm":"2KI","chapter":24,"chapter_end":25},{"label":"Juan 5:1-24","book_usfm":"JHN","chapter":5}]'::jsonb),
  (137, '[{"label":"1 Crónicas 1-3","book_usfm":"1CH","chapter":1,"chapter_end":3},{"label":"Juan 5:25-47","book_usfm":"JHN","chapter":5}]'::jsonb),
  (138, '[{"label":"1 Crónicas 4-6","book_usfm":"1CH","chapter":4,"chapter_end":6},{"label":"Juan 6:1-21","book_usfm":"JHN","chapter":6}]'::jsonb),
  (139, '[{"label":"1 Crónicas 7-9","book_usfm":"1CH","chapter":7,"chapter_end":9},{"label":"Juan 6:22-44","book_usfm":"JHN","chapter":6}]'::jsonb),
  (140, '[{"label":"1 Crónicas 10-12","book_usfm":"1CH","chapter":10,"chapter_end":12},{"label":"Juan 6:45-71","book_usfm":"JHN","chapter":6}]'::jsonb),
  (141, '[{"label":"1 Crónicas 13-15","book_usfm":"1CH","chapter":13,"chapter_end":15},{"label":"Juan 7:1-27","book_usfm":"JHN","chapter":7}]'::jsonb),
  (142, '[{"label":"1 Crónicas 16-18","book_usfm":"1CH","chapter":16,"chapter_end":18},{"label":"Juan 7:28-53","book_usfm":"JHN","chapter":7}]'::jsonb),
  (143, '[{"label":"1 Crónicas 19-21","book_usfm":"1CH","chapter":19,"chapter_end":21},{"label":"Juan 8:1-27","book_usfm":"JHN","chapter":8}]'::jsonb),
  (144, '[{"label":"1 Crónicas 22-24","book_usfm":"1CH","chapter":22,"chapter_end":24},{"label":"Juan 8:28-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (145, '[{"label":"1 Crónicas 25-27","book_usfm":"1CH","chapter":25,"chapter_end":27},{"label":"Juan 9:1-23","book_usfm":"JHN","chapter":9}]'::jsonb),
  (146, '[{"label":"1 Crónicas 28-29","book_usfm":"1CH","chapter":28,"chapter_end":29},{"label":"Juan 9:24-41","book_usfm":"JHN","chapter":9}]'::jsonb),
  (147, '[{"label":"2 Crónicas 1-3","book_usfm":"2CH","chapter":1,"chapter_end":3},{"label":"Juan 10:1-23","book_usfm":"JHN","chapter":10}]'::jsonb),
  (148, '[{"label":"2 Crónicas 4-6","book_usfm":"2CH","chapter":4,"chapter_end":6},{"label":"Juan 10:24-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (149, '[{"label":"2 Crónicas 7-9","book_usfm":"2CH","chapter":7,"chapter_end":9},{"label":"Juan 11:1-29","book_usfm":"JHN","chapter":11}]'::jsonb),
  (150, '[{"label":"2 Crónicas 10-12","book_usfm":"2CH","chapter":10,"chapter_end":12},{"label":"Juan 11:30-57","book_usfm":"JHN","chapter":11}]'::jsonb),
  (151, '[{"label":"2 Crónicas 13-14","book_usfm":"2CH","chapter":13,"chapter_end":14},{"label":"Juan 12:1-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (152, '[{"label":"2 Crónicas 15-16","book_usfm":"2CH","chapter":15,"chapter_end":16},{"label":"Juan 12:27-50","book_usfm":"JHN","chapter":12}]'::jsonb),
  (153, '[{"label":"2 Crónicas 17-18","book_usfm":"2CH","chapter":17,"chapter_end":18},{"label":"Juan 13:1-20","book_usfm":"JHN","chapter":13}]'::jsonb),
  (154, '[{"label":"2 Crónicas 19-20","book_usfm":"2CH","chapter":19,"chapter_end":20},{"label":"Juan 13:21-38","book_usfm":"JHN","chapter":13}]'::jsonb),
  (155, '[{"label":"2 Crónicas 21-22","book_usfm":"2CH","chapter":21,"chapter_end":22},{"label":"Juan 14","book_usfm":"JHN","chapter":14}]'::jsonb),
  (156, '[{"label":"2 Crónicas 23-24","book_usfm":"2CH","chapter":23,"chapter_end":24},{"label":"Juan 15","book_usfm":"JHN","chapter":15}]'::jsonb),
  (157, '[{"label":"2 Crónicas 25-27","book_usfm":"2CH","chapter":25,"chapter_end":27},{"label":"Juan 16","book_usfm":"JHN","chapter":16}]'::jsonb),
  (158, '[{"label":"2 Crónicas 28-29","book_usfm":"2CH","chapter":28,"chapter_end":29},{"label":"Juan 17","book_usfm":"JHN","chapter":17}]'::jsonb),
  (159, '[{"label":"2 Crónicas 30-31","book_usfm":"2CH","chapter":30,"chapter_end":31},{"label":"Juan 18:1-18","book_usfm":"JHN","chapter":18}]'::jsonb),
  (160, '[{"label":"2 Crónicas 32-33","book_usfm":"2CH","chapter":32,"chapter_end":33},{"label":"Juan 18:19-40","book_usfm":"JHN","chapter":18}]'::jsonb),
  (161, '[{"label":"2 Crónicas 34-36","book_usfm":"2CH","chapter":34,"chapter_end":36},{"label":"Juan 19:1-22","book_usfm":"JHN","chapter":19}]'::jsonb),
  (162, '[{"label":"Esdras 1-2","book_usfm":"EZR","chapter":1,"chapter_end":2},{"label":"Juan 19:23-42","book_usfm":"JHN","chapter":19}]'::jsonb),
  (163, '[{"label":"Esdras 3-5","book_usfm":"EZR","chapter":3,"chapter_end":5},{"label":"Juan 20","book_usfm":"JHN","chapter":20}]'::jsonb),
  (164, '[{"label":"Esdras 6-8","book_usfm":"EZR","chapter":6,"chapter_end":8},{"label":"Juan 21","book_usfm":"JHN","chapter":21}]'::jsonb),
  (165, '[{"label":"Esdras 9-10","book_usfm":"EZR","chapter":9,"chapter_end":10},{"label":"Hechos 1","book_usfm":"ACT","chapter":1}]'::jsonb),
  (166, '[{"label":"Nehemías 1-3","book_usfm":"NEH","chapter":1,"chapter_end":3},{"label":"Hechos 2:1-21","book_usfm":"ACT","chapter":2}]'::jsonb),
  (167, '[{"label":"Nehemías 4-7","book_usfm":"NEH","chapter":4,"chapter_end":7},{"label":"Hechos 2:22-47","book_usfm":"ACT","chapter":2}]'::jsonb),
  (168, '[{"label":"Nehemías 7-9","book_usfm":"NEH","chapter":7,"chapter_end":9},{"label":"Hechos 3","book_usfm":"ACT","chapter":3}]'::jsonb),
  (169, '[{"label":"Nehemías 10-11","book_usfm":"NEH","chapter":10,"chapter_end":11},{"label":"Hechos 4:1-22","book_usfm":"ACT","chapter":4}]'::jsonb),
  (170, '[{"label":"Nehemías 12-13","book_usfm":"NEH","chapter":12,"chapter_end":13},{"label":"Hechos 4:23-37","book_usfm":"ACT","chapter":4}]'::jsonb),
  (171, '[{"label":"Ester 1-2","book_usfm":"EST","chapter":1,"chapter_end":2},{"label":"Hechos 5:1-21","book_usfm":"ACT","chapter":5}]'::jsonb),
  (172, '[{"label":"Ester 3-5","book_usfm":"EST","chapter":3,"chapter_end":5},{"label":"Hechos 5:22-42","book_usfm":"ACT","chapter":5}]'::jsonb),
  (173, '[{"label":"Ester 6-8","book_usfm":"EST","chapter":6,"chapter_end":8},{"label":"Hechos 6","book_usfm":"ACT","chapter":6}]'::jsonb),
  (174, '[{"label":"Ester 9-10","book_usfm":"EST","chapter":9,"chapter_end":10},{"label":"Hechos 7:1-21","book_usfm":"ACT","chapter":7}]'::jsonb),
  (175, '[{"label":"Job 1-2","book_usfm":"JOB","chapter":1,"chapter_end":2},{"label":"Hechos 7:22-43","book_usfm":"ACT","chapter":7}]'::jsonb),
  (176, '[{"label":"Job 3-4","book_usfm":"JOB","chapter":3,"chapter_end":4},{"label":"Hechos 7:44-60","book_usfm":"ACT","chapter":7}]'::jsonb),
  (177, '[{"label":"Job 5-7","book_usfm":"JOB","chapter":5,"chapter_end":7},{"label":"Hechos 8:1-25","book_usfm":"ACT","chapter":8}]'::jsonb),
  (178, '[{"label":"Job 8-10","book_usfm":"JOB","chapter":8,"chapter_end":10},{"label":"Hechos 8:26-40","book_usfm":"ACT","chapter":8}]'::jsonb),
  (179, '[{"label":"Job 11-13","book_usfm":"JOB","chapter":11,"chapter_end":13},{"label":"Hechos 9:1-21","book_usfm":"ACT","chapter":9}]'::jsonb),
  (180, '[{"label":"Job 14-16","book_usfm":"JOB","chapter":14,"chapter_end":16},{"label":"Hechos 9:22-43","book_usfm":"ACT","chapter":9}]'::jsonb),
  (181, '[{"label":"Job 17-19","book_usfm":"JOB","chapter":17,"chapter_end":19},{"label":"Hechos 10:1-23","book_usfm":"ACT","chapter":10}]'::jsonb),
  (182, '[{"label":"Job 20-21","book_usfm":"JOB","chapter":20,"chapter_end":21},{"label":"Hechos 10:24-48","book_usfm":"ACT","chapter":10}]'::jsonb),
  (183, '[{"label":"Job 22-24","book_usfm":"JOB","chapter":22,"chapter_end":24},{"label":"Hechos 11","book_usfm":"ACT","chapter":11}]'::jsonb),
  (184, '[{"label":"Job 25-27","book_usfm":"JOB","chapter":25,"chapter_end":27},{"label":"Hechos 12","book_usfm":"ACT","chapter":12}]'::jsonb),
  (185, '[{"label":"Job 28-29","book_usfm":"JOB","chapter":28,"chapter_end":29},{"label":"Hechos 13:1-25","book_usfm":"ACT","chapter":13}]'::jsonb),
  (186, '[{"label":"Job 30-31","book_usfm":"JOB","chapter":30,"chapter_end":31},{"label":"Hechos 13:26-52","book_usfm":"ACT","chapter":13}]'::jsonb),
  (187, '[{"label":"Job 32-33","book_usfm":"JOB","chapter":32,"chapter_end":33},{"label":"Hechos 14","book_usfm":"ACT","chapter":14}]'::jsonb),
  (188, '[{"label":"Job 34-35","book_usfm":"JOB","chapter":34,"chapter_end":35},{"label":"Hechos 15:1-21","book_usfm":"ACT","chapter":15}]'::jsonb),
  (189, '[{"label":"Job 36-37","book_usfm":"JOB","chapter":36,"chapter_end":37},{"label":"Hechos 15:22-41","book_usfm":"ACT","chapter":15}]'::jsonb),
  (190, '[{"label":"Job 38-40","book_usfm":"JOB","chapter":38,"chapter_end":40},{"label":"Hechos 16:1-21","book_usfm":"ACT","chapter":16}]'::jsonb),
  (191, '[{"label":"Job 41-42","book_usfm":"JOB","chapter":41,"chapter_end":42},{"label":"Hechos 16:22-40","book_usfm":"ACT","chapter":16}]'::jsonb),
  (192, '[{"label":"Salmos 1-3","book_usfm":"PSA","chapter":1,"chapter_end":3},{"label":"Hechos 17:1-15","book_usfm":"ACT","chapter":17}]'::jsonb),
  (193, '[{"label":"Salmos 4-6","book_usfm":"PSA","chapter":4,"chapter_end":6},{"label":"Hechos 17:16-34","book_usfm":"ACT","chapter":17}]'::jsonb),
  (194, '[{"label":"Salmos 7-9","book_usfm":"PSA","chapter":7,"chapter_end":9},{"label":"Hechos 18","book_usfm":"ACT","chapter":18}]'::jsonb),
  (195, '[{"label":"Salmos 10-12","book_usfm":"PSA","chapter":10,"chapter_end":12},{"label":"Hechos 19:1-20","book_usfm":"ACT","chapter":19}]'::jsonb),
  (196, '[{"label":"Salmos 13-15","book_usfm":"PSA","chapter":13,"chapter_end":15},{"label":"Hechos 19:21-41","book_usfm":"ACT","chapter":19}]'::jsonb),
  (197, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Hechos 20:1-16","book_usfm":"ACT","chapter":20}]'::jsonb),
  (198, '[{"label":"Salmos 18-19","book_usfm":"PSA","chapter":18,"chapter_end":19},{"label":"Hechos 20:17-38","book_usfm":"ACT","chapter":20}]'::jsonb),
  (199, '[{"label":"Salmos 20-22","book_usfm":"PSA","chapter":20,"chapter_end":22},{"label":"Hechos 21:1-17","book_usfm":"ACT","chapter":21}]'::jsonb),
  (200, '[{"label":"Salmos 23-25","book_usfm":"PSA","chapter":23,"chapter_end":25},{"label":"Hechos 21:18-40","book_usfm":"ACT","chapter":21}]'::jsonb),
  (201, '[{"label":"Salmos 26-28","book_usfm":"PSA","chapter":26,"chapter_end":28},{"label":"Hechos 22","book_usfm":"ACT","chapter":22}]'::jsonb),
  (202, '[{"label":"Salmos 29-30","book_usfm":"PSA","chapter":29,"chapter_end":30},{"label":"Hechos 23:1-15","book_usfm":"ACT","chapter":23}]'::jsonb),
  (203, '[{"label":"Salmos 31-32","book_usfm":"PSA","chapter":31,"chapter_end":32},{"label":"Hechos 23:16-35","book_usfm":"ACT","chapter":23}]'::jsonb),
  (204, '[{"label":"Salmos 33-34","book_usfm":"PSA","chapter":33,"chapter_end":34},{"label":"Hechos 24","book_usfm":"ACT","chapter":24}]'::jsonb),
  (205, '[{"label":"Salmos 35-36","book_usfm":"PSA","chapter":35,"chapter_end":36},{"label":"Hechos 25","book_usfm":"ACT","chapter":25}]'::jsonb),
  (206, '[{"label":"Salmos 37-39","book_usfm":"PSA","chapter":37,"chapter_end":39},{"label":"Hechos 26","book_usfm":"ACT","chapter":26}]'::jsonb),
  (207, '[{"label":"Salmos 40-42","book_usfm":"PSA","chapter":40,"chapter_end":42},{"label":"Hechos 27:1-26","book_usfm":"ACT","chapter":27}]'::jsonb),
  (208, '[{"label":"Salmos 43-45","book_usfm":"PSA","chapter":43,"chapter_end":45},{"label":"Hechos 27:27-44","book_usfm":"ACT","chapter":27}]'::jsonb),
  (209, '[{"label":"Salmos 46-48","book_usfm":"PSA","chapter":46,"chapter_end":48},{"label":"Hechos 28","book_usfm":"ACT","chapter":28}]'::jsonb),
  (210, '[{"label":"Salmos 49-50","book_usfm":"PSA","chapter":49,"chapter_end":50},{"label":"Romanos 1","book_usfm":"ROM","chapter":1}]'::jsonb),
  (211, '[{"label":"Salmos 51-53","book_usfm":"PSA","chapter":51,"chapter_end":53},{"label":"Romanos 2","book_usfm":"ROM","chapter":2}]'::jsonb),
  (212, '[{"label":"Salmos 54-56","book_usfm":"PSA","chapter":54,"chapter_end":56},{"label":"Romanos 3","book_usfm":"ROM","chapter":3}]'::jsonb),
  (213, '[{"label":"Salmos 57-59","book_usfm":"PSA","chapter":57,"chapter_end":59},{"label":"Romanos 4","book_usfm":"ROM","chapter":4}]'::jsonb),
  (214, '[{"label":"Salmos 60-62","book_usfm":"PSA","chapter":60,"chapter_end":62},{"label":"Romanos 5","book_usfm":"ROM","chapter":5}]'::jsonb),
  (215, '[{"label":"Salmos 63-65","book_usfm":"PSA","chapter":63,"chapter_end":65},{"label":"Romanos 6","book_usfm":"ROM","chapter":6}]'::jsonb),
  (216, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Romanos 7","book_usfm":"ROM","chapter":7}]'::jsonb),
  (217, '[{"label":"Salmos 68-69","book_usfm":"PSA","chapter":68,"chapter_end":69},{"label":"Romanos 8:1-21","book_usfm":"ROM","chapter":8}]'::jsonb),
  (218, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Romanos 8:22-39","book_usfm":"ROM","chapter":8}]'::jsonb),
  (219, '[{"label":"Salmos 72-73","book_usfm":"PSA","chapter":72,"chapter_end":73},{"label":"Romanos 9:1-15","book_usfm":"ROM","chapter":9}]'::jsonb),
  (220, '[{"label":"Salmos 74-76","book_usfm":"PSA","chapter":74,"chapter_end":76},{"label":"Romanos 9:16-33","book_usfm":"ROM","chapter":9}]'::jsonb),
  (221, '[{"label":"Salmos 77-78","book_usfm":"PSA","chapter":77,"chapter_end":78},{"label":"Romanos 10","book_usfm":"ROM","chapter":10}]'::jsonb),
  (222, '[{"label":"Salmos 79-80","book_usfm":"PSA","chapter":79,"chapter_end":80},{"label":"Romanos 11:1-18","book_usfm":"ROM","chapter":11}]'::jsonb),
  (223, '[{"label":"Salmos 81-83","book_usfm":"PSA","chapter":81,"chapter_end":83},{"label":"Romanos 11:19-36","book_usfm":"ROM","chapter":11}]'::jsonb),
  (224, '[{"label":"Salmos 84-86","book_usfm":"PSA","chapter":84,"chapter_end":86},{"label":"Romanos 12","book_usfm":"ROM","chapter":12}]'::jsonb),
  (225, '[{"label":"Salmos 87-88","book_usfm":"PSA","chapter":87,"chapter_end":88},{"label":"Romanos 13","book_usfm":"ROM","chapter":13}]'::jsonb),
  (226, '[{"label":"Salmos 89-90","book_usfm":"PSA","chapter":89,"chapter_end":90},{"label":"Romanos 14","book_usfm":"ROM","chapter":14}]'::jsonb),
  (227, '[{"label":"Salmos 91-93","book_usfm":"PSA","chapter":91,"chapter_end":93},{"label":"Romanos 15:1-13","book_usfm":"ROM","chapter":15}]'::jsonb),
  (228, '[{"label":"Salmos 94-96","book_usfm":"PSA","chapter":94,"chapter_end":96},{"label":"Romanos 15:14-33","book_usfm":"ROM","chapter":15}]'::jsonb),
  (229, '[{"label":"Salmos 97-99","book_usfm":"PSA","chapter":97,"chapter_end":99},{"label":"Romanos 16","book_usfm":"ROM","chapter":16}]'::jsonb),
  (230, '[{"label":"Salmos 100-102","book_usfm":"PSA","chapter":100,"chapter_end":102},{"label":"1 Corintios 1","book_usfm":"1CO","chapter":1}]'::jsonb),
  (231, '[{"label":"Salmos 103-104","book_usfm":"PSA","chapter":103,"chapter_end":104},{"label":"1 Corintios 2","book_usfm":"1CO","chapter":2}]'::jsonb),
  (232, '[{"label":"Salmos 105-106","book_usfm":"PSA","chapter":105,"chapter_end":106},{"label":"1 Corintios 3","book_usfm":"1CO","chapter":3}]'::jsonb),
  (233, '[{"label":"Salmos 107-109","book_usfm":"PSA","chapter":107,"chapter_end":109},{"label":"1 Corintios 4","book_usfm":"1CO","chapter":4}]'::jsonb),
  (234, '[{"label":"Salmos 110-112","book_usfm":"PSA","chapter":110,"chapter_end":112},{"label":"1 Corintios 5","book_usfm":"1CO","chapter":5}]'::jsonb),
  (235, '[{"label":"Salmos 113-115","book_usfm":"PSA","chapter":113,"chapter_end":115},{"label":"1 Corintios 6","book_usfm":"1CO","chapter":6}]'::jsonb),
  (236, '[{"label":"Salmos 116-118","book_usfm":"PSA","chapter":116,"chapter_end":118},{"label":"1 Corintios 7:1-19","book_usfm":"1CO","chapter":7}]'::jsonb),
  (237, '[{"label":"Salmos 119:1-88","book_usfm":"PSA","chapter":119},{"label":"1 Corintios 7:20-40","book_usfm":"1CO","chapter":7}]'::jsonb),
  (238, '[{"label":"Salmos 119:89-176","book_usfm":"PSA","chapter":119},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8}]'::jsonb),
  (239, '[{"label":"Salmos 120-122","book_usfm":"PSA","chapter":120,"chapter_end":122},{"label":"1 Corintios 9","book_usfm":"1CO","chapter":9}]'::jsonb),
  (240, '[{"label":"Salmos 123-125","book_usfm":"PSA","chapter":123,"chapter_end":125},{"label":"1 Corintios 10:1-18","book_usfm":"1CO","chapter":10}]'::jsonb),
  (241, '[{"label":"Salmos 126-128","book_usfm":"PSA","chapter":126,"chapter_end":128},{"label":"1 Corintios 10:19-33","book_usfm":"1CO","chapter":10}]'::jsonb),
  (242, '[{"label":"Salmos 129-131","book_usfm":"PSA","chapter":129,"chapter_end":131},{"label":"1 Corintios 11:1-16","book_usfm":"1CO","chapter":11}]'::jsonb),
  (243, '[{"label":"Salmos 132-134","book_usfm":"PSA","chapter":132,"chapter_end":134},{"label":"1 Corintios 11:17-34","book_usfm":"1CO","chapter":11}]'::jsonb),
  (244, '[{"label":"Salmos 135-136","book_usfm":"PSA","chapter":135,"chapter_end":136},{"label":"1 Corintios 12","book_usfm":"1CO","chapter":12}]'::jsonb),
  (245, '[{"label":"Salmos 137-139","book_usfm":"PSA","chapter":137,"chapter_end":139},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13}]'::jsonb),
  (246, '[{"label":"Salmos 140-142","book_usfm":"PSA","chapter":140,"chapter_end":142},{"label":"1 Corintios 14:1-20","book_usfm":"1CO","chapter":14}]'::jsonb),
  (247, '[{"label":"Salmos 143-145","book_usfm":"PSA","chapter":143,"chapter_end":145},{"label":"1 Corintios 14:21-40","book_usfm":"1CO","chapter":14}]'::jsonb),
  (248, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"1 Corintios 15:1-28","book_usfm":"1CO","chapter":15}]'::jsonb),
  (249, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"1 Corintios 15:29-58","book_usfm":"1CO","chapter":15}]'::jsonb),
  (250, '[{"label":"Proverbios 1-2","book_usfm":"PRO","chapter":1,"chapter_end":2},{"label":"1 Corintios 16","book_usfm":"1CO","chapter":16}]'::jsonb),
  (251, '[{"label":"Proverbios 3-5","book_usfm":"PRO","chapter":3,"chapter_end":5},{"label":"2 Corintios 1","book_usfm":"2CO","chapter":1}]'::jsonb),
  (252, '[{"label":"Proverbios 6-7","book_usfm":"PRO","chapter":6,"chapter_end":7},{"label":"2 Corintios 2","book_usfm":"2CO","chapter":2}]'::jsonb),
  (253, '[{"label":"Proverbios 8-9","book_usfm":"PRO","chapter":8,"chapter_end":9},{"label":"2 Corintios 3","book_usfm":"2CO","chapter":3}]'::jsonb),
  (254, '[{"label":"Proverbios 10-12","book_usfm":"PRO","chapter":10,"chapter_end":12},{"label":"2 Corintios 4","book_usfm":"2CO","chapter":4}]'::jsonb),
  (255, '[{"label":"Proverbios 13-15","book_usfm":"PRO","chapter":13,"chapter_end":15},{"label":"2 Corintios 5","book_usfm":"2CO","chapter":5}]'::jsonb),
  (256, '[{"label":"Proverbios 16-18","book_usfm":"PRO","chapter":16,"chapter_end":18},{"label":"2 Corintios 6","book_usfm":"2CO","chapter":6}]'::jsonb),
  (257, '[{"label":"Proverbios 19-21","book_usfm":"PRO","chapter":19,"chapter_end":21},{"label":"2 Corintios 7","book_usfm":"2CO","chapter":7}]'::jsonb),
  (258, '[{"label":"Proverbios 22-24","book_usfm":"PRO","chapter":22,"chapter_end":24},{"label":"2 Corintios 8","book_usfm":"2CO","chapter":8}]'::jsonb),
  (259, '[{"label":"Proverbios 25-26","book_usfm":"PRO","chapter":25,"chapter_end":26},{"label":"2 Corintios 9","book_usfm":"2CO","chapter":9}]'::jsonb),
  (260, '[{"label":"Proverbios 27-29","book_usfm":"PRO","chapter":27,"chapter_end":29},{"label":"2 Corintios 10","book_usfm":"2CO","chapter":10}]'::jsonb),
  (261, '[{"label":"Proverbios 30-31","book_usfm":"PRO","chapter":30,"chapter_end":31},{"label":"2 Corintios 11:1-15","book_usfm":"2CO","chapter":11}]'::jsonb),
  (262, '[{"label":"Eclesiastés 1-3","book_usfm":"ECC","chapter":1,"chapter_end":3},{"label":"2 Corintios 11:16-33","book_usfm":"2CO","chapter":11}]'::jsonb),
  (263, '[{"label":"Eclesiastés 4-6","book_usfm":"ECC","chapter":4,"chapter_end":6},{"label":"2 Corintios 12","book_usfm":"2CO","chapter":12}]'::jsonb),
  (264, '[{"label":"Eclesiastés 7-9","book_usfm":"ECC","chapter":7,"chapter_end":9},{"label":"2 Corintios 13","book_usfm":"2CO","chapter":13}]'::jsonb),
  (265, '[{"label":"Eclesiastés 10-12","book_usfm":"ECC","chapter":10,"chapter_end":12},{"label":"Gálatas 1","book_usfm":"GAL","chapter":1}]'::jsonb),
  (266, '[{"label":"Cantares 1-3","book_usfm":"SNG","chapter":1,"chapter_end":3},{"label":"Gálatas 2","book_usfm":"GAL","chapter":2}]'::jsonb),
  (267, '[{"label":"Cantares 4-5","book_usfm":"SNG","chapter":4,"chapter_end":5},{"label":"Gálatas 3","book_usfm":"GAL","chapter":3}]'::jsonb),
  (268, '[{"label":"Cantares 6-8","book_usfm":"SNG","chapter":6,"chapter_end":8},{"label":"Gálatas 4","book_usfm":"GAL","chapter":4}]'::jsonb),
  (269, '[{"label":"Isaías 1-2","book_usfm":"ISA","chapter":1,"chapter_end":2},{"label":"Gálatas 5","book_usfm":"GAL","chapter":5}]'::jsonb),
  (270, '[{"label":"Isaías 3-4","book_usfm":"ISA","chapter":3,"chapter_end":4},{"label":"Gálatas 6","book_usfm":"GAL","chapter":6}]'::jsonb),
  (271, '[{"label":"Isaías 5-6","book_usfm":"ISA","chapter":5,"chapter_end":6},{"label":"Efesios 1","book_usfm":"EPH","chapter":1}]'::jsonb),
  (272, '[{"label":"Isaías 7-8","book_usfm":"ISA","chapter":7,"chapter_end":8},{"label":"Efesios 2","book_usfm":"EPH","chapter":2}]'::jsonb),
  (273, '[{"label":"Isaías 9-10","book_usfm":"ISA","chapter":9,"chapter_end":10},{"label":"Efesios 3","book_usfm":"EPH","chapter":3}]'::jsonb),
  (274, '[{"label":"Isaías 11-13","book_usfm":"ISA","chapter":11,"chapter_end":13},{"label":"Efesios 4","book_usfm":"EPH","chapter":4}]'::jsonb),
  (275, '[{"label":"Isaías 14-16","book_usfm":"ISA","chapter":14,"chapter_end":16},{"label":"Efesios 5:1-16","book_usfm":"EPH","chapter":5}]'::jsonb),
  (276, '[{"label":"Isaías 17-19","book_usfm":"ISA","chapter":17,"chapter_end":19},{"label":"Efesios 5:17-33","book_usfm":"EPH","chapter":5}]'::jsonb),
  (277, '[{"label":"Isaías 20-22","book_usfm":"ISA","chapter":20,"chapter_end":22},{"label":"Efesios 6","book_usfm":"EPH","chapter":6}]'::jsonb),
  (278, '[{"label":"Isaías 23-25","book_usfm":"ISA","chapter":23,"chapter_end":25},{"label":"Filipenses 1","book_usfm":"PHP","chapter":1}]'::jsonb),
  (279, '[{"label":"Isaías 26-27","book_usfm":"ISA","chapter":26,"chapter_end":27},{"label":"Filipenses 2","book_usfm":"PHP","chapter":2}]'::jsonb),
  (280, '[{"label":"Isaías 28-29","book_usfm":"ISA","chapter":28,"chapter_end":29},{"label":"Filipenses 3","book_usfm":"PHP","chapter":3}]'::jsonb),
  (281, '[{"label":"Isaías 30-31","book_usfm":"ISA","chapter":30,"chapter_end":31},{"label":"Filipenses 4","book_usfm":"PHP","chapter":4}]'::jsonb),
  (282, '[{"label":"Isaías 32-33","book_usfm":"ISA","chapter":32,"chapter_end":33},{"label":"Colosenses 1","book_usfm":"COL","chapter":1}]'::jsonb),
  (283, '[{"label":"Isaías 34-36","book_usfm":"ISA","chapter":34,"chapter_end":36},{"label":"Colosenses 2","book_usfm":"COL","chapter":2}]'::jsonb),
  (284, '[{"label":"Isaías 37-38","book_usfm":"ISA","chapter":37,"chapter_end":38},{"label":"Colosenses 3","book_usfm":"COL","chapter":3}]'::jsonb),
  (285, '[{"label":"Isaías 39-40","book_usfm":"ISA","chapter":39,"chapter_end":40},{"label":"Colosenses 4","book_usfm":"COL","chapter":4}]'::jsonb),
  (286, '[{"label":"Isaías 41-42","book_usfm":"ISA","chapter":41,"chapter_end":42},{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1}]'::jsonb),
  (287, '[{"label":"Isaías 43-44","book_usfm":"ISA","chapter":43,"chapter_end":44},{"label":"1 Tesalonicenses 2","book_usfm":"1TH","chapter":2}]'::jsonb),
  (288, '[{"label":"Isaías 45-46","book_usfm":"ISA","chapter":45,"chapter_end":46},{"label":"1 Tesalonicenses 3","book_usfm":"1TH","chapter":3}]'::jsonb),
  (289, '[{"label":"Isaías 47-49","book_usfm":"ISA","chapter":47,"chapter_end":49},{"label":"1 Tesalonicenses 4","book_usfm":"1TH","chapter":4}]'::jsonb),
  (290, '[{"label":"Isaías 50-52","book_usfm":"ISA","chapter":50,"chapter_end":52},{"label":"1 Tesalonicenses 5","book_usfm":"1TH","chapter":5}]'::jsonb),
  (291, '[{"label":"Isaías 53-55","book_usfm":"ISA","chapter":53,"chapter_end":55},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1}]'::jsonb),
  (292, '[{"label":"Isaías 56-58","book_usfm":"ISA","chapter":56,"chapter_end":58},{"label":"2 Tesalonicenses 2","book_usfm":"2TH","chapter":2}]'::jsonb),
  (293, '[{"label":"Isaías 59-61","book_usfm":"ISA","chapter":59,"chapter_end":61},{"label":"2 Tesalonicenses 3","book_usfm":"2TH","chapter":3}]'::jsonb),
  (294, '[{"label":"Isaías 62-64","book_usfm":"ISA","chapter":62,"chapter_end":64},{"label":"1 Timoteo 1","book_usfm":"1TI","chapter":1}]'::jsonb),
  (295, '[{"label":"Isaías 65-66","book_usfm":"ISA","chapter":65,"chapter_end":66},{"label":"1 Timoteo 2","book_usfm":"1TI","chapter":2}]'::jsonb),
  (296, '[{"label":"Jeremías 1-2","book_usfm":"JER","chapter":1,"chapter_end":2},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3}]'::jsonb),
  (297, '[{"label":"Jeremías 3-5","book_usfm":"JER","chapter":3,"chapter_end":5},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4}]'::jsonb),
  (298, '[{"label":"Jeremías 6-8","book_usfm":"JER","chapter":6,"chapter_end":8},{"label":"1 Timoteo 5","book_usfm":"1TI","chapter":5}]'::jsonb),
  (299, '[{"label":"Jeremías 9-11","book_usfm":"JER","chapter":9,"chapter_end":11},{"label":"1 Timoteo 6","book_usfm":"1TI","chapter":6}]'::jsonb),
  (300, '[{"label":"Jeremías 12-14","book_usfm":"JER","chapter":12,"chapter_end":14},{"label":"2 Timoteo 1","book_usfm":"2TI","chapter":1}]'::jsonb),
  (301, '[{"label":"Jeremías 15-17","book_usfm":"JER","chapter":15,"chapter_end":17},{"label":"2 Timoteo 2","book_usfm":"2TI","chapter":2}]'::jsonb),
  (302, '[{"label":"Jeremías 18-19","book_usfm":"JER","chapter":18,"chapter_end":19},{"label":"2 Timoteo 3","book_usfm":"2TI","chapter":3}]'::jsonb),
  (303, '[{"label":"Jeremías 20-21","book_usfm":"JER","chapter":20,"chapter_end":21},{"label":"2 Timoteo 4","book_usfm":"2TI","chapter":4}]'::jsonb),
  (304, '[{"label":"Jeremías 22-23","book_usfm":"JER","chapter":22,"chapter_end":23},{"label":"Tito 1","book_usfm":"TIT","chapter":1}]'::jsonb),
  (305, '[{"label":"Jeremías 24-26","book_usfm":"JER","chapter":24,"chapter_end":26},{"label":"Tito 2","book_usfm":"TIT","chapter":2}]'::jsonb),
  (306, '[{"label":"Jeremías 27-29","book_usfm":"JER","chapter":27,"chapter_end":29},{"label":"Tito 3","book_usfm":"TIT","chapter":3}]'::jsonb),
  (307, '[{"label":"Jeremías 30-31","book_usfm":"JER","chapter":30,"chapter_end":31},{"label":"Filemón","book_usfm":"PHM","chapter":1}]'::jsonb),
  (308, '[{"label":"Jeremías 32-33","book_usfm":"JER","chapter":32,"chapter_end":33},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1}]'::jsonb),
  (309, '[{"label":"Jeremías 34-36","book_usfm":"JER","chapter":34,"chapter_end":36},{"label":"Hebreos 2","book_usfm":"HEB","chapter":2}]'::jsonb),
  (310, '[{"label":"Jeremías 37-39","book_usfm":"JER","chapter":37,"chapter_end":39},{"label":"Hebreos 3","book_usfm":"HEB","chapter":3}]'::jsonb),
  (311, '[{"label":"Jeremías 40-42","book_usfm":"JER","chapter":40,"chapter_end":42},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4}]'::jsonb),
  (312, '[{"label":"Jeremías 43-45","book_usfm":"JER","chapter":43,"chapter_end":45},{"label":"Hebreos 5","book_usfm":"HEB","chapter":5}]'::jsonb),
  (313, '[{"label":"Jeremías 46-47","book_usfm":"JER","chapter":46,"chapter_end":47},{"label":"Hebreos 6","book_usfm":"HEB","chapter":6}]'::jsonb),
  (314, '[{"label":"Jeremías 48-49","book_usfm":"JER","chapter":48,"chapter_end":49},{"label":"Hebreos 7","book_usfm":"HEB","chapter":7}]'::jsonb),
  (315, '[{"label":"Jeremías 50","book_usfm":"JER","chapter":50},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8}]'::jsonb),
  (316, '[{"label":"Jeremías 51-52","book_usfm":"JER","chapter":51,"chapter_end":52},{"label":"Hebreos 9","book_usfm":"HEB","chapter":9}]'::jsonb),
  (317, '[{"label":"Lamentaciones 1-2","book_usfm":"LAM","chapter":1,"chapter_end":2},{"label":"Hebreos 10:1-18","book_usfm":"HEB","chapter":10}]'::jsonb),
  (318, '[{"label":"Lamentaciones 3-5","book_usfm":"LAM","chapter":3,"chapter_end":5},{"label":"Hebreos 10:19-39","book_usfm":"HEB","chapter":10}]'::jsonb),
  (319, '[{"label":"Ezequiel 1-2","book_usfm":"EZK","chapter":1,"chapter_end":2},{"label":"Hebreos 11:1-19","book_usfm":"HEB","chapter":11}]'::jsonb),
  (320, '[{"label":"Ezequiel 3-4","book_usfm":"EZK","chapter":3,"chapter_end":4},{"label":"Hebreos 11:20-40","book_usfm":"HEB","chapter":11}]'::jsonb),
  (321, '[{"label":"Ezequiel 5-7","book_usfm":"EZK","chapter":5,"chapter_end":7},{"label":"Hebreos 12","book_usfm":"HEB","chapter":12}]'::jsonb),
  (322, '[{"label":"Ezequiel 8-10","book_usfm":"EZK","chapter":8,"chapter_end":10},{"label":"Hebreos 13","book_usfm":"HEB","chapter":13}]'::jsonb),
  (323, '[{"label":"Ezequiel 11-13","book_usfm":"EZK","chapter":11,"chapter_end":13},{"label":"Santiago 1","book_usfm":"JAS","chapter":1}]'::jsonb),
  (324, '[{"label":"Ezequiel 14-15","book_usfm":"EZK","chapter":14,"chapter_end":15},{"label":"Santiago 2","book_usfm":"JAS","chapter":2}]'::jsonb),
  (325, '[{"label":"Ezequiel 16-17","book_usfm":"EZK","chapter":16,"chapter_end":17},{"label":"Santiago 3","book_usfm":"JAS","chapter":3}]'::jsonb),
  (326, '[{"label":"Ezequiel 18-19","book_usfm":"EZK","chapter":18,"chapter_end":19},{"label":"Santiago 4","book_usfm":"JAS","chapter":4}]'::jsonb),
  (327, '[{"label":"Ezequiel 20-21","book_usfm":"EZK","chapter":20,"chapter_end":21},{"label":"Santiago 5","book_usfm":"JAS","chapter":5}]'::jsonb),
  (328, '[{"label":"Ezequiel 22-23","book_usfm":"EZK","chapter":22,"chapter_end":23},{"label":"1 Pedro 1","book_usfm":"1PE","chapter":1}]'::jsonb),
  (329, '[{"label":"Ezequiel 24-26","book_usfm":"EZK","chapter":24,"chapter_end":26},{"label":"1 Pedro 2","book_usfm":"1PE","chapter":2}]'::jsonb),
  (330, '[{"label":"Ezequiel 27-29","book_usfm":"EZK","chapter":27,"chapter_end":29},{"label":"1 Pedro 3","book_usfm":"1PE","chapter":3}]'::jsonb),
  (331, '[{"label":"Ezequiel 30-32","book_usfm":"EZK","chapter":30,"chapter_end":32},{"label":"1 Pedro 4","book_usfm":"1PE","chapter":4}]'::jsonb),
  (332, '[{"label":"Ezequiel 33-34","book_usfm":"EZK","chapter":33,"chapter_end":34},{"label":"1 Pedro 5","book_usfm":"1PE","chapter":5}]'::jsonb),
  (333, '[{"label":"Ezequiel 35-36","book_usfm":"EZK","chapter":35,"chapter_end":36},{"label":"2 Pedro 1","book_usfm":"2PE","chapter":1}]'::jsonb),
  (334, '[{"label":"Ezequiel 37-39","book_usfm":"EZK","chapter":37,"chapter_end":39},{"label":"2 Pedro 2","book_usfm":"2PE","chapter":2}]'::jsonb),
  (335, '[{"label":"Ezequiel 40-41","book_usfm":"EZK","chapter":40,"chapter_end":41},{"label":"2 Pedro 3","book_usfm":"2PE","chapter":3}]'::jsonb),
  (336, '[{"label":"Ezequiel 42-44","book_usfm":"EZK","chapter":42,"chapter_end":44},{"label":"1 Juan 1","book_usfm":"1JN","chapter":1}]'::jsonb),
  (337, '[{"label":"Ezequiel 45-46","book_usfm":"EZK","chapter":45,"chapter_end":46},{"label":"1 Juan 2","book_usfm":"1JN","chapter":2}]'::jsonb),
  (338, '[{"label":"Ezequiel 47-48","book_usfm":"EZK","chapter":47,"chapter_end":48},{"label":"1 Juan 3","book_usfm":"1JN","chapter":3}]'::jsonb),
  (339, '[{"label":"Daniel 1-2","book_usfm":"DAN","chapter":1,"chapter_end":2},{"label":"1 Juan 4","book_usfm":"1JN","chapter":4}]'::jsonb),
  (340, '[{"label":"Daniel 3-4","book_usfm":"DAN","chapter":3,"chapter_end":4},{"label":"1 Juan 5","book_usfm":"1JN","chapter":5}]'::jsonb),
  (341, '[{"label":"Daniel 5-7","book_usfm":"DAN","chapter":5,"chapter_end":7},{"label":"2 Juan","book_usfm":"2JN","chapter":1}]'::jsonb),
  (342, '[{"label":"Daniel 8-10","book_usfm":"DAN","chapter":8,"chapter_end":10},{"label":"3 Juan","book_usfm":"3JN","chapter":1}]'::jsonb),
  (343, '[{"label":"Daniel 11-12","book_usfm":"DAN","chapter":11,"chapter_end":12},{"label":"Judas","book_usfm":"JUD","chapter":1}]'::jsonb),
  (344, '[{"label":"Oseas 1-4","book_usfm":"HOS","chapter":1,"chapter_end":4},{"label":"Apocalipsis 1","book_usfm":"REV","chapter":1}]'::jsonb),
  (345, '[{"label":"Oseas 5-8","book_usfm":"HOS","chapter":5,"chapter_end":8},{"label":"Apocalipsis 2","book_usfm":"REV","chapter":2}]'::jsonb),
  (346, '[{"label":"Oseas 9-11","book_usfm":"HOS","chapter":9,"chapter_end":11},{"label":"Apocalipsis 3","book_usfm":"REV","chapter":3}]'::jsonb),
  (347, '[{"label":"Oseas 12-14","book_usfm":"HOS","chapter":12,"chapter_end":14},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4}]'::jsonb),
  (348, '[{"label":"Joel 1-3","book_usfm":"JOL","chapter":1,"chapter_end":3},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5}]'::jsonb),
  (349, '[{"label":"Amós 1-3","book_usfm":"AMO","chapter":1,"chapter_end":3},{"label":"Apocalipsis 6","book_usfm":"REV","chapter":6}]'::jsonb),
  (350, '[{"label":"Amós 4-6","book_usfm":"AMO","chapter":4,"chapter_end":6},{"label":"Apocalipsis 7","book_usfm":"REV","chapter":7}]'::jsonb),
  (351, '[{"label":"Amós 7-9","book_usfm":"AMO","chapter":7,"chapter_end":9},{"label":"Apocalipsis 8","book_usfm":"REV","chapter":8}]'::jsonb),
  (352, '[{"label":"Abdías","book_usfm":"OBA","chapter":1},{"label":"Apocalipsis 9","book_usfm":"REV","chapter":9}]'::jsonb),
  (353, '[{"label":"Jonás 1-4","book_usfm":"JON","chapter":1,"chapter_end":4},{"label":"Apocalipsis 10","book_usfm":"REV","chapter":10}]'::jsonb),
  (354, '[{"label":"Miqueas 1-3","book_usfm":"MIC","chapter":1,"chapter_end":3},{"label":"Apocalipsis 11","book_usfm":"REV","chapter":11}]'::jsonb),
  (355, '[{"label":"Miqueas 4-5","book_usfm":"MIC","chapter":4,"chapter_end":5},{"label":"Apocalipsis 12","book_usfm":"REV","chapter":12}]'::jsonb),
  (356, '[{"label":"Miqueas 6-7","book_usfm":"MIC","chapter":6,"chapter_end":7},{"label":"Apocalipsis 13","book_usfm":"REV","chapter":13}]'::jsonb),
  (357, '[{"label":"Nahúm 1-3","book_usfm":"NAM","chapter":1,"chapter_end":3},{"label":"Apocalipsis 14","book_usfm":"REV","chapter":14}]'::jsonb),
  (358, '[{"label":"Habacuc 1-3","book_usfm":"HAB","chapter":1,"chapter_end":3},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15}]'::jsonb),
  (359, '[{"label":"Sofonías 1-3","book_usfm":"ZEP","chapter":1,"chapter_end":3},{"label":"Apocalipsis 16","book_usfm":"REV","chapter":16}]'::jsonb),
  (360, '[{"label":"Hageo 1-2","book_usfm":"HAG","chapter":1,"chapter_end":2},{"label":"Apocalipsis 17","book_usfm":"REV","chapter":17}]'::jsonb),
  (361, '[{"label":"Zacarías 1-4","book_usfm":"ZEC","chapter":1,"chapter_end":4},{"label":"Apocalipsis 18","book_usfm":"REV","chapter":18}]'::jsonb),
  (362, '[{"label":"Zacarías 5-8","book_usfm":"ZEC","chapter":5,"chapter_end":8},{"label":"Apocalipsis 19","book_usfm":"REV","chapter":19}]'::jsonb),
  (363, '[{"label":"Zacarías 9-12","book_usfm":"ZEC","chapter":9,"chapter_end":12},{"label":"Apocalipsis 20","book_usfm":"REV","chapter":20}]'::jsonb),
  (364, '[{"label":"Zacarías 13-14","book_usfm":"ZEC","chapter":13,"chapter_end":14},{"label":"Apocalipsis 21","book_usfm":"REV","chapter":21}]'::jsonb),
  (365, '[{"label":"Malaquías 1-4","book_usfm":"MAL","chapter":1,"chapter_end":4},{"label":"Apocalipsis 22","book_usfm":"REV","chapter":22}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'at-nt';

-- ---- Plan: De Génesis a Apocalipsis (365 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('beginning', 'De Génesis a Apocalipsis', 'Toda la Biblia en orden, de principio a fin, en un año.', 365, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'beginning');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Génesis 1-3","book_usfm":"GEN","chapter":1,"chapter_end":3}]'::jsonb),
  (2, '[{"label":"Génesis 4-7","book_usfm":"GEN","chapter":4,"chapter_end":7}]'::jsonb),
  (3, '[{"label":"Génesis 8-11","book_usfm":"GEN","chapter":8,"chapter_end":11}]'::jsonb),
  (4, '[{"label":"Génesis 12-15","book_usfm":"GEN","chapter":12,"chapter_end":15}]'::jsonb),
  (5, '[{"label":"Génesis 16-18","book_usfm":"GEN","chapter":16,"chapter_end":18}]'::jsonb),
  (6, '[{"label":"Génesis 19-21","book_usfm":"GEN","chapter":19,"chapter_end":21}]'::jsonb),
  (7, '[{"label":"Génesis 22-24","book_usfm":"GEN","chapter":22,"chapter_end":24}]'::jsonb),
  (8, '[{"label":"Génesis 25-26","book_usfm":"GEN","chapter":25,"chapter_end":26}]'::jsonb),
  (9, '[{"label":"Génesis 27-29","book_usfm":"GEN","chapter":27,"chapter_end":29}]'::jsonb),
  (10, '[{"label":"Génesis 30-31","book_usfm":"GEN","chapter":30,"chapter_end":31}]'::jsonb),
  (11, '[{"label":"Génesis 32-34","book_usfm":"GEN","chapter":32,"chapter_end":34}]'::jsonb),
  (12, '[{"label":"Génesis 35-37","book_usfm":"GEN","chapter":35,"chapter_end":37}]'::jsonb),
  (13, '[{"label":"Génesis 38-40","book_usfm":"GEN","chapter":38,"chapter_end":40}]'::jsonb),
  (14, '[{"label":"Génesis 41-42","book_usfm":"GEN","chapter":41,"chapter_end":42}]'::jsonb),
  (15, '[{"label":"Génesis 43-45","book_usfm":"GEN","chapter":43,"chapter_end":45}]'::jsonb),
  (16, '[{"label":"Génesis 46-47","book_usfm":"GEN","chapter":46,"chapter_end":47}]'::jsonb),
  (17, '[{"label":"Génesis 48-50","book_usfm":"GEN","chapter":48,"chapter_end":50}]'::jsonb),
  (18, '[{"label":"Éxodo 1-3","book_usfm":"EXO","chapter":1,"chapter_end":3}]'::jsonb),
  (19, '[{"label":"Éxodo 4-6","book_usfm":"EXO","chapter":4,"chapter_end":6}]'::jsonb),
  (20, '[{"label":"Éxodo 7-9","book_usfm":"EXO","chapter":7,"chapter_end":9}]'::jsonb),
  (21, '[{"label":"Éxodo 10-12","book_usfm":"EXO","chapter":10,"chapter_end":12}]'::jsonb),
  (22, '[{"label":"Éxodo 13-15","book_usfm":"EXO","chapter":13,"chapter_end":15}]'::jsonb),
  (23, '[{"label":"Éxodo 16-18","book_usfm":"EXO","chapter":16,"chapter_end":18}]'::jsonb),
  (24, '[{"label":"Éxodo 19-21","book_usfm":"EXO","chapter":19,"chapter_end":21}]'::jsonb),
  (25, '[{"label":"Éxodo 22-24","book_usfm":"EXO","chapter":22,"chapter_end":24}]'::jsonb),
  (26, '[{"label":"Éxodo 25-27","book_usfm":"EXO","chapter":25,"chapter_end":27}]'::jsonb),
  (27, '[{"label":"Éxodo 28-29","book_usfm":"EXO","chapter":28,"chapter_end":29}]'::jsonb),
  (28, '[{"label":"Éxodo 30-32","book_usfm":"EXO","chapter":30,"chapter_end":32}]'::jsonb),
  (29, '[{"label":"Éxodo 33-35","book_usfm":"EXO","chapter":33,"chapter_end":35}]'::jsonb),
  (30, '[{"label":"Éxodo 36-38","book_usfm":"EXO","chapter":36,"chapter_end":38}]'::jsonb),
  (31, '[{"label":"Éxodo 39-40","book_usfm":"EXO","chapter":39,"chapter_end":40}]'::jsonb),
  (32, '[{"label":"Levítico 1-4","book_usfm":"LEV","chapter":1,"chapter_end":4}]'::jsonb),
  (33, '[{"label":"Levítico 5-7","book_usfm":"LEV","chapter":5,"chapter_end":7}]'::jsonb),
  (34, '[{"label":"Levítico 8-10","book_usfm":"LEV","chapter":8,"chapter_end":10}]'::jsonb),
  (35, '[{"label":"Levítico 11-13","book_usfm":"LEV","chapter":11,"chapter_end":13}]'::jsonb),
  (36, '[{"label":"Levítico 14-15","book_usfm":"LEV","chapter":14,"chapter_end":15}]'::jsonb),
  (37, '[{"label":"Levítico 16-18","book_usfm":"LEV","chapter":16,"chapter_end":18}]'::jsonb),
  (38, '[{"label":"Levítico 19-21","book_usfm":"LEV","chapter":19,"chapter_end":21}]'::jsonb),
  (39, '[{"label":"Levítico 22-23","book_usfm":"LEV","chapter":22,"chapter_end":23}]'::jsonb),
  (40, '[{"label":"Levítico 24-25","book_usfm":"LEV","chapter":24,"chapter_end":25}]'::jsonb),
  (41, '[{"label":"Levítico 26-27","book_usfm":"LEV","chapter":26,"chapter_end":27}]'::jsonb),
  (42, '[{"label":"Números 1-2","book_usfm":"NUM","chapter":1,"chapter_end":2}]'::jsonb),
  (43, '[{"label":"Números 3-4","book_usfm":"NUM","chapter":3,"chapter_end":4}]'::jsonb),
  (44, '[{"label":"Números 5-6","book_usfm":"NUM","chapter":5,"chapter_end":6}]'::jsonb),
  (45, '[{"label":"Números 7","book_usfm":"NUM","chapter":7}]'::jsonb),
  (46, '[{"label":"Números 8-10","book_usfm":"NUM","chapter":8,"chapter_end":10}]'::jsonb),
  (47, '[{"label":"Números 11-13","book_usfm":"NUM","chapter":11,"chapter_end":13}]'::jsonb),
  (48, '[{"label":"Números 14-15","book_usfm":"NUM","chapter":14,"chapter_end":15}]'::jsonb),
  (49, '[{"label":"Números 16-17","book_usfm":"NUM","chapter":16,"chapter_end":17}]'::jsonb),
  (50, '[{"label":"Números 18-20","book_usfm":"NUM","chapter":18,"chapter_end":20}]'::jsonb),
  (51, '[{"label":"Números 21-22","book_usfm":"NUM","chapter":21,"chapter_end":22}]'::jsonb),
  (52, '[{"label":"Números 23-25","book_usfm":"NUM","chapter":23,"chapter_end":25}]'::jsonb),
  (53, '[{"label":"Números 26-27","book_usfm":"NUM","chapter":26,"chapter_end":27}]'::jsonb),
  (54, '[{"label":"Números 28-30","book_usfm":"NUM","chapter":28,"chapter_end":30}]'::jsonb),
  (55, '[{"label":"Números 31-32","book_usfm":"NUM","chapter":31,"chapter_end":32}]'::jsonb),
  (56, '[{"label":"Números 33-34","book_usfm":"NUM","chapter":33,"chapter_end":34}]'::jsonb),
  (57, '[{"label":"Números 35-36","book_usfm":"NUM","chapter":35,"chapter_end":36}]'::jsonb),
  (58, '[{"label":"Deuteronomio 1-2","book_usfm":"DEU","chapter":1,"chapter_end":2}]'::jsonb),
  (59, '[{"label":"Deuteronomio 3-4","book_usfm":"DEU","chapter":3,"chapter_end":4}]'::jsonb),
  (60, '[{"label":"Deuteronomio 5-7","book_usfm":"DEU","chapter":5,"chapter_end":7}]'::jsonb),
  (61, '[{"label":"Deuteronomio 8-10","book_usfm":"DEU","chapter":8,"chapter_end":10}]'::jsonb),
  (62, '[{"label":"Deuteronomio 11-13","book_usfm":"DEU","chapter":11,"chapter_end":13}]'::jsonb),
  (63, '[{"label":"Deuteronomio 14-16","book_usfm":"DEU","chapter":14,"chapter_end":16}]'::jsonb),
  (64, '[{"label":"Deuteronomio 17-20","book_usfm":"DEU","chapter":17,"chapter_end":20}]'::jsonb),
  (65, '[{"label":"Deuteronomio 21-23","book_usfm":"DEU","chapter":21,"chapter_end":23}]'::jsonb),
  (66, '[{"label":"Deuteronomio 24-27","book_usfm":"DEU","chapter":24,"chapter_end":27}]'::jsonb),
  (67, '[{"label":"Deuteronomio 28-29","book_usfm":"DEU","chapter":28,"chapter_end":29}]'::jsonb),
  (68, '[{"label":"Deuteronomio 30-31","book_usfm":"DEU","chapter":30,"chapter_end":31}]'::jsonb),
  (69, '[{"label":"Deuteronomio 32-34","book_usfm":"DEU","chapter":32,"chapter_end":34}]'::jsonb),
  (70, '[{"label":"Josué 1-4","book_usfm":"JOS","chapter":1,"chapter_end":4}]'::jsonb),
  (71, '[{"label":"Josué 5-8","book_usfm":"JOS","chapter":5,"chapter_end":8}]'::jsonb),
  (72, '[{"label":"Josué 9-11","book_usfm":"JOS","chapter":9,"chapter_end":11}]'::jsonb),
  (73, '[{"label":"Josué 12-15","book_usfm":"JOS","chapter":12,"chapter_end":15}]'::jsonb),
  (74, '[{"label":"Josué 16-18","book_usfm":"JOS","chapter":16,"chapter_end":18}]'::jsonb),
  (75, '[{"label":"Josué 19-21","book_usfm":"JOS","chapter":19,"chapter_end":21}]'::jsonb),
  (76, '[{"label":"Josué 22-24","book_usfm":"JOS","chapter":22,"chapter_end":24}]'::jsonb),
  (77, '[{"label":"Jueces 1-2","book_usfm":"JDG","chapter":1,"chapter_end":2}]'::jsonb),
  (78, '[{"label":"Jueces 3-5","book_usfm":"JDG","chapter":3,"chapter_end":5}]'::jsonb),
  (79, '[{"label":"Jueces 6-7","book_usfm":"JDG","chapter":6,"chapter_end":7}]'::jsonb),
  (80, '[{"label":"Jueces 8-9","book_usfm":"JDG","chapter":8,"chapter_end":9}]'::jsonb),
  (81, '[{"label":"Jueces 10-12","book_usfm":"JDG","chapter":10,"chapter_end":12}]'::jsonb),
  (82, '[{"label":"Jueces 13-15","book_usfm":"JDG","chapter":13,"chapter_end":15}]'::jsonb),
  (83, '[{"label":"Jueces 16-18","book_usfm":"JDG","chapter":16,"chapter_end":18}]'::jsonb),
  (84, '[{"label":"Jueces 19-21","book_usfm":"JDG","chapter":19,"chapter_end":21}]'::jsonb),
  (85, '[{"label":"Rut 1-4","book_usfm":"RUT","chapter":1,"chapter_end":4}]'::jsonb),
  (86, '[{"label":"1 Samuel 1-3","book_usfm":"1SA","chapter":1,"chapter_end":3}]'::jsonb),
  (87, '[{"label":"1 Samuel 4-8","book_usfm":"1SA","chapter":4,"chapter_end":8}]'::jsonb),
  (88, '[{"label":"1 Samuel 9-12","book_usfm":"1SA","chapter":9,"chapter_end":12}]'::jsonb),
  (89, '[{"label":"1 Samuel 13-14","book_usfm":"1SA","chapter":13,"chapter_end":14}]'::jsonb),
  (90, '[{"label":"1 Samuel 15-17","book_usfm":"1SA","chapter":15,"chapter_end":17}]'::jsonb),
  (91, '[{"label":"1 Samuel 18-20","book_usfm":"1SA","chapter":18,"chapter_end":20}]'::jsonb),
  (92, '[{"label":"1 Samuel 21-24","book_usfm":"1SA","chapter":21,"chapter_end":24}]'::jsonb),
  (93, '[{"label":"1 Samuel 25-27","book_usfm":"1SA","chapter":25,"chapter_end":27}]'::jsonb),
  (94, '[{"label":"1 Samuel 28-31","book_usfm":"1SA","chapter":28,"chapter_end":31}]'::jsonb),
  (95, '[{"label":"2 Samuel 1-3","book_usfm":"2SA","chapter":1,"chapter_end":3}]'::jsonb),
  (96, '[{"label":"2 Samuel 4-7","book_usfm":"2SA","chapter":4,"chapter_end":7}]'::jsonb),
  (97, '[{"label":"2 Samuel 8-12","book_usfm":"2SA","chapter":8,"chapter_end":12}]'::jsonb),
  (98, '[{"label":"2 Samuel 13-15","book_usfm":"2SA","chapter":13,"chapter_end":15}]'::jsonb),
  (99, '[{"label":"2 Samuel 16-18","book_usfm":"2SA","chapter":16,"chapter_end":18}]'::jsonb),
  (100, '[{"label":"2 Samuel 19-21","book_usfm":"2SA","chapter":19,"chapter_end":21}]'::jsonb),
  (101, '[{"label":"2 Samuel 22-24","book_usfm":"2SA","chapter":22,"chapter_end":24}]'::jsonb),
  (102, '[{"label":"1 Reyes 1-2","book_usfm":"1KI","chapter":1,"chapter_end":2}]'::jsonb),
  (103, '[{"label":"1 Reyes 3-5","book_usfm":"1KI","chapter":3,"chapter_end":5}]'::jsonb),
  (104, '[{"label":"1 Reyes 6-7","book_usfm":"1KI","chapter":6,"chapter_end":7}]'::jsonb),
  (105, '[{"label":"1 Reyes 8-9","book_usfm":"1KI","chapter":8,"chapter_end":9}]'::jsonb),
  (106, '[{"label":"1 Reyes 10-11","book_usfm":"1KI","chapter":10,"chapter_end":11}]'::jsonb),
  (107, '[{"label":"1 Reyes 12-14","book_usfm":"1KI","chapter":12,"chapter_end":14}]'::jsonb),
  (108, '[{"label":"1 Reyes 15-17","book_usfm":"1KI","chapter":15,"chapter_end":17}]'::jsonb),
  (109, '[{"label":"1 Reyes 18-20","book_usfm":"1KI","chapter":18,"chapter_end":20}]'::jsonb),
  (110, '[{"label":"1 Reyes 21-22","book_usfm":"1KI","chapter":21,"chapter_end":22}]'::jsonb),
  (111, '[{"label":"2 Reyes 1-3","book_usfm":"2KI","chapter":1,"chapter_end":3}]'::jsonb),
  (112, '[{"label":"2 Reyes 4-5","book_usfm":"2KI","chapter":4,"chapter_end":5}]'::jsonb),
  (113, '[{"label":"2 Reyes 6-8","book_usfm":"2KI","chapter":6,"chapter_end":8}]'::jsonb),
  (114, '[{"label":"2 Reyes 9-11","book_usfm":"2KI","chapter":9,"chapter_end":11}]'::jsonb),
  (115, '[{"label":"2 Reyes 12-14","book_usfm":"2KI","chapter":12,"chapter_end":14}]'::jsonb),
  (116, '[{"label":"2 Reyes 15-17","book_usfm":"2KI","chapter":15,"chapter_end":17}]'::jsonb),
  (117, '[{"label":"2 Reyes 18-19","book_usfm":"2KI","chapter":18,"chapter_end":19}]'::jsonb),
  (118, '[{"label":"2 Reyes 20-22","book_usfm":"2KI","chapter":20,"chapter_end":22}]'::jsonb),
  (119, '[{"label":"2 Reyes 23-25","book_usfm":"2KI","chapter":23,"chapter_end":25}]'::jsonb),
  (120, '[{"label":"1 Crónicas 1-2","book_usfm":"1CH","chapter":1,"chapter_end":2}]'::jsonb),
  (121, '[{"label":"1 Crónicas 3-5","book_usfm":"1CH","chapter":3,"chapter_end":5}]'::jsonb),
  (122, '[{"label":"1 Crónicas 6","book_usfm":"1CH","chapter":6}]'::jsonb),
  (123, '[{"label":"1 Crónicas 7-8","book_usfm":"1CH","chapter":7,"chapter_end":8}]'::jsonb),
  (124, '[{"label":"1 Crónicas 9-11","book_usfm":"1CH","chapter":9,"chapter_end":11}]'::jsonb),
  (125, '[{"label":"1 Crónicas 12-14","book_usfm":"1CH","chapter":12,"chapter_end":14}]'::jsonb),
  (126, '[{"label":"1 Crónicas 15-17","book_usfm":"1CH","chapter":15,"chapter_end":17}]'::jsonb),
  (127, '[{"label":"1 Crónicas 18-21","book_usfm":"1CH","chapter":18,"chapter_end":21}]'::jsonb),
  (128, '[{"label":"1 Crónicas 22-24","book_usfm":"1CH","chapter":22,"chapter_end":24}]'::jsonb),
  (129, '[{"label":"1 Crónicas 25-27","book_usfm":"1CH","chapter":25,"chapter_end":27}]'::jsonb),
  (130, '[{"label":"1 Crónicas 28-29","book_usfm":"1CH","chapter":28,"chapter_end":29},{"label":"2 Crónicas 1","book_usfm":"2CH","chapter":1}]'::jsonb),
  (131, '[{"label":"2 Crónicas 2-5","book_usfm":"2CH","chapter":2,"chapter_end":5}]'::jsonb),
  (132, '[{"label":"2 Crónicas 6-8","book_usfm":"2CH","chapter":6,"chapter_end":8}]'::jsonb),
  (133, '[{"label":"2 Crónicas 9-12","book_usfm":"2CH","chapter":9,"chapter_end":12}]'::jsonb),
  (134, '[{"label":"2 Crónicas 13-17","book_usfm":"2CH","chapter":13,"chapter_end":17}]'::jsonb),
  (135, '[{"label":"2 Crónicas 18-20","book_usfm":"2CH","chapter":18,"chapter_end":20}]'::jsonb),
  (136, '[{"label":"2 Crónicas 21-24","book_usfm":"2CH","chapter":21,"chapter_end":24}]'::jsonb),
  (137, '[{"label":"2 Crónicas 25-27","book_usfm":"2CH","chapter":25,"chapter_end":27}]'::jsonb),
  (138, '[{"label":"2 Crónicas 28-31","book_usfm":"2CH","chapter":28,"chapter_end":31}]'::jsonb),
  (139, '[{"label":"2 Crónicas 32-34","book_usfm":"2CH","chapter":32,"chapter_end":34}]'::jsonb),
  (140, '[{"label":"2 Crónicas 35-36","book_usfm":"2CH","chapter":35,"chapter_end":36}]'::jsonb),
  (141, '[{"label":"Esdras 1-3","book_usfm":"EZR","chapter":1,"chapter_end":3}]'::jsonb),
  (142, '[{"label":"Esdras 4-7","book_usfm":"EZR","chapter":4,"chapter_end":7}]'::jsonb),
  (143, '[{"label":"Esdras 8-10","book_usfm":"EZR","chapter":8,"chapter_end":10}]'::jsonb),
  (144, '[{"label":"Nehemías 1-3","book_usfm":"NEH","chapter":1,"chapter_end":3}]'::jsonb),
  (145, '[{"label":"Nehemías 4-6","book_usfm":"NEH","chapter":4,"chapter_end":6}]'::jsonb),
  (146, '[{"label":"Nehemías 7","book_usfm":"NEH","chapter":7}]'::jsonb),
  (147, '[{"label":"Nehemías 8-9","book_usfm":"NEH","chapter":8,"chapter_end":9}]'::jsonb),
  (148, '[{"label":"Nehemías 10-11","book_usfm":"NEH","chapter":10,"chapter_end":11}]'::jsonb),
  (149, '[{"label":"Nehemías 12-13","book_usfm":"NEH","chapter":12,"chapter_end":13}]'::jsonb),
  (150, '[{"label":"Ester 1-5","book_usfm":"EST","chapter":1,"chapter_end":5}]'::jsonb),
  (151, '[{"label":"Ester 6-10","book_usfm":"EST","chapter":6,"chapter_end":10}]'::jsonb),
  (152, '[{"label":"Job 1-4","book_usfm":"JOB","chapter":1,"chapter_end":4}]'::jsonb),
  (153, '[{"label":"Job 5-7","book_usfm":"JOB","chapter":5,"chapter_end":7}]'::jsonb),
  (154, '[{"label":"Job 8-10","book_usfm":"JOB","chapter":8,"chapter_end":10}]'::jsonb),
  (155, '[{"label":"Job 11-13","book_usfm":"JOB","chapter":11,"chapter_end":13}]'::jsonb),
  (156, '[{"label":"Job 14-16","book_usfm":"JOB","chapter":14,"chapter_end":16}]'::jsonb),
  (157, '[{"label":"Job 17-20","book_usfm":"JOB","chapter":17,"chapter_end":20}]'::jsonb),
  (158, '[{"label":"Job 21-23","book_usfm":"JOB","chapter":21,"chapter_end":23}]'::jsonb),
  (159, '[{"label":"Job 24-28","book_usfm":"JOB","chapter":24,"chapter_end":28}]'::jsonb),
  (160, '[{"label":"Job 29-31","book_usfm":"JOB","chapter":29,"chapter_end":31}]'::jsonb),
  (161, '[{"label":"Job 32-34","book_usfm":"JOB","chapter":32,"chapter_end":34}]'::jsonb),
  (162, '[{"label":"Job 35-37","book_usfm":"JOB","chapter":35,"chapter_end":37}]'::jsonb),
  (163, '[{"label":"Job 38-39","book_usfm":"JOB","chapter":38,"chapter_end":39}]'::jsonb),
  (164, '[{"label":"Job 40-42","book_usfm":"JOB","chapter":40,"chapter_end":42}]'::jsonb),
  (165, '[{"label":"Salmos 1-8","book_usfm":"PSA","chapter":1,"chapter_end":8}]'::jsonb),
  (166, '[{"label":"Salmos 9-16","book_usfm":"PSA","chapter":9,"chapter_end":16}]'::jsonb),
  (167, '[{"label":"Salmos 17-20","book_usfm":"PSA","chapter":17,"chapter_end":20}]'::jsonb),
  (168, '[{"label":"Salmos 21-25","book_usfm":"PSA","chapter":21,"chapter_end":25}]'::jsonb),
  (169, '[{"label":"Salmos 26-31","book_usfm":"PSA","chapter":26,"chapter_end":31}]'::jsonb),
  (170, '[{"label":"Salmos 32-35","book_usfm":"PSA","chapter":32,"chapter_end":35}]'::jsonb),
  (171, '[{"label":"Salmos 36-39","book_usfm":"PSA","chapter":36,"chapter_end":39}]'::jsonb),
  (172, '[{"label":"Salmos 40-45","book_usfm":"PSA","chapter":40,"chapter_end":45}]'::jsonb),
  (173, '[{"label":"Salmos 46-50","book_usfm":"PSA","chapter":46,"chapter_end":50}]'::jsonb),
  (174, '[{"label":"Salmos 51-57","book_usfm":"PSA","chapter":51,"chapter_end":57}]'::jsonb),
  (175, '[{"label":"Salmos 58-65","book_usfm":"PSA","chapter":58,"chapter_end":65}]'::jsonb),
  (176, '[{"label":"Salmos 66-69","book_usfm":"PSA","chapter":66,"chapter_end":69}]'::jsonb),
  (177, '[{"label":"Salmos 70-73","book_usfm":"PSA","chapter":70,"chapter_end":73}]'::jsonb),
  (178, '[{"label":"Salmos 74-77","book_usfm":"PSA","chapter":74,"chapter_end":77}]'::jsonb),
  (179, '[{"label":"Salmos 78-79","book_usfm":"PSA","chapter":78,"chapter_end":79}]'::jsonb),
  (180, '[{"label":"Salmos 80-85","book_usfm":"PSA","chapter":80,"chapter_end":85}]'::jsonb),
  (181, '[{"label":"Salmos 86-89","book_usfm":"PSA","chapter":86,"chapter_end":89}]'::jsonb),
  (182, '[{"label":"Salmos 90-95","book_usfm":"PSA","chapter":90,"chapter_end":95}]'::jsonb),
  (183, '[{"label":"Salmos 96-102","book_usfm":"PSA","chapter":96,"chapter_end":102}]'::jsonb),
  (184, '[{"label":"Salmos 103-105","book_usfm":"PSA","chapter":103,"chapter_end":105}]'::jsonb),
  (185, '[{"label":"Salmos 106-107","book_usfm":"PSA","chapter":106,"chapter_end":107}]'::jsonb),
  (186, '[{"label":"Salmos 108-114","book_usfm":"PSA","chapter":108,"chapter_end":114}]'::jsonb),
  (187, '[{"label":"Salmos 115-118","book_usfm":"PSA","chapter":115,"chapter_end":118}]'::jsonb),
  (188, '[{"label":"Salmos 119:1-88","book_usfm":"PSA","chapter":119}]'::jsonb),
  (189, '[{"label":"Salmos 119:89-176","book_usfm":"PSA","chapter":119}]'::jsonb),
  (190, '[{"label":"Salmos 120-132","book_usfm":"PSA","chapter":120,"chapter_end":132}]'::jsonb),
  (191, '[{"label":"Salmos 133-139","book_usfm":"PSA","chapter":133,"chapter_end":139}]'::jsonb),
  (192, '[{"label":"Salmos 140-145","book_usfm":"PSA","chapter":140,"chapter_end":145}]'::jsonb),
  (193, '[{"label":"Salmos 146-150","book_usfm":"PSA","chapter":146,"chapter_end":150}]'::jsonb),
  (194, '[{"label":"Proverbios 1-3","book_usfm":"PRO","chapter":1,"chapter_end":3}]'::jsonb),
  (195, '[{"label":"Proverbios 4-6","book_usfm":"PRO","chapter":4,"chapter_end":6}]'::jsonb),
  (196, '[{"label":"Proverbios 7-9","book_usfm":"PRO","chapter":7,"chapter_end":9}]'::jsonb),
  (197, '[{"label":"Proverbios 10-12","book_usfm":"PRO","chapter":10,"chapter_end":12}]'::jsonb),
  (198, '[{"label":"Proverbios 13-15","book_usfm":"PRO","chapter":13,"chapter_end":15}]'::jsonb),
  (199, '[{"label":"Proverbios 16-18","book_usfm":"PRO","chapter":16,"chapter_end":18}]'::jsonb),
  (200, '[{"label":"Proverbios 19-21","book_usfm":"PRO","chapter":19,"chapter_end":21}]'::jsonb),
  (201, '[{"label":"Proverbios 22-23","book_usfm":"PRO","chapter":22,"chapter_end":23}]'::jsonb),
  (202, '[{"label":"Proverbios 24-26","book_usfm":"PRO","chapter":24,"chapter_end":26}]'::jsonb),
  (203, '[{"label":"Proverbios 27-29","book_usfm":"PRO","chapter":27,"chapter_end":29}]'::jsonb),
  (204, '[{"label":"Proverbios 30-31","book_usfm":"PRO","chapter":30,"chapter_end":31}]'::jsonb),
  (205, '[{"label":"Eclesiastés 1-4","book_usfm":"ECC","chapter":1,"chapter_end":4}]'::jsonb),
  (206, '[{"label":"Eclesiastés 5-8","book_usfm":"ECC","chapter":5,"chapter_end":8}]'::jsonb),
  (207, '[{"label":"Eclesiastés 9-12","book_usfm":"ECC","chapter":9,"chapter_end":12}]'::jsonb),
  (208, '[{"label":"Cantares 1-8","book_usfm":"SNG","chapter":1,"chapter_end":8}]'::jsonb),
  (209, '[{"label":"Isaías 1-4","book_usfm":"ISA","chapter":1,"chapter_end":4}]'::jsonb),
  (210, '[{"label":"Isaías 5-8","book_usfm":"ISA","chapter":5,"chapter_end":8}]'::jsonb),
  (211, '[{"label":"Isaías 9-12","book_usfm":"ISA","chapter":9,"chapter_end":12}]'::jsonb),
  (212, '[{"label":"Isaías 13-17","book_usfm":"ISA","chapter":13,"chapter_end":17}]'::jsonb),
  (213, '[{"label":"Isaías 18-22","book_usfm":"ISA","chapter":18,"chapter_end":22}]'::jsonb),
  (214, '[{"label":"Isaías 23-27","book_usfm":"ISA","chapter":23,"chapter_end":27}]'::jsonb),
  (215, '[{"label":"Isaías 28-30","book_usfm":"ISA","chapter":28,"chapter_end":30}]'::jsonb),
  (216, '[{"label":"Isaías 31-35","book_usfm":"ISA","chapter":31,"chapter_end":35}]'::jsonb),
  (217, '[{"label":"Isaías 36-41","book_usfm":"ISA","chapter":36,"chapter_end":41}]'::jsonb),
  (218, '[{"label":"Isaías 42-44","book_usfm":"ISA","chapter":42,"chapter_end":44}]'::jsonb),
  (219, '[{"label":"Isaías 45-48","book_usfm":"ISA","chapter":45,"chapter_end":48}]'::jsonb),
  (220, '[{"label":"Isaías 49-53","book_usfm":"ISA","chapter":49,"chapter_end":53}]'::jsonb),
  (221, '[{"label":"Isaías 54-58","book_usfm":"ISA","chapter":54,"chapter_end":58}]'::jsonb),
  (222, '[{"label":"Isaías 59-63","book_usfm":"ISA","chapter":59,"chapter_end":63}]'::jsonb),
  (223, '[{"label":"Isaías 64-66","book_usfm":"ISA","chapter":64,"chapter_end":66}]'::jsonb),
  (224, '[{"label":"Jeremías 1-3","book_usfm":"JER","chapter":1,"chapter_end":3}]'::jsonb),
  (225, '[{"label":"Jeremías 4-6","book_usfm":"JER","chapter":4,"chapter_end":6}]'::jsonb),
  (226, '[{"label":"Jeremías 7-9","book_usfm":"JER","chapter":7,"chapter_end":9}]'::jsonb),
  (227, '[{"label":"Jeremías 10-13","book_usfm":"JER","chapter":10,"chapter_end":13}]'::jsonb),
  (228, '[{"label":"Jeremías 14-17","book_usfm":"JER","chapter":14,"chapter_end":17}]'::jsonb),
  (229, '[{"label":"Jeremías 18-22","book_usfm":"JER","chapter":18,"chapter_end":22}]'::jsonb),
  (230, '[{"label":"Jeremías 23-25","book_usfm":"JER","chapter":23,"chapter_end":25}]'::jsonb),
  (231, '[{"label":"Jeremías 26-29","book_usfm":"JER","chapter":26,"chapter_end":29}]'::jsonb),
  (232, '[{"label":"Jeremías 30-31","book_usfm":"JER","chapter":30,"chapter_end":31}]'::jsonb),
  (233, '[{"label":"Jeremías 32-34","book_usfm":"JER","chapter":32,"chapter_end":34}]'::jsonb),
  (234, '[{"label":"Jeremías 35-37","book_usfm":"JER","chapter":35,"chapter_end":37}]'::jsonb),
  (235, '[{"label":"Jeremías 38-41","book_usfm":"JER","chapter":38,"chapter_end":41}]'::jsonb),
  (236, '[{"label":"Jeremías 42-45","book_usfm":"JER","chapter":42,"chapter_end":45}]'::jsonb),
  (237, '[{"label":"Jeremías 46-48","book_usfm":"JER","chapter":46,"chapter_end":48}]'::jsonb),
  (238, '[{"label":"Jeremías 49-50","book_usfm":"JER","chapter":49,"chapter_end":50}]'::jsonb),
  (239, '[{"label":"Jeremías 51-52","book_usfm":"JER","chapter":51,"chapter_end":52}]'::jsonb),
  (240, '[{"label":"Lamentaciones 1:1-3:36","book_usfm":"LAM","chapter":1,"chapter_end":3}]'::jsonb),
  (241, '[{"label":"Lamentaciones 3:37-5:22","book_usfm":"LAM","chapter":3,"chapter_end":5}]'::jsonb),
  (242, '[{"label":"Ezequiel 1-4","book_usfm":"EZK","chapter":1,"chapter_end":4}]'::jsonb),
  (243, '[{"label":"Ezequiel 5-8","book_usfm":"EZK","chapter":5,"chapter_end":8}]'::jsonb),
  (244, '[{"label":"Ezequiel 9-12","book_usfm":"EZK","chapter":9,"chapter_end":12}]'::jsonb),
  (245, '[{"label":"Ezequiel 13-15","book_usfm":"EZK","chapter":13,"chapter_end":15}]'::jsonb),
  (246, '[{"label":"Ezequiel 16-17","book_usfm":"EZK","chapter":16,"chapter_end":17}]'::jsonb),
  (247, '[{"label":"Ezequiel 18-20","book_usfm":"EZK","chapter":18,"chapter_end":20}]'::jsonb),
  (248, '[{"label":"Ezequiel 21-22","book_usfm":"EZK","chapter":21,"chapter_end":22}]'::jsonb),
  (249, '[{"label":"Ezequiel 23-24","book_usfm":"EZK","chapter":23,"chapter_end":24}]'::jsonb),
  (250, '[{"label":"Ezequiel 25-27","book_usfm":"EZK","chapter":25,"chapter_end":27}]'::jsonb),
  (251, '[{"label":"Ezequiel 28-30","book_usfm":"EZK","chapter":28,"chapter_end":30}]'::jsonb),
  (252, '[{"label":"Ezequiel 31-33","book_usfm":"EZK","chapter":31,"chapter_end":33}]'::jsonb),
  (253, '[{"label":"Ezequiel 34-36","book_usfm":"EZK","chapter":34,"chapter_end":36}]'::jsonb),
  (254, '[{"label":"Ezequiel 37-39","book_usfm":"EZK","chapter":37,"chapter_end":39}]'::jsonb),
  (255, '[{"label":"Ezequiel 40-42","book_usfm":"EZK","chapter":40,"chapter_end":42}]'::jsonb),
  (256, '[{"label":"Ezequiel 43-45","book_usfm":"EZK","chapter":43,"chapter_end":45}]'::jsonb),
  (257, '[{"label":"Ezequiel 46-48","book_usfm":"EZK","chapter":46,"chapter_end":48}]'::jsonb),
  (258, '[{"label":"Daniel 1-3","book_usfm":"DAN","chapter":1,"chapter_end":3}]'::jsonb),
  (259, '[{"label":"Daniel 4-6","book_usfm":"DAN","chapter":4,"chapter_end":6}]'::jsonb),
  (260, '[{"label":"Daniel 7-9","book_usfm":"DAN","chapter":7,"chapter_end":9}]'::jsonb),
  (261, '[{"label":"Daniel 10-12","book_usfm":"DAN","chapter":10,"chapter_end":12}]'::jsonb),
  (262, '[{"label":"Oseas 1-7","book_usfm":"HOS","chapter":1,"chapter_end":7}]'::jsonb),
  (263, '[{"label":"Oseas 8-14","book_usfm":"HOS","chapter":8,"chapter_end":14}]'::jsonb),
  (264, '[{"label":"Joel 1-3","book_usfm":"JOL","chapter":1,"chapter_end":3}]'::jsonb),
  (265, '[{"label":"Amós 1-5","book_usfm":"AMO","chapter":1,"chapter_end":5}]'::jsonb),
  (266, '[{"label":"Amós 6-9","book_usfm":"AMO","chapter":6,"chapter_end":9}]'::jsonb),
  (267, '[{"label":"Abdías","book_usfm":"OBA","chapter":1},{"label":"Jonás 1-4","book_usfm":"JON","chapter":1,"chapter_end":4}]'::jsonb),
  (268, '[{"label":"Miqueas 1-7","book_usfm":"MIC","chapter":1,"chapter_end":7}]'::jsonb),
  (269, '[{"label":"Nahúm 1-3","book_usfm":"NAM","chapter":1,"chapter_end":3}]'::jsonb),
  (270, '[{"label":"Habacuc 1-3","book_usfm":"HAB","chapter":1,"chapter_end":3},{"label":"Sofonías 1-3","book_usfm":"ZEP","chapter":1,"chapter_end":3}]'::jsonb),
  (271, '[{"label":"Hageo 1-2","book_usfm":"HAG","chapter":1,"chapter_end":2}]'::jsonb),
  (272, '[{"label":"Zacarías 1-7","book_usfm":"ZEC","chapter":1,"chapter_end":7}]'::jsonb),
  (273, '[{"label":"Zacarías 8-14","book_usfm":"ZEC","chapter":8,"chapter_end":14}]'::jsonb),
  (274, '[{"label":"Malaquías 1-4","book_usfm":"MAL","chapter":1,"chapter_end":4}]'::jsonb),
  (275, '[{"label":"Mateo 1-4","book_usfm":"MAT","chapter":1,"chapter_end":4}]'::jsonb),
  (276, '[{"label":"Mateo 5-6","book_usfm":"MAT","chapter":5,"chapter_end":6}]'::jsonb),
  (277, '[{"label":"Mateo 7-8","book_usfm":"MAT","chapter":7,"chapter_end":8}]'::jsonb),
  (278, '[{"label":"Mateo 9-10","book_usfm":"MAT","chapter":9,"chapter_end":10}]'::jsonb),
  (279, '[{"label":"Mateo 11-12","book_usfm":"MAT","chapter":11,"chapter_end":12}]'::jsonb),
  (280, '[{"label":"Mateo 13-14","book_usfm":"MAT","chapter":13,"chapter_end":14}]'::jsonb),
  (281, '[{"label":"Mateo 15-17","book_usfm":"MAT","chapter":15,"chapter_end":17}]'::jsonb),
  (282, '[{"label":"Mateo 18-19","book_usfm":"MAT","chapter":18,"chapter_end":19}]'::jsonb),
  (283, '[{"label":"Mateo 20-21","book_usfm":"MAT","chapter":20,"chapter_end":21}]'::jsonb),
  (284, '[{"label":"Mateo 22-23","book_usfm":"MAT","chapter":22,"chapter_end":23}]'::jsonb),
  (285, '[{"label":"Mateo 24-25","book_usfm":"MAT","chapter":24,"chapter_end":25}]'::jsonb),
  (286, '[{"label":"Mateo 26","book_usfm":"MAT","chapter":26}]'::jsonb),
  (287, '[{"label":"Mateo 27-28","book_usfm":"MAT","chapter":27,"chapter_end":28}]'::jsonb),
  (288, '[{"label":"Marcos 1-3","book_usfm":"MRK","chapter":1,"chapter_end":3}]'::jsonb),
  (289, '[{"label":"Marcos 4-5","book_usfm":"MRK","chapter":4,"chapter_end":5}]'::jsonb),
  (290, '[{"label":"Marcos 6-7","book_usfm":"MRK","chapter":6,"chapter_end":7}]'::jsonb),
  (291, '[{"label":"Marcos 8-9","book_usfm":"MRK","chapter":8,"chapter_end":9}]'::jsonb),
  (292, '[{"label":"Marcos 10-11","book_usfm":"MRK","chapter":10,"chapter_end":11}]'::jsonb),
  (293, '[{"label":"Marcos 12-13","book_usfm":"MRK","chapter":12,"chapter_end":13}]'::jsonb),
  (294, '[{"label":"Marcos 14","book_usfm":"MRK","chapter":14}]'::jsonb),
  (295, '[{"label":"Marcos 15-16","book_usfm":"MRK","chapter":15,"chapter_end":16}]'::jsonb),
  (296, '[{"label":"Lucas 1","book_usfm":"LUK","chapter":1}]'::jsonb),
  (297, '[{"label":"Lucas 2-3","book_usfm":"LUK","chapter":2,"chapter_end":3}]'::jsonb),
  (298, '[{"label":"Lucas 4-5","book_usfm":"LUK","chapter":4,"chapter_end":5}]'::jsonb),
  (299, '[{"label":"Lucas 6-7","book_usfm":"LUK","chapter":6,"chapter_end":7}]'::jsonb),
  (300, '[{"label":"Lucas 8-9","book_usfm":"LUK","chapter":8,"chapter_end":9}]'::jsonb),
  (301, '[{"label":"Lucas 10-11","book_usfm":"LUK","chapter":10,"chapter_end":11}]'::jsonb),
  (302, '[{"label":"Lucas 12-13","book_usfm":"LUK","chapter":12,"chapter_end":13}]'::jsonb),
  (303, '[{"label":"Lucas 14-16","book_usfm":"LUK","chapter":14,"chapter_end":16}]'::jsonb),
  (304, '[{"label":"Lucas 17-18","book_usfm":"LUK","chapter":17,"chapter_end":18}]'::jsonb),
  (305, '[{"label":"Lucas 19-20","book_usfm":"LUK","chapter":19,"chapter_end":20}]'::jsonb),
  (306, '[{"label":"Lucas 21-22","book_usfm":"LUK","chapter":21,"chapter_end":22}]'::jsonb),
  (307, '[{"label":"Lucas 23-24","book_usfm":"LUK","chapter":23,"chapter_end":24}]'::jsonb),
  (308, '[{"label":"Juan 1-2","book_usfm":"JHN","chapter":1,"chapter_end":2}]'::jsonb),
  (309, '[{"label":"Juan 3-4","book_usfm":"JHN","chapter":3,"chapter_end":4}]'::jsonb),
  (310, '[{"label":"Juan 5-6","book_usfm":"JHN","chapter":5,"chapter_end":6}]'::jsonb),
  (311, '[{"label":"Juan 7-8","book_usfm":"JHN","chapter":7,"chapter_end":8}]'::jsonb),
  (312, '[{"label":"Juan 9-10","book_usfm":"JHN","chapter":9,"chapter_end":10}]'::jsonb),
  (313, '[{"label":"Juan 11-12","book_usfm":"JHN","chapter":11,"chapter_end":12}]'::jsonb),
  (314, '[{"label":"Juan 13-15","book_usfm":"JHN","chapter":13,"chapter_end":15}]'::jsonb),
  (315, '[{"label":"Juan 16-18","book_usfm":"JHN","chapter":16,"chapter_end":18}]'::jsonb),
  (316, '[{"label":"Juan 19-21","book_usfm":"JHN","chapter":19,"chapter_end":21}]'::jsonb),
  (317, '[{"label":"Hechos 1-3","book_usfm":"ACT","chapter":1,"chapter_end":3}]'::jsonb),
  (318, '[{"label":"Hechos 4-6","book_usfm":"ACT","chapter":4,"chapter_end":6}]'::jsonb),
  (319, '[{"label":"Hechos 7-8","book_usfm":"ACT","chapter":7,"chapter_end":8}]'::jsonb),
  (320, '[{"label":"Hechos 9-10","book_usfm":"ACT","chapter":9,"chapter_end":10}]'::jsonb),
  (321, '[{"label":"Hechos 11-13","book_usfm":"ACT","chapter":11,"chapter_end":13}]'::jsonb),
  (322, '[{"label":"Hechos 14-15","book_usfm":"ACT","chapter":14,"chapter_end":15}]'::jsonb),
  (323, '[{"label":"Hechos 16-17","book_usfm":"ACT","chapter":16,"chapter_end":17}]'::jsonb),
  (324, '[{"label":"Hechos 18-20","book_usfm":"ACT","chapter":18,"chapter_end":20}]'::jsonb),
  (325, '[{"label":"Hechos 21-23","book_usfm":"ACT","chapter":21,"chapter_end":23}]'::jsonb),
  (326, '[{"label":"Hechos 24-26","book_usfm":"ACT","chapter":24,"chapter_end":26}]'::jsonb),
  (327, '[{"label":"Hechos 27-28","book_usfm":"ACT","chapter":27,"chapter_end":28}]'::jsonb),
  (328, '[{"label":"Romanos 1-3","book_usfm":"ROM","chapter":1,"chapter_end":3}]'::jsonb),
  (329, '[{"label":"Romanos 4-7","book_usfm":"ROM","chapter":4,"chapter_end":7}]'::jsonb),
  (330, '[{"label":"Romanos 8-10","book_usfm":"ROM","chapter":8,"chapter_end":10}]'::jsonb),
  (331, '[{"label":"Romanos 11-13","book_usfm":"ROM","chapter":11,"chapter_end":13}]'::jsonb),
  (332, '[{"label":"Romanos 14-16","book_usfm":"ROM","chapter":14,"chapter_end":16}]'::jsonb),
  (333, '[{"label":"1 Corintios 1-4","book_usfm":"1CO","chapter":1,"chapter_end":4}]'::jsonb),
  (334, '[{"label":"1 Corintios 5-8","book_usfm":"1CO","chapter":5,"chapter_end":8}]'::jsonb),
  (335, '[{"label":"1 Corintios 9-11","book_usfm":"1CO","chapter":9,"chapter_end":11}]'::jsonb),
  (336, '[{"label":"1 Corintios 12-14","book_usfm":"1CO","chapter":12,"chapter_end":14}]'::jsonb),
  (337, '[{"label":"1 Corintios 15-16","book_usfm":"1CO","chapter":15,"chapter_end":16}]'::jsonb),
  (338, '[{"label":"2 Corintios 1-4","book_usfm":"2CO","chapter":1,"chapter_end":4}]'::jsonb),
  (339, '[{"label":"2 Corintios 5-9","book_usfm":"2CO","chapter":5,"chapter_end":9}]'::jsonb),
  (340, '[{"label":"2 Corintios 10-13","book_usfm":"2CO","chapter":10,"chapter_end":13}]'::jsonb),
  (341, '[{"label":"Gálatas 1-3","book_usfm":"GAL","chapter":1,"chapter_end":3}]'::jsonb),
  (342, '[{"label":"Gálatas 4-6","book_usfm":"GAL","chapter":4,"chapter_end":6}]'::jsonb),
  (343, '[{"label":"Efesios 1-3","book_usfm":"EPH","chapter":1,"chapter_end":3}]'::jsonb),
  (344, '[{"label":"Efesios 4-6","book_usfm":"EPH","chapter":4,"chapter_end":6}]'::jsonb),
  (345, '[{"label":"Filipenses 1-4","book_usfm":"PHP","chapter":1,"chapter_end":4}]'::jsonb),
  (346, '[{"label":"Colosenses 1-4","book_usfm":"COL","chapter":1,"chapter_end":4}]'::jsonb),
  (347, '[{"label":"1 Tesalonicenses 1-5","book_usfm":"1TH","chapter":1,"chapter_end":5}]'::jsonb),
  (348, '[{"label":"2 Tesalonicenses 1-3","book_usfm":"2TH","chapter":1,"chapter_end":3}]'::jsonb),
  (349, '[{"label":"1 Timoteo 1-6","book_usfm":"1TI","chapter":1,"chapter_end":6}]'::jsonb),
  (350, '[{"label":"2 Timoteo 1-4","book_usfm":"2TI","chapter":1,"chapter_end":4}]'::jsonb),
  (351, '[{"label":"Tito 1-3","book_usfm":"TIT","chapter":1,"chapter_end":3},{"label":"Filemón","book_usfm":"PHM","chapter":1}]'::jsonb),
  (352, '[{"label":"Hebreos 1-6","book_usfm":"HEB","chapter":1,"chapter_end":6}]'::jsonb),
  (353, '[{"label":"Hebreos 7-10","book_usfm":"HEB","chapter":7,"chapter_end":10}]'::jsonb),
  (354, '[{"label":"Hebreos 11-13","book_usfm":"HEB","chapter":11,"chapter_end":13}]'::jsonb),
  (355, '[{"label":"Santiago 1-5","book_usfm":"JAS","chapter":1,"chapter_end":5}]'::jsonb),
  (356, '[{"label":"1 Pedro 1-5","book_usfm":"1PE","chapter":1,"chapter_end":5}]'::jsonb),
  (357, '[{"label":"2 Pedro 1-3","book_usfm":"2PE","chapter":1,"chapter_end":3}]'::jsonb),
  (358, '[{"label":"1 Juan 1-5","book_usfm":"1JN","chapter":1,"chapter_end":5}]'::jsonb),
  (359, '[{"label":"2 Juan","book_usfm":"2JN","chapter":1},{"label":"3 Juan","book_usfm":"3JN","chapter":1},{"label":"Judas","book_usfm":"JUD","chapter":1}]'::jsonb),
  (360, '[{"label":"Apocalipsis 1-3","book_usfm":"REV","chapter":1,"chapter_end":3}]'::jsonb),
  (361, '[{"label":"Apocalipsis 4-8","book_usfm":"REV","chapter":4,"chapter_end":8}]'::jsonb),
  (362, '[{"label":"Apocalipsis 9-12","book_usfm":"REV","chapter":9,"chapter_end":12}]'::jsonb),
  (363, '[{"label":"Apocalipsis 13-16","book_usfm":"REV","chapter":13,"chapter_end":16}]'::jsonb),
  (364, '[{"label":"Apocalipsis 17-19","book_usfm":"REV","chapter":17,"chapter_end":19}]'::jsonb),
  (365, '[{"label":"Apocalipsis 20-22","book_usfm":"REV","chapter":20,"chapter_end":22}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'beginning';

-- ---- Plan: Nuevo Testamento en 24 semanas (168 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('nt-24-week', 'Nuevo Testamento en 24 semanas', 'El Nuevo Testamento completo en seis meses, a buen ritmo.', 168, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'nt-24-week');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Mateo 1-2","book_usfm":"MAT","chapter":1,"chapter_end":2}]'::jsonb),
  (2, '[{"label":"Mateo 3-4","book_usfm":"MAT","chapter":3,"chapter_end":4}]'::jsonb),
  (3, '[{"label":"Mateo 5-7","book_usfm":"MAT","chapter":5,"chapter_end":7}]'::jsonb),
  (4, '[{"label":"Mateo 8","book_usfm":"MAT","chapter":8}]'::jsonb),
  (5, '[{"label":"Mateo 9","book_usfm":"MAT","chapter":9}]'::jsonb),
  (6, '[{"label":"Mateo 10","book_usfm":"MAT","chapter":10}]'::jsonb),
  (7, '[{"label":"Mateo 11","book_usfm":"MAT","chapter":11}]'::jsonb),
  (8, '[{"label":"Mateo 12","book_usfm":"MAT","chapter":12}]'::jsonb),
  (9, '[{"label":"Mateo 13","book_usfm":"MAT","chapter":13}]'::jsonb),
  (10, '[{"label":"Mateo 14-15","book_usfm":"MAT","chapter":14,"chapter_end":15}]'::jsonb),
  (11, '[{"label":"Mateo 16-17","book_usfm":"MAT","chapter":16,"chapter_end":17}]'::jsonb),
  (12, '[{"label":"Mateo 18-19","book_usfm":"MAT","chapter":18,"chapter_end":19}]'::jsonb),
  (13, '[{"label":"Mateo 20","book_usfm":"MAT","chapter":20}]'::jsonb),
  (14, '[{"label":"Mateo 21","book_usfm":"MAT","chapter":21}]'::jsonb),
  (15, '[{"label":"Mateo 22","book_usfm":"MAT","chapter":22}]'::jsonb),
  (16, '[{"label":"Mateo 23","book_usfm":"MAT","chapter":23}]'::jsonb),
  (17, '[{"label":"Mateo 24","book_usfm":"MAT","chapter":24}]'::jsonb),
  (18, '[{"label":"Mateo 25","book_usfm":"MAT","chapter":25}]'::jsonb),
  (19, '[{"label":"Mateo 26","book_usfm":"MAT","chapter":26}]'::jsonb),
  (20, '[{"label":"Mateo 27","book_usfm":"MAT","chapter":27}]'::jsonb),
  (21, '[{"label":"Mateo 28","book_usfm":"MAT","chapter":28}]'::jsonb),
  (22, '[{"label":"Hebreos 1-2","book_usfm":"HEB","chapter":1,"chapter_end":2}]'::jsonb),
  (23, '[{"label":"Hebreos 3-5","book_usfm":"HEB","chapter":3,"chapter_end":5}]'::jsonb),
  (24, '[{"label":"Hebreos 6-7","book_usfm":"HEB","chapter":6,"chapter_end":7}]'::jsonb),
  (25, '[{"label":"Hebreos 8-9","book_usfm":"HEB","chapter":8,"chapter_end":9}]'::jsonb),
  (26, '[{"label":"Hebreos 10-11","book_usfm":"HEB","chapter":10,"chapter_end":11}]'::jsonb),
  (27, '[{"label":"Hebreos 12-13","book_usfm":"HEB","chapter":12,"chapter_end":13}]'::jsonb),
  (28, '[{"label":"Romanos 1","book_usfm":"ROM","chapter":1}]'::jsonb),
  (29, '[{"label":"Romanos 2-3","book_usfm":"ROM","chapter":2,"chapter_end":3}]'::jsonb),
  (30, '[{"label":"Romanos 4-5","book_usfm":"ROM","chapter":4,"chapter_end":5}]'::jsonb),
  (31, '[{"label":"Romanos 6-7","book_usfm":"ROM","chapter":6,"chapter_end":7}]'::jsonb),
  (32, '[{"label":"Romanos 8","book_usfm":"ROM","chapter":8}]'::jsonb),
  (33, '[{"label":"Romanos 9-10","book_usfm":"ROM","chapter":9,"chapter_end":10}]'::jsonb),
  (34, '[{"label":"Romanos 11-12","book_usfm":"ROM","chapter":11,"chapter_end":12}]'::jsonb),
  (35, '[{"label":"Romanos 13-14","book_usfm":"ROM","chapter":13,"chapter_end":14}]'::jsonb),
  (36, '[{"label":"Romanos 15-16","book_usfm":"ROM","chapter":15,"chapter_end":16}]'::jsonb),
  (37, '[{"label":"Marcos 1","book_usfm":"MRK","chapter":1}]'::jsonb),
  (38, '[{"label":"Marcos 2","book_usfm":"MRK","chapter":2}]'::jsonb),
  (39, '[{"label":"Marcos 3","book_usfm":"MRK","chapter":3}]'::jsonb),
  (40, '[{"label":"Marcos 4","book_usfm":"MRK","chapter":4}]'::jsonb),
  (41, '[{"label":"Marcos 5","book_usfm":"MRK","chapter":5}]'::jsonb),
  (42, '[{"label":"Marcos 6","book_usfm":"MRK","chapter":6}]'::jsonb),
  (43, '[{"label":"Marcos 7","book_usfm":"MRK","chapter":7}]'::jsonb),
  (44, '[{"label":"Marcos 8","book_usfm":"MRK","chapter":8}]'::jsonb),
  (45, '[{"label":"Marcos 9","book_usfm":"MRK","chapter":9}]'::jsonb),
  (46, '[{"label":"Marcos 10","book_usfm":"MRK","chapter":10}]'::jsonb),
  (47, '[{"label":"Marcos 11","book_usfm":"MRK","chapter":11}]'::jsonb),
  (48, '[{"label":"Marcos 12","book_usfm":"MRK","chapter":12}]'::jsonb),
  (49, '[{"label":"Marcos 13","book_usfm":"MRK","chapter":13}]'::jsonb),
  (50, '[{"label":"Marcos 14","book_usfm":"MRK","chapter":14}]'::jsonb),
  (51, '[{"label":"Marcos 15-16","book_usfm":"MRK","chapter":15,"chapter_end":16}]'::jsonb),
  (52, '[{"label":"1 Corintios 1","book_usfm":"1CO","chapter":1}]'::jsonb),
  (53, '[{"label":"1 Corintios 2-3","book_usfm":"1CO","chapter":2,"chapter_end":3}]'::jsonb),
  (54, '[{"label":"1 Corintios 4-6","book_usfm":"1CO","chapter":4,"chapter_end":6}]'::jsonb),
  (55, '[{"label":"1 Corintios 7-8","book_usfm":"1CO","chapter":7,"chapter_end":8}]'::jsonb),
  (56, '[{"label":"1 Corintios 9-10","book_usfm":"1CO","chapter":9,"chapter_end":10}]'::jsonb),
  (57, '[{"label":"1 Corintios 11-12","book_usfm":"1CO","chapter":11,"chapter_end":12}]'::jsonb),
  (58, '[{"label":"1 Corintios 13-14","book_usfm":"1CO","chapter":13,"chapter_end":14}]'::jsonb),
  (59, '[{"label":"1 Corintios 15","book_usfm":"1CO","chapter":15}]'::jsonb),
  (60, '[{"label":"1 Corintios 16","book_usfm":"1CO","chapter":16}]'::jsonb),
  (61, '[{"label":"2 Corintios 1-2","book_usfm":"2CO","chapter":1,"chapter_end":2}]'::jsonb),
  (62, '[{"label":"2 Corintios 3-4","book_usfm":"2CO","chapter":3,"chapter_end":4}]'::jsonb),
  (63, '[{"label":"2 Corintios 5-6","book_usfm":"2CO","chapter":5,"chapter_end":6}]'::jsonb),
  (64, '[{"label":"2 Corintios 7-9","book_usfm":"2CO","chapter":7,"chapter_end":9}]'::jsonb),
  (65, '[{"label":"2 Corintios 10-11","book_usfm":"2CO","chapter":10,"chapter_end":11}]'::jsonb),
  (66, '[{"label":"2 Corintios 12-13","book_usfm":"2CO","chapter":12,"chapter_end":13}]'::jsonb),
  (67, '[{"label":"1 Pedro 1:1-3:7","book_usfm":"1PE","chapter":1,"chapter_end":3}]'::jsonb),
  (68, '[{"label":"1 Pedro 3:8-5:14","book_usfm":"1PE","chapter":3,"chapter_end":5}]'::jsonb),
  (69, '[{"label":"2 Pedro 1-3","book_usfm":"2PE","chapter":1,"chapter_end":3}]'::jsonb),
  (70, '[{"label":"Lucas 1","book_usfm":"LUK","chapter":1}]'::jsonb),
  (71, '[{"label":"Lucas 2","book_usfm":"LUK","chapter":2}]'::jsonb),
  (72, '[{"label":"Lucas 3","book_usfm":"LUK","chapter":3}]'::jsonb),
  (73, '[{"label":"Lucas 4","book_usfm":"LUK","chapter":4}]'::jsonb),
  (74, '[{"label":"Lucas 5","book_usfm":"LUK","chapter":5}]'::jsonb),
  (75, '[{"label":"Lucas 6","book_usfm":"LUK","chapter":6}]'::jsonb),
  (76, '[{"label":"Lucas 7","book_usfm":"LUK","chapter":7}]'::jsonb),
  (77, '[{"label":"Lucas 8","book_usfm":"LUK","chapter":8}]'::jsonb),
  (78, '[{"label":"Lucas 9","book_usfm":"LUK","chapter":9}]'::jsonb),
  (79, '[{"label":"Lucas 10","book_usfm":"LUK","chapter":10}]'::jsonb),
  (80, '[{"label":"Lucas 11","book_usfm":"LUK","chapter":11}]'::jsonb),
  (81, '[{"label":"Lucas 12","book_usfm":"LUK","chapter":12}]'::jsonb),
  (82, '[{"label":"Lucas 13","book_usfm":"LUK","chapter":13}]'::jsonb),
  (83, '[{"label":"Lucas 14","book_usfm":"LUK","chapter":14}]'::jsonb),
  (84, '[{"label":"Lucas 15-16","book_usfm":"LUK","chapter":15,"chapter_end":16}]'::jsonb),
  (85, '[{"label":"Lucas 17","book_usfm":"LUK","chapter":17}]'::jsonb),
  (86, '[{"label":"Lucas 18","book_usfm":"LUK","chapter":18}]'::jsonb),
  (87, '[{"label":"Lucas 19","book_usfm":"LUK","chapter":19}]'::jsonb),
  (88, '[{"label":"Lucas 20","book_usfm":"LUK","chapter":20}]'::jsonb),
  (89, '[{"label":"Lucas 21","book_usfm":"LUK","chapter":21}]'::jsonb),
  (90, '[{"label":"Lucas 22","book_usfm":"LUK","chapter":22}]'::jsonb),
  (91, '[{"label":"Lucas 23","book_usfm":"LUK","chapter":23}]'::jsonb),
  (92, '[{"label":"Lucas 24","book_usfm":"LUK","chapter":24}]'::jsonb),
  (93, '[{"label":"Gálatas 1-2","book_usfm":"GAL","chapter":1,"chapter_end":2}]'::jsonb),
  (94, '[{"label":"Gálatas 3-4","book_usfm":"GAL","chapter":3,"chapter_end":4}]'::jsonb),
  (95, '[{"label":"Gálatas 5-6","book_usfm":"GAL","chapter":5,"chapter_end":6}]'::jsonb),
  (96, '[{"label":"Efesios 1-2","book_usfm":"EPH","chapter":1,"chapter_end":2}]'::jsonb),
  (97, '[{"label":"Efesios 3-4","book_usfm":"EPH","chapter":3,"chapter_end":4}]'::jsonb),
  (98, '[{"label":"Efesios 5-6","book_usfm":"EPH","chapter":5,"chapter_end":6}]'::jsonb),
  (99, '[{"label":"Santiago 1","book_usfm":"JAS","chapter":1}]'::jsonb),
  (100, '[{"label":"Santiago 2-3","book_usfm":"JAS","chapter":2,"chapter_end":3}]'::jsonb),
  (101, '[{"label":"Santiago 4-5","book_usfm":"JAS","chapter":4,"chapter_end":5}]'::jsonb),
  (102, '[{"label":"Hechos 1-2","book_usfm":"ACT","chapter":1,"chapter_end":2}]'::jsonb),
  (103, '[{"label":"Hechos 3-4","book_usfm":"ACT","chapter":3,"chapter_end":4}]'::jsonb),
  (104, '[{"label":"Hechos 5-6","book_usfm":"ACT","chapter":5,"chapter_end":6}]'::jsonb),
  (105, '[{"label":"Hechos 7","book_usfm":"ACT","chapter":7}]'::jsonb),
  (106, '[{"label":"Hechos 8","book_usfm":"ACT","chapter":8}]'::jsonb),
  (107, '[{"label":"Hechos 9","book_usfm":"ACT","chapter":9}]'::jsonb),
  (108, '[{"label":"Hechos 10","book_usfm":"ACT","chapter":10}]'::jsonb),
  (109, '[{"label":"Hechos 11-12","book_usfm":"ACT","chapter":11,"chapter_end":12}]'::jsonb),
  (110, '[{"label":"Hechos 13","book_usfm":"ACT","chapter":13}]'::jsonb),
  (111, '[{"label":"Hechos 14-15","book_usfm":"ACT","chapter":14,"chapter_end":15}]'::jsonb),
  (112, '[{"label":"Hechos 16","book_usfm":"ACT","chapter":16}]'::jsonb),
  (113, '[{"label":"Hechos 17-18","book_usfm":"ACT","chapter":17,"chapter_end":18}]'::jsonb),
  (114, '[{"label":"Hechos 19","book_usfm":"ACT","chapter":19}]'::jsonb),
  (115, '[{"label":"Hechos 20","book_usfm":"ACT","chapter":20}]'::jsonb),
  (116, '[{"label":"Hechos 21","book_usfm":"ACT","chapter":21}]'::jsonb),
  (117, '[{"label":"Hechos 22-23","book_usfm":"ACT","chapter":22,"chapter_end":23}]'::jsonb),
  (118, '[{"label":"Hechos 24-25","book_usfm":"ACT","chapter":24,"chapter_end":25}]'::jsonb),
  (119, '[{"label":"Hechos 26","book_usfm":"ACT","chapter":26}]'::jsonb),
  (120, '[{"label":"Hechos 27","book_usfm":"ACT","chapter":27}]'::jsonb),
  (121, '[{"label":"Hechos 28","book_usfm":"ACT","chapter":28}]'::jsonb),
  (122, '[{"label":"Filipenses 1-2","book_usfm":"PHP","chapter":1,"chapter_end":2}]'::jsonb),
  (123, '[{"label":"Filipenses 3-4","book_usfm":"PHP","chapter":3,"chapter_end":4}]'::jsonb),
  (124, '[{"label":"Colosenses 1-2","book_usfm":"COL","chapter":1,"chapter_end":2}]'::jsonb),
  (125, '[{"label":"Colosenses 3-4","book_usfm":"COL","chapter":3,"chapter_end":4}]'::jsonb),
  (126, '[{"label":"Tito 1-3","book_usfm":"TIT","chapter":1,"chapter_end":3}]'::jsonb),
  (127, '[{"label":"Filemón","book_usfm":"PHM","chapter":1}]'::jsonb),
  (128, '[{"label":"Judas","book_usfm":"JUD","chapter":1}]'::jsonb),
  (129, '[{"label":"Juan 1","book_usfm":"JHN","chapter":1}]'::jsonb),
  (130, '[{"label":"Juan 2-3","book_usfm":"JHN","chapter":2,"chapter_end":3}]'::jsonb),
  (131, '[{"label":"Juan 4","book_usfm":"JHN","chapter":4}]'::jsonb),
  (132, '[{"label":"Juan 5","book_usfm":"JHN","chapter":5}]'::jsonb),
  (133, '[{"label":"Juan 6","book_usfm":"JHN","chapter":6}]'::jsonb),
  (134, '[{"label":"Juan 7","book_usfm":"JHN","chapter":7}]'::jsonb),
  (135, '[{"label":"Juan 8","book_usfm":"JHN","chapter":8}]'::jsonb),
  (136, '[{"label":"Juan 9","book_usfm":"JHN","chapter":9}]'::jsonb),
  (137, '[{"label":"Juan 10","book_usfm":"JHN","chapter":10}]'::jsonb),
  (138, '[{"label":"Juan 11","book_usfm":"JHN","chapter":11}]'::jsonb),
  (139, '[{"label":"Juan 12","book_usfm":"JHN","chapter":12}]'::jsonb),
  (140, '[{"label":"Juan 13","book_usfm":"JHN","chapter":13}]'::jsonb),
  (141, '[{"label":"Juan 14-15","book_usfm":"JHN","chapter":14,"chapter_end":15}]'::jsonb),
  (142, '[{"label":"Juan 16-17","book_usfm":"JHN","chapter":16,"chapter_end":17}]'::jsonb),
  (143, '[{"label":"Juan 18","book_usfm":"JHN","chapter":18}]'::jsonb),
  (144, '[{"label":"Juan 19","book_usfm":"JHN","chapter":19}]'::jsonb),
  (145, '[{"label":"Juan 20-21","book_usfm":"JHN","chapter":20,"chapter_end":21}]'::jsonb),
  (146, '[{"label":"1 Tesalonicenses 1-3","book_usfm":"1TH","chapter":1,"chapter_end":3}]'::jsonb),
  (147, '[{"label":"1 Tesalonicenses 4-5","book_usfm":"1TH","chapter":4,"chapter_end":5}]'::jsonb),
  (148, '[{"label":"2 Tesalonicenses 1-3","book_usfm":"2TH","chapter":1,"chapter_end":3}]'::jsonb),
  (149, '[{"label":"1 Timoteo 1-2","book_usfm":"1TI","chapter":1,"chapter_end":2}]'::jsonb),
  (150, '[{"label":"1 Timoteo 3-4","book_usfm":"1TI","chapter":3,"chapter_end":4}]'::jsonb),
  (151, '[{"label":"1 Timoteo 5-6","book_usfm":"1TI","chapter":5,"chapter_end":6}]'::jsonb),
  (152, '[{"label":"2 Timoteo 1-2","book_usfm":"2TI","chapter":1,"chapter_end":2}]'::jsonb),
  (153, '[{"label":"2 Timoteo 3-4","book_usfm":"2TI","chapter":3,"chapter_end":4}]'::jsonb),
  (154, '[{"label":"1 Juan 1-2","book_usfm":"1JN","chapter":1,"chapter_end":2}]'::jsonb),
  (155, '[{"label":"1 Juan 3","book_usfm":"1JN","chapter":3}]'::jsonb),
  (156, '[{"label":"1 Juan 4-5","book_usfm":"1JN","chapter":4,"chapter_end":5}]'::jsonb),
  (157, '[{"label":"2 Juan","book_usfm":"2JN","chapter":1}]'::jsonb),
  (158, '[{"label":"3 Juan","book_usfm":"3JN","chapter":1}]'::jsonb),
  (159, '[{"label":"Apocalipsis 1-2","book_usfm":"REV","chapter":1,"chapter_end":2}]'::jsonb),
  (160, '[{"label":"Apocalipsis 3-4","book_usfm":"REV","chapter":3,"chapter_end":4}]'::jsonb),
  (161, '[{"label":"Apocalipsis 5-6","book_usfm":"REV","chapter":5,"chapter_end":6}]'::jsonb),
  (162, '[{"label":"Apocalipsis 7-8","book_usfm":"REV","chapter":7,"chapter_end":8}]'::jsonb),
  (163, '[{"label":"Apocalipsis 9-11","book_usfm":"REV","chapter":9,"chapter_end":11}]'::jsonb),
  (164, '[{"label":"Apocalipsis 12-13","book_usfm":"REV","chapter":12,"chapter_end":13}]'::jsonb),
  (165, '[{"label":"Apocalipsis 14-16","book_usfm":"REV","chapter":14,"chapter_end":16}]'::jsonb),
  (166, '[{"label":"Apocalipsis 17-18","book_usfm":"REV","chapter":17,"chapter_end":18}]'::jsonb),
  (167, '[{"label":"Apocalipsis 19-20","book_usfm":"REV","chapter":19,"chapter_end":20}]'::jsonb),
  (168, '[{"label":"Apocalipsis 21-22","book_usfm":"REV","chapter":21,"chapter_end":22}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'nt-24-week';

-- ---- Plan: 40 días con Dios (40 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('40-dias-con-dios', '40 días con Dios', 'Cuarenta días de lecturas breves para crecer en la fe.', 40, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = '40-dias-con-dios');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Romanos 12:1-2","book_usfm":"ROM","chapter":12}]'::jsonb),
  (2, '[{"label":"Santiago 1:1-12","book_usfm":"JAS","chapter":1}]'::jsonb),
  (3, '[{"label":"Santiago 1:13-18","book_usfm":"JAS","chapter":1}]'::jsonb),
  (4, '[{"label":"Santiago 1:19-27","book_usfm":"JAS","chapter":1}]'::jsonb),
  (5, '[{"label":"Santiago 2:14-20","book_usfm":"JAS","chapter":2}]'::jsonb),
  (6, '[{"label":"Santiago 3:13-18","book_usfm":"JAS","chapter":3}]'::jsonb),
  (7, '[{"label":"Santiago 4:6-12","book_usfm":"JAS","chapter":4}]'::jsonb),
  (8, '[{"label":"Lucas 18:10-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (9, '[{"label":"1 Corintios 12:12-27","book_usfm":"1CO","chapter":12}]'::jsonb),
  (10, '[{"label":"Efesios 1:15-19","book_usfm":"EPH","chapter":1}]'::jsonb),
  (11, '[{"label":"Efesios 2:4-10","book_usfm":"EPH","chapter":2}]'::jsonb),
  (12, '[{"label":"Efesios 5:1-5","book_usfm":"EPH","chapter":5}]'::jsonb),
  (13, '[{"label":"Efesios 5:6-20","book_usfm":"EPH","chapter":5}]'::jsonb),
  (14, '[{"label":"Lucas 15:11-32","book_usfm":"LUK","chapter":15}]'::jsonb),
  (15, '[{"label":"Apocalipsis 3:2-5","book_usfm":"REV","chapter":3}]'::jsonb),
  (16, '[{"label":"Filipenses 3:12-16","book_usfm":"PHP","chapter":3}]'::jsonb),
  (17, '[{"label":"Filipenses 4:4-9","book_usfm":"PHP","chapter":4}]'::jsonb),
  (18, '[{"label":"Apocalipsis 3:8-11","book_usfm":"REV","chapter":3}]'::jsonb),
  (19, '[{"label":"Colosenses 2:16-23","book_usfm":"COL","chapter":2}]'::jsonb),
  (20, '[{"label":"Colosenses 3:1-11","book_usfm":"COL","chapter":3}]'::jsonb),
  (21, '[{"label":"Colosenses 3:12-17","book_usfm":"COL","chapter":3}]'::jsonb),
  (22, '[{"label":"Lucas 11:29-36","book_usfm":"LUK","chapter":11}]'::jsonb),
  (23, '[{"label":"2 Pedro 1:5-11","book_usfm":"2PE","chapter":1}]'::jsonb),
  (24, '[{"label":"Hechos 13:42-52","book_usfm":"ACT","chapter":13}]'::jsonb),
  (25, '[{"label":"Juan 8:1-19","book_usfm":"JHN","chapter":8}]'::jsonb),
  (26, '[{"label":"1 Juan 2:1-6","book_usfm":"1JN","chapter":2}]'::jsonb),
  (27, '[{"label":"1 Juan 2:7-11","book_usfm":"1JN","chapter":2}]'::jsonb),
  (28, '[{"label":"1 Juan 2:15-17","book_usfm":"1JN","chapter":2}]'::jsonb),
  (29, '[{"label":"1 Juan 3:1-3","book_usfm":"1JN","chapter":3}]'::jsonb),
  (30, '[{"label":"1 Juan 3:17-24","book_usfm":"1JN","chapter":3}]'::jsonb),
  (31, '[{"label":"1 Juan 4:7-21","book_usfm":"1JN","chapter":4}]'::jsonb),
  (32, '[{"label":"1 Juan 5:1-6","book_usfm":"1JN","chapter":5}]'::jsonb),
  (33, '[{"label":"Mateo 14:25-33","book_usfm":"MAT","chapter":14}]'::jsonb),
  (34, '[{"label":"Mateo 5:21-24","book_usfm":"MAT","chapter":5}]'::jsonb),
  (35, '[{"label":"Mateo 5:27-30","book_usfm":"MAT","chapter":5}]'::jsonb),
  (36, '[{"label":"Mateo 5:33-37","book_usfm":"MAT","chapter":5}]'::jsonb),
  (37, '[{"label":"Mateo 5:38-42","book_usfm":"MAT","chapter":5}]'::jsonb),
  (38, '[{"label":"Mateo 6:19-34","book_usfm":"MAT","chapter":6}]'::jsonb),
  (39, '[{"label":"Lucas 14:25-35","book_usfm":"LUK","chapter":14}]'::jsonb),
  (40, '[{"label":"Apocalipsis 21:1-4","book_usfm":"REV","chapter":21}]'::jsonb)
) as d(day_number, refs)
where p.slug = '40-dias-con-dios';

-- ---- Plan: Oficio Diario (Libro de Oración Común) (861 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('bcp-daily-office', 'Oficio Diario (Libro de Oración Común)', 'Leccionario litúrgico de dos años: salmos y lecturas para cada día.', 861, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'bcp-daily-office');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Isaías 62:1-5","book_usfm":"ISA","chapter":62},{"label":"Isaías 62:10-12","book_usfm":"ISA","chapter":62},{"label":"Apocalipsis 19:11-16","book_usfm":"REV","chapter":19},{"label":"Mateo 1:18-25","book_usfm":"MAT","chapter":1}]'::jsonb),
  (2, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"1 Reyes 19:1-8","book_usfm":"1KI","chapter":19},{"label":"Efesios 4:1-16","book_usfm":"EPH","chapter":4},{"label":"Juan 6:1-14","book_usfm":"JHN","chapter":6}]'::jsonb),
  (3, '[{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"1 Reyes 19:9-18","book_usfm":"1KI","chapter":19},{"label":"Efesios 4:17-32","book_usfm":"EPH","chapter":4},{"label":"Juan 6:15-27","book_usfm":"JHN","chapter":6}]'::jsonb),
  (4, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Colosenses 3:12-17","book_usfm":"COL","chapter":3},{"label":"Juan 6:41-47","book_usfm":"JHN","chapter":6}]'::jsonb),
  (5, '[{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Isaías 66:18-23","book_usfm":"ISA","chapter":66},{"label":"Romanos 15:7-13","book_usfm":"ROM","chapter":15}]'::jsonb),
  (6, '[{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Isaías 49:1-7","book_usfm":"ISA","chapter":49},{"label":"Apocalipsis 21:22-27","book_usfm":"REV","chapter":21},{"label":"Mateo 12:14-21","book_usfm":"MAT","chapter":12}]'::jsonb),
  (7, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Deuteronomio 8:1-3","book_usfm":"DEU","chapter":8},{"label":"Colosenses 1:1-14","book_usfm":"COL","chapter":1},{"label":"Juan 6:30-33","book_usfm":"JHN","chapter":6},{"label":"Juan 6:48-51","book_usfm":"JHN","chapter":6}]'::jsonb),
  (8, '[{"label":"Salmos 117-118","book_usfm":"PSA","chapter":117,"chapter_end":118},{"label":"Salmos 112-113","book_usfm":"PSA","chapter":112,"chapter_end":113},{"label":"Éxodo 17:1-7","book_usfm":"EXO","chapter":17},{"label":"Colosenses 1:15-23","book_usfm":"COL","chapter":1},{"label":"Juan 7:37-52","book_usfm":"JHN","chapter":7}]'::jsonb),
  (9, '[{"label":"Salmos 121-123","book_usfm":"PSA","chapter":121,"chapter_end":123},{"label":"Salmos 131-132","book_usfm":"PSA","chapter":131,"chapter_end":132},{"label":"Isaías 45:14-19","book_usfm":"ISA","chapter":45},{"label":"Colosenses 1:24-2:7","book_usfm":"COL","chapter":1,"chapter_end":2},{"label":"Juan 8:12-19","book_usfm":"JHN","chapter":8}]'::jsonb),
  (10, '[{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Isaías 61:1-9","book_usfm":"ISA","chapter":61},{"label":"Gálatas 3:23-29","book_usfm":"GAL","chapter":3},{"label":"Gálatas 4:4-7","book_usfm":"GAL","chapter":4}]'::jsonb),
  (11, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Génesis 1:1-2:3","book_usfm":"GEN","chapter":1,"chapter_end":2},{"label":"Efesios 1:3-14","book_usfm":"EPH","chapter":1},{"label":"Juan 1:29-34","book_usfm":"JHN","chapter":1}]'::jsonb),
  (12, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Génesis 2:4-25","book_usfm":"GEN","chapter":2},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1}]'::jsonb),
  (13, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Génesis 3","book_usfm":"GEN","chapter":3},{"label":"Hebreos 2:1-10","book_usfm":"HEB","chapter":2},{"label":"Juan 1:19-28","book_usfm":"JHN","chapter":1}]'::jsonb),
  (14, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Génesis 4:1-16","book_usfm":"GEN","chapter":4},{"label":"Hebreos 2:11-18","book_usfm":"HEB","chapter":2},{"label":"Juan 1:29-42","book_usfm":"JHN","chapter":1}]'::jsonb),
  (15, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Génesis 4:17-26","book_usfm":"GEN","chapter":4},{"label":"Hebreos 3:1-11","book_usfm":"HEB","chapter":3},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (16, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Génesis 6:1-8","book_usfm":"GEN","chapter":6},{"label":"Hebreos 3:12-19","book_usfm":"HEB","chapter":3},{"label":"Juan 2:1-12","book_usfm":"JHN","chapter":2}]'::jsonb),
  (17, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Génesis 6:9-22","book_usfm":"GEN","chapter":6},{"label":"Hebreos 4:1-13","book_usfm":"HEB","chapter":4},{"label":"Juan 2:13-22","book_usfm":"JHN","chapter":2}]'::jsonb),
  (18, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Ezequiel 3:4-11","book_usfm":"EZK","chapter":3},{"label":"Hechos 10:34-44","book_usfm":"ACT","chapter":10},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Juan 21:15-22","book_usfm":"JHN","chapter":21}]'::jsonb),
  (19, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Génesis 8:6-22","book_usfm":"GEN","chapter":8},{"label":"Hebreos 4:14-5:6","book_usfm":"HEB","chapter":4,"chapter_end":5},{"label":"Juan 2:23-3:15","book_usfm":"JHN","chapter":2,"chapter_end":3}]'::jsonb),
  (20, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Génesis 9:1-17","book_usfm":"GEN","chapter":9},{"label":"Hebreos 5:7-14","book_usfm":"HEB","chapter":5},{"label":"Juan 3:16-21","book_usfm":"JHN","chapter":3}]'::jsonb),
  (21, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Génesis 9:18-29","book_usfm":"GEN","chapter":9},{"label":"Hebreos 6:1-12","book_usfm":"HEB","chapter":6},{"label":"Juan 3:22-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (22, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Génesis 11:1-9","book_usfm":"GEN","chapter":11},{"label":"Hebreos 6:13-20","book_usfm":"HEB","chapter":6},{"label":"Juan 4:1-15","book_usfm":"JHN","chapter":4}]'::jsonb),
  (23, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Génesis 11:27-12:8","book_usfm":"GEN","chapter":11,"chapter_end":12},{"label":"Hebreos 7:1-17","book_usfm":"HEB","chapter":7},{"label":"Juan 4:16-26","book_usfm":"JHN","chapter":4}]'::jsonb),
  (24, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Génesis 12:9-13:1","book_usfm":"GEN","chapter":12,"chapter_end":13},{"label":"Hebreos 7:18-28","book_usfm":"HEB","chapter":7},{"label":"Juan 4:27-42","book_usfm":"JHN","chapter":4}]'::jsonb),
  (25, '[{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Isaías 45:18-25","book_usfm":"ISA","chapter":45},{"label":"Filipenses 3:4-11","book_usfm":"PHP","chapter":3},{"label":"Salmos 119:89-112","book_usfm":"PSA","chapter":119},{"label":"Hechos 9:1-22","book_usfm":"ACT","chapter":9}]'::jsonb),
  (26, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Génesis 14","book_usfm":"GEN","chapter":14},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8},{"label":"Juan 4:43-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (27, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Génesis 15:1-11","book_usfm":"GEN","chapter":15},{"label":"Génesis 15:17-21","book_usfm":"GEN","chapter":15},{"label":"Hebreos 9:1-14","book_usfm":"HEB","chapter":9},{"label":"Juan 5:1-18","book_usfm":"JHN","chapter":5}]'::jsonb),
  (28, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Génesis 16:1-14","book_usfm":"GEN","chapter":16},{"label":"Hebreos 9:15-28","book_usfm":"HEB","chapter":9},{"label":"Juan 5:19-29","book_usfm":"JHN","chapter":5}]'::jsonb),
  (29, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Génesis 16:15-17:14","book_usfm":"GEN","chapter":16,"chapter_end":17},{"label":"Hebreos 10:1-10","book_usfm":"HEB","chapter":10},{"label":"Juan 5:30-47","book_usfm":"JHN","chapter":5}]'::jsonb),
  (30, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Génesis 17:15-27","book_usfm":"GEN","chapter":17},{"label":"Hebreos 10:11-25","book_usfm":"HEB","chapter":10},{"label":"Juan 6:1-15","book_usfm":"JHN","chapter":6}]'::jsonb),
  (31, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Génesis 18:1-16","book_usfm":"GEN","chapter":18},{"label":"Hebreos 10:26-39","book_usfm":"HEB","chapter":10},{"label":"Juan 6:16-27","book_usfm":"JHN","chapter":6}]'::jsonb),
  (32, '[{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 122","book_usfm":"PSA","chapter":122},{"label":"1 Samuel 1:20-28","book_usfm":"1SA","chapter":1},{"label":"Romanos 8:14-21","book_usfm":"ROM","chapter":8}]'::jsonb),
  (33, '[{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"1 Samuel 2:1-10","book_usfm":"1SA","chapter":2},{"label":"Juan 8:31-36","book_usfm":"JHN","chapter":8},{"label":"Salmos 48","book_usfm":"PSA","chapter":48},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"1 Juan 3:1-8","book_usfm":"1JN","chapter":3}]'::jsonb),
  (34, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Génesis 21:1-21","book_usfm":"GEN","chapter":21},{"label":"Hebreos 11:13-22","book_usfm":"HEB","chapter":11},{"label":"Juan 6:41-51","book_usfm":"JHN","chapter":6}]'::jsonb),
  (35, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Génesis 22:1-18","book_usfm":"GEN","chapter":22},{"label":"Hebreos 11:23-31","book_usfm":"HEB","chapter":11},{"label":"Juan 6:52-59","book_usfm":"JHN","chapter":6}]'::jsonb),
  (36, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Génesis 23","book_usfm":"GEN","chapter":23},{"label":"Hebreos 11:32-12:2","book_usfm":"HEB","chapter":11,"chapter_end":12},{"label":"Juan 6:60-71","book_usfm":"JHN","chapter":6}]'::jsonb),
  (37, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Génesis 24:1-27","book_usfm":"GEN","chapter":24},{"label":"Hebreos 12:3-11","book_usfm":"HEB","chapter":12},{"label":"Juan 7:1-13","book_usfm":"JHN","chapter":7}]'::jsonb),
  (38, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Génesis 24:28-38","book_usfm":"GEN","chapter":24},{"label":"Génesis 24:49-51","book_usfm":"GEN","chapter":24},{"label":"Hebreos 12:12-29","book_usfm":"HEB","chapter":12},{"label":"Juan 7:14-36","book_usfm":"JHN","chapter":7}]'::jsonb),
  (39, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Génesis 24:50-67","book_usfm":"GEN","chapter":24},{"label":"2 Timoteo 2:14-21","book_usfm":"2TI","chapter":2},{"label":"Marcos 10:13-22","book_usfm":"MRK","chapter":10}]'::jsonb),
  (40, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Génesis 25:19-34","book_usfm":"GEN","chapter":25},{"label":"Hebreos 13:1-16","book_usfm":"HEB","chapter":13},{"label":"Juan 7:37-52","book_usfm":"JHN","chapter":7}]'::jsonb),
  (41, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Génesis 26:1-6","book_usfm":"GEN","chapter":26},{"label":"Génesis 26:12-33","book_usfm":"GEN","chapter":26},{"label":"Hebreos 13:17-25","book_usfm":"HEB","chapter":13},{"label":"Juan 7:53-8:11","book_usfm":"JHN","chapter":7,"chapter_end":8}]'::jsonb),
  (42, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Génesis 27:1-29","book_usfm":"GEN","chapter":27},{"label":"Romanos 12:1-8","book_usfm":"ROM","chapter":12},{"label":"Juan 8:12-20","book_usfm":"JHN","chapter":8}]'::jsonb),
  (43, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Génesis 27:30-45","book_usfm":"GEN","chapter":27},{"label":"Romanos 12:9-21","book_usfm":"ROM","chapter":12},{"label":"Juan 8:21-32","book_usfm":"JHN","chapter":8}]'::jsonb),
  (44, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Génesis 27:46-28:4","book_usfm":"GEN","chapter":27,"chapter_end":28},{"label":"Génesis 28:10-22","book_usfm":"GEN","chapter":28},{"label":"Romanos 13","book_usfm":"ROM","chapter":13},{"label":"Juan 8:33-47","book_usfm":"JHN","chapter":8}]'::jsonb),
  (45, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Génesis 29:1-20","book_usfm":"GEN","chapter":29},{"label":"Romanos 14","book_usfm":"ROM","chapter":14},{"label":"Juan 8:47-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (46, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"2 Corintios 3:7-18","book_usfm":"2CO","chapter":3},{"label":"Lucas 9:18-27","book_usfm":"LUK","chapter":9}]'::jsonb),
  (47, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Proverbios 27:1-6","book_usfm":"PRO","chapter":27},{"label":"Proverbios 27:10-12","book_usfm":"PRO","chapter":27},{"label":"Filipenses 2:1-13","book_usfm":"PHP","chapter":2},{"label":"Juan 18:15-18","book_usfm":"JHN","chapter":18},{"label":"Juan 18:25-27","book_usfm":"JHN","chapter":18}]'::jsonb),
  (48, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Proverbios 30:1-4","book_usfm":"PRO","chapter":30},{"label":"Proverbios 30:24-33","book_usfm":"PRO","chapter":30},{"label":"Filipenses 3:1-11","book_usfm":"PHP","chapter":3},{"label":"Juan 18:28-38","book_usfm":"JHN","chapter":18}]'::jsonb),
  (49, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 130","book_usfm":"PSA","chapter":130},{"label":"Amós 5:6-15","book_usfm":"AMO","chapter":5},{"label":"Hebreos 12:1-14","book_usfm":"HEB","chapter":12},{"label":"Lucas 18:9-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (50, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Habacuc 3:1-18","book_usfm":"HAB","chapter":3},{"label":"Filipenses 3:12-21","book_usfm":"PHP","chapter":3},{"label":"Juan 17:1-8","book_usfm":"JHN","chapter":17}]'::jsonb),
  (51, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Ezequiel 18:1-4","book_usfm":"EZK","chapter":18},{"label":"Ezequiel 18:25-32","book_usfm":"EZK","chapter":18},{"label":"Filipenses 4:1-9","book_usfm":"PHP","chapter":4},{"label":"Juan 17:9-19","book_usfm":"JHN","chapter":17}]'::jsonb),
  (52, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Ezequiel 39:21-29","book_usfm":"EZK","chapter":39},{"label":"Filipenses 4:10-20","book_usfm":"PHP","chapter":4},{"label":"Juan 17:20-26","book_usfm":"JHN","chapter":17}]'::jsonb),
  (53, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Daniel 9:3-10","book_usfm":"DAN","chapter":9},{"label":"Hebreos 2:10-18","book_usfm":"HEB","chapter":2},{"label":"Juan 12:44-50","book_usfm":"JHN","chapter":12}]'::jsonb),
  (54, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Génesis 37:1-11","book_usfm":"GEN","chapter":37},{"label":"1 Corintios 1:1-19","book_usfm":"1CO","chapter":1},{"label":"Marcos 1:1-13","book_usfm":"MRK","chapter":1}]'::jsonb),
  (55, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"1 Samuel 16:1-13","book_usfm":"1SA","chapter":16},{"label":"1 Juan 2:18-25","book_usfm":"1JN","chapter":2},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Hechos 20:17-35","book_usfm":"ACT","chapter":20}]'::jsonb),
  (56, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Génesis 37:25-36","book_usfm":"GEN","chapter":37},{"label":"1 Corintios 2:1-13","book_usfm":"1CO","chapter":2},{"label":"Marcos 1:29-45","book_usfm":"MRK","chapter":1}]'::jsonb),
  (57, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Génesis 39","book_usfm":"GEN","chapter":39},{"label":"1 Corintios 2:14-3:15","book_usfm":"1CO","chapter":2,"chapter_end":3},{"label":"Marcos 2:1-12","book_usfm":"MRK","chapter":2}]'::jsonb),
  (58, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Génesis 40","book_usfm":"GEN","chapter":40},{"label":"1 Corintios 3:16-23","book_usfm":"1CO","chapter":3},{"label":"Marcos 2:13-22","book_usfm":"MRK","chapter":2}]'::jsonb),
  (59, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Génesis 41:1-13","book_usfm":"GEN","chapter":41},{"label":"1 Corintios 4:1-7","book_usfm":"1CO","chapter":4},{"label":"Marcos 2:23-3:6","book_usfm":"MRK","chapter":2,"chapter_end":3}]'::jsonb),
  (60, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Génesis 41:14-45","book_usfm":"GEN","chapter":41},{"label":"Romanos 6:3-14","book_usfm":"ROM","chapter":6},{"label":"Juan 5:19-24","book_usfm":"JHN","chapter":5}]'::jsonb),
  (61, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Génesis 41:46-57","book_usfm":"GEN","chapter":41},{"label":"1 Corintios 4:8-21","book_usfm":"1CO","chapter":4},{"label":"Marcos 3:7-19","book_usfm":"MRK","chapter":3}]'::jsonb),
  (62, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Génesis 42:1-17","book_usfm":"GEN","chapter":42},{"label":"1 Corintios 5:1-8","book_usfm":"1CO","chapter":5},{"label":"Marcos 3:19-35","book_usfm":"MRK","chapter":3}]'::jsonb),
  (63, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Génesis 42:18-28","book_usfm":"GEN","chapter":42},{"label":"1 Corintios 5:9-6:8","book_usfm":"1CO","chapter":5,"chapter_end":6},{"label":"Marcos 4:1-20","book_usfm":"MRK","chapter":4}]'::jsonb),
  (64, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Génesis 42:29-38","book_usfm":"GEN","chapter":42},{"label":"1 Corintios 6:12-20","book_usfm":"1CO","chapter":6},{"label":"Marcos 4:21-34","book_usfm":"MRK","chapter":4}]'::jsonb),
  (65, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Génesis 43:1-15","book_usfm":"GEN","chapter":43},{"label":"1 Corintios 7:1-9","book_usfm":"1CO","chapter":7},{"label":"Marcos 4:35-41","book_usfm":"MRK","chapter":4}]'::jsonb),
  (66, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Génesis 43:16-34","book_usfm":"GEN","chapter":43},{"label":"1 Corintios 7:10-24","book_usfm":"1CO","chapter":7},{"label":"Marcos 5:1-20","book_usfm":"MRK","chapter":5}]'::jsonb),
  (67, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Génesis 44:1-17","book_usfm":"GEN","chapter":44},{"label":"Romanos 8:1-10","book_usfm":"ROM","chapter":8},{"label":"Juan 5:25-29","book_usfm":"JHN","chapter":5}]'::jsonb),
  (68, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Génesis 44:18-34","book_usfm":"GEN","chapter":44},{"label":"1 Corintios 7:25-31","book_usfm":"1CO","chapter":7},{"label":"Marcos 5:21-43","book_usfm":"MRK","chapter":5}]'::jsonb),
  (69, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Génesis 45:1-15","book_usfm":"GEN","chapter":45},{"label":"1 Corintios 7:32-40","book_usfm":"1CO","chapter":7},{"label":"Marcos 6:1-13","book_usfm":"MRK","chapter":6}]'::jsonb),
  (70, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Génesis 45:16-28","book_usfm":"GEN","chapter":45},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8},{"label":"Marcos 6:13-29","book_usfm":"MRK","chapter":6}]'::jsonb),
  (71, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Génesis 46:1-7","book_usfm":"GEN","chapter":46},{"label":"Génesis 46:28-34","book_usfm":"GEN","chapter":46},{"label":"1 Corintios 9:1-15","book_usfm":"1CO","chapter":9},{"label":"Marcos 6:30-46","book_usfm":"MRK","chapter":6}]'::jsonb),
  (72, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Génesis 47:1-26","book_usfm":"GEN","chapter":47},{"label":"1 Corintios 9:16-27","book_usfm":"1CO","chapter":9},{"label":"Marcos 6:47-56","book_usfm":"MRK","chapter":6}]'::jsonb),
  (73, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Génesis 47:27-48:7","book_usfm":"GEN","chapter":47,"chapter_end":48},{"label":"1 Corintios 10:1-13","book_usfm":"1CO","chapter":10},{"label":"Marcos 7:1-23","book_usfm":"MRK","chapter":7}]'::jsonb),
  (74, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Génesis 48:8-22","book_usfm":"GEN","chapter":48},{"label":"Romanos 8:11-25","book_usfm":"ROM","chapter":8},{"label":"Juan 6:27-40","book_usfm":"JHN","chapter":6}]'::jsonb),
  (75, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Génesis 49:1-28","book_usfm":"GEN","chapter":49},{"label":"1 Corintios 10:14-11:1","book_usfm":"1CO","chapter":10,"chapter_end":11},{"label":"Marcos 7:24-37","book_usfm":"MRK","chapter":7}]'::jsonb),
  (76, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Génesis 49:29-50:14","book_usfm":"GEN","chapter":49,"chapter_end":50},{"label":"1 Corintios 11:17-34","book_usfm":"1CO","chapter":11},{"label":"Marcos 8:1-10","book_usfm":"MRK","chapter":8}]'::jsonb),
  (77, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Génesis 50:15-26","book_usfm":"GEN","chapter":50},{"label":"1 Corintios 12:1-11","book_usfm":"1CO","chapter":12},{"label":"Marcos 8:11-26","book_usfm":"MRK","chapter":8}]'::jsonb),
  (78, '[{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Isaías 63:7-16","book_usfm":"ISA","chapter":63},{"label":"Mateo 1:18-25","book_usfm":"MAT","chapter":1},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3}]'::jsonb),
  (79, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Éxodo 2:1-22","book_usfm":"EXO","chapter":2},{"label":"1 Corintios 12:27-13:3","book_usfm":"1CO","chapter":12,"chapter_end":13},{"label":"Marcos 9:2-13","book_usfm":"MRK","chapter":9}]'::jsonb),
  (80, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Éxodo 2:23-3:15","book_usfm":"EXO","chapter":2,"chapter_end":3},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13},{"label":"Marcos 9:14-29","book_usfm":"MRK","chapter":9}]'::jsonb),
  (81, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Éxodo 3:16-4:12","book_usfm":"EXO","chapter":3,"chapter_end":4},{"label":"Romanos 12","book_usfm":"ROM","chapter":12},{"label":"Juan 8:46-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (82, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Éxodo 4:10-31","book_usfm":"EXO","chapter":4},{"label":"1 Corintios 14:1-19","book_usfm":"1CO","chapter":14},{"label":"Marcos 9:30-41","book_usfm":"MRK","chapter":9}]'::jsonb),
  (83, '[{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Génesis 3:1-15","book_usfm":"GEN","chapter":3},{"label":"Romanos 5:12-21","book_usfm":"ROM","chapter":5}]'::jsonb),
  (84, '[{"label":"Salmos 82","book_usfm":"PSA","chapter":82},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Isaías 52:7-12","book_usfm":"ISA","chapter":52},{"label":"Hebreos 2:5-10","book_usfm":"HEB","chapter":2},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Juan 1:9-14","book_usfm":"JHN","chapter":1}]'::jsonb),
  (85, '[{"label":"Salmos 131-133","book_usfm":"PSA","chapter":131,"chapter_end":133},{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Éxodo 7:25-8:19","book_usfm":"EXO","chapter":7,"chapter_end":8},{"label":"2 Corintios 3:7-18","book_usfm":"2CO","chapter":3},{"label":"Marcos 10:17-31","book_usfm":"MRK","chapter":10}]'::jsonb),
  (86, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Éxodo 9:13-35","book_usfm":"EXO","chapter":9},{"label":"2 Corintios 4:1-12","book_usfm":"2CO","chapter":4},{"label":"Marcos 10:32-45","book_usfm":"MRK","chapter":10}]'::jsonb),
  (87, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Éxodo 10:21-11:8","book_usfm":"EXO","chapter":10,"chapter_end":11},{"label":"2 Corintios 4:13-18","book_usfm":"2CO","chapter":4},{"label":"Marcos 10:46-52","book_usfm":"MRK","chapter":10}]'::jsonb),
  (88, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Zacarías 9:9-12","book_usfm":"ZEC","chapter":9},{"label":"Zacarías 12:9-11","book_usfm":"ZEC","chapter":12},{"label":"Zacarías 13:1","book_usfm":"ZEC","chapter":13},{"label":"Zacarías 13:7-9","book_usfm":"ZEC","chapter":13},{"label":"1 Timoteo 6:12-16","book_usfm":"1TI","chapter":6},{"label":"Lucas 19:41-48","book_usfm":"LUK","chapter":19}]'::jsonb),
  (89, '[{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Salmos 69:1-23","book_usfm":"PSA","chapter":69},{"label":"Lamentaciones 1:1-2","book_usfm":"LAM","chapter":1},{"label":"Lamentaciones 1:6-12","book_usfm":"LAM","chapter":1},{"label":"2 Corintios 1:1-7","book_usfm":"2CO","chapter":1},{"label":"Marcos 11:12-25","book_usfm":"MRK","chapter":11}]'::jsonb),
  (90, '[{"label":"Salmos 6","book_usfm":"PSA","chapter":6},{"label":"Salmos 12","book_usfm":"PSA","chapter":12},{"label":"Salmos 94","book_usfm":"PSA","chapter":94},{"label":"Lamentaciones 1:17-22","book_usfm":"LAM","chapter":1},{"label":"2 Corintios 1:8-22","book_usfm":"2CO","chapter":1},{"label":"Marcos 11:27-33","book_usfm":"MRK","chapter":11}]'::jsonb),
  (91, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Lamentaciones 2:1-9","book_usfm":"LAM","chapter":2},{"label":"Lamentaciones 2:14-17","book_usfm":"LAM","chapter":2},{"label":"2 Corintios 1:23-2:11","book_usfm":"2CO","chapter":1,"chapter_end":2},{"label":"Marcos 12:1-11","book_usfm":"MRK","chapter":12}]'::jsonb),
  (92, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 142-143","book_usfm":"PSA","chapter":142,"chapter_end":143},{"label":"Lamentaciones 2:10-18","book_usfm":"LAM","chapter":2},{"label":"1 Corintios 10:14-17","book_usfm":"1CO","chapter":10},{"label":"1 Corintios 11:27-32","book_usfm":"1CO","chapter":11},{"label":"Marcos 14:12-25","book_usfm":"MRK","chapter":14}]'::jsonb),
  (93, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Lamentaciones 3:1-9","book_usfm":"LAM","chapter":3},{"label":"Lamentaciones 3:19-33","book_usfm":"LAM","chapter":3},{"label":"1 Pedro 1:10-20","book_usfm":"1PE","chapter":1},{"label":"Juan 13:36-38","book_usfm":"JHN","chapter":13},{"label":"Juan 19:38-42","book_usfm":"JHN","chapter":19}]'::jsonb),
  (94, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Lamentaciones 3:37-58","book_usfm":"LAM","chapter":3},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4},{"label":"Romanos 8:1-11","book_usfm":"ROM","chapter":8}]'::jsonb),
  (95, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 113-114","book_usfm":"PSA","chapter":113,"chapter_end":114},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Éxodo 12:1-14","book_usfm":"EXO","chapter":12},{"label":"Isaías 51:9-11","book_usfm":"ISA","chapter":51},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1},{"label":"Lucas 24:13-35","book_usfm":"LUK","chapter":24},{"label":"Juan 20:19-23","book_usfm":"JHN","chapter":20}]'::jsonb),
  (96, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Éxodo 12:14-27","book_usfm":"EXO","chapter":12},{"label":"1 Corintios 15:1-11","book_usfm":"1CO","chapter":15},{"label":"Marcos 16:1-8","book_usfm":"MRK","chapter":16}]'::jsonb),
  (97, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 114","book_usfm":"PSA","chapter":114},{"label":"Éxodo 12:28-39","book_usfm":"EXO","chapter":12},{"label":"1 Corintios 15:12-28","book_usfm":"1CO","chapter":15},{"label":"Marcos 16:9-20","book_usfm":"MRK","chapter":16}]'::jsonb),
  (98, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99","book_usfm":"PSA","chapter":99},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"Éxodo 12:40-51","book_usfm":"EXO","chapter":12},{"label":"1 Corintios 15:29-41","book_usfm":"1CO","chapter":15},{"label":"Mateo 28:1-16","book_usfm":"MAT","chapter":28}]'::jsonb),
  (99, '[{"label":"Salmos 146-149","book_usfm":"PSA","chapter":146,"chapter_end":149},{"label":"Éxodo 13:3-10","book_usfm":"EXO","chapter":13},{"label":"1 Corintios 15:41-50","book_usfm":"1CO","chapter":15},{"label":"Mateo 28:16-20","book_usfm":"MAT","chapter":28}]'::jsonb),
  (100, '[{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Éxodo 13:1-2","book_usfm":"EXO","chapter":13},{"label":"Éxodo 13:11-16","book_usfm":"EXO","chapter":13},{"label":"1 Corintios 15:51-58","book_usfm":"1CO","chapter":15},{"label":"Lucas 24:1-12","book_usfm":"LUK","chapter":24}]'::jsonb),
  (101, '[{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Éxodo 13:17-14:4","book_usfm":"EXO","chapter":13,"chapter_end":14},{"label":"2 Corintios 4:16-5:10","book_usfm":"2CO","chapter":4,"chapter_end":5},{"label":"Marcos 12:18-27","book_usfm":"MRK","chapter":12}]'::jsonb),
  (102, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Éxodo 14:5-22","book_usfm":"EXO","chapter":14},{"label":"1 Juan 1:1-7","book_usfm":"1JN","chapter":1},{"label":"Juan 14:1-7","book_usfm":"JHN","chapter":14}]'::jsonb),
  (103, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Éxodo 14:21-31","book_usfm":"EXO","chapter":14},{"label":"1 Pedro 1:1-12","book_usfm":"1PE","chapter":1},{"label":"Juan 14:1-17","book_usfm":"JHN","chapter":14}]'::jsonb),
  (104, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Éxodo 15:1-21","book_usfm":"EXO","chapter":15},{"label":"1 Pedro 1:13-25","book_usfm":"1PE","chapter":1},{"label":"Juan 14:18-31","book_usfm":"JHN","chapter":14}]'::jsonb),
  (105, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Éxodo 15:22-16:10","book_usfm":"EXO","chapter":15,"chapter_end":16},{"label":"1 Pedro 2:1-10","book_usfm":"1PE","chapter":2},{"label":"Juan 15:1-11","book_usfm":"JHN","chapter":15}]'::jsonb),
  (106, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Éxodo 16:10-22","book_usfm":"EXO","chapter":16},{"label":"1 Pedro 2:11-25","book_usfm":"1PE","chapter":2},{"label":"Juan 15:12-27","book_usfm":"JHN","chapter":15}]'::jsonb),
  (107, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 134-135","book_usfm":"PSA","chapter":134,"chapter_end":135},{"label":"Éxodo 16:23-36","book_usfm":"EXO","chapter":16},{"label":"1 Pedro 3:13-4:6","book_usfm":"1PE","chapter":3,"chapter_end":4},{"label":"Juan 16:1-15","book_usfm":"JHN","chapter":16}]'::jsonb),
  (108, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Éxodo 17","book_usfm":"EXO","chapter":17},{"label":"1 Pedro 4:7-19","book_usfm":"1PE","chapter":4},{"label":"Juan 16:16-33","book_usfm":"JHN","chapter":16}]'::jsonb),
  (109, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Éxodo 18:1-12","book_usfm":"EXO","chapter":18},{"label":"1 Juan 2:7-17","book_usfm":"1JN","chapter":2},{"label":"Marcos 16:9-20","book_usfm":"MRK","chapter":16}]'::jsonb),
  (110, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Éxodo 18:13-27","book_usfm":"EXO","chapter":18},{"label":"1 Pedro 5","book_usfm":"1PE","chapter":5},{"label":"Mateo 1:1-17","book_usfm":"MAT","chapter":1},{"label":"Mateo 3:1-6","book_usfm":"MAT","chapter":3}]'::jsonb),
  (111, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Éxodo 19:1-16","book_usfm":"EXO","chapter":19},{"label":"Colosenses 1:1-14","book_usfm":"COL","chapter":1},{"label":"Mateo 3:7-12","book_usfm":"MAT","chapter":3}]'::jsonb),
  (112, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Éxodo 19:16-25","book_usfm":"EXO","chapter":19},{"label":"Colosenses 1:15-23","book_usfm":"COL","chapter":1},{"label":"Mateo 3:13-17","book_usfm":"MAT","chapter":3}]'::jsonb),
  (113, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Éxodo 20:1-21","book_usfm":"EXO","chapter":20},{"label":"Colosenses 1:24-2:7","book_usfm":"COL","chapter":1,"chapter_end":2},{"label":"Mateo 4:1-11","book_usfm":"MAT","chapter":4}]'::jsonb),
  (114, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Éxodo 24","book_usfm":"EXO","chapter":24},{"label":"Colosenses 2:8-23","book_usfm":"COL","chapter":2},{"label":"Mateo 4:12-17","book_usfm":"MAT","chapter":4}]'::jsonb),
  (115, '[{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Hechos 12:25-13:3","book_usfm":"ACT","chapter":12,"chapter_end":13},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"2 Timoteo 4:1-11","book_usfm":"2TI","chapter":4}]'::jsonb),
  (116, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Éxodo 28:1-4","book_usfm":"EXO","chapter":28},{"label":"Éxodo 28:30-38","book_usfm":"EXO","chapter":28},{"label":"1 Juan 2:18-29","book_usfm":"1JN","chapter":2},{"label":"Marcos 6:30-44","book_usfm":"MRK","chapter":6}]'::jsonb),
  (117, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Éxodo 32:1-20","book_usfm":"EXO","chapter":32},{"label":"Colosenses 3:18-4","book_usfm":"COL","chapter":3},{"label":"Mateo 5:1-10","book_usfm":"MAT","chapter":5}]'::jsonb),
  (118, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Éxodo 32:21-34","book_usfm":"EXO","chapter":32},{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1},{"label":"Mateo 5:11-16","book_usfm":"MAT","chapter":5}]'::jsonb),
  (119, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Éxodo 33","book_usfm":"EXO","chapter":33},{"label":"1 Tesalonicenses 2:1-12","book_usfm":"1TH","chapter":2},{"label":"Mateo 5:17-20","book_usfm":"MAT","chapter":5}]'::jsonb),
  (120, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Éxodo 34:1-17","book_usfm":"EXO","chapter":34},{"label":"1 Tesalonicenses 2:13-20","book_usfm":"1TH","chapter":2},{"label":"Mateo 5:21-26","book_usfm":"MAT","chapter":5}]'::jsonb),
  (121, '[{"label":"Salmos 119:137-160","book_usfm":"PSA","chapter":119},{"label":"Job 23:1-12","book_usfm":"JOB","chapter":23},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1},{"label":"Salmos 139","book_usfm":"PSA","chapter":139},{"label":"Juan 12:20-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (122, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Éxodo 40:18-38","book_usfm":"EXO","chapter":40},{"label":"1 Tesalonicenses 4:1-12","book_usfm":"1TH","chapter":4},{"label":"Mateo 5:38-48","book_usfm":"MAT","chapter":5}]'::jsonb),
  (123, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Levítico 8:1-13","book_usfm":"LEV","chapter":8},{"label":"Levítico 8:30-36","book_usfm":"LEV","chapter":8},{"label":"Hebreos 12:1-14","book_usfm":"HEB","chapter":12},{"label":"Lucas 4:16-30","book_usfm":"LUK","chapter":4}]'::jsonb),
  (124, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Levítico 16:1-19","book_usfm":"LEV","chapter":16},{"label":"1 Tesalonicenses 4:13-18","book_usfm":"1TH","chapter":4},{"label":"Mateo 6:1-6","book_usfm":"MAT","chapter":6},{"label":"Mateo 6:16-18","book_usfm":"MAT","chapter":6}]'::jsonb),
  (125, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Levítico 16:20-34","book_usfm":"LEV","chapter":16},{"label":"1 Tesalonicenses 5:1-11","book_usfm":"1TH","chapter":5},{"label":"Mateo 6:7-15","book_usfm":"MAT","chapter":6}]'::jsonb),
  (126, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Levítico 19:1-18","book_usfm":"LEV","chapter":19},{"label":"1 Tesalonicenses 5:12-28","book_usfm":"1TH","chapter":5},{"label":"Mateo 6:19-24","book_usfm":"MAT","chapter":6}]'::jsonb),
  (127, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Levítico 19:26-37","book_usfm":"LEV","chapter":19},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1},{"label":"Mateo 6:25-34","book_usfm":"MAT","chapter":6}]'::jsonb),
  (128, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Levítico 23:1-22","book_usfm":"LEV","chapter":23},{"label":"2 Tesalonicenses 2","book_usfm":"2TH","chapter":2},{"label":"Mateo 7:1-12","book_usfm":"MAT","chapter":7}]'::jsonb),
  (129, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Levítico 23:23-44","book_usfm":"LEV","chapter":23},{"label":"2 Tesalonicenses 3","book_usfm":"2TH","chapter":3},{"label":"Mateo 7:13-21","book_usfm":"MAT","chapter":7}]'::jsonb),
  (130, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Levítico 25:1-17","book_usfm":"LEV","chapter":25},{"label":"Santiago 1:2-8","book_usfm":"JAS","chapter":1},{"label":"Santiago 1:16-18","book_usfm":"JAS","chapter":1},{"label":"Lucas 12:13-21","book_usfm":"LUK","chapter":12}]'::jsonb),
  (131, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Levítico 25:35-55","book_usfm":"LEV","chapter":25},{"label":"Colosenses 1:9-14","book_usfm":"COL","chapter":1},{"label":"Mateo 13:1-16","book_usfm":"MAT","chapter":13}]'::jsonb),
  (132, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Levítico 26:1-20","book_usfm":"LEV","chapter":26},{"label":"1 Timoteo 2:1-6","book_usfm":"1TI","chapter":2},{"label":"Mateo 13:18-23","book_usfm":"MAT","chapter":13}]'::jsonb),
  (133, '[{"label":"Salmos 68:1-20","book_usfm":"PSA","chapter":68},{"label":"2 Reyes 2:1-15","book_usfm":"2KI","chapter":2},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5}]'::jsonb),
  (134, '[{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 47","book_usfm":"PSA","chapter":47},{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Daniel 7:9-14","book_usfm":"DAN","chapter":7},{"label":"Hebreos 2:5-18","book_usfm":"HEB","chapter":2},{"label":"Mateo 28:16-20","book_usfm":"MAT","chapter":28}]'::jsonb),
  (135, '[{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"1 Samuel 2:1-10","book_usfm":"1SA","chapter":2},{"label":"Efesios 2:1-10","book_usfm":"EPH","chapter":2},{"label":"Mateo 7:22-27","book_usfm":"MAT","chapter":7}]'::jsonb),
  (136, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Números 11:16-17","book_usfm":"NUM","chapter":11},{"label":"Números 11:24-29","book_usfm":"NUM","chapter":11},{"label":"Efesios 2:11-22","book_usfm":"EPH","chapter":2},{"label":"Mateo 7:28-8:4","book_usfm":"MAT","chapter":7,"chapter_end":8}]'::jsonb),
  (137, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Éxodo 3:1-12","book_usfm":"EXO","chapter":3},{"label":"Hebreos 12:18-29","book_usfm":"HEB","chapter":12},{"label":"Lucas 10:17-24","book_usfm":"LUK","chapter":10}]'::jsonb),
  (138, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Josué 1:1-9","book_usfm":"JOS","chapter":1},{"label":"Efesios 3:1-13","book_usfm":"EPH","chapter":3},{"label":"Mateo 8:5-17","book_usfm":"MAT","chapter":8}]'::jsonb),
  (139, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"1 Samuel 16:1-13","book_usfm":"1SA","chapter":16},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3},{"label":"Mateo 8:18-27","book_usfm":"MAT","chapter":8}]'::jsonb),
  (140, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Isaías 4:2-6","book_usfm":"ISA","chapter":4},{"label":"Efesios 4:1-16","book_usfm":"EPH","chapter":4},{"label":"Mateo 8:28-34","book_usfm":"MAT","chapter":8}]'::jsonb),
  (141, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Zacarías 4","book_usfm":"ZEC","chapter":4},{"label":"Efesios 4:17-32","book_usfm":"EPH","chapter":4},{"label":"Mateo 9:1-8","book_usfm":"MAT","chapter":9}]'::jsonb),
  (142, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Jeremías 31:27-34","book_usfm":"JER","chapter":31},{"label":"Efesios 5:1-20","book_usfm":"EPH","chapter":5},{"label":"Mateo 9:9-17","book_usfm":"MAT","chapter":9}]'::jsonb),
  (143, '[{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Éxodo 19:3-8","book_usfm":"EXO","chapter":19},{"label":"Éxodo 19:16-20","book_usfm":"EXO","chapter":19},{"label":"1 Pedro 2:4-10","book_usfm":"1PE","chapter":2}]'::jsonb),
  (144, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Deuteronomio 16:9-12","book_usfm":"DEU","chapter":16},{"label":"Hechos 4:18-21","book_usfm":"ACT","chapter":4},{"label":"Hechos 4:23-33","book_usfm":"ACT","chapter":4},{"label":"Juan 4:19-26","book_usfm":"JHN","chapter":4}]'::jsonb),
  (145, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Proverbios 10:1-12","book_usfm":"PRO","chapter":10},{"label":"1 Timoteo 1:1-17","book_usfm":"1TI","chapter":1},{"label":"Mateo 12:22-32","book_usfm":"MAT","chapter":12}]'::jsonb),
  (146, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Proverbios 15:16-33","book_usfm":"PRO","chapter":15},{"label":"1 Timoteo 1:18-2:8","book_usfm":"1TI","chapter":1,"chapter_end":2},{"label":"Mateo 12:33-42","book_usfm":"MAT","chapter":12}]'::jsonb),
  (147, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Proverbios 17:1-20","book_usfm":"PRO","chapter":17},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3},{"label":"Mateo 12:43-50","book_usfm":"MAT","chapter":12}]'::jsonb),
  (148, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Proverbios 21:30-22:6","book_usfm":"PRO","chapter":21,"chapter_end":22},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4},{"label":"Mateo 13:24-30","book_usfm":"MAT","chapter":13}]'::jsonb),
  (149, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Proverbios 23:19-21","book_usfm":"PRO","chapter":23},{"label":"Proverbios 23:29-24:2","book_usfm":"PRO","chapter":23,"chapter_end":24},{"label":"1 Timoteo 5:17-25","book_usfm":"1TI","chapter":5},{"label":"Mateo 13:31-35","book_usfm":"MAT","chapter":13}]'::jsonb),
  (150, '[{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3}]'::jsonb),
  (151, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Job 38:1-11","book_usfm":"JOB","chapter":38},{"label":"Job 42:1-5","book_usfm":"JOB","chapter":42},{"label":"Apocalipsis 19:4-16","book_usfm":"REV","chapter":19},{"label":"Juan 1:29-34","book_usfm":"JHN","chapter":1}]'::jsonb),
  (152, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Eclesiastés 2:1-15","book_usfm":"ECC","chapter":2},{"label":"Gálatas 1:1-17","book_usfm":"GAL","chapter":1},{"label":"Mateo 13:44-52","book_usfm":"MAT","chapter":13}]'::jsonb),
  (153, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Eclesiastés 2:16-26","book_usfm":"ECC","chapter":2},{"label":"Gálatas 1:18-2:10","book_usfm":"GAL","chapter":1,"chapter_end":2},{"label":"Mateo 13:53-58","book_usfm":"MAT","chapter":13}]'::jsonb),
  (154, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Eclesiastés 3:1-15","book_usfm":"ECC","chapter":3},{"label":"Gálatas 2:11-21","book_usfm":"GAL","chapter":2},{"label":"Mateo 14:1-12","book_usfm":"MAT","chapter":14}]'::jsonb),
  (155, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Eclesiastés 3:16-4:3","book_usfm":"ECC","chapter":3,"chapter_end":4},{"label":"Gálatas 3:1-14","book_usfm":"GAL","chapter":3},{"label":"Mateo 14:13-21","book_usfm":"MAT","chapter":14}]'::jsonb),
  (156, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Eclesiastés 5:1-7","book_usfm":"ECC","chapter":5},{"label":"Gálatas 3:15-22","book_usfm":"GAL","chapter":3},{"label":"Mateo 14:22-36","book_usfm":"MAT","chapter":14}]'::jsonb),
  (157, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Eclesiastés 5:8-20","book_usfm":"ECC","chapter":5},{"label":"Gálatas 3:23-4:11","book_usfm":"GAL","chapter":3,"chapter_end":4},{"label":"Mateo 15:1-20","book_usfm":"MAT","chapter":15}]'::jsonb),
  (158, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Eclesiastés 6","book_usfm":"ECC","chapter":6},{"label":"Hechos 10:9-23","book_usfm":"ACT","chapter":10},{"label":"Lucas 12:32-40","book_usfm":"LUK","chapter":12}]'::jsonb),
  (159, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Eclesiastés 7:1-14","book_usfm":"ECC","chapter":7},{"label":"Gálatas 4:12-20","book_usfm":"GAL","chapter":4},{"label":"Mateo 15:21-28","book_usfm":"MAT","chapter":15}]'::jsonb),
  (160, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Eclesiastés 8:14-9:10","book_usfm":"ECC","chapter":8,"chapter_end":9},{"label":"Gálatas 4:21-31","book_usfm":"GAL","chapter":4},{"label":"Mateo 15:29-39","book_usfm":"MAT","chapter":15}]'::jsonb),
  (161, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Eclesiastés 9:11-18","book_usfm":"ECC","chapter":9},{"label":"Gálatas 5:1-15","book_usfm":"GAL","chapter":5},{"label":"Mateo 16:1-12","book_usfm":"MAT","chapter":16}]'::jsonb),
  (162, '[{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Hechos 4:32-37","book_usfm":"ACT","chapter":4},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 146","book_usfm":"PSA","chapter":146},{"label":"Hechos 9:26-31","book_usfm":"ACT","chapter":9}]'::jsonb),
  (163, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Eclesiastés 11:9-12:14","book_usfm":"ECC","chapter":11,"chapter_end":12},{"label":"Gálatas 5:25-6:10","book_usfm":"GAL","chapter":5,"chapter_end":6},{"label":"Mateo 16:21-28","book_usfm":"MAT","chapter":16}]'::jsonb),
  (164, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Números 3:1-13","book_usfm":"NUM","chapter":3},{"label":"Gálatas 6:11-18","book_usfm":"GAL","chapter":6},{"label":"Mateo 17:1-13","book_usfm":"MAT","chapter":17}]'::jsonb),
  (165, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Números 6:22-27","book_usfm":"NUM","chapter":6},{"label":"Hechos 13:1-12","book_usfm":"ACT","chapter":13},{"label":"Lucas 12:41-48","book_usfm":"LUK","chapter":12}]'::jsonb),
  (166, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Números 9:15-23","book_usfm":"NUM","chapter":9},{"label":"Números 10:29-36","book_usfm":"NUM","chapter":10},{"label":"Romanos 1:1-15","book_usfm":"ROM","chapter":1},{"label":"Mateo 17:14-21","book_usfm":"MAT","chapter":17}]'::jsonb),
  (167, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Números 11:1-23","book_usfm":"NUM","chapter":11},{"label":"Romanos 1:16-25","book_usfm":"ROM","chapter":1},{"label":"Mateo 17:22-27","book_usfm":"MAT","chapter":17}]'::jsonb),
  (168, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Números 11:24-35","book_usfm":"NUM","chapter":11},{"label":"Romanos 1:28-2:11","book_usfm":"ROM","chapter":1,"chapter_end":2},{"label":"Mateo 18:1-9","book_usfm":"MAT","chapter":18}]'::jsonb),
  (169, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Números 12","book_usfm":"NUM","chapter":12},{"label":"Romanos 2:12-24","book_usfm":"ROM","chapter":2},{"label":"Mateo 18:10-20","book_usfm":"MAT","chapter":18}]'::jsonb),
  (170, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Números 13:1-3","book_usfm":"NUM","chapter":13},{"label":"Números 13:21-30","book_usfm":"NUM","chapter":13},{"label":"Romanos 2:25-3:8","book_usfm":"ROM","chapter":2,"chapter_end":3},{"label":"Mateo 18:21-35","book_usfm":"MAT","chapter":18}]'::jsonb),
  (171, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Números 13:31-14:25","book_usfm":"NUM","chapter":13,"chapter_end":14},{"label":"Romanos 3:9-20","book_usfm":"ROM","chapter":3},{"label":"Mateo 19:1-12","book_usfm":"MAT","chapter":19}]'::jsonb),
  (172, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Números 14:26-45","book_usfm":"NUM","chapter":14},{"label":"Hechos 15:1-12","book_usfm":"ACT","chapter":15},{"label":"Lucas 12:49-56","book_usfm":"LUK","chapter":12}]'::jsonb),
  (173, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Números 16:1-19","book_usfm":"NUM","chapter":16},{"label":"Romanos 3:21-31","book_usfm":"ROM","chapter":3},{"label":"Mateo 19:13-22","book_usfm":"MAT","chapter":19}]'::jsonb),
  (174, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Lucas 1:5-23","book_usfm":"LUK","chapter":1}]'::jsonb),
  (175, '[{"label":"Salmos 82","book_usfm":"PSA","chapter":82},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Malaquías 3:1-5","book_usfm":"MAL","chapter":3},{"label":"Juan 3:22-30","book_usfm":"JHN","chapter":3},{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Mateo 11:2-19","book_usfm":"MAT","chapter":11}]'::jsonb),
  (176, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Números 17:1-11","book_usfm":"NUM","chapter":17},{"label":"Romanos 5:1-11","book_usfm":"ROM","chapter":5},{"label":"Mateo 20:17-28","book_usfm":"MAT","chapter":20}]'::jsonb),
  (177, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Números 20:1-13","book_usfm":"NUM","chapter":20},{"label":"Romanos 5:12-21","book_usfm":"ROM","chapter":5},{"label":"Mateo 20:29-34","book_usfm":"MAT","chapter":20}]'::jsonb),
  (178, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Números 20:14-29","book_usfm":"NUM","chapter":20},{"label":"Romanos 6:1-11","book_usfm":"ROM","chapter":6},{"label":"Mateo 21:1-11","book_usfm":"MAT","chapter":21}]'::jsonb),
  (179, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Números 21:4-9","book_usfm":"NUM","chapter":21},{"label":"Números 21:21-35","book_usfm":"NUM","chapter":21},{"label":"Hechos 17:12-34","book_usfm":"ACT","chapter":17},{"label":"Lucas 13:10-17","book_usfm":"LUK","chapter":13}]'::jsonb),
  (180, '[{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Ezequiel 2:1-7","book_usfm":"EZK","chapter":2},{"label":"Hechos 11:1-18","book_usfm":"ACT","chapter":11},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Gálatas 2:1-9","book_usfm":"GAL","chapter":2}]'::jsonb),
  (181, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Números 22:21-38","book_usfm":"NUM","chapter":22},{"label":"Romanos 7:1-12","book_usfm":"ROM","chapter":7},{"label":"Mateo 21:23-32","book_usfm":"MAT","chapter":21}]'::jsonb),
  (182, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Números 22:41-23:12","book_usfm":"NUM","chapter":22,"chapter_end":23},{"label":"Romanos 7:13-25","book_usfm":"ROM","chapter":7},{"label":"Mateo 21:33-46","book_usfm":"MAT","chapter":21}]'::jsonb),
  (183, '[{"label":"Salmos 131-135","book_usfm":"PSA","chapter":131,"chapter_end":135},{"label":"Números 23:11-26","book_usfm":"NUM","chapter":23},{"label":"Romanos 8:1-11","book_usfm":"ROM","chapter":8},{"label":"Mateo 22:1-14","book_usfm":"MAT","chapter":22}]'::jsonb),
  (184, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Números 24:1-13","book_usfm":"NUM","chapter":24},{"label":"Romanos 8:12-17","book_usfm":"ROM","chapter":8},{"label":"Mateo 22:15-22","book_usfm":"MAT","chapter":22}]'::jsonb),
  (185, '[{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Santiago 5:7-10","book_usfm":"JAS","chapter":5},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Apocalipsis 21:1-7","book_usfm":"REV","chapter":21}]'::jsonb),
  (186, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Números 27:12-23","book_usfm":"NUM","chapter":27},{"label":"Hechos 19:11-20","book_usfm":"ACT","chapter":19},{"label":"Marcos 1:14-20","book_usfm":"MRK","chapter":1}]'::jsonb),
  (187, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Números 32:1-6","book_usfm":"NUM","chapter":32},{"label":"Números 32:16-27","book_usfm":"NUM","chapter":32},{"label":"Romanos 8:26-30","book_usfm":"ROM","chapter":8},{"label":"Mateo 23:1-12","book_usfm":"MAT","chapter":23}]'::jsonb),
  (188, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Números 35:1-3","book_usfm":"NUM","chapter":35},{"label":"Números 35:9-15","book_usfm":"NUM","chapter":35},{"label":"Números 35:30-34","book_usfm":"NUM","chapter":35},{"label":"Romanos 8:31-39","book_usfm":"ROM","chapter":8},{"label":"Mateo 23:13-26","book_usfm":"MAT","chapter":23}]'::jsonb),
  (189, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Deuteronomio 1:1-18","book_usfm":"DEU","chapter":1},{"label":"Romanos 9:1-18","book_usfm":"ROM","chapter":9},{"label":"Mateo 23:27-39","book_usfm":"MAT","chapter":23}]'::jsonb),
  (190, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Deuteronomio 3:18-28","book_usfm":"DEU","chapter":3},{"label":"Romanos 9:19-33","book_usfm":"ROM","chapter":9},{"label":"Mateo 24:1-14","book_usfm":"MAT","chapter":24}]'::jsonb),
  (191, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Deuteronomio 31:7-13","book_usfm":"DEU","chapter":31},{"label":"Deuteronomio 31:24-32:4","book_usfm":"DEU","chapter":31,"chapter_end":32},{"label":"Romanos 10:1-13","book_usfm":"ROM","chapter":10},{"label":"Mateo 24:15-31","book_usfm":"MAT","chapter":24}]'::jsonb),
  (192, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Deuteronomio 34","book_usfm":"DEU","chapter":34},{"label":"Romanos 10:14-21","book_usfm":"ROM","chapter":10},{"label":"Mateo 24:32-51","book_usfm":"MAT","chapter":24}]'::jsonb),
  (193, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Josué 1","book_usfm":"JOS","chapter":1},{"label":"Hechos 21:3-15","book_usfm":"ACT","chapter":21},{"label":"Marcos 1:21-27","book_usfm":"MRK","chapter":1}]'::jsonb),
  (194, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Josué 2:1-14","book_usfm":"JOS","chapter":2},{"label":"Romanos 11:1-12","book_usfm":"ROM","chapter":11},{"label":"Mateo 25:1-13","book_usfm":"MAT","chapter":25}]'::jsonb),
  (195, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Josué 2:15-24","book_usfm":"JOS","chapter":2},{"label":"Romanos 11:13-24","book_usfm":"ROM","chapter":11},{"label":"Mateo 25:14-30","book_usfm":"MAT","chapter":25}]'::jsonb),
  (196, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Josué 3:1-13","book_usfm":"JOS","chapter":3},{"label":"Romanos 11:25-36","book_usfm":"ROM","chapter":11},{"label":"Mateo 25:31-46","book_usfm":"MAT","chapter":25}]'::jsonb),
  (197, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Josué 3:14-4:7","book_usfm":"JOS","chapter":3,"chapter_end":4},{"label":"Romanos 12:1-8","book_usfm":"ROM","chapter":12},{"label":"Mateo 26:1-16","book_usfm":"MAT","chapter":26}]'::jsonb),
  (198, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Josué 4:19-5:1","book_usfm":"JOS","chapter":4,"chapter_end":5},{"label":"Josué 5:10-15","book_usfm":"JOS","chapter":5},{"label":"Romanos 12:9-21","book_usfm":"ROM","chapter":12},{"label":"Mateo 26:17-25","book_usfm":"MAT","chapter":26}]'::jsonb),
  (199, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Josué 6:1-14","book_usfm":"JOS","chapter":6},{"label":"Romanos 13:1-7","book_usfm":"ROM","chapter":13},{"label":"Mateo 26:26-35","book_usfm":"MAT","chapter":26}]'::jsonb),
  (200, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Josué 6:15-27","book_usfm":"JOS","chapter":6},{"label":"Hechos 22:30-23:11","book_usfm":"ACT","chapter":22,"chapter_end":23},{"label":"Marcos 2:1-12","book_usfm":"MRK","chapter":2}]'::jsonb),
  (201, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Josué 7:1-13","book_usfm":"JOS","chapter":7},{"label":"Romanos 13:8-14","book_usfm":"ROM","chapter":13},{"label":"Mateo 26:36-46","book_usfm":"MAT","chapter":26}]'::jsonb),
  (202, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Josué 8:1-22","book_usfm":"JOS","chapter":8},{"label":"Romanos 14:1-12","book_usfm":"ROM","chapter":14},{"label":"Mateo 26:47-56","book_usfm":"MAT","chapter":26}]'::jsonb),
  (203, '[{"label":"Salmos 116","book_usfm":"PSA","chapter":116},{"label":"Sofonías 3:14-20","book_usfm":"ZEP","chapter":3},{"label":"Marcos 15:47-16:7","book_usfm":"MRK","chapter":15,"chapter_end":16},{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 149","book_usfm":"PSA","chapter":149},{"label":"2 Corintios 1:3-7","book_usfm":"2CO","chapter":1}]'::jsonb),
  (204, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Josué 9:3-21","book_usfm":"JOS","chapter":9},{"label":"Romanos 15:1-13","book_usfm":"ROM","chapter":15},{"label":"Mateo 26:69-75","book_usfm":"MAT","chapter":26}]'::jsonb),
  (205, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Josué 9:22-10:15","book_usfm":"JOS","chapter":9,"chapter_end":10},{"label":"Romanos 15:14-24","book_usfm":"ROM","chapter":15},{"label":"Mateo 27:1-10","book_usfm":"MAT","chapter":27}]'::jsonb),
  (206, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Jeremías 16:14-21","book_usfm":"JER","chapter":16},{"label":"Marcos 1:14-20","book_usfm":"MRK","chapter":1},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Mateo 10:16-32","book_usfm":"MAT","chapter":10}]'::jsonb),
  (207, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Josué 24:1-15","book_usfm":"JOS","chapter":24},{"label":"Hechos 28:23-31","book_usfm":"ACT","chapter":28},{"label":"Marcos 2:23-28","book_usfm":"MRK","chapter":2}]'::jsonb),
  (208, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Josué 24:16-33","book_usfm":"JOS","chapter":24},{"label":"Romanos 16:1-16","book_usfm":"ROM","chapter":16},{"label":"Mateo 27:24-31","book_usfm":"MAT","chapter":27}]'::jsonb),
  (209, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Jueces 2:1-5","book_usfm":"JDG","chapter":2},{"label":"Jueces 2:11-23","book_usfm":"JDG","chapter":2},{"label":"Romanos 16:17-27","book_usfm":"ROM","chapter":16},{"label":"Mateo 27:32-44","book_usfm":"MAT","chapter":27}]'::jsonb),
  (210, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Jueces 3:12-30","book_usfm":"JDG","chapter":3},{"label":"Hechos 1:1-14","book_usfm":"ACT","chapter":1},{"label":"Mateo 27:45-54","book_usfm":"MAT","chapter":27}]'::jsonb),
  (211, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Jueces 4:4-23","book_usfm":"JDG","chapter":4},{"label":"Hechos 1:15-26","book_usfm":"ACT","chapter":1},{"label":"Mateo 27:55-66","book_usfm":"MAT","chapter":27}]'::jsonb),
  (212, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Jueces 5:1-18","book_usfm":"JDG","chapter":5},{"label":"Hechos 2:1-21","book_usfm":"ACT","chapter":2},{"label":"Mateo 28:1-10","book_usfm":"MAT","chapter":28}]'::jsonb),
  (213, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Jueces 5:19-31","book_usfm":"JDG","chapter":5},{"label":"Hechos 2:22-36","book_usfm":"ACT","chapter":2},{"label":"Mateo 28:11-20","book_usfm":"MAT","chapter":28}]'::jsonb),
  (214, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Jueces 6:1-24","book_usfm":"JDG","chapter":6},{"label":"2 Corintios 9:6-15","book_usfm":"2CO","chapter":9},{"label":"Marcos 3:20-30","book_usfm":"MRK","chapter":3}]'::jsonb),
  (215, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Jueces 6:25-40","book_usfm":"JDG","chapter":6},{"label":"Hechos 2:37-47","book_usfm":"ACT","chapter":2},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1}]'::jsonb),
  (216, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Jueces 7:1-18","book_usfm":"JDG","chapter":7},{"label":"Hechos 3:1-11","book_usfm":"ACT","chapter":3},{"label":"Juan 1:19-28","book_usfm":"JHN","chapter":1}]'::jsonb),
  (217, '[{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"1 Reyes 19:1-12","book_usfm":"1KI","chapter":19},{"label":"2 Corintios 3:1-9","book_usfm":"2CO","chapter":3},{"label":"2 Corintios 3:18","book_usfm":"2CO","chapter":3}]'::jsonb),
  (218, '[{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Éxodo 24:12-18","book_usfm":"EXO","chapter":24},{"label":"2 Corintios 4:1-6","book_usfm":"2CO","chapter":4},{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Juan 12:27-36","book_usfm":"JHN","chapter":12}]'::jsonb),
  (219, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Jueces 9:1-16","book_usfm":"JDG","chapter":9},{"label":"Jueces 9:19-21","book_usfm":"JDG","chapter":9},{"label":"Hechos 4:13-31","book_usfm":"ACT","chapter":4},{"label":"Juan 2:1-12","book_usfm":"JHN","chapter":2}]'::jsonb),
  (220, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Jueces 9:22-25","book_usfm":"JDG","chapter":9},{"label":"Jueces 9:50-57","book_usfm":"JDG","chapter":9},{"label":"Hechos 4:32-5:11","book_usfm":"ACT","chapter":4,"chapter_end":5},{"label":"Juan 2:13-25","book_usfm":"JHN","chapter":2}]'::jsonb),
  (221, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Jueces 11:1-11","book_usfm":"JDG","chapter":11},{"label":"Jueces 11:29-40","book_usfm":"JDG","chapter":11},{"label":"2 Corintios 11:21-31","book_usfm":"2CO","chapter":11},{"label":"Marcos 4:35-41","book_usfm":"MRK","chapter":4}]'::jsonb),
  (222, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Jueces 12:1-7","book_usfm":"JDG","chapter":12},{"label":"Hechos 5:12-26","book_usfm":"ACT","chapter":5},{"label":"Juan 3:1-21","book_usfm":"JHN","chapter":3}]'::jsonb),
  (223, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Jueces 13:1-15","book_usfm":"JDG","chapter":13},{"label":"Hechos 5:27-42","book_usfm":"ACT","chapter":5},{"label":"Juan 3:22-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (224, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Jueces 13:15-24","book_usfm":"JDG","chapter":13},{"label":"Hechos 6","book_usfm":"ACT","chapter":6},{"label":"Juan 4:1-26","book_usfm":"JHN","chapter":4}]'::jsonb),
  (225, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Jueces 14:1-19","book_usfm":"JDG","chapter":14},{"label":"Hechos 6:15-7:16","book_usfm":"ACT","chapter":6,"chapter_end":7},{"label":"Juan 4:27-42","book_usfm":"JHN","chapter":4}]'::jsonb),
  (226, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Jueces 14:20-15","book_usfm":"JDG","chapter":14},{"label":"Hechos 7:17-29","book_usfm":"ACT","chapter":7},{"label":"Juan 4:43-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (227, '[{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"1 Samuel 2:1-10","book_usfm":"1SA","chapter":2},{"label":"Juan 2:1-12","book_usfm":"JHN","chapter":2},{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Salmos 149","book_usfm":"PSA","chapter":149},{"label":"Juan 19:23-27","book_usfm":"JHN","chapter":19}]'::jsonb),
  (228, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Jueces 16:15-31","book_usfm":"JDG","chapter":16},{"label":"2 Corintios 13:1-11","book_usfm":"2CO","chapter":13},{"label":"Marcos 5:25-34","book_usfm":"MRK","chapter":5}]'::jsonb),
  (229, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Jueces 17","book_usfm":"JDG","chapter":17},{"label":"Hechos 7:44-8:1","book_usfm":"ACT","chapter":7,"chapter_end":8},{"label":"Juan 5:19-29","book_usfm":"JHN","chapter":5}]'::jsonb),
  (230, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Jueces 18:1-15","book_usfm":"JDG","chapter":18},{"label":"Hechos 8:1-13","book_usfm":"ACT","chapter":8},{"label":"Juan 5:30-47","book_usfm":"JHN","chapter":5}]'::jsonb),
  (231, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Jueces 18:16-31","book_usfm":"JDG","chapter":18},{"label":"Hechos 8:14-25","book_usfm":"ACT","chapter":8},{"label":"Juan 6:1-15","book_usfm":"JHN","chapter":6}]'::jsonb),
  (232, '[{"label":"Salmos 131-135","book_usfm":"PSA","chapter":131,"chapter_end":135},{"label":"Job 1","book_usfm":"JOB","chapter":1},{"label":"Hechos 8:26-40","book_usfm":"ACT","chapter":8},{"label":"Juan 6:16-27","book_usfm":"JHN","chapter":6}]'::jsonb),
  (233, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Job 2","book_usfm":"JOB","chapter":2},{"label":"Hechos 9:1-9","book_usfm":"ACT","chapter":9},{"label":"Juan 6:27-40","book_usfm":"JHN","chapter":6}]'::jsonb),
  (234, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Job 3","book_usfm":"JOB","chapter":3},{"label":"Hechos 9:10-19","book_usfm":"ACT","chapter":9},{"label":"Juan 6:41-51","book_usfm":"JHN","chapter":6}]'::jsonb),
  (235, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Job 4:1-6","book_usfm":"JOB","chapter":4},{"label":"Job 4:12-21","book_usfm":"JOB","chapter":4},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4},{"label":"Marcos 6:1-6","book_usfm":"MRK","chapter":6}]'::jsonb),
  (236, '[{"label":"Salmos 86","book_usfm":"PSA","chapter":86},{"label":"Génesis 28:10-17","book_usfm":"GEN","chapter":28},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"1 Pedro 5:1-11","book_usfm":"1PE","chapter":5}]'::jsonb),
  (237, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Job 6:1-4","book_usfm":"JOB","chapter":6},{"label":"Job 6:8-15","book_usfm":"JOB","chapter":6},{"label":"Job 6:21","book_usfm":"JOB","chapter":6},{"label":"Hechos 9:32-43","book_usfm":"ACT","chapter":9},{"label":"Juan 6:60-71","book_usfm":"JHN","chapter":6}]'::jsonb),
  (238, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Job 6:1","book_usfm":"JOB","chapter":6},{"label":"Job 7","book_usfm":"JOB","chapter":7},{"label":"Hechos 10:1-16","book_usfm":"ACT","chapter":10},{"label":"Juan 7:1-13","book_usfm":"JHN","chapter":7}]'::jsonb),
  (239, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Job 8:1-10","book_usfm":"JOB","chapter":8},{"label":"Job 8:20-22","book_usfm":"JOB","chapter":8},{"label":"Hechos 10:17-33","book_usfm":"ACT","chapter":10},{"label":"Juan 7:14-36","book_usfm":"JHN","chapter":7}]'::jsonb),
  (240, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Job 9:1-15","book_usfm":"JOB","chapter":9},{"label":"Job 9:32-35","book_usfm":"JOB","chapter":9},{"label":"Hechos 10:34-48","book_usfm":"ACT","chapter":10},{"label":"Juan 7:37-52","book_usfm":"JHN","chapter":7}]'::jsonb),
  (241, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Job 9:1","book_usfm":"JOB","chapter":9},{"label":"Job 10:1-9","book_usfm":"JOB","chapter":10},{"label":"Job 10:16-22","book_usfm":"JOB","chapter":10},{"label":"Hechos 11:1-18","book_usfm":"ACT","chapter":11},{"label":"Juan 8:12-20","book_usfm":"JHN","chapter":8}]'::jsonb),
  (242, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Job 11:1-9","book_usfm":"JOB","chapter":11},{"label":"Job 11:13-20","book_usfm":"JOB","chapter":11},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5},{"label":"Mateo 5:1-12","book_usfm":"MAT","chapter":5}]'::jsonb),
  (243, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Job 12:1-6","book_usfm":"JOB","chapter":12},{"label":"Job 12:13-25","book_usfm":"JOB","chapter":12},{"label":"Hechos 11:19-30","book_usfm":"ACT","chapter":11},{"label":"Juan 8:21-32","book_usfm":"JHN","chapter":8}]'::jsonb),
  (244, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Job 12:1","book_usfm":"JOB","chapter":12},{"label":"Job 13:3-17","book_usfm":"JOB","chapter":13},{"label":"Job 13:21-27","book_usfm":"JOB","chapter":13},{"label":"Hechos 12:1-17","book_usfm":"ACT","chapter":12},{"label":"Juan 8:33-47","book_usfm":"JHN","chapter":8}]'::jsonb),
  (245, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Job 12:1","book_usfm":"JOB","chapter":12},{"label":"Job 14","book_usfm":"JOB","chapter":14},{"label":"Hechos 12:18-25","book_usfm":"ACT","chapter":12},{"label":"Juan 8:47-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (246, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Job 16:16-17:1","book_usfm":"JOB","chapter":16,"chapter_end":17},{"label":"Job 17:13-16","book_usfm":"JOB","chapter":17},{"label":"Hechos 13:1-12","book_usfm":"ACT","chapter":13},{"label":"Juan 9:1-17","book_usfm":"JHN","chapter":9}]'::jsonb),
  (247, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Job 19:1-7","book_usfm":"JOB","chapter":19},{"label":"Job 19:14-27","book_usfm":"JOB","chapter":19},{"label":"Hechos 13:13-25","book_usfm":"ACT","chapter":13},{"label":"Juan 9:18-41","book_usfm":"JHN","chapter":9}]'::jsonb),
  (248, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Job 22:1-4","book_usfm":"JOB","chapter":22},{"label":"Job 22:21-23:7","book_usfm":"JOB","chapter":22,"chapter_end":23},{"label":"Hechos 13:26-43","book_usfm":"ACT","chapter":13},{"label":"Juan 10:1-18","book_usfm":"JHN","chapter":10}]'::jsonb),
  (249, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Job 25","book_usfm":"JOB","chapter":25},{"label":"Job 27:1-6","book_usfm":"JOB","chapter":27},{"label":"Apocalipsis 14:1-7","book_usfm":"REV","chapter":14},{"label":"Apocalipsis 14:13","book_usfm":"REV","chapter":14},{"label":"Mateo 5:13-20","book_usfm":"MAT","chapter":5}]'::jsonb),
  (250, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Job 32:1-10","book_usfm":"JOB","chapter":32},{"label":"Job 32:19-33:1","book_usfm":"JOB","chapter":32,"chapter_end":33},{"label":"Job 33:19-28","book_usfm":"JOB","chapter":33},{"label":"Hechos 13:44-52","book_usfm":"ACT","chapter":13},{"label":"Juan 10:19-30","book_usfm":"JHN","chapter":10}]'::jsonb),
  (251, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Job 29:1-20","book_usfm":"JOB","chapter":29},{"label":"Hechos 14:1-18","book_usfm":"ACT","chapter":14},{"label":"Juan 10:31-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (252, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Job 29:1","book_usfm":"JOB","chapter":29},{"label":"Job 30:1-2","book_usfm":"JOB","chapter":30},{"label":"Job 30:16-31","book_usfm":"JOB","chapter":30},{"label":"Hechos 14:19-28","book_usfm":"ACT","chapter":14},{"label":"Juan 11:1-16","book_usfm":"JHN","chapter":11}]'::jsonb),
  (253, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Job 29:1","book_usfm":"JOB","chapter":29},{"label":"Job 31:1-23","book_usfm":"JOB","chapter":31},{"label":"Hechos 15:1-11","book_usfm":"ACT","chapter":15},{"label":"Juan 11:17-29","book_usfm":"JHN","chapter":11}]'::jsonb),
  (254, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Job 29:1","book_usfm":"JOB","chapter":29},{"label":"Job 31:24-40","book_usfm":"JOB","chapter":31},{"label":"Hechos 15:12-21","book_usfm":"ACT","chapter":15},{"label":"Juan 11:30-44","book_usfm":"JHN","chapter":11}]'::jsonb),
  (255, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Job 38:1-17","book_usfm":"JOB","chapter":38},{"label":"Hechos 15:22-35","book_usfm":"ACT","chapter":15},{"label":"Juan 11:45-54","book_usfm":"JHN","chapter":11}]'::jsonb),
  (256, '[{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"1 Reyes 8:22-30","book_usfm":"1KI","chapter":8},{"label":"Efesios 2:11-22","book_usfm":"EPH","chapter":2}]'::jsonb),
  (257, '[{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Números 21:4-9","book_usfm":"NUM","chapter":21},{"label":"Juan 3:11-17","book_usfm":"JHN","chapter":3},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"1 Pedro 3:17-22","book_usfm":"1PE","chapter":3}]'::jsonb),
  (258, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Job 40:1","book_usfm":"JOB","chapter":40},{"label":"Job 41:1-11","book_usfm":"JOB","chapter":41},{"label":"Hechos 16:6-15","book_usfm":"ACT","chapter":16},{"label":"Juan 12:9-19","book_usfm":"JHN","chapter":12}]'::jsonb),
  (259, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Job 42","book_usfm":"JOB","chapter":42},{"label":"Hechos 16:16-24","book_usfm":"ACT","chapter":16},{"label":"Juan 12:20-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (260, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Job 28","book_usfm":"JOB","chapter":28},{"label":"Hechos 16:25-40","book_usfm":"ACT","chapter":16},{"label":"Juan 12:27-36","book_usfm":"JHN","chapter":12}]'::jsonb),
  (261, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Ester 1:1-4","book_usfm":"EST","chapter":1},{"label":"Ester 1:10-19","book_usfm":"EST","chapter":1},{"label":"Hechos 17:1-15","book_usfm":"ACT","chapter":17},{"label":"Juan 12:36-43","book_usfm":"JHN","chapter":12}]'::jsonb),
  (262, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Ester 2:5-8","book_usfm":"EST","chapter":2},{"label":"Ester 2:15-23","book_usfm":"EST","chapter":2},{"label":"Hechos 17:16-34","book_usfm":"ACT","chapter":17},{"label":"Juan 12:44-50","book_usfm":"JHN","chapter":12}]'::jsonb),
  (263, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Ester 3:1-4:3","book_usfm":"EST","chapter":3,"chapter_end":4},{"label":"Santiago 1:19-27","book_usfm":"JAS","chapter":1},{"label":"Mateo 6:1-6","book_usfm":"MAT","chapter":6},{"label":"Mateo 6:16-18","book_usfm":"MAT","chapter":6}]'::jsonb),
  (264, '[{"label":"Salmos 119:41-64","book_usfm":"PSA","chapter":119},{"label":"Isaías 8:11-20","book_usfm":"ISA","chapter":8},{"label":"Romanos 10:1-15","book_usfm":"ROM","chapter":10},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Mateo 13:44-52","book_usfm":"MAT","chapter":13}]'::jsonb),
  (265, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Ester 5","book_usfm":"EST","chapter":5},{"label":"Hechos 18:12-28","book_usfm":"ACT","chapter":18},{"label":"Lucas 3:15-22","book_usfm":"LUK","chapter":3}]'::jsonb),
  (266, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Ester 6","book_usfm":"EST","chapter":6},{"label":"Hechos 19:1-10","book_usfm":"ACT","chapter":19},{"label":"Lucas 4:1-13","book_usfm":"LUK","chapter":4}]'::jsonb),
  (267, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Ester 7","book_usfm":"EST","chapter":7},{"label":"Hechos 19:11-20","book_usfm":"ACT","chapter":19},{"label":"Lucas 4:14-30","book_usfm":"LUK","chapter":4}]'::jsonb),
  (268, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Ester 8:1-8","book_usfm":"EST","chapter":8},{"label":"Ester 8:15-17","book_usfm":"EST","chapter":8},{"label":"Hechos 19:21-41","book_usfm":"ACT","chapter":19},{"label":"Lucas 4:31-37","book_usfm":"LUK","chapter":4}]'::jsonb),
  (269, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Oseas 1:1-2","book_usfm":"HOS","chapter":1},{"label":"Hechos 20:1-16","book_usfm":"ACT","chapter":20},{"label":"Lucas 4:38-44","book_usfm":"LUK","chapter":4}]'::jsonb),
  (270, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Oseas 2:2-14","book_usfm":"HOS","chapter":2},{"label":"Santiago 3:1-13","book_usfm":"JAS","chapter":3},{"label":"Mateo 13:44-52","book_usfm":"MAT","chapter":13}]'::jsonb),
  (271, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Oseas 2:14-23","book_usfm":"HOS","chapter":2},{"label":"Hechos 20:17-38","book_usfm":"ACT","chapter":20},{"label":"Lucas 5:1-11","book_usfm":"LUK","chapter":5}]'::jsonb),
  (272, '[{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Job 38:1-7","book_usfm":"JOB","chapter":38},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 150","book_usfm":"PSA","chapter":150},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Marcos 13:21-27","book_usfm":"MRK","chapter":13}]'::jsonb),
  (273, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Oseas 4:11-19","book_usfm":"HOS","chapter":4},{"label":"Hechos 21:15-26","book_usfm":"ACT","chapter":21},{"label":"Lucas 5:27-39","book_usfm":"LUK","chapter":5}]'::jsonb),
  (274, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Oseas 5:8-6:6","book_usfm":"HOS","chapter":5,"chapter_end":6},{"label":"Hechos 21:27-36","book_usfm":"ACT","chapter":21},{"label":"Lucas 6:1-11","book_usfm":"LUK","chapter":6}]'::jsonb),
  (275, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Oseas 10","book_usfm":"HOS","chapter":10},{"label":"Hechos 21:37-22:16","book_usfm":"ACT","chapter":21,"chapter_end":22},{"label":"Lucas 6:12-26","book_usfm":"LUK","chapter":6}]'::jsonb),
  (276, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Oseas 11:1-9","book_usfm":"HOS","chapter":11},{"label":"Hechos 22:17-29","book_usfm":"ACT","chapter":22},{"label":"Lucas 6:27-38","book_usfm":"LUK","chapter":6}]'::jsonb),
  (277, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Oseas 13:4-14","book_usfm":"HOS","chapter":13},{"label":"1 Corintios 2:6-16","book_usfm":"1CO","chapter":2},{"label":"Mateo 14:1-12","book_usfm":"MAT","chapter":14}]'::jsonb),
  (278, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Oseas 14","book_usfm":"HOS","chapter":14},{"label":"Hechos 22:30-23:11","book_usfm":"ACT","chapter":22,"chapter_end":23},{"label":"Lucas 6:39-49","book_usfm":"LUK","chapter":6}]'::jsonb),
  (279, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Miqueas 1:1-9","book_usfm":"MIC","chapter":1},{"label":"Hechos 23:12-24","book_usfm":"ACT","chapter":23},{"label":"Lucas 7:1-17","book_usfm":"LUK","chapter":7}]'::jsonb),
  (280, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Miqueas 2","book_usfm":"MIC","chapter":2},{"label":"Hechos 23:23-35","book_usfm":"ACT","chapter":23},{"label":"Lucas 7:18-35","book_usfm":"LUK","chapter":7}]'::jsonb),
  (281, '[{"label":"Salmos 131-135","book_usfm":"PSA","chapter":131,"chapter_end":135},{"label":"Miqueas 3:1-8","book_usfm":"MIC","chapter":3},{"label":"Hechos 24:1-23","book_usfm":"ACT","chapter":24},{"label":"Lucas 7:36-50","book_usfm":"LUK","chapter":7}]'::jsonb),
  (282, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Miqueas 3:9-4:5","book_usfm":"MIC","chapter":3,"chapter_end":4},{"label":"Hechos 24:24-25:12","book_usfm":"ACT","chapter":24,"chapter_end":25},{"label":"Lucas 8:1-15","book_usfm":"LUK","chapter":8}]'::jsonb),
  (283, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Miqueas 5:1-4","book_usfm":"MIC","chapter":5},{"label":"Miqueas 5:10-15","book_usfm":"MIC","chapter":5},{"label":"Hechos 25:13-27","book_usfm":"ACT","chapter":25},{"label":"Lucas 8:16-25","book_usfm":"LUK","chapter":8}]'::jsonb),
  (284, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Miqueas 6:1-8","book_usfm":"MIC","chapter":6},{"label":"1 Corintios 4:9-16","book_usfm":"1CO","chapter":4},{"label":"Mateo 15:21-28","book_usfm":"MAT","chapter":15}]'::jsonb),
  (285, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Miqueas 7:1-7","book_usfm":"MIC","chapter":7},{"label":"Hechos 26:1-23","book_usfm":"ACT","chapter":26},{"label":"Lucas 8:26-39","book_usfm":"LUK","chapter":8}]'::jsonb),
  (286, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Jonás 1","book_usfm":"JON","chapter":1},{"label":"Hechos 26:24-27:8","book_usfm":"ACT","chapter":26,"chapter_end":27},{"label":"Lucas 8:40-56","book_usfm":"LUK","chapter":8}]'::jsonb),
  (287, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Jonás 1:17-2:10","book_usfm":"JON","chapter":1,"chapter_end":2},{"label":"Hechos 27:9-26","book_usfm":"ACT","chapter":27},{"label":"Lucas 9:1-17","book_usfm":"LUK","chapter":9}]'::jsonb),
  (288, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Jonás 3-4","book_usfm":"JON","chapter":3,"chapter_end":4},{"label":"Hechos 27:27-44","book_usfm":"ACT","chapter":27},{"label":"Lucas 9:18-27","book_usfm":"LUK","chapter":9}]'::jsonb),
  (289, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Hechos 28:1-16","book_usfm":"ACT","chapter":28},{"label":"Lucas 9:28-36","book_usfm":"LUK","chapter":9}]'::jsonb),
  (290, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Hechos 28:17-31","book_usfm":"ACT","chapter":28},{"label":"Lucas 9:37-50","book_usfm":"LUK","chapter":9}]'::jsonb),
  (291, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Ezequiel 47:1-12","book_usfm":"EZK","chapter":47},{"label":"Lucas 1:1-4","book_usfm":"LUK","chapter":1},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Hechos 1:1-8","book_usfm":"ACT","chapter":1}]'::jsonb),
  (292, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Apocalipsis 7:1-8","book_usfm":"REV","chapter":7},{"label":"Lucas 9:51-62","book_usfm":"LUK","chapter":9}]'::jsonb),
  (293, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Apocalipsis 7:9-17","book_usfm":"REV","chapter":7},{"label":"Lucas 10:1-16","book_usfm":"LUK","chapter":10}]'::jsonb),
  (294, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Apocalipsis 8","book_usfm":"REV","chapter":8},{"label":"Lucas 10:17-24","book_usfm":"LUK","chapter":10}]'::jsonb),
  (295, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Apocalipsis 9:1-12","book_usfm":"REV","chapter":9},{"label":"Lucas 10:25-37","book_usfm":"LUK","chapter":10}]'::jsonb),
  (296, '[{"label":"Salmos 119:145-168","book_usfm":"PSA","chapter":119},{"label":"Jeremías 11:18-23","book_usfm":"JER","chapter":11},{"label":"Mateo 10:16-22","book_usfm":"MAT","chapter":10},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Salmos 125","book_usfm":"PSA","chapter":125},{"label":"Hebreos 12:12-24","book_usfm":"HEB","chapter":12}]'::jsonb),
  (297, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Apocalipsis 10","book_usfm":"REV","chapter":10},{"label":"Lucas 11:1-13","book_usfm":"LUK","chapter":11}]'::jsonb),
  (298, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"1 Corintios 10:15-24","book_usfm":"1CO","chapter":10},{"label":"Mateo 18:15-20","book_usfm":"MAT","chapter":18}]'::jsonb),
  (299, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Apocalipsis 11:1-14","book_usfm":"REV","chapter":11},{"label":"Lucas 11:14-26","book_usfm":"LUK","chapter":11}]'::jsonb),
  (300, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Apocalipsis 11:14-19","book_usfm":"REV","chapter":11},{"label":"Lucas 11:27-36","book_usfm":"LUK","chapter":11}]'::jsonb),
  (301, '[{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Isaías 28:9-16","book_usfm":"ISA","chapter":28},{"label":"Efesios 4:1-16","book_usfm":"EPH","chapter":4},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Juan 14:15-31","book_usfm":"JHN","chapter":14}]'::jsonb),
  (302, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Apocalipsis 12:7-17","book_usfm":"REV","chapter":12},{"label":"Lucas 11:53-12:12","book_usfm":"LUK","chapter":11,"chapter_end":12}]'::jsonb),
  (303, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Apocalipsis 13:1-10","book_usfm":"REV","chapter":13},{"label":"Lucas 12:13-31","book_usfm":"LUK","chapter":12}]'::jsonb),
  (304, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Apocalipsis 19:1","book_usfm":"REV","chapter":19},{"label":"Apocalipsis 19:4-10","book_usfm":"REV","chapter":19}]'::jsonb),
  (305, '[{"label":"Salmos 111-112","book_usfm":"PSA","chapter":111,"chapter_end":112},{"label":"Hebreos 11:32-12:2","book_usfm":"HEB","chapter":11,"chapter_end":12},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Salmos 150","book_usfm":"PSA","chapter":150},{"label":"Apocalipsis 21:1-4","book_usfm":"REV","chapter":21},{"label":"Apocalipsis 21:22-22:5","book_usfm":"REV","chapter":21,"chapter_end":22}]'::jsonb),
  (306, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Apocalipsis 14:1-13","book_usfm":"REV","chapter":14},{"label":"Lucas 12:49-59","book_usfm":"LUK","chapter":12}]'::jsonb),
  (307, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Apocalipsis 14:14-15:8","book_usfm":"REV","chapter":14,"chapter_end":15},{"label":"Lucas 13:1-9","book_usfm":"LUK","chapter":13}]'::jsonb),
  (308, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Apocalipsis 16:1-11","book_usfm":"REV","chapter":16},{"label":"Lucas 13:10-17","book_usfm":"LUK","chapter":13}]'::jsonb),
  (309, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Apocalipsis 16:12-21","book_usfm":"REV","chapter":16},{"label":"Lucas 13:18-30","book_usfm":"LUK","chapter":13}]'::jsonb),
  (310, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Apocalipsis 17","book_usfm":"REV","chapter":17},{"label":"Lucas 13:31-35","book_usfm":"LUK","chapter":13}]'::jsonb),
  (311, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Apocalipsis 18:1-14","book_usfm":"REV","chapter":18},{"label":"Lucas 14:1-11","book_usfm":"LUK","chapter":14}]'::jsonb),
  (312, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"1 Corintios 14:1-12","book_usfm":"1CO","chapter":14},{"label":"Mateo 20:1-16","book_usfm":"MAT","chapter":20}]'::jsonb),
  (313, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Joel 1:1-13","book_usfm":"JOL","chapter":1},{"label":"Apocalipsis 18:15-24","book_usfm":"REV","chapter":18},{"label":"Lucas 14:12-24","book_usfm":"LUK","chapter":14}]'::jsonb),
  (314, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Joel 1:15-2:11","book_usfm":"JOL","chapter":1,"chapter_end":2},{"label":"Apocalipsis 19:1-10","book_usfm":"REV","chapter":19},{"label":"Lucas 14:25-35","book_usfm":"LUK","chapter":14}]'::jsonb),
  (315, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Joel 2:12-19","book_usfm":"JOL","chapter":2},{"label":"Apocalipsis 19:11-21","book_usfm":"REV","chapter":19},{"label":"Lucas 15:1-10","book_usfm":"LUK","chapter":15}]'::jsonb),
  (316, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Joel 2:21-27","book_usfm":"JOL","chapter":2},{"label":"Santiago 1:1-15","book_usfm":"JAS","chapter":1},{"label":"Lucas 15:1-2","book_usfm":"LUK","chapter":15},{"label":"Lucas 15:11-32","book_usfm":"LUK","chapter":15}]'::jsonb),
  (317, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Joel 2:28-3:8","book_usfm":"JOL","chapter":2,"chapter_end":3},{"label":"Santiago 1:16-27","book_usfm":"JAS","chapter":1},{"label":"Lucas 16:1-9","book_usfm":"LUK","chapter":16}]'::jsonb),
  (318, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Joel 3:9-17","book_usfm":"JOL","chapter":3},{"label":"Santiago 2:1-13","book_usfm":"JAS","chapter":2},{"label":"Lucas 16:10-18","book_usfm":"LUK","chapter":16}]'::jsonb),
  (319, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Habacuc 1:1-2","book_usfm":"HAB","chapter":1},{"label":"Filipenses 3:13-4:1","book_usfm":"PHP","chapter":3,"chapter_end":4},{"label":"Mateo 23:13-24","book_usfm":"MAT","chapter":23}]'::jsonb),
  (320, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Habacuc 2:1-4","book_usfm":"HAB","chapter":2},{"label":"Habacuc 2:9-20","book_usfm":"HAB","chapter":2},{"label":"Santiago 2:14-26","book_usfm":"JAS","chapter":2},{"label":"Lucas 16:19-31","book_usfm":"LUK","chapter":16}]'::jsonb),
  (321, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Habacuc 3:1-18","book_usfm":"HAB","chapter":3},{"label":"Santiago 3:1-12","book_usfm":"JAS","chapter":3},{"label":"Lucas 17:1-10","book_usfm":"LUK","chapter":17}]'::jsonb),
  (322, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Malaquías 1:1","book_usfm":"MAL","chapter":1},{"label":"Malaquías 1:6-14","book_usfm":"MAL","chapter":1},{"label":"Santiago 3:13-4:12","book_usfm":"JAS","chapter":3,"chapter_end":4},{"label":"Lucas 17:11-19","book_usfm":"LUK","chapter":17}]'::jsonb),
  (323, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Malaquías 2:1-16","book_usfm":"MAL","chapter":2},{"label":"Santiago 4:13-5:6","book_usfm":"JAS","chapter":4,"chapter_end":5},{"label":"Lucas 17:20-37","book_usfm":"LUK","chapter":17}]'::jsonb),
  (324, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Malaquías 3:1-12","book_usfm":"MAL","chapter":3},{"label":"Santiago 5:7-12","book_usfm":"JAS","chapter":5},{"label":"Lucas 18:1-8","book_usfm":"LUK","chapter":18}]'::jsonb),
  (325, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Malaquías 3:13-4:6","book_usfm":"MAL","chapter":3,"chapter_end":4},{"label":"Santiago 5:13-20","book_usfm":"JAS","chapter":5},{"label":"Lucas 18:9-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (326, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Zacarías 9:9-16","book_usfm":"ZEC","chapter":9},{"label":"1 Pedro 3:13-22","book_usfm":"1PE","chapter":3},{"label":"Mateo 21:1-13","book_usfm":"MAT","chapter":21}]'::jsonb),
  (327, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Zacarías 10","book_usfm":"ZEC","chapter":10},{"label":"Gálatas 6:1-10","book_usfm":"GAL","chapter":6},{"label":"Lucas 18:15-30","book_usfm":"LUK","chapter":18}]'::jsonb),
  (328, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Zacarías 11:4-17","book_usfm":"ZEC","chapter":11},{"label":"1 Corintios 3:10-23","book_usfm":"1CO","chapter":3},{"label":"Lucas 18:31-43","book_usfm":"LUK","chapter":18}]'::jsonb),
  (329, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Zacarías 12:1-10","book_usfm":"ZEC","chapter":12},{"label":"Efesios 1:3-14","book_usfm":"EPH","chapter":1},{"label":"Lucas 19:1-10","book_usfm":"LUK","chapter":19}]'::jsonb),
  (330, '[{"label":"Salmos 147","book_usfm":"PSA","chapter":147},{"label":"Deuteronomio 26:1-11","book_usfm":"DEU","chapter":26},{"label":"Juan 6:26-35","book_usfm":"JHN","chapter":6},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"1 Tesalonicenses 5:12-24","book_usfm":"1TH","chapter":5}]'::jsonb),
  (331, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Zacarías 14:1-11","book_usfm":"ZEC","chapter":14},{"label":"Romanos 15:7-13","book_usfm":"ROM","chapter":15},{"label":"Lucas 19:28-40","book_usfm":"LUK","chapter":19}]'::jsonb),
  (332, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Zacarías 14:12-21","book_usfm":"ZEC","chapter":14},{"label":"Filipenses 2:1-11","book_usfm":"PHP","chapter":2},{"label":"Lucas 19:41-48","book_usfm":"LUK","chapter":19}]'::jsonb),
  (333, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Isaías 1:1-9","book_usfm":"ISA","chapter":1},{"label":"2 Pedro 3:1-10","book_usfm":"2PE","chapter":3},{"label":"Mateo 25:1-13","book_usfm":"MAT","chapter":25}]'::jsonb),
  (334, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Isaías 49:1-6","book_usfm":"ISA","chapter":49},{"label":"1 Corintios 4:1-16","book_usfm":"1CO","chapter":4},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Juan 1:35-42","book_usfm":"JHN","chapter":1}]'::jsonb),
  (335, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Isaías 1:21-31","book_usfm":"ISA","chapter":1},{"label":"1 Tesalonicenses 2:1-12","book_usfm":"1TH","chapter":2},{"label":"Lucas 20:9-18","book_usfm":"LUK","chapter":20}]'::jsonb),
  (336, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Isaías 2:1-11","book_usfm":"ISA","chapter":2},{"label":"1 Tesalonicenses 2:13-20","book_usfm":"1TH","chapter":2},{"label":"Lucas 20:19-26","book_usfm":"LUK","chapter":20}]'::jsonb),
  (337, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Isaías 2:12-22","book_usfm":"ISA","chapter":2},{"label":"1 Tesalonicenses 3","book_usfm":"1TH","chapter":3},{"label":"Lucas 20:27-40","book_usfm":"LUK","chapter":20}]'::jsonb),
  (338, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Isaías 3:8-15","book_usfm":"ISA","chapter":3},{"label":"1 Tesalonicenses 4:1-12","book_usfm":"1TH","chapter":4},{"label":"Lucas 20:41-21:4","book_usfm":"LUK","chapter":20,"chapter_end":21}]'::jsonb),
  (339, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Isaías 4:2-6","book_usfm":"ISA","chapter":4},{"label":"1 Tesalonicenses 4:13-18","book_usfm":"1TH","chapter":4},{"label":"Lucas 21:5-19","book_usfm":"LUK","chapter":21}]'::jsonb),
  (340, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Isaías 5:1-7","book_usfm":"ISA","chapter":5},{"label":"2 Pedro 3:11-18","book_usfm":"2PE","chapter":3},{"label":"Lucas 7:28-35","book_usfm":"LUK","chapter":7}]'::jsonb),
  (341, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Isaías 5:8-12","book_usfm":"ISA","chapter":5},{"label":"Isaías 5:18-23","book_usfm":"ISA","chapter":5},{"label":"1 Tesalonicenses 5:1-11","book_usfm":"1TH","chapter":5},{"label":"Lucas 21:20-28","book_usfm":"LUK","chapter":21}]'::jsonb),
  (342, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Isaías 5:13-17","book_usfm":"ISA","chapter":5},{"label":"Isaías 5:24-25","book_usfm":"ISA","chapter":5},{"label":"1 Tesalonicenses 5:12-28","book_usfm":"1TH","chapter":5},{"label":"Lucas 21:29-38","book_usfm":"LUK","chapter":21}]'::jsonb),
  (343, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Isaías 6","book_usfm":"ISA","chapter":6},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1},{"label":"Juan 7:53-8:11","book_usfm":"JHN","chapter":7,"chapter_end":8}]'::jsonb),
  (344, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Isaías 7:1-9","book_usfm":"ISA","chapter":7},{"label":"2 Tesalonicenses 2:1-12","book_usfm":"2TH","chapter":2},{"label":"Lucas 22:1-13","book_usfm":"LUK","chapter":22}]'::jsonb),
  (345, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Isaías 7:10-25","book_usfm":"ISA","chapter":7},{"label":"2 Tesalonicenses 2:13-3:5","book_usfm":"2TH","chapter":2,"chapter_end":3},{"label":"Lucas 22:14-30","book_usfm":"LUK","chapter":22}]'::jsonb),
  (346, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Isaías 8:1-15","book_usfm":"ISA","chapter":8},{"label":"2 Tesalonicenses 3:6-18","book_usfm":"2TH","chapter":3},{"label":"Lucas 22:31-38","book_usfm":"LUK","chapter":22}]'::jsonb),
  (347, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Isaías 13:6-13","book_usfm":"ISA","chapter":13},{"label":"Hebreos 12:18-29","book_usfm":"HEB","chapter":12},{"label":"Juan 3:22-30","book_usfm":"JHN","chapter":3}]'::jsonb),
  (348, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Isaías 8:16-9:1","book_usfm":"ISA","chapter":8,"chapter_end":9},{"label":"2 Pedro 1:1-11","book_usfm":"2PE","chapter":1},{"label":"Lucas 22:39-53","book_usfm":"LUK","chapter":22}]'::jsonb),
  (349, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Isaías 9:1-7","book_usfm":"ISA","chapter":9},{"label":"2 Pedro 1:12-21","book_usfm":"2PE","chapter":1},{"label":"Lucas 22:54-69","book_usfm":"LUK","chapter":22}]'::jsonb),
  (350, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Isaías 9:8-17","book_usfm":"ISA","chapter":9},{"label":"2 Pedro 2:1-10","book_usfm":"2PE","chapter":2},{"label":"Marcos 1:1-8","book_usfm":"MRK","chapter":1}]'::jsonb),
  (351, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Isaías 9:18-10:4","book_usfm":"ISA","chapter":9,"chapter_end":10},{"label":"2 Pedro 2:10-16","book_usfm":"2PE","chapter":2},{"label":"Mateo 3:1-12","book_usfm":"MAT","chapter":3}]'::jsonb),
  (352, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Isaías 10:5-19","book_usfm":"ISA","chapter":10},{"label":"2 Pedro 2:17-22","book_usfm":"2PE","chapter":2},{"label":"Mateo 11:2-15","book_usfm":"MAT","chapter":11}]'::jsonb),
  (353, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Isaías 10:20-27","book_usfm":"ISA","chapter":10},{"label":"Judas 17-25","book_usfm":"JUD","chapter":1},{"label":"Lucas 3:1-9","book_usfm":"LUK","chapter":3}]'::jsonb),
  (354, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Isaías 42:1-12","book_usfm":"ISA","chapter":42},{"label":"Efesios 6:10-20","book_usfm":"EPH","chapter":6},{"label":"Juan 3:16-21","book_usfm":"JHN","chapter":3}]'::jsonb),
  (355, '[{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 121","book_usfm":"PSA","chapter":121},{"label":"Job 42:1-6","book_usfm":"JOB","chapter":42},{"label":"1 Pedro 1:3-9","book_usfm":"1PE","chapter":1},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Juan 14:1-7","book_usfm":"JHN","chapter":14}]'::jsonb),
  (356, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Isaías 11:10-16","book_usfm":"ISA","chapter":11},{"label":"Apocalipsis 20:11-21:8","book_usfm":"REV","chapter":20,"chapter_end":21},{"label":"Lucas 1:5-25","book_usfm":"LUK","chapter":1}]'::jsonb),
  (357, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Isaías 28:9-22","book_usfm":"ISA","chapter":28},{"label":"Apocalipsis 21:9-21","book_usfm":"REV","chapter":21},{"label":"Lucas 1:26-38","book_usfm":"LUK","chapter":1}]'::jsonb),
  (358, '[{"label":"Salmos 89:1-29","book_usfm":"PSA","chapter":89},{"label":"Isaías 59:15-21","book_usfm":"ISA","chapter":59},{"label":"Filipenses 2:5-11","book_usfm":"PHP","chapter":2}]'::jsonb),
  (359, '[{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Zacarías 2:10-13","book_usfm":"ZEC","chapter":2},{"label":"1 Juan 4:7-16","book_usfm":"1JN","chapter":4},{"label":"Juan 3:31-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (360, '[{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"2 Crónicas 24:17-22","book_usfm":"2CH","chapter":24},{"label":"Hechos 6:1-7","book_usfm":"ACT","chapter":6},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Hechos 7:59-8:8","book_usfm":"ACT","chapter":7,"chapter_end":8}]'::jsonb),
  (361, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Isaías 62:6-7","book_usfm":"ISA","chapter":62},{"label":"Isaías 62:10-12","book_usfm":"ISA","chapter":62},{"label":"Hebreos 2:10-18","book_usfm":"HEB","chapter":2},{"label":"Mateo 1:18-25","book_usfm":"MAT","chapter":1}]'::jsonb),
  (362, '[{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Isaías 49:13-23","book_usfm":"ISA","chapter":49},{"label":"Mateo 18:1-14","book_usfm":"MAT","chapter":18},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 126","book_usfm":"PSA","chapter":126},{"label":"Marcos 10:13-16","book_usfm":"MRK","chapter":10}]'::jsonb),
  (363, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Isaías 12","book_usfm":"ISA","chapter":12},{"label":"Apocalipsis 1:1-8","book_usfm":"REV","chapter":1},{"label":"Juan 7:37-52","book_usfm":"JHN","chapter":7}]'::jsonb),
  (364, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Isaías 25:1-9","book_usfm":"ISA","chapter":25},{"label":"Apocalipsis 1:9-20","book_usfm":"REV","chapter":1},{"label":"Juan 7:53-8:11","book_usfm":"JHN","chapter":7,"chapter_end":8}]'::jsonb),
  (365, '[{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Isaías 65:15-25","book_usfm":"ISA","chapter":65},{"label":"Apocalipsis 21:1-6","book_usfm":"REV","chapter":21}]'::jsonb),
  (366, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Génesis 17:1-12","book_usfm":"GEN","chapter":17},{"label":"Génesis 17:15-16","book_usfm":"GEN","chapter":17},{"label":"Colosenses 2:6-12","book_usfm":"COL","chapter":2},{"label":"Juan 16:23-30","book_usfm":"JHN","chapter":16}]'::jsonb),
  (367, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Génesis 12:1-7","book_usfm":"GEN","chapter":12},{"label":"Hebreos 11:1-12","book_usfm":"HEB","chapter":11},{"label":"Juan 6:35-42","book_usfm":"JHN","chapter":6},{"label":"Juan 6:48-51","book_usfm":"JHN","chapter":6}]'::jsonb),
  (368, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"1 Juan 2:12-17","book_usfm":"1JN","chapter":2},{"label":"Juan 6:41-47","book_usfm":"JHN","chapter":6}]'::jsonb),
  (369, '[{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 89:1-29","book_usfm":"PSA","chapter":89},{"label":"Éxodo 3:1-12","book_usfm":"EXO","chapter":3},{"label":"Hebreos 11:23-31","book_usfm":"HEB","chapter":11},{"label":"Juan 14:6-14","book_usfm":"JHN","chapter":14}]'::jsonb),
  (370, '[{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Isaías 66:18-23","book_usfm":"ISA","chapter":66},{"label":"Romanos 15:7-13","book_usfm":"ROM","chapter":15}]'::jsonb),
  (371, '[{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Isaías 52:7-10","book_usfm":"ISA","chapter":52},{"label":"Apocalipsis 21:22-27","book_usfm":"REV","chapter":21},{"label":"Mateo 12:14-21","book_usfm":"MAT","chapter":12}]'::jsonb),
  (372, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Isaías 52:3-6","book_usfm":"ISA","chapter":52},{"label":"Apocalipsis 2:1-7","book_usfm":"REV","chapter":2},{"label":"Juan 2:1-11","book_usfm":"JHN","chapter":2}]'::jsonb),
  (373, '[{"label":"Salmos 117-118","book_usfm":"PSA","chapter":117,"chapter_end":118},{"label":"Salmos 112-113","book_usfm":"PSA","chapter":112,"chapter_end":113},{"label":"Isaías 59:15-21","book_usfm":"ISA","chapter":59},{"label":"Apocalipsis 2:8-17","book_usfm":"REV","chapter":2},{"label":"Juan 4:46-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (374, '[{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Isaías 61:1-9","book_usfm":"ISA","chapter":61},{"label":"Gálatas 3:23-29","book_usfm":"GAL","chapter":3},{"label":"Gálatas 4:4-7","book_usfm":"GAL","chapter":4}]'::jsonb),
  (375, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Isaías 40:1-11","book_usfm":"ISA","chapter":40},{"label":"Hebreos 1:1-12","book_usfm":"HEB","chapter":1},{"label":"Juan 1:1-7","book_usfm":"JHN","chapter":1},{"label":"Juan 1:19-20","book_usfm":"JHN","chapter":1},{"label":"Juan 1:29-34","book_usfm":"JHN","chapter":1}]'::jsonb),
  (376, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Isaías 40:12-23","book_usfm":"ISA","chapter":40},{"label":"Efesios 1:1-14","book_usfm":"EPH","chapter":1},{"label":"Marcos 1:1-13","book_usfm":"MRK","chapter":1}]'::jsonb),
  (377, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Isaías 40:25-31","book_usfm":"ISA","chapter":40},{"label":"Efesios 1:15-23","book_usfm":"EPH","chapter":1},{"label":"Marcos 1:14-28","book_usfm":"MRK","chapter":1}]'::jsonb),
  (378, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Isaías 41:1-16","book_usfm":"ISA","chapter":41},{"label":"Efesios 2:1-10","book_usfm":"EPH","chapter":2},{"label":"Marcos 1:29-45","book_usfm":"MRK","chapter":1}]'::jsonb),
  (379, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Isaías 41:17-29","book_usfm":"ISA","chapter":41},{"label":"Efesios 2:11-22","book_usfm":"EPH","chapter":2},{"label":"Marcos 2:1-12","book_usfm":"MRK","chapter":2}]'::jsonb),
  (380, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Isaías 42:1-17","book_usfm":"ISA","chapter":42},{"label":"Efesios 3:1-13","book_usfm":"EPH","chapter":3},{"label":"Marcos 2:13-22","book_usfm":"MRK","chapter":2}]'::jsonb),
  (381, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Isaías 43:1-13","book_usfm":"ISA","chapter":43},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3},{"label":"Marcos 2:23-3:6","book_usfm":"MRK","chapter":2,"chapter_end":3}]'::jsonb),
  (382, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Isaías 43:14-44:5","book_usfm":"ISA","chapter":43,"chapter_end":44},{"label":"Hebreos 6:17-7:10","book_usfm":"HEB","chapter":6,"chapter_end":7},{"label":"Juan 4:27-42","book_usfm":"JHN","chapter":4}]'::jsonb),
  (383, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Ezequiel 3:4-11","book_usfm":"EZK","chapter":3},{"label":"Hechos 10:34-44","book_usfm":"ACT","chapter":10},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Juan 21:15-22","book_usfm":"JHN","chapter":21}]'::jsonb),
  (384, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Isaías 44:9-20","book_usfm":"ISA","chapter":44},{"label":"Efesios 4:17-32","book_usfm":"EPH","chapter":4},{"label":"Marcos 3:19-35","book_usfm":"MRK","chapter":3}]'::jsonb),
  (385, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Isaías 44:24-45:7","book_usfm":"ISA","chapter":44,"chapter_end":45},{"label":"Efesios 5:1-14","book_usfm":"EPH","chapter":5},{"label":"Marcos 4:1-20","book_usfm":"MRK","chapter":4}]'::jsonb),
  (386, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Isaías 45:5-17","book_usfm":"ISA","chapter":45},{"label":"Efesios 5:15-33","book_usfm":"EPH","chapter":5},{"label":"Marcos 4:21-34","book_usfm":"MRK","chapter":4}]'::jsonb),
  (387, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Isaías 45:18-25","book_usfm":"ISA","chapter":45},{"label":"Efesios 6:1-9","book_usfm":"EPH","chapter":6},{"label":"Marcos 4:35-41","book_usfm":"MRK","chapter":4}]'::jsonb),
  (388, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Isaías 46","book_usfm":"ISA","chapter":46},{"label":"Efesios 6:10-24","book_usfm":"EPH","chapter":6},{"label":"Marcos 5:1-20","book_usfm":"MRK","chapter":5}]'::jsonb),
  (389, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Isaías 47","book_usfm":"ISA","chapter":47},{"label":"Hebreos 10:19-31","book_usfm":"HEB","chapter":10},{"label":"Juan 5:2-18","book_usfm":"JHN","chapter":5}]'::jsonb),
  (390, '[{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Isaías 45:18-25","book_usfm":"ISA","chapter":45},{"label":"Filipenses 3:4-11","book_usfm":"PHP","chapter":3},{"label":"Salmos 119:89-112","book_usfm":"PSA","chapter":119},{"label":"Hechos 9:1-22","book_usfm":"ACT","chapter":9}]'::jsonb),
  (391, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Isaías 48:12-21","book_usfm":"ISA","chapter":48},{"label":"Gálatas 1:18-2:10","book_usfm":"GAL","chapter":1,"chapter_end":2},{"label":"Marcos 6:1-13","book_usfm":"MRK","chapter":6}]'::jsonb),
  (392, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Isaías 49:1-12","book_usfm":"ISA","chapter":49},{"label":"Gálatas 2:11-21","book_usfm":"GAL","chapter":2},{"label":"Marcos 6:13-29","book_usfm":"MRK","chapter":6}]'::jsonb),
  (393, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Isaías 49:13-23","book_usfm":"ISA","chapter":49},{"label":"Gálatas 3:1-14","book_usfm":"GAL","chapter":3},{"label":"Marcos 6:30-46","book_usfm":"MRK","chapter":6}]'::jsonb),
  (394, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Isaías 50","book_usfm":"ISA","chapter":50},{"label":"Gálatas 3:15-22","book_usfm":"GAL","chapter":3},{"label":"Marcos 6:47-56","book_usfm":"MRK","chapter":6}]'::jsonb),
  (395, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Isaías 51:1-8","book_usfm":"ISA","chapter":51},{"label":"Gálatas 3:23-29","book_usfm":"GAL","chapter":3},{"label":"Marcos 7:1-23","book_usfm":"MRK","chapter":7}]'::jsonb),
  (396, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Isaías 51:9-16","book_usfm":"ISA","chapter":51},{"label":"Hebreos 11:8-16","book_usfm":"HEB","chapter":11},{"label":"Juan 7:14-31","book_usfm":"JHN","chapter":7}]'::jsonb),
  (397, '[{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 122","book_usfm":"PSA","chapter":122},{"label":"1 Samuel 1:20-28","book_usfm":"1SA","chapter":1},{"label":"Romanos 8:14-21","book_usfm":"ROM","chapter":8}]'::jsonb),
  (398, '[{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"1 Samuel 2:1-10","book_usfm":"1SA","chapter":2},{"label":"Juan 8:31-36","book_usfm":"JHN","chapter":8},{"label":"Salmos 48","book_usfm":"PSA","chapter":48},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"1 Juan 3:1-8","book_usfm":"1JN","chapter":3}]'::jsonb),
  (399, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Isaías 54","book_usfm":"ISA","chapter":54},{"label":"Gálatas 4:21-31","book_usfm":"GAL","chapter":4},{"label":"Marcos 8:11-26","book_usfm":"MRK","chapter":8}]'::jsonb),
  (400, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Isaías 55","book_usfm":"ISA","chapter":55},{"label":"Gálatas 5:1-15","book_usfm":"GAL","chapter":5},{"label":"Marcos 8:27-9:1","book_usfm":"MRK","chapter":8,"chapter_end":9}]'::jsonb),
  (401, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Isaías 56:1-8","book_usfm":"ISA","chapter":56},{"label":"Gálatas 5:16-24","book_usfm":"GAL","chapter":5},{"label":"Marcos 9:2-13","book_usfm":"MRK","chapter":9}]'::jsonb),
  (402, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Isaías 57:3-13","book_usfm":"ISA","chapter":57},{"label":"Gálatas 5:25-6:10","book_usfm":"GAL","chapter":5,"chapter_end":6},{"label":"Marcos 9:14-29","book_usfm":"MRK","chapter":9}]'::jsonb),
  (403, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Deuteronomio 6:1-9","book_usfm":"DEU","chapter":6},{"label":"Hebreos 12:18-29","book_usfm":"HEB","chapter":12},{"label":"Juan 12:24-32","book_usfm":"JHN","chapter":12}]'::jsonb),
  (404, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Deuteronomio 6:10-15","book_usfm":"DEU","chapter":6},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1}]'::jsonb),
  (405, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Deuteronomio 6:16-25","book_usfm":"DEU","chapter":6},{"label":"Hebreos 2:1-10","book_usfm":"HEB","chapter":2},{"label":"Juan 1:19-28","book_usfm":"JHN","chapter":1}]'::jsonb),
  (406, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 130","book_usfm":"PSA","chapter":130},{"label":"Jonás 3-4","book_usfm":"JON","chapter":3,"chapter_end":4},{"label":"Hebreos 12:1-14","book_usfm":"HEB","chapter":12},{"label":"Lucas 18:9-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (407, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Deuteronomio 7:6-11","book_usfm":"DEU","chapter":7},{"label":"Tito 1","book_usfm":"TIT","chapter":1},{"label":"Juan 1:29-34","book_usfm":"JHN","chapter":1}]'::jsonb),
  (408, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Deuteronomio 7:12-16","book_usfm":"DEU","chapter":7},{"label":"Tito 2","book_usfm":"TIT","chapter":2},{"label":"Juan 1:35-42","book_usfm":"JHN","chapter":1}]'::jsonb),
  (409, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Deuteronomio 7:17-26","book_usfm":"DEU","chapter":7},{"label":"Tito 3","book_usfm":"TIT","chapter":3},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (410, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Deuteronomio 8:1-10","book_usfm":"DEU","chapter":8},{"label":"1 Corintios 1:17-31","book_usfm":"1CO","chapter":1},{"label":"Marcos 2:18-22","book_usfm":"MRK","chapter":2}]'::jsonb),
  (411, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Deuteronomio 8:11-20","book_usfm":"DEU","chapter":8},{"label":"Hebreos 2:11-18","book_usfm":"HEB","chapter":2},{"label":"Juan 2:1-12","book_usfm":"JHN","chapter":2}]'::jsonb),
  (412, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Deuteronomio 9:4-12","book_usfm":"DEU","chapter":9},{"label":"Hebreos 3:1-11","book_usfm":"HEB","chapter":3},{"label":"Juan 2:13-22","book_usfm":"JHN","chapter":2}]'::jsonb),
  (413, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Deuteronomio 9:13-21","book_usfm":"DEU","chapter":9},{"label":"Hebreos 3:12-19","book_usfm":"HEB","chapter":3},{"label":"Juan 2:23-3:15","book_usfm":"JHN","chapter":2,"chapter_end":3}]'::jsonb),
  (414, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Deuteronomio 9:23-10:5","book_usfm":"DEU","chapter":9,"chapter_end":10},{"label":"Hebreos 4:1-10","book_usfm":"HEB","chapter":4},{"label":"Juan 3:16-21","book_usfm":"JHN","chapter":3}]'::jsonb),
  (415, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Deuteronomio 10:12-22","book_usfm":"DEU","chapter":10},{"label":"Hebreos 4:11-16","book_usfm":"HEB","chapter":4},{"label":"Juan 3:22-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (416, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Deuteronomio 11:18-28","book_usfm":"DEU","chapter":11},{"label":"Hebreos 5:1-10","book_usfm":"HEB","chapter":5},{"label":"Juan 4:1-26","book_usfm":"JHN","chapter":4}]'::jsonb),
  (417, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Jeremías 1:1-10","book_usfm":"JER","chapter":1},{"label":"1 Corintios 3:11-23","book_usfm":"1CO","chapter":3},{"label":"Marcos 3:31-4:9","book_usfm":"MRK","chapter":3,"chapter_end":4}]'::jsonb),
  (418, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Jeremías 1:11-19","book_usfm":"JER","chapter":1},{"label":"Romanos 1:1-15","book_usfm":"ROM","chapter":1},{"label":"Juan 4:27-42","book_usfm":"JHN","chapter":4}]'::jsonb),
  (419, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Jeremías 2:1-13","book_usfm":"JER","chapter":2},{"label":"Romanos 1:16-25","book_usfm":"ROM","chapter":1},{"label":"Juan 4:43-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (420, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"1 Samuel 16:1-13","book_usfm":"1SA","chapter":16},{"label":"1 Juan 2:18-25","book_usfm":"1JN","chapter":2},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Hechos 20:17-35","book_usfm":"ACT","chapter":20}]'::jsonb),
  (421, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Jeremías 4:9-10","book_usfm":"JER","chapter":4},{"label":"Jeremías 4:19-28","book_usfm":"JER","chapter":4},{"label":"Romanos 2:12-24","book_usfm":"ROM","chapter":2},{"label":"Juan 5:19-29","book_usfm":"JHN","chapter":5}]'::jsonb),
  (422, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Jeremías 5:1-9","book_usfm":"JER","chapter":5},{"label":"Romanos 2:25-3:18","book_usfm":"ROM","chapter":2,"chapter_end":3},{"label":"Juan 5:30-47","book_usfm":"JHN","chapter":5}]'::jsonb),
  (423, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Jeremías 5:20-31","book_usfm":"JER","chapter":5},{"label":"Romanos 3:19-31","book_usfm":"ROM","chapter":3},{"label":"Juan 7:1-13","book_usfm":"JHN","chapter":7}]'::jsonb),
  (424, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Jeremías 6:9-15","book_usfm":"JER","chapter":6},{"label":"1 Corintios 6:12-20","book_usfm":"1CO","chapter":6},{"label":"Marcos 5:1-20","book_usfm":"MRK","chapter":5}]'::jsonb),
  (425, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Jeremías 7:1-15","book_usfm":"JER","chapter":7},{"label":"Romanos 4:1-12","book_usfm":"ROM","chapter":4},{"label":"Juan 7:14-36","book_usfm":"JHN","chapter":7}]'::jsonb),
  (426, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Jeremías 7:21-34","book_usfm":"JER","chapter":7},{"label":"Romanos 4:13-25","book_usfm":"ROM","chapter":4},{"label":"Juan 7:37-52","book_usfm":"JHN","chapter":7}]'::jsonb),
  (427, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Jeremías 8:18-9:6","book_usfm":"JER","chapter":8,"chapter_end":9},{"label":"Romanos 5:1-11","book_usfm":"ROM","chapter":5},{"label":"Juan 8:12-20","book_usfm":"JHN","chapter":8}]'::jsonb),
  (428, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Jeremías 10:11-24","book_usfm":"JER","chapter":10},{"label":"Romanos 5:12-21","book_usfm":"ROM","chapter":5},{"label":"Juan 8:21-32","book_usfm":"JHN","chapter":8}]'::jsonb),
  (429, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Jeremías 11:1-8","book_usfm":"JER","chapter":11},{"label":"Jeremías 11:14-20","book_usfm":"JER","chapter":11},{"label":"Romanos 6:1-11","book_usfm":"ROM","chapter":6},{"label":"Juan 8:33-47","book_usfm":"JHN","chapter":8}]'::jsonb),
  (430, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Jeremías 13:1-11","book_usfm":"JER","chapter":13},{"label":"Romanos 6:12-23","book_usfm":"ROM","chapter":6},{"label":"Juan 8:47-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (431, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Jeremías 14:1-9","book_usfm":"JER","chapter":14},{"label":"Jeremías 14:17-22","book_usfm":"JER","chapter":14},{"label":"Gálatas 4:21-5:1","book_usfm":"GAL","chapter":4,"chapter_end":5},{"label":"Marcos 8:11-21","book_usfm":"MRK","chapter":8}]'::jsonb),
  (432, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Jeremías 16:10-21","book_usfm":"JER","chapter":16},{"label":"Romanos 7:1-12","book_usfm":"ROM","chapter":7},{"label":"Juan 6:1-15","book_usfm":"JHN","chapter":6}]'::jsonb),
  (433, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Jeremías 17:19-27","book_usfm":"JER","chapter":17},{"label":"Romanos 7:13-25","book_usfm":"ROM","chapter":7},{"label":"Juan 6:16-27","book_usfm":"JHN","chapter":6}]'::jsonb),
  (434, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Jeremías 18:1-11","book_usfm":"JER","chapter":18},{"label":"Romanos 8:1-11","book_usfm":"ROM","chapter":8},{"label":"Juan 6:27-40","book_usfm":"JHN","chapter":6}]'::jsonb),
  (435, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Jeremías 22:13-23","book_usfm":"JER","chapter":22},{"label":"Romanos 8:12-27","book_usfm":"ROM","chapter":8},{"label":"Juan 6:41-51","book_usfm":"JHN","chapter":6}]'::jsonb),
  (436, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Jeremías 23:1-8","book_usfm":"JER","chapter":23},{"label":"Romanos 8:28-39","book_usfm":"ROM","chapter":8},{"label":"Juan 6:52-59","book_usfm":"JHN","chapter":6}]'::jsonb),
  (437, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Jeremías 23:9-15","book_usfm":"JER","chapter":23},{"label":"Romanos 9:1-18","book_usfm":"ROM","chapter":9},{"label":"Juan 6:60-71","book_usfm":"JHN","chapter":6}]'::jsonb),
  (438, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Jeremías 23:16-32","book_usfm":"JER","chapter":23},{"label":"1 Corintios 9:19-27","book_usfm":"1CO","chapter":9},{"label":"Marcos 8:31-9:1","book_usfm":"MRK","chapter":8,"chapter_end":9}]'::jsonb),
  (439, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Jeremías 24","book_usfm":"JER","chapter":24},{"label":"Romanos 9:19-33","book_usfm":"ROM","chapter":9},{"label":"Juan 9:1-17","book_usfm":"JHN","chapter":9}]'::jsonb),
  (440, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Jeremías 25:8-17","book_usfm":"JER","chapter":25},{"label":"Romanos 10:1-13","book_usfm":"ROM","chapter":10},{"label":"Juan 9:18-41","book_usfm":"JHN","chapter":9}]'::jsonb),
  (441, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Jeremías 25:30-38","book_usfm":"JER","chapter":25},{"label":"Romanos 10:14-21","book_usfm":"ROM","chapter":10},{"label":"Juan 10:1-18","book_usfm":"JHN","chapter":10}]'::jsonb),
  (442, '[{"label":"Salmos 131-133","book_usfm":"PSA","chapter":131,"chapter_end":133},{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Jeremías 26:1-16","book_usfm":"JER","chapter":26},{"label":"Romanos 11:1-12","book_usfm":"ROM","chapter":11},{"label":"Juan 10:19-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (443, '[{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Isaías 63:7-16","book_usfm":"ISA","chapter":63},{"label":"Mateo 1:18-25","book_usfm":"MAT","chapter":1},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3}]'::jsonb),
  (444, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Jeremías 31:27-34","book_usfm":"JER","chapter":31},{"label":"Romanos 11:25-36","book_usfm":"ROM","chapter":11},{"label":"Juan 11:28-44","book_usfm":"JHN","chapter":11},{"label":"Juan 12:37-50","book_usfm":"JHN","chapter":12}]'::jsonb),
  (445, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Zacarías 9:9-12","book_usfm":"ZEC","chapter":9},{"label":"Zacarías 12:9-11","book_usfm":"ZEC","chapter":12},{"label":"Zacarías 13:1","book_usfm":"ZEC","chapter":13},{"label":"Zacarías 13:7-9","book_usfm":"ZEC","chapter":13},{"label":"1 Timoteo 6:12-16","book_usfm":"1TI","chapter":6},{"label":"Mateo 21:12-17","book_usfm":"MAT","chapter":21}]'::jsonb),
  (446, '[{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Salmos 69:1-23","book_usfm":"PSA","chapter":69},{"label":"Jeremías 12:1-16","book_usfm":"JER","chapter":12},{"label":"Filipenses 3:1-14","book_usfm":"PHP","chapter":3},{"label":"Juan 12:9-19","book_usfm":"JHN","chapter":12}]'::jsonb),
  (447, '[{"label":"Salmos 6","book_usfm":"PSA","chapter":6},{"label":"Salmos 12","book_usfm":"PSA","chapter":12},{"label":"Salmos 94","book_usfm":"PSA","chapter":94},{"label":"Jeremías 15:10-21","book_usfm":"JER","chapter":15},{"label":"Filipenses 3:15-21","book_usfm":"PHP","chapter":3},{"label":"Juan 12:20-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (448, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Jeremías 17:5-10","book_usfm":"JER","chapter":17},{"label":"Jeremías 17:14-17","book_usfm":"JER","chapter":17},{"label":"Filipenses 4:1-13","book_usfm":"PHP","chapter":4},{"label":"Juan 12:27-36","book_usfm":"JHN","chapter":12}]'::jsonb),
  (449, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 142-143","book_usfm":"PSA","chapter":142,"chapter_end":143},{"label":"Jeremías 20:7-11","book_usfm":"JER","chapter":20},{"label":"1 Corintios 10:14-17","book_usfm":"1CO","chapter":10},{"label":"1 Corintios 11:27-32","book_usfm":"1CO","chapter":11},{"label":"Juan 17","book_usfm":"JHN","chapter":17}]'::jsonb),
  (450, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Génesis 22:1-14","book_usfm":"GEN","chapter":22},{"label":"1 Pedro 1:10-20","book_usfm":"1PE","chapter":1},{"label":"Juan 13:36-38","book_usfm":"JHN","chapter":13},{"label":"Juan 19:38-42","book_usfm":"JHN","chapter":19}]'::jsonb),
  (451, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Job 19:21-27","book_usfm":"JOB","chapter":19},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4},{"label":"Romanos 8:1-11","book_usfm":"ROM","chapter":8}]'::jsonb),
  (452, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 113-114","book_usfm":"PSA","chapter":113,"chapter_end":114},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Éxodo 12:1-14","book_usfm":"EXO","chapter":12},{"label":"Isaías 51:9-11","book_usfm":"ISA","chapter":51},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1},{"label":"Lucas 24:13-35","book_usfm":"LUK","chapter":24},{"label":"Juan 20:19-23","book_usfm":"JHN","chapter":20}]'::jsonb),
  (453, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Jonás 2:1-9","book_usfm":"JON","chapter":2},{"label":"Hechos 2:14","book_usfm":"ACT","chapter":2},{"label":"Hechos 2:22-32","book_usfm":"ACT","chapter":2},{"label":"Juan 14:1-14","book_usfm":"JHN","chapter":14}]'::jsonb),
  (454, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 114","book_usfm":"PSA","chapter":114},{"label":"Isaías 30:18-21","book_usfm":"ISA","chapter":30},{"label":"Hechos 2:36-47","book_usfm":"ACT","chapter":2},{"label":"Juan 14:15-31","book_usfm":"JHN","chapter":14}]'::jsonb),
  (455, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99","book_usfm":"PSA","chapter":99},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"Miqueas 7:7-15","book_usfm":"MIC","chapter":7},{"label":"Hechos 3:1-10","book_usfm":"ACT","chapter":3},{"label":"Juan 15:1-11","book_usfm":"JHN","chapter":15}]'::jsonb),
  (456, '[{"label":"Salmos 146-149","book_usfm":"PSA","chapter":146,"chapter_end":149},{"label":"Ezequiel 37:1-14","book_usfm":"EZK","chapter":37},{"label":"Hechos 3:11-26","book_usfm":"ACT","chapter":3},{"label":"Juan 15:12-27","book_usfm":"JHN","chapter":15}]'::jsonb),
  (457, '[{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Daniel 12:1-4","book_usfm":"DAN","chapter":12},{"label":"Daniel 12:13","book_usfm":"DAN","chapter":12},{"label":"Hechos 4:1-12","book_usfm":"ACT","chapter":4},{"label":"Juan 16:1-15","book_usfm":"JHN","chapter":16}]'::jsonb),
  (458, '[{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Isaías 25:1-9","book_usfm":"ISA","chapter":25},{"label":"Hechos 4:13-31","book_usfm":"ACT","chapter":4},{"label":"Juan 16:16-33","book_usfm":"JHN","chapter":16}]'::jsonb),
  (459, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Isaías 43:8-13","book_usfm":"ISA","chapter":43},{"label":"1 Pedro 2:2-10","book_usfm":"1PE","chapter":2},{"label":"Juan 14:1-7","book_usfm":"JHN","chapter":14}]'::jsonb),
  (460, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Daniel 1","book_usfm":"DAN","chapter":1},{"label":"1 Juan 1","book_usfm":"1JN","chapter":1},{"label":"Juan 17:1-11","book_usfm":"JHN","chapter":17}]'::jsonb),
  (461, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Daniel 2:1-16","book_usfm":"DAN","chapter":2},{"label":"1 Juan 2:1-11","book_usfm":"1JN","chapter":2},{"label":"Juan 17:12-19","book_usfm":"JHN","chapter":17}]'::jsonb),
  (462, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Daniel 2:17-30","book_usfm":"DAN","chapter":2},{"label":"1 Juan 2:12-17","book_usfm":"1JN","chapter":2},{"label":"Juan 17:20-26","book_usfm":"JHN","chapter":17}]'::jsonb),
  (463, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Daniel 2:31-49","book_usfm":"DAN","chapter":2},{"label":"1 Juan 2:18-29","book_usfm":"1JN","chapter":2},{"label":"Lucas 3:1-14","book_usfm":"LUK","chapter":3}]'::jsonb),
  (464, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 134-135","book_usfm":"PSA","chapter":134,"chapter_end":135},{"label":"Daniel 3:1-18","book_usfm":"DAN","chapter":3},{"label":"1 Juan 3:1-10","book_usfm":"1JN","chapter":3},{"label":"Lucas 3:15-22","book_usfm":"LUK","chapter":3}]'::jsonb),
  (465, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Daniel 3:19-30","book_usfm":"DAN","chapter":3},{"label":"1 Juan 3:11-18","book_usfm":"1JN","chapter":3},{"label":"Lucas 4:1-13","book_usfm":"LUK","chapter":4}]'::jsonb),
  (466, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Daniel 4:1-18","book_usfm":"DAN","chapter":4},{"label":"1 Pedro 4:7-11","book_usfm":"1PE","chapter":4},{"label":"Juan 21:15-25","book_usfm":"JHN","chapter":21}]'::jsonb),
  (467, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Daniel 4:19-27","book_usfm":"DAN","chapter":4},{"label":"1 Juan 3:19-4:6","book_usfm":"1JN","chapter":3,"chapter_end":4},{"label":"Lucas 4:14-30","book_usfm":"LUK","chapter":4}]'::jsonb),
  (468, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Daniel 4:28-37","book_usfm":"DAN","chapter":4},{"label":"1 Juan 4:7-21","book_usfm":"1JN","chapter":4},{"label":"Lucas 4:31-37","book_usfm":"LUK","chapter":4}]'::jsonb),
  (469, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Daniel 5:1-12","book_usfm":"DAN","chapter":5},{"label":"1 Juan 5:1-12","book_usfm":"1JN","chapter":5},{"label":"Lucas 4:38-44","book_usfm":"LUK","chapter":4}]'::jsonb),
  (470, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Daniel 5:13-30","book_usfm":"DAN","chapter":5},{"label":"1 Juan 5:13-21","book_usfm":"1JN","chapter":5},{"label":"Lucas 5:1-11","book_usfm":"LUK","chapter":5}]'::jsonb),
  (471, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Daniel 6:1-15","book_usfm":"DAN","chapter":6},{"label":"2 Juan","book_usfm":"2JN","chapter":1},{"label":"Lucas 5:12-26","book_usfm":"LUK","chapter":5}]'::jsonb),
  (472, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Daniel 6:16-28","book_usfm":"DAN","chapter":6},{"label":"3 Juan","book_usfm":"3JN","chapter":1},{"label":"Lucas 5:27-39","book_usfm":"LUK","chapter":5}]'::jsonb),
  (473, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"1 Pedro 5:1-11","book_usfm":"1PE","chapter":5},{"label":"Mateo 7:15-29","book_usfm":"MAT","chapter":7}]'::jsonb),
  (474, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Colosenses 1:1-14","book_usfm":"COL","chapter":1},{"label":"Lucas 6:1-11","book_usfm":"LUK","chapter":6}]'::jsonb),
  (475, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Colosenses 1:15-23","book_usfm":"COL","chapter":1},{"label":"Lucas 6:12-26","book_usfm":"LUK","chapter":6}]'::jsonb),
  (476, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Colosenses 1:24-2:7","book_usfm":"COL","chapter":1,"chapter_end":2},{"label":"Lucas 6:27-38","book_usfm":"LUK","chapter":6}]'::jsonb),
  (477, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Colosenses 2:8-23","book_usfm":"COL","chapter":2},{"label":"Lucas 6:39-49","book_usfm":"LUK","chapter":6}]'::jsonb),
  (478, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Colosenses 3:1-11","book_usfm":"COL","chapter":3},{"label":"Lucas 7:1-17","book_usfm":"LUK","chapter":7}]'::jsonb),
  (479, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Colosenses 3:12-17","book_usfm":"COL","chapter":3},{"label":"Lucas 7:18-35","book_usfm":"LUK","chapter":7}]'::jsonb),
  (480, '[{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Hechos 12:25-13:3","book_usfm":"ACT","chapter":12,"chapter_end":13},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"2 Timoteo 4:1-11","book_usfm":"2TI","chapter":4}]'::jsonb),
  (481, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Colosenses 3:18-4","book_usfm":"COL","chapter":3},{"label":"Lucas 7:36-50","book_usfm":"LUK","chapter":7}]'::jsonb),
  (482, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Romanos 12","book_usfm":"ROM","chapter":12},{"label":"Lucas 8:1-15","book_usfm":"LUK","chapter":8}]'::jsonb),
  (483, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Romanos 13","book_usfm":"ROM","chapter":13},{"label":"Lucas 8:16-25","book_usfm":"LUK","chapter":8}]'::jsonb),
  (484, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Romanos 14:1-12","book_usfm":"ROM","chapter":14},{"label":"Lucas 8:26-39","book_usfm":"LUK","chapter":8}]'::jsonb),
  (485, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Romanos 14:13-23","book_usfm":"ROM","chapter":14},{"label":"Lucas 8:40-56","book_usfm":"LUK","chapter":8}]'::jsonb),
  (486, '[{"label":"Salmos 119:137-160","book_usfm":"PSA","chapter":119},{"label":"Job 23:1-12","book_usfm":"JOB","chapter":23},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1},{"label":"Salmos 139","book_usfm":"PSA","chapter":139},{"label":"Juan 12:20-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (487, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"1 Timoteo 3:14-4:5","book_usfm":"1TI","chapter":3,"chapter_end":4},{"label":"Mateo 13:24-34","book_usfm":"MAT","chapter":13}]'::jsonb),
  (488, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Deuteronomio 8:1-10","book_usfm":"DEU","chapter":8},{"label":"Santiago 1:1-15","book_usfm":"JAS","chapter":1},{"label":"Lucas 9:18-27","book_usfm":"LUK","chapter":9}]'::jsonb),
  (489, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Deuteronomio 8:11-20","book_usfm":"DEU","chapter":8},{"label":"Santiago 1:16-27","book_usfm":"JAS","chapter":1},{"label":"Lucas 11:1-13","book_usfm":"LUK","chapter":11}]'::jsonb),
  (490, '[{"label":"Salmos 68:1-20","book_usfm":"PSA","chapter":68},{"label":"2 Reyes 2:1-15","book_usfm":"2KI","chapter":2},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5}]'::jsonb),
  (491, '[{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 47","book_usfm":"PSA","chapter":47},{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Ezequiel 1:1-14","book_usfm":"EZK","chapter":1},{"label":"Ezequiel 1:24-28","book_usfm":"EZK","chapter":1},{"label":"Hebreos 2:5-18","book_usfm":"HEB","chapter":2},{"label":"Mateo 28:16-20","book_usfm":"MAT","chapter":28}]'::jsonb),
  (492, '[{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Ezequiel 1:28-3:3","book_usfm":"EZK","chapter":1,"chapter_end":3},{"label":"Hebreos 4:14-5:6","book_usfm":"HEB","chapter":4,"chapter_end":5},{"label":"Lucas 9:28-36","book_usfm":"LUK","chapter":9}]'::jsonb),
  (493, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Ezequiel 3:4-17","book_usfm":"EZK","chapter":3},{"label":"Hebreos 5:7-14","book_usfm":"HEB","chapter":5},{"label":"Lucas 9:37-50","book_usfm":"LUK","chapter":9}]'::jsonb),
  (494, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Ezequiel 3:16-27","book_usfm":"EZK","chapter":3},{"label":"Efesios 2:1-10","book_usfm":"EPH","chapter":2},{"label":"Mateo 10:24-33","book_usfm":"MAT","chapter":10},{"label":"Mateo 10:40-42","book_usfm":"MAT","chapter":10}]'::jsonb),
  (495, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Ezequiel 4","book_usfm":"EZK","chapter":4},{"label":"Hebreos 6:1-12","book_usfm":"HEB","chapter":6},{"label":"Lucas 9:51-62","book_usfm":"LUK","chapter":9}]'::jsonb),
  (496, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Ezequiel 7:10-15","book_usfm":"EZK","chapter":7},{"label":"Ezequiel 7:23-27","book_usfm":"EZK","chapter":7},{"label":"Hebreos 6:13-20","book_usfm":"HEB","chapter":6},{"label":"Lucas 10:1-17","book_usfm":"LUK","chapter":10}]'::jsonb),
  (497, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Ezequiel 11:14-25","book_usfm":"EZK","chapter":11},{"label":"Hebreos 7:1-17","book_usfm":"HEB","chapter":7},{"label":"Lucas 10:17-24","book_usfm":"LUK","chapter":10}]'::jsonb),
  (498, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Ezequiel 18:1-4","book_usfm":"EZK","chapter":18},{"label":"Ezequiel 18:19-32","book_usfm":"EZK","chapter":18},{"label":"Hebreos 7:18-28","book_usfm":"HEB","chapter":7},{"label":"Lucas 10:25-37","book_usfm":"LUK","chapter":10}]'::jsonb),
  (499, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Ezequiel 34:17-31","book_usfm":"EZK","chapter":34},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8},{"label":"Lucas 10:38-42","book_usfm":"LUK","chapter":10}]'::jsonb),
  (500, '[{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Éxodo 19:3-8","book_usfm":"EXO","chapter":19},{"label":"Éxodo 19:16-20","book_usfm":"EXO","chapter":19},{"label":"1 Pedro 2:4-10","book_usfm":"1PE","chapter":2}]'::jsonb),
  (501, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Isaías 11:1-9","book_usfm":"ISA","chapter":11},{"label":"1 Corintios 2:1-13","book_usfm":"1CO","chapter":2},{"label":"Juan 14:21-29","book_usfm":"JHN","chapter":14}]'::jsonb),
  (502, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Rut 1:1-18","book_usfm":"RUT","chapter":1},{"label":"1 Timoteo 1:1-17","book_usfm":"1TI","chapter":1},{"label":"Lucas 13:1-9","book_usfm":"LUK","chapter":13}]'::jsonb),
  (503, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Rut 1:19-2:13","book_usfm":"RUT","chapter":1,"chapter_end":2},{"label":"1 Timoteo 1:18-2:8","book_usfm":"1TI","chapter":1,"chapter_end":2},{"label":"Lucas 13:10-17","book_usfm":"LUK","chapter":13}]'::jsonb),
  (504, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Rut 2:14-23","book_usfm":"RUT","chapter":2},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3},{"label":"Lucas 13:18-30","book_usfm":"LUK","chapter":13}]'::jsonb),
  (505, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Rut 3","book_usfm":"RUT","chapter":3},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4},{"label":"Lucas 13:31-35","book_usfm":"LUK","chapter":13}]'::jsonb),
  (506, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Rut 4:1-17","book_usfm":"RUT","chapter":4},{"label":"1 Timoteo 5:17-25","book_usfm":"1TI","chapter":5},{"label":"Lucas 14:1-11","book_usfm":"LUK","chapter":14}]'::jsonb),
  (507, '[{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3}]'::jsonb),
  (508, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Efesios 4:1-16","book_usfm":"EPH","chapter":4},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1}]'::jsonb),
  (509, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Deuteronomio 4:9-14","book_usfm":"DEU","chapter":4},{"label":"2 Corintios 1:1-11","book_usfm":"2CO","chapter":1},{"label":"Lucas 14:25-35","book_usfm":"LUK","chapter":14}]'::jsonb),
  (510, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Deuteronomio 4:15-24","book_usfm":"DEU","chapter":4},{"label":"2 Corintios 1:12-22","book_usfm":"2CO","chapter":1},{"label":"Lucas 15:1-10","book_usfm":"LUK","chapter":15}]'::jsonb),
  (511, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Deuteronomio 4:25-31","book_usfm":"DEU","chapter":4},{"label":"2 Corintios 1:23-2:17","book_usfm":"2CO","chapter":1,"chapter_end":2},{"label":"Lucas 15:1-2","book_usfm":"LUK","chapter":15},{"label":"Lucas 15:11-32","book_usfm":"LUK","chapter":15}]'::jsonb),
  (512, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Deuteronomio 4:32-40","book_usfm":"DEU","chapter":4},{"label":"2 Corintios 3","book_usfm":"2CO","chapter":3},{"label":"Lucas 16:1-9","book_usfm":"LUK","chapter":16}]'::jsonb),
  (513, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Deuteronomio 5:1-22","book_usfm":"DEU","chapter":5},{"label":"2 Corintios 4:1-12","book_usfm":"2CO","chapter":4},{"label":"Lucas 16:10-18","book_usfm":"LUK","chapter":16}]'::jsonb),
  (514, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Deuteronomio 5:22-33","book_usfm":"DEU","chapter":5},{"label":"2 Corintios 4:13-5:10","book_usfm":"2CO","chapter":4,"chapter_end":5},{"label":"Lucas 16:19-31","book_usfm":"LUK","chapter":16}]'::jsonb),
  (515, '[{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Isaías 11:1-10","book_usfm":"ISA","chapter":11},{"label":"Hebreos 2:11-18","book_usfm":"HEB","chapter":2}]'::jsonb),
  (516, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"1 Samuel 1:1-20","book_usfm":"1SA","chapter":1},{"label":"Hebreos 3:1-6","book_usfm":"HEB","chapter":3},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Juan 3:25-30","book_usfm":"JHN","chapter":3}]'::jsonb),
  (517, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Deuteronomio 12:1-12","book_usfm":"DEU","chapter":12},{"label":"2 Corintios 6:3-7:1","book_usfm":"2CO","chapter":6,"chapter_end":7},{"label":"Lucas 17:11-19","book_usfm":"LUK","chapter":17}]'::jsonb),
  (518, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Deuteronomio 13:1-11","book_usfm":"DEU","chapter":13},{"label":"2 Corintios 7:2-16","book_usfm":"2CO","chapter":7},{"label":"Lucas 17:20-37","book_usfm":"LUK","chapter":17}]'::jsonb),
  (519, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Deuteronomio 16:18-20","book_usfm":"DEU","chapter":16},{"label":"Deuteronomio 17:14-20","book_usfm":"DEU","chapter":17},{"label":"2 Corintios 8:1-16","book_usfm":"2CO","chapter":8},{"label":"Lucas 18:1-8","book_usfm":"LUK","chapter":18}]'::jsonb),
  (520, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Deuteronomio 26:1-11","book_usfm":"DEU","chapter":26},{"label":"2 Corintios 8:16-24","book_usfm":"2CO","chapter":8},{"label":"Lucas 18:9-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (521, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Deuteronomio 29:2-15","book_usfm":"DEU","chapter":29},{"label":"2 Corintios 9","book_usfm":"2CO","chapter":9},{"label":"Lucas 18:15-30","book_usfm":"LUK","chapter":18}]'::jsonb),
  (522, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Deuteronomio 29:16-29","book_usfm":"DEU","chapter":29},{"label":"Apocalipsis 12:1-12","book_usfm":"REV","chapter":12},{"label":"Mateo 15:29-39","book_usfm":"MAT","chapter":15}]'::jsonb),
  (523, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Deuteronomio 30:1-10","book_usfm":"DEU","chapter":30},{"label":"2 Corintios 10","book_usfm":"2CO","chapter":10},{"label":"Lucas 18:31-43","book_usfm":"LUK","chapter":18}]'::jsonb),
  (524, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Deuteronomio 30:11-20","book_usfm":"DEU","chapter":30},{"label":"2 Corintios 11:1-21","book_usfm":"2CO","chapter":11},{"label":"Lucas 19:1-10","book_usfm":"LUK","chapter":19}]'::jsonb),
  (525, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Deuteronomio 31:30-32:14","book_usfm":"DEU","chapter":31,"chapter_end":32},{"label":"2 Corintios 11:21-33","book_usfm":"2CO","chapter":11},{"label":"Lucas 19:11-27","book_usfm":"LUK","chapter":19}]'::jsonb),
  (526, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"2 Corintios 12:1-10","book_usfm":"2CO","chapter":12},{"label":"Lucas 19:28-40","book_usfm":"LUK","chapter":19}]'::jsonb),
  (527, '[{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Hechos 4:32-37","book_usfm":"ACT","chapter":4},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 146","book_usfm":"PSA","chapter":146},{"label":"Hechos 9:26-31","book_usfm":"ACT","chapter":9}]'::jsonb),
  (528, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"2 Corintios 13","book_usfm":"2CO","chapter":13},{"label":"Lucas 20:1-8","book_usfm":"LUK","chapter":20}]'::jsonb),
  (529, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15},{"label":"Mateo 18:1-14","book_usfm":"MAT","chapter":18}]'::jsonb),
  (530, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"1 Samuel 1:1-20","book_usfm":"1SA","chapter":1},{"label":"Hechos 1:1-14","book_usfm":"ACT","chapter":1},{"label":"Lucas 20:9-19","book_usfm":"LUK","chapter":20}]'::jsonb),
  (531, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"1 Samuel 1:21-2:11","book_usfm":"1SA","chapter":1,"chapter_end":2},{"label":"Hechos 1:15-26","book_usfm":"ACT","chapter":1},{"label":"Lucas 20:19-26","book_usfm":"LUK","chapter":20}]'::jsonb),
  (532, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"1 Samuel 2:12-26","book_usfm":"1SA","chapter":2},{"label":"Hechos 2:1-21","book_usfm":"ACT","chapter":2},{"label":"Lucas 20:27-40","book_usfm":"LUK","chapter":20}]'::jsonb),
  (533, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"1 Samuel 2:27-36","book_usfm":"1SA","chapter":2},{"label":"Hechos 2:22-36","book_usfm":"ACT","chapter":2},{"label":"Lucas 20:41-21:4","book_usfm":"LUK","chapter":20,"chapter_end":21}]'::jsonb),
  (534, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"1 Samuel 3","book_usfm":"1SA","chapter":3},{"label":"Hechos 2:37-47","book_usfm":"ACT","chapter":2},{"label":"Lucas 21:5-19","book_usfm":"LUK","chapter":21}]'::jsonb),
  (535, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"1 Samuel 4:1-11","book_usfm":"1SA","chapter":4},{"label":"Hechos 4:32-5:11","book_usfm":"ACT","chapter":4,"chapter_end":5},{"label":"Lucas 21:20-28","book_usfm":"LUK","chapter":21}]'::jsonb),
  (536, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"1 Samuel 4:12-22","book_usfm":"1SA","chapter":4},{"label":"Santiago 1:1-18","book_usfm":"JAS","chapter":1},{"label":"Mateo 19:23-30","book_usfm":"MAT","chapter":19}]'::jsonb),
  (537, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"1 Samuel 5","book_usfm":"1SA","chapter":5},{"label":"Hechos 5:12-26","book_usfm":"ACT","chapter":5},{"label":"Lucas 21:29-36","book_usfm":"LUK","chapter":21}]'::jsonb),
  (538, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"1 Samuel 6:1-16","book_usfm":"1SA","chapter":6},{"label":"Hechos 5:27-42","book_usfm":"ACT","chapter":5},{"label":"Lucas 21:37-22:13","book_usfm":"LUK","chapter":21,"chapter_end":22}]'::jsonb),
  (539, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Lucas 1:5-23","book_usfm":"LUK","chapter":1}]'::jsonb),
  (540, '[{"label":"Salmos 82","book_usfm":"PSA","chapter":82},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Malaquías 3:1-5","book_usfm":"MAL","chapter":3},{"label":"Juan 3:22-30","book_usfm":"JHN","chapter":3},{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Mateo 11:2-19","book_usfm":"MAT","chapter":11}]'::jsonb),
  (541, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"1 Samuel 9:1-14","book_usfm":"1SA","chapter":9},{"label":"Hechos 7:17-29","book_usfm":"ACT","chapter":7},{"label":"Lucas 22:31-38","book_usfm":"LUK","chapter":22}]'::jsonb),
  (542, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"1 Samuel 9:15-10:1","book_usfm":"1SA","chapter":9,"chapter_end":10},{"label":"Hechos 7:30-43","book_usfm":"ACT","chapter":7},{"label":"Lucas 22:39-51","book_usfm":"LUK","chapter":22}]'::jsonb),
  (543, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"1 Samuel 10:1-16","book_usfm":"1SA","chapter":10},{"label":"Romanos 4:13-25","book_usfm":"ROM","chapter":4},{"label":"Mateo 21:23-32","book_usfm":"MAT","chapter":21}]'::jsonb),
  (544, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"1 Samuel 10:17-27","book_usfm":"1SA","chapter":10},{"label":"Hechos 7:44-8:1","book_usfm":"ACT","chapter":7,"chapter_end":8},{"label":"Lucas 22:52-62","book_usfm":"LUK","chapter":22}]'::jsonb),
  (545, '[{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Ezequiel 2:1-7","book_usfm":"EZK","chapter":2},{"label":"Hechos 11:1-18","book_usfm":"ACT","chapter":11},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Gálatas 2:1-9","book_usfm":"GAL","chapter":2}]'::jsonb),
  (546, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"1 Samuel 12:1-6","book_usfm":"1SA","chapter":12},{"label":"1 Samuel 12:16-25","book_usfm":"1SA","chapter":12},{"label":"Hechos 8:14-25","book_usfm":"ACT","chapter":8},{"label":"Lucas 23:1-12","book_usfm":"LUK","chapter":23}]'::jsonb),
  (547, '[{"label":"Salmos 131-135","book_usfm":"PSA","chapter":131,"chapter_end":135},{"label":"1 Samuel 13:5-18","book_usfm":"1SA","chapter":13},{"label":"Hechos 8:26-40","book_usfm":"ACT","chapter":8},{"label":"Lucas 23:13-25","book_usfm":"LUK","chapter":23}]'::jsonb),
  (548, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"1 Samuel 13:19-14:15","book_usfm":"1SA","chapter":13,"chapter_end":14},{"label":"Hechos 9:1-9","book_usfm":"ACT","chapter":9},{"label":"Lucas 23:26-31","book_usfm":"LUK","chapter":23}]'::jsonb),
  (549, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"1 Samuel 14:16-30","book_usfm":"1SA","chapter":14},{"label":"Hechos 9:10-19","book_usfm":"ACT","chapter":9},{"label":"Lucas 23:32-43","book_usfm":"LUK","chapter":23}]'::jsonb),
  (550, '[{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Santiago 5:7-10","book_usfm":"JAS","chapter":5},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Apocalipsis 21:1-7","book_usfm":"REV","chapter":21}]'::jsonb),
  (551, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"1 Samuel 15:1-3","book_usfm":"1SA","chapter":15},{"label":"1 Samuel 15:7-23","book_usfm":"1SA","chapter":15},{"label":"Hechos 9:19-31","book_usfm":"ACT","chapter":9},{"label":"Lucas 23:44-56","book_usfm":"LUK","chapter":23}]'::jsonb),
  (552, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"1 Samuel 15:24-35","book_usfm":"1SA","chapter":15},{"label":"Hechos 9:32-43","book_usfm":"ACT","chapter":9},{"label":"Lucas 23:56-24:11","book_usfm":"LUK","chapter":23,"chapter_end":24}]'::jsonb),
  (553, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"1 Samuel 16:1-13","book_usfm":"1SA","chapter":16},{"label":"Hechos 10:1-16","book_usfm":"ACT","chapter":10},{"label":"Lucas 24:12-35","book_usfm":"LUK","chapter":24}]'::jsonb),
  (554, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"1 Samuel 16:14-17:11","book_usfm":"1SA","chapter":16,"chapter_end":17},{"label":"Hechos 10:17-33","book_usfm":"ACT","chapter":10},{"label":"Lucas 24:36-53","book_usfm":"LUK","chapter":24}]'::jsonb),
  (555, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"1 Samuel 17:17-30","book_usfm":"1SA","chapter":17},{"label":"Hechos 10:34-48","book_usfm":"ACT","chapter":10},{"label":"Marcos 1:1-13","book_usfm":"MRK","chapter":1}]'::jsonb),
  (556, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"1 Samuel 17:31-49","book_usfm":"1SA","chapter":17},{"label":"Hechos 11:1-18","book_usfm":"ACT","chapter":11},{"label":"Marcos 1:14-28","book_usfm":"MRK","chapter":1}]'::jsonb),
  (557, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"1 Samuel 17:50-18:4","book_usfm":"1SA","chapter":17,"chapter_end":18},{"label":"Romanos 10:4-17","book_usfm":"ROM","chapter":10},{"label":"Mateo 23:29-39","book_usfm":"MAT","chapter":23}]'::jsonb),
  (558, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"1 Samuel 18:5-16","book_usfm":"1SA","chapter":18},{"label":"1 Samuel 18:27-30","book_usfm":"1SA","chapter":18},{"label":"Hechos 11:19-30","book_usfm":"ACT","chapter":11},{"label":"Marcos 1:29-45","book_usfm":"MRK","chapter":1}]'::jsonb),
  (559, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"1 Samuel 19:1-18","book_usfm":"1SA","chapter":19},{"label":"Hechos 12:1-17","book_usfm":"ACT","chapter":12},{"label":"Marcos 2:1-12","book_usfm":"MRK","chapter":2}]'::jsonb),
  (560, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"1 Samuel 20:1-23","book_usfm":"1SA","chapter":20},{"label":"Hechos 12:18-25","book_usfm":"ACT","chapter":12},{"label":"Marcos 2:13-22","book_usfm":"MRK","chapter":2}]'::jsonb),
  (561, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"1 Samuel 20:24-42","book_usfm":"1SA","chapter":20},{"label":"Hechos 13:1-12","book_usfm":"ACT","chapter":13},{"label":"Marcos 2:23-3:6","book_usfm":"MRK","chapter":2,"chapter_end":3}]'::jsonb),
  (562, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"1 Samuel 21","book_usfm":"1SA","chapter":21},{"label":"Hechos 13:13-25","book_usfm":"ACT","chapter":13},{"label":"Marcos 3:7-19","book_usfm":"MRK","chapter":3}]'::jsonb),
  (563, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"1 Samuel 22","book_usfm":"1SA","chapter":22},{"label":"Hechos 13:26-43","book_usfm":"ACT","chapter":13},{"label":"Marcos 3:19-35","book_usfm":"MRK","chapter":3}]'::jsonb),
  (564, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"1 Samuel 23:7-18","book_usfm":"1SA","chapter":23},{"label":"Romanos 11:33-12:2","book_usfm":"ROM","chapter":11,"chapter_end":12},{"label":"Mateo 25:14-30","book_usfm":"MAT","chapter":25}]'::jsonb),
  (565, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"1 Samuel 24","book_usfm":"1SA","chapter":24},{"label":"Hechos 13:44-52","book_usfm":"ACT","chapter":13},{"label":"Marcos 4:1-20","book_usfm":"MRK","chapter":4}]'::jsonb),
  (566, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"1 Samuel 25:1-22","book_usfm":"1SA","chapter":25},{"label":"Hechos 14:1-18","book_usfm":"ACT","chapter":14},{"label":"Marcos 4:21-34","book_usfm":"MRK","chapter":4}]'::jsonb),
  (567, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"1 Samuel 25:23-44","book_usfm":"1SA","chapter":25},{"label":"Hechos 14:19-28","book_usfm":"ACT","chapter":14},{"label":"Marcos 4:35-41","book_usfm":"MRK","chapter":4}]'::jsonb),
  (568, '[{"label":"Salmos 116","book_usfm":"PSA","chapter":116},{"label":"Sofonías 3:14-20","book_usfm":"ZEP","chapter":3},{"label":"Marcos 15:47-16:7","book_usfm":"MRK","chapter":15,"chapter_end":16},{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 149","book_usfm":"PSA","chapter":149},{"label":"2 Corintios 1:3-7","book_usfm":"2CO","chapter":1}]'::jsonb),
  (569, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"1 Samuel 31","book_usfm":"1SA","chapter":31},{"label":"Hechos 15:12-21","book_usfm":"ACT","chapter":15},{"label":"Marcos 5:21-43","book_usfm":"MRK","chapter":5}]'::jsonb),
  (570, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"2 Samuel 1:1-16","book_usfm":"2SA","chapter":1},{"label":"Hechos 15:22-35","book_usfm":"ACT","chapter":15},{"label":"Marcos 6:1-13","book_usfm":"MRK","chapter":6}]'::jsonb),
  (571, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Jeremías 16:14-21","book_usfm":"JER","chapter":16},{"label":"Marcos 1:14-20","book_usfm":"MRK","chapter":1},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Mateo 10:16-32","book_usfm":"MAT","chapter":10}]'::jsonb),
  (572, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"2 Samuel 2:1-11","book_usfm":"2SA","chapter":2},{"label":"Hechos 15:36-16:5","book_usfm":"ACT","chapter":15,"chapter_end":16},{"label":"Marcos 6:14-29","book_usfm":"MRK","chapter":6}]'::jsonb),
  (573, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"2 Samuel 3:6-21","book_usfm":"2SA","chapter":3},{"label":"Hechos 16:6-15","book_usfm":"ACT","chapter":16},{"label":"Marcos 6:30-46","book_usfm":"MRK","chapter":6}]'::jsonb),
  (574, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"2 Samuel 3:22-39","book_usfm":"2SA","chapter":3},{"label":"Hechos 16:16-24","book_usfm":"ACT","chapter":16},{"label":"Marcos 6:47-56","book_usfm":"MRK","chapter":6}]'::jsonb),
  (575, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"2 Samuel 4","book_usfm":"2SA","chapter":4},{"label":"Hechos 16:25-40","book_usfm":"ACT","chapter":16},{"label":"Marcos 7:1-23","book_usfm":"MRK","chapter":7}]'::jsonb),
  (576, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"2 Samuel 5:1-12","book_usfm":"2SA","chapter":5},{"label":"Hechos 17:1-15","book_usfm":"ACT","chapter":17},{"label":"Marcos 7:24-37","book_usfm":"MRK","chapter":7}]'::jsonb),
  (577, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"2 Samuel 5:22-6:11","book_usfm":"2SA","chapter":5,"chapter_end":6},{"label":"Hechos 17:16-34","book_usfm":"ACT","chapter":17},{"label":"Marcos 8:1-10","book_usfm":"MRK","chapter":8}]'::jsonb),
  (578, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"2 Samuel 6:12-23","book_usfm":"2SA","chapter":6},{"label":"Romanos 14:7-12","book_usfm":"ROM","chapter":14},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (579, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"2 Samuel 7:1-17","book_usfm":"2SA","chapter":7},{"label":"Hechos 18:1-11","book_usfm":"ACT","chapter":18},{"label":"Marcos 8:11-21","book_usfm":"MRK","chapter":8}]'::jsonb),
  (580, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"2 Samuel 7:18-29","book_usfm":"2SA","chapter":7},{"label":"Hechos 18:12-28","book_usfm":"ACT","chapter":18},{"label":"Marcos 8:22-33","book_usfm":"MRK","chapter":8}]'::jsonb),
  (581, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"2 Samuel 9","book_usfm":"2SA","chapter":9},{"label":"Hechos 19:1-10","book_usfm":"ACT","chapter":19},{"label":"Marcos 8:34-9:1","book_usfm":"MRK","chapter":8,"chapter_end":9}]'::jsonb),
  (582, '[{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"1 Reyes 19:1-12","book_usfm":"1KI","chapter":19},{"label":"2 Corintios 3:1-9","book_usfm":"2CO","chapter":3},{"label":"2 Corintios 3:18","book_usfm":"2CO","chapter":3}]'::jsonb),
  (583, '[{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Éxodo 24:12-18","book_usfm":"EXO","chapter":24},{"label":"2 Corintios 4:1-6","book_usfm":"2CO","chapter":4},{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Juan 12:27-36","book_usfm":"JHN","chapter":12}]'::jsonb),
  (584, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"2 Samuel 12:15-31","book_usfm":"2SA","chapter":12},{"label":"Hechos 20:1-16","book_usfm":"ACT","chapter":20},{"label":"Marcos 9:30-41","book_usfm":"MRK","chapter":9}]'::jsonb),
  (585, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"2 Samuel 13:1-22","book_usfm":"2SA","chapter":13},{"label":"Romanos 15:1-13","book_usfm":"ROM","chapter":15},{"label":"Juan 3:22-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (586, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"2 Samuel 13:23-39","book_usfm":"2SA","chapter":13},{"label":"Hechos 20:17-38","book_usfm":"ACT","chapter":20},{"label":"Marcos 9:42-50","book_usfm":"MRK","chapter":9}]'::jsonb),
  (587, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"2 Samuel 14:1-20","book_usfm":"2SA","chapter":14},{"label":"Hechos 21:1-14","book_usfm":"ACT","chapter":21},{"label":"Marcos 10:1-16","book_usfm":"MRK","chapter":10}]'::jsonb),
  (588, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"2 Samuel 14:21-33","book_usfm":"2SA","chapter":14},{"label":"Hechos 21:15-26","book_usfm":"ACT","chapter":21},{"label":"Marcos 10:17-31","book_usfm":"MRK","chapter":10}]'::jsonb),
  (589, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"2 Samuel 15:1-18","book_usfm":"2SA","chapter":15},{"label":"Hechos 21:27-36","book_usfm":"ACT","chapter":21},{"label":"Marcos 10:32-45","book_usfm":"MRK","chapter":10}]'::jsonb),
  (590, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"2 Samuel 15:19-37","book_usfm":"2SA","chapter":15},{"label":"Hechos 21:37-22:16","book_usfm":"ACT","chapter":21,"chapter_end":22},{"label":"Marcos 10:46-52","book_usfm":"MRK","chapter":10}]'::jsonb),
  (591, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"2 Samuel 16","book_usfm":"2SA","chapter":16},{"label":"Hechos 22:17-29","book_usfm":"ACT","chapter":22},{"label":"Marcos 11:1-11","book_usfm":"MRK","chapter":11}]'::jsonb),
  (592, '[{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"1 Samuel 2:1-10","book_usfm":"1SA","chapter":2},{"label":"Juan 2:1-12","book_usfm":"JHN","chapter":2},{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Salmos 149","book_usfm":"PSA","chapter":149},{"label":"Juan 19:23-27","book_usfm":"JHN","chapter":19}]'::jsonb),
  (593, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"2 Samuel 17:24-18:8","book_usfm":"2SA","chapter":17,"chapter_end":18},{"label":"Hechos 22:30-23:11","book_usfm":"ACT","chapter":22,"chapter_end":23},{"label":"Marcos 11:12-26","book_usfm":"MRK","chapter":11}]'::jsonb),
  (594, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"2 Samuel 18:9-18","book_usfm":"2SA","chapter":18},{"label":"Hechos 23:12-24","book_usfm":"ACT","chapter":23},{"label":"Marcos 11:27-12:12","book_usfm":"MRK","chapter":11,"chapter_end":12}]'::jsonb),
  (595, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"2 Samuel 18:19-23","book_usfm":"2SA","chapter":18},{"label":"Hechos 23:23-35","book_usfm":"ACT","chapter":23},{"label":"Marcos 12:13-27","book_usfm":"MRK","chapter":12}]'::jsonb),
  (596, '[{"label":"Salmos 131-135","book_usfm":"PSA","chapter":131,"chapter_end":135},{"label":"2 Samuel 19:1-23","book_usfm":"2SA","chapter":19},{"label":"Hechos 24:1-23","book_usfm":"ACT","chapter":24},{"label":"Marcos 12:28-34","book_usfm":"MRK","chapter":12}]'::jsonb),
  (597, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"2 Samuel 19:24-43","book_usfm":"2SA","chapter":19},{"label":"Hechos 24:24-25:12","book_usfm":"ACT","chapter":24,"chapter_end":25},{"label":"Marcos 12:35-44","book_usfm":"MRK","chapter":12}]'::jsonb),
  (598, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"2 Samuel 23:1-7","book_usfm":"2SA","chapter":23},{"label":"2 Samuel 23:13-17","book_usfm":"2SA","chapter":23},{"label":"Hechos 25:13-27","book_usfm":"ACT","chapter":25},{"label":"Marcos 13:1-13","book_usfm":"MRK","chapter":13}]'::jsonb),
  (599, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"2 Samuel 24:1-2","book_usfm":"2SA","chapter":24},{"label":"2 Samuel 24:10-25","book_usfm":"2SA","chapter":24},{"label":"Gálatas 3:23-4:7","book_usfm":"GAL","chapter":3,"chapter_end":4},{"label":"Juan 8:12-20","book_usfm":"JHN","chapter":8}]'::jsonb),
  (600, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"1 Reyes 1:5-31","book_usfm":"1KI","chapter":1},{"label":"Hechos 26:1-23","book_usfm":"ACT","chapter":26},{"label":"Marcos 13:14-27","book_usfm":"MRK","chapter":13}]'::jsonb),
  (601, '[{"label":"Salmos 86","book_usfm":"PSA","chapter":86},{"label":"Génesis 28:10-17","book_usfm":"GEN","chapter":28},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"1 Pedro 5:1-11","book_usfm":"1PE","chapter":5}]'::jsonb),
  (602, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"1 Reyes 3:1-15","book_usfm":"1KI","chapter":3},{"label":"Hechos 27:9-26","book_usfm":"ACT","chapter":27},{"label":"Marcos 14:1-11","book_usfm":"MRK","chapter":14}]'::jsonb),
  (603, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"1 Reyes 3:16-28","book_usfm":"1KI","chapter":3},{"label":"Hechos 27:27-44","book_usfm":"ACT","chapter":27},{"label":"Marcos 14:12-26","book_usfm":"MRK","chapter":14}]'::jsonb),
  (604, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"1 Reyes 5:1-6","book_usfm":"1KI","chapter":5},{"label":"1 Reyes 6:7","book_usfm":"1KI","chapter":6},{"label":"Hechos 28:1-16","book_usfm":"ACT","chapter":28},{"label":"Marcos 14:27-42","book_usfm":"MRK","chapter":14}]'::jsonb),
  (605, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"1 Reyes 7:51-8:21","book_usfm":"1KI","chapter":7,"chapter_end":8},{"label":"Hechos 28:17-31","book_usfm":"ACT","chapter":28},{"label":"Marcos 14:43-52","book_usfm":"MRK","chapter":14}]'::jsonb),
  (606, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"1 Reyes 8:22-40","book_usfm":"1KI","chapter":8},{"label":"1 Timoteo 4:7-16","book_usfm":"1TI","chapter":4},{"label":"Juan 8:47-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (607, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"2 Crónicas 6:32-7:7","book_usfm":"2CH","chapter":6,"chapter_end":7},{"label":"Santiago 2:1-13","book_usfm":"JAS","chapter":2},{"label":"Marcos 14:53-65","book_usfm":"MRK","chapter":14}]'::jsonb),
  (608, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"1 Reyes 8:65-9:9","book_usfm":"1KI","chapter":8,"chapter_end":9},{"label":"Santiago 2:14-26","book_usfm":"JAS","chapter":2},{"label":"Marcos 14:66-72","book_usfm":"MRK","chapter":14}]'::jsonb),
  (609, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"1 Reyes 9:24-10:13","book_usfm":"1KI","chapter":9,"chapter_end":10},{"label":"Santiago 3:1-12","book_usfm":"JAS","chapter":3},{"label":"Marcos 15:1-11","book_usfm":"MRK","chapter":15}]'::jsonb),
  (610, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"1 Reyes 11:1-13","book_usfm":"1KI","chapter":11},{"label":"Santiago 3:13-4:12","book_usfm":"JAS","chapter":3,"chapter_end":4},{"label":"Marcos 15:12-21","book_usfm":"MRK","chapter":15}]'::jsonb),
  (611, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"1 Reyes 11:26-43","book_usfm":"1KI","chapter":11},{"label":"Santiago 4:13-5:6","book_usfm":"JAS","chapter":4,"chapter_end":5},{"label":"Marcos 15:22-32","book_usfm":"MRK","chapter":15}]'::jsonb),
  (612, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"1 Reyes 12:1-20","book_usfm":"1KI","chapter":12},{"label":"Santiago 5:7-12","book_usfm":"JAS","chapter":5},{"label":"Santiago 5:19-20","book_usfm":"JAS","chapter":5},{"label":"Marcos 15:33-39","book_usfm":"MRK","chapter":15}]'::jsonb),
  (613, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"1 Reyes 12:21-33","book_usfm":"1KI","chapter":12},{"label":"Hechos 4:18-31","book_usfm":"ACT","chapter":4},{"label":"Juan 10:31-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (614, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"1 Reyes 13:1-10","book_usfm":"1KI","chapter":13},{"label":"Filipenses 1:1-11","book_usfm":"PHP","chapter":1},{"label":"Marcos 15:40-47","book_usfm":"MRK","chapter":15}]'::jsonb),
  (615, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"1 Reyes 16:23-34","book_usfm":"1KI","chapter":16},{"label":"Filipenses 1:12-30","book_usfm":"PHP","chapter":1},{"label":"Marcos 16","book_usfm":"MRK","chapter":16}]'::jsonb),
  (616, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"1 Reyes 17","book_usfm":"1KI","chapter":17},{"label":"Filipenses 2:1-11","book_usfm":"PHP","chapter":2},{"label":"Mateo 2:1-12","book_usfm":"MAT","chapter":2}]'::jsonb),
  (617, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"1 Reyes 18:1-19","book_usfm":"1KI","chapter":18},{"label":"Filipenses 2:12-30","book_usfm":"PHP","chapter":2},{"label":"Mateo 2:13-23","book_usfm":"MAT","chapter":2}]'::jsonb),
  (618, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"1 Reyes 18:20-40","book_usfm":"1KI","chapter":18},{"label":"Filipenses 3:1-16","book_usfm":"PHP","chapter":3},{"label":"Mateo 3:1-12","book_usfm":"MAT","chapter":3}]'::jsonb),
  (619, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"1 Reyes 18:41-19:8","book_usfm":"1KI","chapter":18,"chapter_end":19},{"label":"Filipenses 3:17-4:7","book_usfm":"PHP","chapter":3,"chapter_end":4},{"label":"Mateo 3:13-17","book_usfm":"MAT","chapter":3}]'::jsonb),
  (620, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"1 Reyes 19:8-21","book_usfm":"1KI","chapter":19},{"label":"Hechos 5:34-42","book_usfm":"ACT","chapter":5},{"label":"Juan 11:45-47","book_usfm":"JHN","chapter":11}]'::jsonb),
  (621, '[{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"1 Reyes 8:22-30","book_usfm":"1KI","chapter":8},{"label":"Efesios 2:11-22","book_usfm":"EPH","chapter":2}]'::jsonb),
  (622, '[{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Números 21:4-9","book_usfm":"NUM","chapter":21},{"label":"Juan 3:11-17","book_usfm":"JHN","chapter":3},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"1 Pedro 3:17-22","book_usfm":"1PE","chapter":3}]'::jsonb),
  (623, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"1 Reyes 22:1-28","book_usfm":"1KI","chapter":22},{"label":"1 Corintios 2:1-13","book_usfm":"1CO","chapter":2},{"label":"Mateo 4:18-25","book_usfm":"MAT","chapter":4}]'::jsonb),
  (624, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"1 Reyes 22:29-45","book_usfm":"1KI","chapter":22},{"label":"1 Corintios 2:14-3:15","book_usfm":"1CO","chapter":2,"chapter_end":3},{"label":"Mateo 5:1-10","book_usfm":"MAT","chapter":5}]'::jsonb),
  (625, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"2 Reyes 1:2-17","book_usfm":"2KI","chapter":1},{"label":"1 Corintios 3:16-23","book_usfm":"1CO","chapter":3},{"label":"Mateo 5:11-16","book_usfm":"MAT","chapter":5}]'::jsonb),
  (626, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"2 Reyes 2:1-18","book_usfm":"2KI","chapter":2},{"label":"1 Corintios 4:1-7","book_usfm":"1CO","chapter":4},{"label":"Mateo 5:17-20","book_usfm":"MAT","chapter":5}]'::jsonb),
  (627, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"2 Reyes 4:8-37","book_usfm":"2KI","chapter":4},{"label":"Hechos 9:10-31","book_usfm":"ACT","chapter":9},{"label":"Lucas 3:7-18","book_usfm":"LUK","chapter":3}]'::jsonb),
  (628, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"2 Reyes 5:1-19","book_usfm":"2KI","chapter":5},{"label":"1 Corintios 4:8-21","book_usfm":"1CO","chapter":4},{"label":"Mateo 5:21-26","book_usfm":"MAT","chapter":5}]'::jsonb),
  (629, '[{"label":"Salmos 119:41-64","book_usfm":"PSA","chapter":119},{"label":"Isaías 8:11-20","book_usfm":"ISA","chapter":8},{"label":"Romanos 10:1-15","book_usfm":"ROM","chapter":10},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Mateo 13:44-52","book_usfm":"MAT","chapter":13}]'::jsonb),
  (630, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"2 Reyes 6:1-23","book_usfm":"2KI","chapter":6},{"label":"1 Corintios 5:9-6:8","book_usfm":"1CO","chapter":5,"chapter_end":6},{"label":"Mateo 5:38-48","book_usfm":"MAT","chapter":5}]'::jsonb),
  (631, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"2 Reyes 9:1-16","book_usfm":"2KI","chapter":9},{"label":"1 Corintios 6:12-20","book_usfm":"1CO","chapter":6},{"label":"Mateo 6:1-6","book_usfm":"MAT","chapter":6},{"label":"Mateo 6:16-18","book_usfm":"MAT","chapter":6}]'::jsonb),
  (632, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"2 Reyes 9:17-37","book_usfm":"2KI","chapter":9},{"label":"1 Corintios 7:1-9","book_usfm":"1CO","chapter":7},{"label":"Mateo 6:7-15","book_usfm":"MAT","chapter":6}]'::jsonb),
  (633, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"2 Reyes 11:1-20","book_usfm":"2KI","chapter":11},{"label":"1 Corintios 7:10-24","book_usfm":"1CO","chapter":7},{"label":"Mateo 6:19-24","book_usfm":"MAT","chapter":6}]'::jsonb),
  (634, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"2 Reyes 17:1-18","book_usfm":"2KI","chapter":17},{"label":"Hechos 9:36-43","book_usfm":"ACT","chapter":9},{"label":"Lucas 5:1-11","book_usfm":"LUK","chapter":5}]'::jsonb),
  (635, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"2 Reyes 17:24-41","book_usfm":"2KI","chapter":17},{"label":"1 Corintios 7:25-31","book_usfm":"1CO","chapter":7},{"label":"Mateo 6:25-34","book_usfm":"MAT","chapter":6}]'::jsonb),
  (636, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"2 Crónicas 29:1-3","book_usfm":"2CH","chapter":29},{"label":"2 Crónicas 30","book_usfm":"2CH","chapter":30},{"label":"1 Corintios 7:32-40","book_usfm":"1CO","chapter":7},{"label":"Mateo 7:1-12","book_usfm":"MAT","chapter":7}]'::jsonb),
  (637, '[{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Job 38:1-7","book_usfm":"JOB","chapter":38},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 150","book_usfm":"PSA","chapter":150},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Marcos 13:21-27","book_usfm":"MRK","chapter":13}]'::jsonb),
  (638, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"2 Reyes 18:28-37","book_usfm":"2KI","chapter":18},{"label":"1 Corintios 9:1-15","book_usfm":"1CO","chapter":9},{"label":"Mateo 7:22-29","book_usfm":"MAT","chapter":7}]'::jsonb),
  (639, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"2 Reyes 19:1-20","book_usfm":"2KI","chapter":19},{"label":"1 Corintios 9:16-27","book_usfm":"1CO","chapter":9},{"label":"Mateo 8:1-17","book_usfm":"MAT","chapter":8}]'::jsonb),
  (640, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"2 Reyes 19:21-36","book_usfm":"2KI","chapter":19},{"label":"1 Corintios 10:1-13","book_usfm":"1CO","chapter":10},{"label":"Mateo 8:18-27","book_usfm":"MAT","chapter":8}]'::jsonb),
  (641, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"2 Reyes 20","book_usfm":"2KI","chapter":20},{"label":"Hechos 12:1-17","book_usfm":"ACT","chapter":12},{"label":"Lucas 7:11-17","book_usfm":"LUK","chapter":7}]'::jsonb),
  (642, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"2 Reyes 21:1-18","book_usfm":"2KI","chapter":21},{"label":"1 Corintios 10:14-11:1","book_usfm":"1CO","chapter":10,"chapter_end":11},{"label":"Mateo 8:28-34","book_usfm":"MAT","chapter":8}]'::jsonb),
  (643, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"2 Reyes 22:1-13","book_usfm":"2KI","chapter":22},{"label":"1 Corintios 11:2","book_usfm":"1CO","chapter":11},{"label":"1 Corintios 11:17-22","book_usfm":"1CO","chapter":11},{"label":"Mateo 9:1-8","book_usfm":"MAT","chapter":9}]'::jsonb),
  (644, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"2 Reyes 22:14-23:3","book_usfm":"2KI","chapter":22,"chapter_end":23},{"label":"1 Corintios 11:23-34","book_usfm":"1CO","chapter":11},{"label":"Mateo 9:9-17","book_usfm":"MAT","chapter":9}]'::jsonb),
  (645, '[{"label":"Salmos 131-135","book_usfm":"PSA","chapter":131,"chapter_end":135},{"label":"2 Reyes 23:4-25","book_usfm":"2KI","chapter":23},{"label":"1 Corintios 12:1-11","book_usfm":"1CO","chapter":12},{"label":"Mateo 9:18-26","book_usfm":"MAT","chapter":9}]'::jsonb),
  (646, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"2 Reyes 23:36-24:17","book_usfm":"2KI","chapter":23,"chapter_end":24},{"label":"1 Corintios 12:12-26","book_usfm":"1CO","chapter":12},{"label":"Mateo 9:27-34","book_usfm":"MAT","chapter":9}]'::jsonb),
  (647, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Jeremías 35","book_usfm":"JER","chapter":35},{"label":"1 Corintios 12:27-13:3","book_usfm":"1CO","chapter":12,"chapter_end":13},{"label":"Mateo 9:35-10:4","book_usfm":"MAT","chapter":9,"chapter_end":10}]'::jsonb),
  (648, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Jeremías 36:1-10","book_usfm":"JER","chapter":36},{"label":"Hechos 14:8-18","book_usfm":"ACT","chapter":14},{"label":"Lucas 7:36-50","book_usfm":"LUK","chapter":7}]'::jsonb),
  (649, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Jeremías 36:11-26","book_usfm":"JER","chapter":36},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13},{"label":"Mateo 10:5-15","book_usfm":"MAT","chapter":10}]'::jsonb),
  (650, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Jeremías 36:27-37:2","book_usfm":"JER","chapter":36,"chapter_end":37},{"label":"1 Corintios 14:1-12","book_usfm":"1CO","chapter":14},{"label":"Mateo 10:16-23","book_usfm":"MAT","chapter":10}]'::jsonb),
  (651, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Jeremías 37:3-21","book_usfm":"JER","chapter":37},{"label":"1 Corintios 14:13-25","book_usfm":"1CO","chapter":14},{"label":"Mateo 10:24-33","book_usfm":"MAT","chapter":10}]'::jsonb),
  (652, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Jeremías 38:1-13","book_usfm":"JER","chapter":38},{"label":"1 Corintios 14:26-33","book_usfm":"1CO","chapter":14},{"label":"1 Corintios 14:37-40","book_usfm":"1CO","chapter":14},{"label":"Mateo 10:34-42","book_usfm":"MAT","chapter":10}]'::jsonb),
  (653, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Jeremías 38:14-28","book_usfm":"JER","chapter":38},{"label":"1 Corintios 15:1-11","book_usfm":"1CO","chapter":15},{"label":"Mateo 11:1-6","book_usfm":"MAT","chapter":11}]'::jsonb),
  (654, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"2 Reyes 25:8-12","book_usfm":"2KI","chapter":25},{"label":"2 Reyes 25:22-26","book_usfm":"2KI","chapter":25},{"label":"1 Corintios 15:12-29","book_usfm":"1CO","chapter":15},{"label":"Mateo 11:7-15","book_usfm":"MAT","chapter":11}]'::jsonb),
  (655, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Jeremías 29:1","book_usfm":"JER","chapter":29},{"label":"Jeremías 29:4-14","book_usfm":"JER","chapter":29},{"label":"Hechos 16:6-15","book_usfm":"ACT","chapter":16},{"label":"Lucas 10:1-12","book_usfm":"LUK","chapter":10},{"label":"Lucas 10:17-20","book_usfm":"LUK","chapter":10}]'::jsonb),
  (656, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Ezequiel 47:1-12","book_usfm":"EZK","chapter":47},{"label":"Lucas 1:1-4","book_usfm":"LUK","chapter":1},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Hechos 1:1-8","book_usfm":"ACT","chapter":1}]'::jsonb),
  (657, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Lamentaciones 1:1-12","book_usfm":"LAM","chapter":1},{"label":"1 Corintios 15:41-50","book_usfm":"1CO","chapter":15},{"label":"Mateo 11:25-30","book_usfm":"MAT","chapter":11}]'::jsonb),
  (658, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Lamentaciones 2:8-15","book_usfm":"LAM","chapter":2},{"label":"1 Corintios 15:51-58","book_usfm":"1CO","chapter":15},{"label":"Mateo 12:1-14","book_usfm":"MAT","chapter":12}]'::jsonb),
  (659, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Esdras 1","book_usfm":"EZR","chapter":1},{"label":"1 Corintios 16:1-9","book_usfm":"1CO","chapter":16},{"label":"Mateo 12:15-21","book_usfm":"MAT","chapter":12}]'::jsonb),
  (660, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Esdras 3","book_usfm":"EZR","chapter":3},{"label":"1 Corintios 16:10-24","book_usfm":"1CO","chapter":16},{"label":"Mateo 12:22-32","book_usfm":"MAT","chapter":12}]'::jsonb),
  (661, '[{"label":"Salmos 119:145-168","book_usfm":"PSA","chapter":119},{"label":"Jeremías 11:18-23","book_usfm":"JER","chapter":11},{"label":"Mateo 10:16-22","book_usfm":"MAT","chapter":10},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Salmos 125","book_usfm":"PSA","chapter":125},{"label":"Hebreos 12:12-24","book_usfm":"HEB","chapter":12}]'::jsonb),
  (662, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Hageo 1:1-2:9","book_usfm":"HAG","chapter":1,"chapter_end":2},{"label":"Hechos 18:24-19:7","book_usfm":"ACT","chapter":18,"chapter_end":19},{"label":"Lucas 10:25-37","book_usfm":"LUK","chapter":10}]'::jsonb),
  (663, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Zacarías 1:7-17","book_usfm":"ZEC","chapter":1},{"label":"Apocalipsis 1:4-20","book_usfm":"REV","chapter":1},{"label":"Mateo 12:43-50","book_usfm":"MAT","chapter":12}]'::jsonb),
  (664, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Esdras 5","book_usfm":"EZR","chapter":5},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4},{"label":"Mateo 13:1-9","book_usfm":"MAT","chapter":13}]'::jsonb),
  (665, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Esdras 6","book_usfm":"EZR","chapter":6},{"label":"Apocalipsis 5:1-10","book_usfm":"REV","chapter":5},{"label":"Mateo 13:10-17","book_usfm":"MAT","chapter":13}]'::jsonb),
  (666, '[{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Isaías 28:9-16","book_usfm":"ISA","chapter":28},{"label":"Efesios 4:1-16","book_usfm":"EPH","chapter":4},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Juan 14:15-31","book_usfm":"JHN","chapter":14}]'::jsonb),
  (667, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Nehemías 2","book_usfm":"NEH","chapter":2},{"label":"Apocalipsis 6:12-7:4","book_usfm":"REV","chapter":6,"chapter_end":7},{"label":"Mateo 13:24-30","book_usfm":"MAT","chapter":13}]'::jsonb),
  (668, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Nehemías 4","book_usfm":"NEH","chapter":4},{"label":"Apocalipsis 7:4-17","book_usfm":"REV","chapter":7},{"label":"Mateo 13:31-35","book_usfm":"MAT","chapter":13}]'::jsonb),
  (669, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Apocalipsis 19:1","book_usfm":"REV","chapter":19},{"label":"Apocalipsis 19:4-10","book_usfm":"REV","chapter":19}]'::jsonb),
  (670, '[{"label":"Salmos 111-112","book_usfm":"PSA","chapter":111,"chapter_end":112},{"label":"Hebreos 11:32-12:2","book_usfm":"HEB","chapter":11,"chapter_end":12},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Salmos 150","book_usfm":"PSA","chapter":150},{"label":"Apocalipsis 21:1-4","book_usfm":"REV","chapter":21},{"label":"Apocalipsis 21:22-22:5","book_usfm":"REV","chapter":21,"chapter_end":22}]'::jsonb),
  (671, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Nehemías 12:27-31","book_usfm":"NEH","chapter":12},{"label":"Nehemías 12:42-47","book_usfm":"NEH","chapter":12},{"label":"Apocalipsis 11","book_usfm":"REV","chapter":11},{"label":"Mateo 13:44-52","book_usfm":"MAT","chapter":13}]'::jsonb),
  (672, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Nehemías 13:4-22","book_usfm":"NEH","chapter":13},{"label":"Apocalipsis 12:1-12","book_usfm":"REV","chapter":12},{"label":"Mateo 13:53-58","book_usfm":"MAT","chapter":13}]'::jsonb),
  (673, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Esdras 7:1-26","book_usfm":"EZR","chapter":7},{"label":"Apocalipsis 14:1-13","book_usfm":"REV","chapter":14},{"label":"Mateo 14:1-12","book_usfm":"MAT","chapter":14}]'::jsonb),
  (674, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Esdras 7:27-28","book_usfm":"EZR","chapter":7},{"label":"Esdras 8:21-36","book_usfm":"EZR","chapter":8},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15},{"label":"Mateo 14:13-21","book_usfm":"MAT","chapter":14}]'::jsonb),
  (675, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Esdras 9","book_usfm":"EZR","chapter":9},{"label":"Apocalipsis 17:1-14","book_usfm":"REV","chapter":17},{"label":"Mateo 14:22-36","book_usfm":"MAT","chapter":14}]'::jsonb),
  (676, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Esdras 10:1-17","book_usfm":"EZR","chapter":10},{"label":"Hechos 24:10-21","book_usfm":"ACT","chapter":24},{"label":"Lucas 14:12-24","book_usfm":"LUK","chapter":14}]'::jsonb),
  (677, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Nehemías 9:1-25","book_usfm":"NEH","chapter":9},{"label":"Apocalipsis 18:1-8","book_usfm":"REV","chapter":18},{"label":"Mateo 15:1-20","book_usfm":"MAT","chapter":15}]'::jsonb),
  (678, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Nehemías 9:26-38","book_usfm":"NEH","chapter":9},{"label":"Apocalipsis 18:9-20","book_usfm":"REV","chapter":18},{"label":"Mateo 15:21-28","book_usfm":"MAT","chapter":15}]'::jsonb),
  (679, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Nehemías 7:73-8:3","book_usfm":"NEH","chapter":7,"chapter_end":8},{"label":"Nehemías 8:5-18","book_usfm":"NEH","chapter":8},{"label":"Apocalipsis 18:21-24","book_usfm":"REV","chapter":18},{"label":"Mateo 15:29-39","book_usfm":"MAT","chapter":15}]'::jsonb),
  (680, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Apocalipsis 19:1-10","book_usfm":"REV","chapter":19},{"label":"Mateo 16:1-12","book_usfm":"MAT","chapter":16}]'::jsonb),
  (681, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Apocalipsis 19:11-16","book_usfm":"REV","chapter":19},{"label":"Mateo 16:13-20","book_usfm":"MAT","chapter":16}]'::jsonb),
  (682, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Apocalipsis 20:1-6","book_usfm":"REV","chapter":20},{"label":"Mateo 16:21-28","book_usfm":"MAT","chapter":16}]'::jsonb),
  (683, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Hechos 28:14-23","book_usfm":"ACT","chapter":28},{"label":"Lucas 16:1-13","book_usfm":"LUK","chapter":16}]'::jsonb),
  (684, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Apocalipsis 20:7-15","book_usfm":"REV","chapter":20},{"label":"Mateo 17:1-13","book_usfm":"MAT","chapter":17}]'::jsonb),
  (685, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Apocalipsis 21:1-8","book_usfm":"REV","chapter":21},{"label":"Mateo 17:14-21","book_usfm":"MAT","chapter":17}]'::jsonb),
  (686, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Apocalipsis 21:9-21","book_usfm":"REV","chapter":21},{"label":"Mateo 17:22-27","book_usfm":"MAT","chapter":17}]'::jsonb),
  (687, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Apocalipsis 21:22-22:5","book_usfm":"REV","chapter":21,"chapter_end":22},{"label":"Mateo 18:1-9","book_usfm":"MAT","chapter":18}]'::jsonb),
  (688, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Apocalipsis 22:6-13","book_usfm":"REV","chapter":22},{"label":"Mateo 18:10-20","book_usfm":"MAT","chapter":18}]'::jsonb),
  (689, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Isaías 65:17-25","book_usfm":"ISA","chapter":65},{"label":"Apocalipsis 22:14-21","book_usfm":"REV","chapter":22},{"label":"Mateo 18:21-35","book_usfm":"MAT","chapter":18}]'::jsonb),
  (690, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Isaías 19:19-25","book_usfm":"ISA","chapter":19},{"label":"Romanos 15:5-13","book_usfm":"ROM","chapter":15},{"label":"Lucas 19:11-27","book_usfm":"LUK","chapter":19}]'::jsonb),
  (691, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Joel 3:1-2","book_usfm":"JOL","chapter":3},{"label":"Joel 3:9-17","book_usfm":"JOL","chapter":3},{"label":"1 Pedro 1:1-12","book_usfm":"1PE","chapter":1},{"label":"Mateo 19:1-12","book_usfm":"MAT","chapter":19}]'::jsonb),
  (692, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Nahúm 1:1-13","book_usfm":"NAM","chapter":1},{"label":"1 Pedro 1:13-25","book_usfm":"1PE","chapter":1},{"label":"Mateo 19:13-22","book_usfm":"MAT","chapter":19}]'::jsonb),
  (693, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Abdías 15-21","book_usfm":"OBA","chapter":1},{"label":"1 Pedro 2:1-10","book_usfm":"1PE","chapter":2},{"label":"Mateo 19:23-30","book_usfm":"MAT","chapter":19}]'::jsonb),
  (694, '[{"label":"Salmos 147","book_usfm":"PSA","chapter":147},{"label":"Deuteronomio 26:1-11","book_usfm":"DEU","chapter":26},{"label":"Juan 6:26-35","book_usfm":"JHN","chapter":6},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"1 Tesalonicenses 5:12-24","book_usfm":"1TH","chapter":5}]'::jsonb),
  (695, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Isaías 24:14-23","book_usfm":"ISA","chapter":24},{"label":"1 Pedro 3:13-4:6","book_usfm":"1PE","chapter":3,"chapter_end":4},{"label":"Mateo 20:17-28","book_usfm":"MAT","chapter":20}]'::jsonb),
  (696, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Miqueas 7:11-20","book_usfm":"MIC","chapter":7},{"label":"1 Pedro 4:7-19","book_usfm":"1PE","chapter":4},{"label":"Mateo 20:29-34","book_usfm":"MAT","chapter":20}]'::jsonb),
  (697, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Amós 1:1-5","book_usfm":"AMO","chapter":1},{"label":"Amós 1:13-2:8","book_usfm":"AMO","chapter":1,"chapter_end":2},{"label":"1 Tesalonicenses 5:1-11","book_usfm":"1TH","chapter":5},{"label":"Lucas 21:5-19","book_usfm":"LUK","chapter":21}]'::jsonb),
  (698, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Amós 2:6-16","book_usfm":"AMO","chapter":2},{"label":"2 Pedro 1:1-11","book_usfm":"2PE","chapter":1},{"label":"Mateo 21:1-11","book_usfm":"MAT","chapter":21}]'::jsonb),
  (699, '[{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Isaías 49:1-6","book_usfm":"ISA","chapter":49},{"label":"1 Corintios 4:1-16","book_usfm":"1CO","chapter":4},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Juan 1:35-42","book_usfm":"JHN","chapter":1}]'::jsonb),
  (700, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Amós 3:12-4:5","book_usfm":"AMO","chapter":3,"chapter_end":4},{"label":"2 Pedro 3:1-10","book_usfm":"2PE","chapter":3},{"label":"Mateo 21:23-32","book_usfm":"MAT","chapter":21}]'::jsonb),
  (701, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Amós 4:6-13","book_usfm":"AMO","chapter":4},{"label":"2 Pedro 3:11-18","book_usfm":"2PE","chapter":3},{"label":"Mateo 21:33-46","book_usfm":"MAT","chapter":21}]'::jsonb),
  (702, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Amós 5:1-17","book_usfm":"AMO","chapter":5},{"label":"Judas 1-16","book_usfm":"JUD","chapter":1},{"label":"Mateo 22:1-14","book_usfm":"MAT","chapter":22}]'::jsonb),
  (703, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Amós 5:18-27","book_usfm":"AMO","chapter":5},{"label":"Judas 17-25","book_usfm":"JUD","chapter":1},{"label":"Mateo 22:15-22","book_usfm":"MAT","chapter":22}]'::jsonb),
  (704, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Amós 6","book_usfm":"AMO","chapter":6},{"label":"2 Tesalonicenses 1:5-12","book_usfm":"2TH","chapter":1},{"label":"Lucas 1:57-68","book_usfm":"LUK","chapter":1}]'::jsonb),
  (705, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Amós 7:1-9","book_usfm":"AMO","chapter":7},{"label":"Apocalipsis 1:1-8","book_usfm":"REV","chapter":1},{"label":"Mateo 22:23-33","book_usfm":"MAT","chapter":22}]'::jsonb),
  (706, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Amós 7:10-17","book_usfm":"AMO","chapter":7},{"label":"Apocalipsis 1:9-16","book_usfm":"REV","chapter":1},{"label":"Mateo 22:34-46","book_usfm":"MAT","chapter":22}]'::jsonb),
  (707, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Amós 8","book_usfm":"AMO","chapter":8},{"label":"Apocalipsis 1:17-2:7","book_usfm":"REV","chapter":1,"chapter_end":2},{"label":"Mateo 23:1-12","book_usfm":"MAT","chapter":23}]'::jsonb),
  (708, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Amós 9:1-10","book_usfm":"AMO","chapter":9},{"label":"Apocalipsis 2:8-17","book_usfm":"REV","chapter":2},{"label":"Mateo 23:13-26","book_usfm":"MAT","chapter":23}]'::jsonb),
  (709, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Hageo 1","book_usfm":"HAG","chapter":1},{"label":"Apocalipsis 2:18-29","book_usfm":"REV","chapter":2},{"label":"Mateo 23:27-39","book_usfm":"MAT","chapter":23}]'::jsonb),
  (710, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Hageo 2:1-9","book_usfm":"HAG","chapter":2},{"label":"Apocalipsis 3:1-6","book_usfm":"REV","chapter":3},{"label":"Mateo 24:1-14","book_usfm":"MAT","chapter":24}]'::jsonb),
  (711, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Amós 9:11-15","book_usfm":"AMO","chapter":9},{"label":"2 Tesalonicenses 2:1-3","book_usfm":"2TH","chapter":2},{"label":"2 Tesalonicenses 2:13-17","book_usfm":"2TH","chapter":2},{"label":"Juan 5:30-47","book_usfm":"JHN","chapter":5}]'::jsonb),
  (712, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Zacarías 1:7-17","book_usfm":"ZEC","chapter":1},{"label":"Apocalipsis 3:7-13","book_usfm":"REV","chapter":3},{"label":"Mateo 24:15-31","book_usfm":"MAT","chapter":24}]'::jsonb),
  (713, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Zacarías 2","book_usfm":"ZEC","chapter":2},{"label":"Apocalipsis 3:14-22","book_usfm":"REV","chapter":3},{"label":"Mateo 24:32-44","book_usfm":"MAT","chapter":24}]'::jsonb),
  (714, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Zacarías 3","book_usfm":"ZEC","chapter":3},{"label":"Apocalipsis 4:1-8","book_usfm":"REV","chapter":4},{"label":"Mateo 24:45-51","book_usfm":"MAT","chapter":24}]'::jsonb),
  (715, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Zacarías 4","book_usfm":"ZEC","chapter":4},{"label":"Apocalipsis 4:9-5:5","book_usfm":"REV","chapter":4,"chapter_end":5},{"label":"Mateo 25:1-13","book_usfm":"MAT","chapter":25}]'::jsonb),
  (716, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Zacarías 7:8-8","book_usfm":"ZEC","chapter":7},{"label":"Apocalipsis 5:6-14","book_usfm":"REV","chapter":5},{"label":"Mateo 25:14-30","book_usfm":"MAT","chapter":25}]'::jsonb),
  (717, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Zacarías 8:9-17","book_usfm":"ZEC","chapter":8},{"label":"Apocalipsis 6","book_usfm":"REV","chapter":6},{"label":"Mateo 25:31-46","book_usfm":"MAT","chapter":25}]'::jsonb),
  (718, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Génesis 3:8-15","book_usfm":"GEN","chapter":3},{"label":"Apocalipsis 12:1-10","book_usfm":"REV","chapter":12},{"label":"Juan 3:16-21","book_usfm":"JHN","chapter":3}]'::jsonb),
  (719, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"Sofonías 3:14-20","book_usfm":"ZEP","chapter":3},{"label":"Tito 1","book_usfm":"TIT","chapter":1},{"label":"Lucas 1:1-25","book_usfm":"LUK","chapter":1}]'::jsonb),
  (720, '[{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 121","book_usfm":"PSA","chapter":121},{"label":"Job 42:1-6","book_usfm":"JOB","chapter":42},{"label":"1 Pedro 1:3-9","book_usfm":"1PE","chapter":1},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Juan 14:1-7","book_usfm":"JHN","chapter":14}]'::jsonb),
  (721, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"2 Samuel 7:1-17","book_usfm":"2SA","chapter":7},{"label":"Tito 2:11-3:8","book_usfm":"TIT","chapter":2,"chapter_end":3},{"label":"Lucas 1:39-48","book_usfm":"LUK","chapter":1},{"label":"Lucas 1:48-56","book_usfm":"LUK","chapter":1}]'::jsonb),
  (722, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"2 Samuel 7:18-29","book_usfm":"2SA","chapter":7},{"label":"Gálatas 3:1-14","book_usfm":"GAL","chapter":3},{"label":"Lucas 1:57-66","book_usfm":"LUK","chapter":1}]'::jsonb),
  (723, '[{"label":"Salmos 89:1-29","book_usfm":"PSA","chapter":89},{"label":"Isaías 59:15-21","book_usfm":"ISA","chapter":59},{"label":"Filipenses 2:5-11","book_usfm":"PHP","chapter":2}]'::jsonb),
  (724, '[{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Miqueas 4:1-5","book_usfm":"MIC","chapter":4},{"label":"Miqueas 5:2-4","book_usfm":"MIC","chapter":5},{"label":"1 Juan 4:7-16","book_usfm":"1JN","chapter":4},{"label":"Juan 3:31-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (725, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"1 Samuel 1:1-2","book_usfm":"1SA","chapter":1},{"label":"1 Samuel 1:7-28","book_usfm":"1SA","chapter":1},{"label":"Colosenses 1:9-20","book_usfm":"COL","chapter":1},{"label":"Lucas 2:22-40","book_usfm":"LUK","chapter":2}]'::jsonb),
  (726, '[{"label":"Salmos 97-98","book_usfm":"PSA","chapter":97,"chapter_end":98},{"label":"Proverbios 8:22-30","book_usfm":"PRO","chapter":8},{"label":"Juan 13:20-35","book_usfm":"JHN","chapter":13},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"1 Juan 5:1-12","book_usfm":"1JN","chapter":5}]'::jsonb),
  (727, '[{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Isaías 49:13-23","book_usfm":"ISA","chapter":49},{"label":"Mateo 18:1-14","book_usfm":"MAT","chapter":18},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 126","book_usfm":"PSA","chapter":126},{"label":"Marcos 10:13-16","book_usfm":"MRK","chapter":10}]'::jsonb),
  (728, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"2 Samuel 23:13-17","book_usfm":"2SA","chapter":23},{"label":"2 Juan","book_usfm":"2JN","chapter":1},{"label":"Juan 2:1-11","book_usfm":"JHN","chapter":2}]'::jsonb),
  (729, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"1 Reyes 17:17-24","book_usfm":"1KI","chapter":17},{"label":"3 Juan","book_usfm":"3JN","chapter":1},{"label":"Juan 4:46-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (730, '[{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Isaías 65:15-25","book_usfm":"ISA","chapter":65},{"label":"Apocalipsis 21:1-6","book_usfm":"REV","chapter":21}]'::jsonb),
  (731, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Isaías 62:1-5","book_usfm":"ISA","chapter":62},{"label":"Isaías 62:10-12","book_usfm":"ISA","chapter":62},{"label":"Apocalipsis 19:11-16","book_usfm":"REV","chapter":19},{"label":"Mateo 1:18-25","book_usfm":"MAT","chapter":1}]'::jsonb),
  (732, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Colosenses 3:12-17","book_usfm":"COL","chapter":3},{"label":"Juan 6:41-47","book_usfm":"JHN","chapter":6}]'::jsonb),
  (733, '[{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"1 Reyes 19:9-18","book_usfm":"1KI","chapter":19},{"label":"Efesios 4:17-32","book_usfm":"EPH","chapter":4},{"label":"Juan 6:15-27","book_usfm":"JHN","chapter":6}]'::jsonb),
  (734, '[{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 89:1-29","book_usfm":"PSA","chapter":89},{"label":"Josué 3:14-4:7","book_usfm":"JOS","chapter":3,"chapter_end":4},{"label":"Efesios 5:1-20","book_usfm":"EPH","chapter":5},{"label":"Juan 9:1-12","book_usfm":"JHN","chapter":9},{"label":"Juan 9:35-38","book_usfm":"JHN","chapter":9}]'::jsonb),
  (735, '[{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Isaías 66:18-23","book_usfm":"ISA","chapter":66},{"label":"Romanos 15:7-13","book_usfm":"ROM","chapter":15}]'::jsonb),
  (736, '[{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Isaías 49:1-7","book_usfm":"ISA","chapter":49},{"label":"Apocalipsis 21:22-27","book_usfm":"REV","chapter":21},{"label":"Mateo 12:14-21","book_usfm":"MAT","chapter":12}]'::jsonb),
  (737, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Deuteronomio 8:1-3","book_usfm":"DEU","chapter":8},{"label":"Colosenses 1:1-14","book_usfm":"COL","chapter":1},{"label":"Juan 6:30-33","book_usfm":"JHN","chapter":6},{"label":"Juan 6:48-51","book_usfm":"JHN","chapter":6}]'::jsonb),
  (738, '[{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Isaías 61:1-9","book_usfm":"ISA","chapter":61},{"label":"Gálatas 3:23-29","book_usfm":"GAL","chapter":3},{"label":"Gálatas 4:4-7","book_usfm":"GAL","chapter":4}]'::jsonb),
  (739, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Génesis 1:1-2:3","book_usfm":"GEN","chapter":1,"chapter_end":2},{"label":"Efesios 1:3-14","book_usfm":"EPH","chapter":1},{"label":"Juan 1:29-34","book_usfm":"JHN","chapter":1}]'::jsonb),
  (740, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Génesis 2:4-25","book_usfm":"GEN","chapter":2},{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1}]'::jsonb),
  (741, '[{"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},{"label":"Salmos 10-11","book_usfm":"PSA","chapter":10,"chapter_end":11},{"label":"Génesis 3","book_usfm":"GEN","chapter":3},{"label":"Hebreos 2:1-10","book_usfm":"HEB","chapter":2},{"label":"Juan 1:19-28","book_usfm":"JHN","chapter":1}]'::jsonb),
  (742, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Génesis 4:1-16","book_usfm":"GEN","chapter":4},{"label":"Hebreos 2:11-18","book_usfm":"HEB","chapter":2},{"label":"Juan 1:29-42","book_usfm":"JHN","chapter":1}]'::jsonb),
  (743, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Génesis 4:17-26","book_usfm":"GEN","chapter":4},{"label":"Hebreos 3:1-11","book_usfm":"HEB","chapter":3},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (744, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Génesis 6:1-8","book_usfm":"GEN","chapter":6},{"label":"Hebreos 3:12-19","book_usfm":"HEB","chapter":3},{"label":"Juan 2:1-12","book_usfm":"JHN","chapter":2}]'::jsonb),
  (745, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Génesis 6:9-22","book_usfm":"GEN","chapter":6},{"label":"Hebreos 4:1-13","book_usfm":"HEB","chapter":4},{"label":"Juan 2:13-22","book_usfm":"JHN","chapter":2}]'::jsonb),
  (746, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Génesis 7:1-10","book_usfm":"GEN","chapter":7},{"label":"Génesis 7:17-23","book_usfm":"GEN","chapter":7},{"label":"Efesios 4:1-16","book_usfm":"EPH","chapter":4},{"label":"Marcos 3:7-19","book_usfm":"MRK","chapter":3}]'::jsonb),
  (747, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Génesis 8:6-22","book_usfm":"GEN","chapter":8},{"label":"Hebreos 4:14-5:6","book_usfm":"HEB","chapter":4,"chapter_end":5},{"label":"Juan 2:23-3:15","book_usfm":"JHN","chapter":2,"chapter_end":3}]'::jsonb),
  (748, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Ezequiel 3:4-11","book_usfm":"EZK","chapter":3},{"label":"Hechos 10:34-44","book_usfm":"ACT","chapter":10},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Juan 21:15-22","book_usfm":"JHN","chapter":21}]'::jsonb),
  (749, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Génesis 9:18-29","book_usfm":"GEN","chapter":9},{"label":"Hebreos 6:1-12","book_usfm":"HEB","chapter":6},{"label":"Juan 3:22-36","book_usfm":"JHN","chapter":3}]'::jsonb),
  (750, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Génesis 11:1-9","book_usfm":"GEN","chapter":11},{"label":"Hebreos 6:13-20","book_usfm":"HEB","chapter":6},{"label":"Juan 4:1-15","book_usfm":"JHN","chapter":4}]'::jsonb),
  (751, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Génesis 11:27-12:8","book_usfm":"GEN","chapter":11,"chapter_end":12},{"label":"Hebreos 7:1-17","book_usfm":"HEB","chapter":7},{"label":"Juan 4:16-26","book_usfm":"JHN","chapter":4}]'::jsonb),
  (752, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Génesis 12:9-13:1","book_usfm":"GEN","chapter":12,"chapter_end":13},{"label":"Hebreos 7:18-28","book_usfm":"HEB","chapter":7},{"label":"Juan 4:27-42","book_usfm":"JHN","chapter":4}]'::jsonb),
  (753, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Génesis 13:2-18","book_usfm":"GEN","chapter":13},{"label":"Gálatas 2:1-10","book_usfm":"GAL","chapter":2},{"label":"Marcos 7:31-37","book_usfm":"MRK","chapter":7}]'::jsonb),
  (754, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Génesis 14","book_usfm":"GEN","chapter":14},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8},{"label":"Juan 4:43-54","book_usfm":"JHN","chapter":4}]'::jsonb),
  (755, '[{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Isaías 45:18-25","book_usfm":"ISA","chapter":45},{"label":"Filipenses 3:4-11","book_usfm":"PHP","chapter":3},{"label":"Salmos 119:89-112","book_usfm":"PSA","chapter":119},{"label":"Hechos 9:1-22","book_usfm":"ACT","chapter":9}]'::jsonb),
  (756, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Génesis 16:1-14","book_usfm":"GEN","chapter":16},{"label":"Hebreos 9:15-28","book_usfm":"HEB","chapter":9},{"label":"Juan 5:19-29","book_usfm":"JHN","chapter":5}]'::jsonb),
  (757, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Génesis 16:15-17:14","book_usfm":"GEN","chapter":16,"chapter_end":17},{"label":"Hebreos 10:1-10","book_usfm":"HEB","chapter":10},{"label":"Juan 5:30-47","book_usfm":"JHN","chapter":5}]'::jsonb),
  (758, '[{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Génesis 17:15-27","book_usfm":"GEN","chapter":17},{"label":"Hebreos 10:11-25","book_usfm":"HEB","chapter":10},{"label":"Juan 6:1-15","book_usfm":"JHN","chapter":6}]'::jsonb),
  (759, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Génesis 18:1-16","book_usfm":"GEN","chapter":18},{"label":"Hebreos 10:26-39","book_usfm":"HEB","chapter":10},{"label":"Juan 6:16-27","book_usfm":"JHN","chapter":6}]'::jsonb),
  (760, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Génesis 18:16-33","book_usfm":"GEN","chapter":18},{"label":"Gálatas 5:13-25","book_usfm":"GAL","chapter":5},{"label":"Marcos 8:22-30","book_usfm":"MRK","chapter":8}]'::jsonb),
  (761, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Génesis 19:1-29","book_usfm":"GEN","chapter":19},{"label":"Hebreos 11:1-12","book_usfm":"HEB","chapter":11},{"label":"Juan 6:27-40","book_usfm":"JHN","chapter":6}]'::jsonb),
  (762, '[{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 122","book_usfm":"PSA","chapter":122},{"label":"1 Samuel 1:20-28","book_usfm":"1SA","chapter":1},{"label":"Romanos 8:14-21","book_usfm":"ROM","chapter":8}]'::jsonb),
  (763, '[{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"1 Samuel 2:1-10","book_usfm":"1SA","chapter":2},{"label":"Juan 8:31-36","book_usfm":"JHN","chapter":8},{"label":"Salmos 48","book_usfm":"PSA","chapter":48},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"1 Juan 3:1-8","book_usfm":"1JN","chapter":3}]'::jsonb),
  (764, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Génesis 23","book_usfm":"GEN","chapter":23},{"label":"Hebreos 11:32-12:2","book_usfm":"HEB","chapter":11,"chapter_end":12},{"label":"Juan 6:60-71","book_usfm":"JHN","chapter":6}]'::jsonb),
  (765, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Génesis 24:1-27","book_usfm":"GEN","chapter":24},{"label":"Hebreos 12:3-11","book_usfm":"HEB","chapter":12},{"label":"Juan 7:1-13","book_usfm":"JHN","chapter":7}]'::jsonb),
  (766, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Génesis 24:28-38","book_usfm":"GEN","chapter":24},{"label":"Génesis 24:49-51","book_usfm":"GEN","chapter":24},{"label":"Hebreos 12:12-29","book_usfm":"HEB","chapter":12},{"label":"Juan 7:14-36","book_usfm":"JHN","chapter":7}]'::jsonb),
  (767, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Génesis 24:50-67","book_usfm":"GEN","chapter":24},{"label":"2 Timoteo 2:14-21","book_usfm":"2TI","chapter":2},{"label":"Marcos 10:13-22","book_usfm":"MRK","chapter":10}]'::jsonb),
  (768, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Génesis 25:19-34","book_usfm":"GEN","chapter":25},{"label":"Hebreos 13:1-16","book_usfm":"HEB","chapter":13},{"label":"Juan 7:37-52","book_usfm":"JHN","chapter":7}]'::jsonb),
  (769, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Génesis 26:1-6","book_usfm":"GEN","chapter":26},{"label":"Génesis 26:12-33","book_usfm":"GEN","chapter":26},{"label":"Hebreos 13:17-25","book_usfm":"HEB","chapter":13},{"label":"Juan 7:53-8:11","book_usfm":"JHN","chapter":7,"chapter_end":8}]'::jsonb),
  (770, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Génesis 27:1-29","book_usfm":"GEN","chapter":27},{"label":"Romanos 12:1-8","book_usfm":"ROM","chapter":12},{"label":"Juan 8:12-20","book_usfm":"JHN","chapter":8}]'::jsonb),
  (771, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Génesis 27:30-45","book_usfm":"GEN","chapter":27},{"label":"Romanos 12:9-21","book_usfm":"ROM","chapter":12},{"label":"Juan 8:21-32","book_usfm":"JHN","chapter":8}]'::jsonb),
  (772, '[{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 91-92","book_usfm":"PSA","chapter":91,"chapter_end":92},{"label":"Génesis 27:46-28:4","book_usfm":"GEN","chapter":27,"chapter_end":28},{"label":"Génesis 28:10-22","book_usfm":"GEN","chapter":28},{"label":"Romanos 13","book_usfm":"ROM","chapter":13},{"label":"Juan 8:33-47","book_usfm":"JHN","chapter":8}]'::jsonb),
  (773, '[{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Salmos 90","book_usfm":"PSA","chapter":90},{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Génesis 29:1-20","book_usfm":"GEN","chapter":29},{"label":"Romanos 14","book_usfm":"ROM","chapter":14},{"label":"Juan 8:47-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (774, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Génesis 29:20-35","book_usfm":"GEN","chapter":29},{"label":"1 Timoteo 3:14-4:10","book_usfm":"1TI","chapter":3,"chapter_end":4},{"label":"Marcos 10:23-31","book_usfm":"MRK","chapter":10}]'::jsonb),
  (775, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Génesis 30:1-24","book_usfm":"GEN","chapter":30},{"label":"1 Juan 1","book_usfm":"1JN","chapter":1},{"label":"Juan 9:1-17","book_usfm":"JHN","chapter":9}]'::jsonb),
  (776, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Génesis 31:1-24","book_usfm":"GEN","chapter":31},{"label":"1 Juan 2:1-11","book_usfm":"1JN","chapter":2},{"label":"Juan 9:18-41","book_usfm":"JHN","chapter":9}]'::jsonb),
  (777, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Génesis 31:25-50","book_usfm":"GEN","chapter":31},{"label":"1 Juan 2:12-17","book_usfm":"1JN","chapter":2},{"label":"Juan 10:1-18","book_usfm":"JHN","chapter":10}]'::jsonb),
  (778, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Génesis 32:3-21","book_usfm":"GEN","chapter":32},{"label":"1 Juan 2:18-29","book_usfm":"1JN","chapter":2},{"label":"Juan 10:19-30","book_usfm":"JHN","chapter":10}]'::jsonb),
  (779, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Génesis 32:22-33:17","book_usfm":"GEN","chapter":32,"chapter_end":33},{"label":"1 Juan 3:1-10","book_usfm":"1JN","chapter":3},{"label":"Juan 10:31-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (780, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Génesis 35:1-20","book_usfm":"GEN","chapter":35},{"label":"1 Juan 3:11-18","book_usfm":"1JN","chapter":3},{"label":"Juan 11:1-16","book_usfm":"JHN","chapter":11}]'::jsonb),
  (781, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Proverbios 1:20-33","book_usfm":"PRO","chapter":1},{"label":"2 Corintios 5:11-21","book_usfm":"2CO","chapter":5},{"label":"Marcos 10:35-45","book_usfm":"MRK","chapter":10}]'::jsonb),
  (782, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Proverbios 3:11-20","book_usfm":"PRO","chapter":3},{"label":"1 Juan 3:18-4:6","book_usfm":"1JN","chapter":3,"chapter_end":4},{"label":"Juan 11:17-29","book_usfm":"JHN","chapter":11}]'::jsonb),
  (783, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Proverbios 4","book_usfm":"PRO","chapter":4},{"label":"1 Juan 4:7-21","book_usfm":"1JN","chapter":4},{"label":"Juan 11:30-44","book_usfm":"JHN","chapter":11}]'::jsonb),
  (784, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Proverbios 6:1-19","book_usfm":"PRO","chapter":6},{"label":"1 Juan 5:1-12","book_usfm":"1JN","chapter":5},{"label":"Juan 11:45-54","book_usfm":"JHN","chapter":11}]'::jsonb),
  (785, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"1 Samuel 16:1-13","book_usfm":"1SA","chapter":16},{"label":"1 Juan 2:18-25","book_usfm":"1JN","chapter":2},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Hechos 20:17-35","book_usfm":"ACT","chapter":20}]'::jsonb),
  (786, '[{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Proverbios 8:1-21","book_usfm":"PRO","chapter":8},{"label":"Filemón","book_usfm":"PHM","chapter":1},{"label":"Juan 12:9-19","book_usfm":"JHN","chapter":12}]'::jsonb),
  (787, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Proverbios 8:22-36","book_usfm":"PRO","chapter":8},{"label":"2 Timoteo 1:1-14","book_usfm":"2TI","chapter":1},{"label":"Juan 12:20-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (788, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"2 Corintios 3:7-18","book_usfm":"2CO","chapter":3},{"label":"Lucas 9:18-27","book_usfm":"LUK","chapter":9}]'::jsonb),
  (789, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Proverbios 27:1-6","book_usfm":"PRO","chapter":27},{"label":"Proverbios 27:10-12","book_usfm":"PRO","chapter":27},{"label":"Filipenses 2:1-13","book_usfm":"PHP","chapter":2},{"label":"Juan 18:15-18","book_usfm":"JHN","chapter":18},{"label":"Juan 18:25-27","book_usfm":"JHN","chapter":18}]'::jsonb),
  (790, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Proverbios 30:1-4","book_usfm":"PRO","chapter":30},{"label":"Proverbios 30:24-33","book_usfm":"PRO","chapter":30},{"label":"Filipenses 3:1-11","book_usfm":"PHP","chapter":3},{"label":"Juan 18:28-38","book_usfm":"JHN","chapter":18}]'::jsonb),
  (791, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 130","book_usfm":"PSA","chapter":130},{"label":"Amós 5:6-15","book_usfm":"AMO","chapter":5},{"label":"Hebreos 12:1-14","book_usfm":"HEB","chapter":12},{"label":"Lucas 18:9-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (792, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Habacuc 3:1-18","book_usfm":"HAB","chapter":3},{"label":"Filipenses 3:12-21","book_usfm":"PHP","chapter":3},{"label":"Juan 17:1-8","book_usfm":"JHN","chapter":17}]'::jsonb),
  (793, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Ezequiel 18:1-4","book_usfm":"EZK","chapter":18},{"label":"Ezequiel 18:25-32","book_usfm":"EZK","chapter":18},{"label":"Filipenses 4:1-9","book_usfm":"PHP","chapter":4},{"label":"Juan 17:9-19","book_usfm":"JHN","chapter":17}]'::jsonb),
  (794, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Ezequiel 39:21-29","book_usfm":"EZK","chapter":39},{"label":"Filipenses 4:10-20","book_usfm":"PHP","chapter":4},{"label":"Juan 17:20-26","book_usfm":"JHN","chapter":17}]'::jsonb),
  (795, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Daniel 9:3-10","book_usfm":"DAN","chapter":9},{"label":"Hebreos 2:10-18","book_usfm":"HEB","chapter":2},{"label":"Juan 12:44-50","book_usfm":"JHN","chapter":12}]'::jsonb),
  (796, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Génesis 37:1-11","book_usfm":"GEN","chapter":37},{"label":"1 Corintios 1:1-19","book_usfm":"1CO","chapter":1},{"label":"Marcos 1:1-13","book_usfm":"MRK","chapter":1}]'::jsonb),
  (797, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Génesis 37:12-24","book_usfm":"GEN","chapter":37},{"label":"1 Corintios 1:20-31","book_usfm":"1CO","chapter":1},{"label":"Marcos 1:14-28","book_usfm":"MRK","chapter":1}]'::jsonb),
  (798, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Génesis 37:25-36","book_usfm":"GEN","chapter":37},{"label":"1 Corintios 2:1-13","book_usfm":"1CO","chapter":2},{"label":"Marcos 1:29-45","book_usfm":"MRK","chapter":1}]'::jsonb),
  (799, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 59-60","book_usfm":"PSA","chapter":59,"chapter_end":60},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Génesis 39","book_usfm":"GEN","chapter":39},{"label":"1 Corintios 2:14-3:15","book_usfm":"1CO","chapter":2,"chapter_end":3},{"label":"Marcos 2:1-12","book_usfm":"MRK","chapter":2}]'::jsonb),
  (800, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Génesis 40","book_usfm":"GEN","chapter":40},{"label":"1 Corintios 3:16-23","book_usfm":"1CO","chapter":3},{"label":"Marcos 2:13-22","book_usfm":"MRK","chapter":2}]'::jsonb),
  (801, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 138:1-139:23","book_usfm":"PSA","chapter":138,"chapter_end":139},{"label":"Génesis 41:1-13","book_usfm":"GEN","chapter":41},{"label":"1 Corintios 4:1-7","book_usfm":"1CO","chapter":4},{"label":"Marcos 2:23-3:6","book_usfm":"MRK","chapter":2,"chapter_end":3}]'::jsonb),
  (802, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Génesis 41:14-45","book_usfm":"GEN","chapter":41},{"label":"Romanos 6:3-14","book_usfm":"ROM","chapter":6},{"label":"Juan 5:19-24","book_usfm":"JHN","chapter":5}]'::jsonb),
  (803, '[{"label":"Salmos 56-58","book_usfm":"PSA","chapter":56,"chapter_end":58},{"label":"Salmos 64-65","book_usfm":"PSA","chapter":64,"chapter_end":65},{"label":"Génesis 41:46-57","book_usfm":"GEN","chapter":41},{"label":"1 Corintios 4:8-21","book_usfm":"1CO","chapter":4},{"label":"Marcos 3:7-19","book_usfm":"MRK","chapter":3}]'::jsonb),
  (804, '[{"label":"Salmos 61-62","book_usfm":"PSA","chapter":61,"chapter_end":62},{"label":"Salmos 68","book_usfm":"PSA","chapter":68},{"label":"Génesis 42:1-17","book_usfm":"GEN","chapter":42},{"label":"1 Corintios 5:1-8","book_usfm":"1CO","chapter":5},{"label":"Marcos 3:19-35","book_usfm":"MRK","chapter":3}]'::jsonb),
  (805, '[{"label":"Salmos 72","book_usfm":"PSA","chapter":72},{"label":"Salmos 119:73-96","book_usfm":"PSA","chapter":119},{"label":"Génesis 42:18-28","book_usfm":"GEN","chapter":42},{"label":"1 Corintios 5:9-6:8","book_usfm":"1CO","chapter":5,"chapter_end":6},{"label":"Marcos 4:1-20","book_usfm":"MRK","chapter":4}]'::jsonb),
  (806, '[{"label":"Salmos 70-71","book_usfm":"PSA","chapter":70,"chapter_end":71},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Génesis 42:29-38","book_usfm":"GEN","chapter":42},{"label":"1 Corintios 6:12-20","book_usfm":"1CO","chapter":6},{"label":"Marcos 4:21-34","book_usfm":"MRK","chapter":4}]'::jsonb),
  (807, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Génesis 43:1-15","book_usfm":"GEN","chapter":43},{"label":"1 Corintios 7:1-9","book_usfm":"1CO","chapter":7},{"label":"Marcos 4:35-41","book_usfm":"MRK","chapter":4}]'::jsonb),
  (808, '[{"label":"Salmos 75-76","book_usfm":"PSA","chapter":75,"chapter_end":76},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Génesis 43:16-34","book_usfm":"GEN","chapter":43},{"label":"1 Corintios 7:10-24","book_usfm":"1CO","chapter":7},{"label":"Marcos 5:1-20","book_usfm":"MRK","chapter":5}]'::jsonb),
  (809, '[{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Isaías 63:7-16","book_usfm":"ISA","chapter":63},{"label":"Mateo 1:18-25","book_usfm":"MAT","chapter":1},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Efesios 3:14-21","book_usfm":"EPH","chapter":3}]'::jsonb),
  (810, '[{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 79","book_usfm":"PSA","chapter":79},{"label":"Génesis 44:18-34","book_usfm":"GEN","chapter":44},{"label":"1 Corintios 7:25-31","book_usfm":"1CO","chapter":7},{"label":"Marcos 5:21-43","book_usfm":"MRK","chapter":5}]'::jsonb),
  (811, '[{"label":"Salmos 78","book_usfm":"PSA","chapter":78},{"label":"Génesis 45:1-15","book_usfm":"GEN","chapter":45},{"label":"1 Corintios 7:32-40","book_usfm":"1CO","chapter":7},{"label":"Marcos 6:1-13","book_usfm":"MRK","chapter":6}]'::jsonb),
  (812, '[{"label":"Salmos 119:97-120","book_usfm":"PSA","chapter":119},{"label":"Salmos 81-82","book_usfm":"PSA","chapter":81,"chapter_end":82},{"label":"Génesis 45:16-28","book_usfm":"GEN","chapter":45},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8},{"label":"Marcos 6:13-29","book_usfm":"MRK","chapter":6}]'::jsonb),
  (813, '[{"label":"Salmos 83","book_usfm":"PSA","chapter":83},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Salmos 85-86","book_usfm":"PSA","chapter":85,"chapter_end":86},{"label":"Génesis 46:1-7","book_usfm":"GEN","chapter":46},{"label":"Génesis 46:28-34","book_usfm":"GEN","chapter":46},{"label":"1 Corintios 9:1-15","book_usfm":"1CO","chapter":9},{"label":"Marcos 6:30-46","book_usfm":"MRK","chapter":6}]'::jsonb),
  (814, '[{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Génesis 3:1-15","book_usfm":"GEN","chapter":3},{"label":"Romanos 5:12-21","book_usfm":"ROM","chapter":5}]'::jsonb),
  (815, '[{"label":"Salmos 82","book_usfm":"PSA","chapter":82},{"label":"Salmos 87","book_usfm":"PSA","chapter":87},{"label":"Isaías 52:7-12","book_usfm":"ISA","chapter":52},{"label":"Hebreos 2:5-10","book_usfm":"HEB","chapter":2},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 132","book_usfm":"PSA","chapter":132},{"label":"Juan 1:9-14","book_usfm":"JHN","chapter":1}]'::jsonb),
  (816, '[{"label":"Salmos 66-67","book_usfm":"PSA","chapter":66,"chapter_end":67},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Génesis 48:8-22","book_usfm":"GEN","chapter":48},{"label":"Romanos 8:11-25","book_usfm":"ROM","chapter":8},{"label":"Juan 6:27-40","book_usfm":"JHN","chapter":6}]'::jsonb),
  (817, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Génesis 49:1-28","book_usfm":"GEN","chapter":49},{"label":"1 Corintios 10:14-11:1","book_usfm":"1CO","chapter":10,"chapter_end":11},{"label":"Marcos 7:24-37","book_usfm":"MRK","chapter":7}]'::jsonb),
  (818, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99-100","book_usfm":"PSA","chapter":99,"chapter_end":100},{"label":"Salmos 94-95","book_usfm":"PSA","chapter":94,"chapter_end":95},{"label":"Génesis 49:29-50:14","book_usfm":"GEN","chapter":49,"chapter_end":50},{"label":"1 Corintios 11:17-34","book_usfm":"1CO","chapter":11},{"label":"Marcos 8:1-10","book_usfm":"MRK","chapter":8}]'::jsonb),
  (819, '[{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 109:1-30","book_usfm":"PSA","chapter":109},{"label":"Salmos 119:121-144","book_usfm":"PSA","chapter":119},{"label":"Génesis 50:15-26","book_usfm":"GEN","chapter":50},{"label":"1 Corintios 12:1-11","book_usfm":"1CO","chapter":12},{"label":"Marcos 8:11-26","book_usfm":"MRK","chapter":8}]'::jsonb),
  (820, '[{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Éxodo 1:6-22","book_usfm":"EXO","chapter":1},{"label":"1 Corintios 12:12-26","book_usfm":"1CO","chapter":12},{"label":"Marcos 8:27-9:1","book_usfm":"MRK","chapter":8,"chapter_end":9}]'::jsonb),
  (821, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 107:1-32","book_usfm":"PSA","chapter":107},{"label":"Éxodo 2:1-22","book_usfm":"EXO","chapter":2},{"label":"1 Corintios 12:27-13:3","book_usfm":"1CO","chapter":12,"chapter_end":13},{"label":"Marcos 9:2-13","book_usfm":"MRK","chapter":9}]'::jsonb),
  (822, '[{"label":"Salmos 107:33-108:13","book_usfm":"PSA","chapter":107,"chapter_end":108},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Éxodo 2:23-3:15","book_usfm":"EXO","chapter":2,"chapter_end":3},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13},{"label":"Marcos 9:14-29","book_usfm":"MRK","chapter":9}]'::jsonb),
  (823, '[{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Éxodo 3:16-4:12","book_usfm":"EXO","chapter":3,"chapter_end":4},{"label":"Romanos 12","book_usfm":"ROM","chapter":12},{"label":"Juan 8:46-59","book_usfm":"JHN","chapter":8}]'::jsonb),
  (824, '[{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Éxodo 4:10-31","book_usfm":"EXO","chapter":4},{"label":"1 Corintios 14:1-19","book_usfm":"1CO","chapter":14},{"label":"Marcos 9:30-41","book_usfm":"MRK","chapter":9}]'::jsonb),
  (825, '[{"label":"Salmos 120-127","book_usfm":"PSA","chapter":120,"chapter_end":127},{"label":"Éxodo 5:1-6","book_usfm":"EXO","chapter":5},{"label":"1 Corintios 14:20-33","book_usfm":"1CO","chapter":14},{"label":"1 Corintios 14:39-40","book_usfm":"1CO","chapter":14},{"label":"Marcos 9:42-50","book_usfm":"MRK","chapter":9}]'::jsonb),
  (826, '[{"label":"Salmos 119:145-176","book_usfm":"PSA","chapter":119},{"label":"Salmos 128-130","book_usfm":"PSA","chapter":128,"chapter_end":130},{"label":"Éxodo 7:8-24","book_usfm":"EXO","chapter":7},{"label":"2 Corintios 2:14-3:6","book_usfm":"2CO","chapter":2,"chapter_end":3},{"label":"Marcos 10:1-16","book_usfm":"MRK","chapter":10}]'::jsonb),
  (827, '[{"label":"Salmos 131-133","book_usfm":"PSA","chapter":131,"chapter_end":133},{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 142","book_usfm":"PSA","chapter":142},{"label":"Éxodo 7:25-8:19","book_usfm":"EXO","chapter":7,"chapter_end":8},{"label":"2 Corintios 3:7-18","book_usfm":"2CO","chapter":3},{"label":"Marcos 10:17-31","book_usfm":"MRK","chapter":10}]'::jsonb),
  (828, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Éxodo 9:13-35","book_usfm":"EXO","chapter":9},{"label":"2 Corintios 4:1-12","book_usfm":"2CO","chapter":4},{"label":"Marcos 10:32-45","book_usfm":"MRK","chapter":10}]'::jsonb),
  (829, '[{"label":"Salmos 137","book_usfm":"PSA","chapter":137},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Éxodo 10:21-11:8","book_usfm":"EXO","chapter":10,"chapter_end":11},{"label":"2 Corintios 4:13-18","book_usfm":"2CO","chapter":4},{"label":"Marcos 10:46-52","book_usfm":"MRK","chapter":10}]'::jsonb),
  (830, '[{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Zacarías 9:9-12","book_usfm":"ZEC","chapter":9},{"label":"Zacarías 12:9-11","book_usfm":"ZEC","chapter":12},{"label":"Zacarías 13:1","book_usfm":"ZEC","chapter":13},{"label":"Zacarías 13:7-9","book_usfm":"ZEC","chapter":13},{"label":"1 Timoteo 6:12-16","book_usfm":"1TI","chapter":6},{"label":"Lucas 19:41-48","book_usfm":"LUK","chapter":19}]'::jsonb),
  (831, '[{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Salmos 69:1-23","book_usfm":"PSA","chapter":69},{"label":"Lamentaciones 1:1-2","book_usfm":"LAM","chapter":1},{"label":"Lamentaciones 1:6-12","book_usfm":"LAM","chapter":1},{"label":"2 Corintios 1:1-7","book_usfm":"2CO","chapter":1},{"label":"Marcos 11:12-25","book_usfm":"MRK","chapter":11}]'::jsonb),
  (832, '[{"label":"Salmos 6","book_usfm":"PSA","chapter":6},{"label":"Salmos 12","book_usfm":"PSA","chapter":12},{"label":"Salmos 94","book_usfm":"PSA","chapter":94},{"label":"Lamentaciones 1:17-22","book_usfm":"LAM","chapter":1},{"label":"2 Corintios 1:8-22","book_usfm":"2CO","chapter":1},{"label":"Marcos 11:27-33","book_usfm":"MRK","chapter":11}]'::jsonb),
  (833, '[{"label":"Salmos 55","book_usfm":"PSA","chapter":55},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Lamentaciones 2:1-9","book_usfm":"LAM","chapter":2},{"label":"Lamentaciones 2:14-17","book_usfm":"LAM","chapter":2},{"label":"2 Corintios 1:23-2:11","book_usfm":"2CO","chapter":1,"chapter_end":2},{"label":"Marcos 12:1-11","book_usfm":"MRK","chapter":12}]'::jsonb),
  (834, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 142-143","book_usfm":"PSA","chapter":142,"chapter_end":143},{"label":"Lamentaciones 2:10-18","book_usfm":"LAM","chapter":2},{"label":"1 Corintios 10:14-17","book_usfm":"1CO","chapter":10},{"label":"1 Corintios 11:27-32","book_usfm":"1CO","chapter":11},{"label":"Marcos 14:12-25","book_usfm":"MRK","chapter":14}]'::jsonb),
  (835, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Lamentaciones 3:1-9","book_usfm":"LAM","chapter":3},{"label":"Lamentaciones 3:19-33","book_usfm":"LAM","chapter":3},{"label":"1 Pedro 1:10-20","book_usfm":"1PE","chapter":1},{"label":"Juan 13:36-38","book_usfm":"JHN","chapter":13},{"label":"Juan 19:38-42","book_usfm":"JHN","chapter":19}]'::jsonb),
  (836, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Lamentaciones 3:37-58","book_usfm":"LAM","chapter":3},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4},{"label":"Romanos 8:1-11","book_usfm":"ROM","chapter":8}]'::jsonb),
  (837, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 113-114","book_usfm":"PSA","chapter":113,"chapter_end":114},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Éxodo 12:1-14","book_usfm":"EXO","chapter":12},{"label":"Isaías 51:9-11","book_usfm":"ISA","chapter":51},{"label":"Juan 1:1-18","book_usfm":"JHN","chapter":1},{"label":"Lucas 24:13-35","book_usfm":"LUK","chapter":24},{"label":"Juan 20:19-23","book_usfm":"JHN","chapter":20}]'::jsonb),
  (838, '[{"label":"Salmos 93","book_usfm":"PSA","chapter":93},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Éxodo 12:14-27","book_usfm":"EXO","chapter":12},{"label":"1 Corintios 15:1-11","book_usfm":"1CO","chapter":15},{"label":"Marcos 16:1-8","book_usfm":"MRK","chapter":16}]'::jsonb),
  (839, '[{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 114","book_usfm":"PSA","chapter":114},{"label":"Éxodo 12:28-39","book_usfm":"EXO","chapter":12},{"label":"1 Corintios 15:12-28","book_usfm":"1CO","chapter":15},{"label":"Marcos 16:9-20","book_usfm":"MRK","chapter":16}]'::jsonb),
  (840, '[{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 99","book_usfm":"PSA","chapter":99},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"Éxodo 12:40-51","book_usfm":"EXO","chapter":12},{"label":"1 Corintios 15:29-41","book_usfm":"1CO","chapter":15},{"label":"Mateo 28:1-16","book_usfm":"MAT","chapter":28}]'::jsonb),
  (841, '[{"label":"Salmos 146-149","book_usfm":"PSA","chapter":146,"chapter_end":149},{"label":"Éxodo 13:3-10","book_usfm":"EXO","chapter":13},{"label":"1 Corintios 15:41-50","book_usfm":"1CO","chapter":15},{"label":"Mateo 28:16-20","book_usfm":"MAT","chapter":28}]'::jsonb),
  (842, '[{"label":"Salmos 136","book_usfm":"PSA","chapter":136},{"label":"Salmos 118","book_usfm":"PSA","chapter":118},{"label":"Éxodo 13:1-2","book_usfm":"EXO","chapter":13},{"label":"Éxodo 13:11-16","book_usfm":"EXO","chapter":13},{"label":"1 Corintios 15:51-58","book_usfm":"1CO","chapter":15},{"label":"Lucas 24:1-12","book_usfm":"LUK","chapter":24}]'::jsonb),
  (843, '[{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Salmos 104","book_usfm":"PSA","chapter":104},{"label":"Éxodo 13:17-14:4","book_usfm":"EXO","chapter":13,"chapter_end":14},{"label":"2 Corintios 4:16-5:10","book_usfm":"2CO","chapter":4,"chapter_end":5},{"label":"Marcos 12:18-27","book_usfm":"MRK","chapter":12}]'::jsonb),
  (844, '[{"label":"Salmos 146-147","book_usfm":"PSA","chapter":146,"chapter_end":147},{"label":"Salmos 111-113","book_usfm":"PSA","chapter":111,"chapter_end":113},{"label":"Éxodo 14:5-22","book_usfm":"EXO","chapter":14},{"label":"1 Juan 1:1-7","book_usfm":"1JN","chapter":1},{"label":"Juan 14:1-7","book_usfm":"JHN","chapter":14}]'::jsonb),
  (845, '[{"label":"Salmos 1-4","book_usfm":"PSA","chapter":1,"chapter_end":4},{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Éxodo 14:21-31","book_usfm":"EXO","chapter":14},{"label":"1 Pedro 1:1-12","book_usfm":"1PE","chapter":1},{"label":"Juan 14:1-17","book_usfm":"JHN","chapter":14}]'::jsonb),
  (846, '[{"label":"Salmos 145","book_usfm":"PSA","chapter":145},{"label":"Hechos 12:25-13:3","book_usfm":"ACT","chapter":12,"chapter_end":13},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"2 Timoteo 4:1-11","book_usfm":"2TI","chapter":4}]'::jsonb),
  (847, '[{"label":"Salmos 119:1-24","book_usfm":"PSA","chapter":119},{"label":"Salmos 12-14","book_usfm":"PSA","chapter":12,"chapter_end":14},{"label":"Éxodo 15:22-16:10","book_usfm":"EXO","chapter":15,"chapter_end":16},{"label":"1 Pedro 2:1-10","book_usfm":"1PE","chapter":2},{"label":"Juan 15:1-11","book_usfm":"JHN","chapter":15}]'::jsonb),
  (848, '[{"label":"Salmos 18","book_usfm":"PSA","chapter":18},{"label":"Éxodo 16:10-22","book_usfm":"EXO","chapter":16},{"label":"1 Pedro 2:11-25","book_usfm":"1PE","chapter":2},{"label":"Juan 15:12-27","book_usfm":"JHN","chapter":15}]'::jsonb),
  (849, '[{"label":"Salmos 16-17","book_usfm":"PSA","chapter":16,"chapter_end":17},{"label":"Salmos 134-135","book_usfm":"PSA","chapter":134,"chapter_end":135},{"label":"Éxodo 16:23-36","book_usfm":"EXO","chapter":16},{"label":"1 Pedro 3:13-4:6","book_usfm":"1PE","chapter":3,"chapter_end":4},{"label":"Juan 16:1-15","book_usfm":"JHN","chapter":16}]'::jsonb),
  (850, '[{"label":"Salmos 20-21","book_usfm":"PSA","chapter":20,"chapter_end":21},{"label":"Salmos 110","book_usfm":"PSA","chapter":110},{"label":"Salmos 116-117","book_usfm":"PSA","chapter":116,"chapter_end":117},{"label":"Éxodo 17","book_usfm":"EXO","chapter":17},{"label":"1 Pedro 4:7-19","book_usfm":"1PE","chapter":4},{"label":"Juan 16:16-33","book_usfm":"JHN","chapter":16}]'::jsonb),
  (851, '[{"label":"Salmos 148-150","book_usfm":"PSA","chapter":148,"chapter_end":150},{"label":"Salmos 114-115","book_usfm":"PSA","chapter":114,"chapter_end":115},{"label":"Éxodo 18:1-12","book_usfm":"EXO","chapter":18},{"label":"1 Juan 2:7-17","book_usfm":"1JN","chapter":2},{"label":"Marcos 16:9-20","book_usfm":"MRK","chapter":16}]'::jsonb),
  (852, '[{"label":"Salmos 119:137-160","book_usfm":"PSA","chapter":119},{"label":"Job 23:1-12","book_usfm":"JOB","chapter":23},{"label":"Juan 1:43-51","book_usfm":"JHN","chapter":1},{"label":"Salmos 139","book_usfm":"PSA","chapter":139},{"label":"Juan 12:20-26","book_usfm":"JHN","chapter":12}]'::jsonb),
  (853, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39},{"label":"Éxodo 19:1-16","book_usfm":"EXO","chapter":19},{"label":"Colosenses 1:1-14","book_usfm":"COL","chapter":1},{"label":"Mateo 3:7-12","book_usfm":"MAT","chapter":3}]'::jsonb),
  (854, '[{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 119:25-48","book_usfm":"PSA","chapter":119},{"label":"Éxodo 19:16-25","book_usfm":"EXO","chapter":19},{"label":"Colosenses 1:15-23","book_usfm":"COL","chapter":1},{"label":"Mateo 3:13-17","book_usfm":"MAT","chapter":3}]'::jsonb),
  (855, '[{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Éxodo 20:1-21","book_usfm":"EXO","chapter":20},{"label":"Colosenses 1:24-2:7","book_usfm":"COL","chapter":1,"chapter_end":2},{"label":"Mateo 4:1-11","book_usfm":"MAT","chapter":4}]'::jsonb),
  (856, '[{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Éxodo 24","book_usfm":"EXO","chapter":24},{"label":"Colosenses 2:8-23","book_usfm":"COL","chapter":2},{"label":"Mateo 4:12-17","book_usfm":"MAT","chapter":4}]'::jsonb),
  (857, '[{"label":"Salmos 30","book_usfm":"PSA","chapter":30},{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 42-43","book_usfm":"PSA","chapter":42,"chapter_end":43},{"label":"Éxodo 25:1-22","book_usfm":"EXO","chapter":25},{"label":"Colosenses 3:1-17","book_usfm":"COL","chapter":3},{"label":"Mateo 4:18-25","book_usfm":"MAT","chapter":4}]'::jsonb),
  (858, '[{"label":"Salmos 63","book_usfm":"PSA","chapter":63},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Éxodo 28:1-4","book_usfm":"EXO","chapter":28},{"label":"Éxodo 28:30-38","book_usfm":"EXO","chapter":28},{"label":"1 Juan 2:18-29","book_usfm":"1JN","chapter":2},{"label":"Marcos 6:30-44","book_usfm":"MRK","chapter":6}]'::jsonb),
  (859, '[{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 52","book_usfm":"PSA","chapter":52},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Éxodo 32:1-20","book_usfm":"EXO","chapter":32},{"label":"Colosenses 3:18-4","book_usfm":"COL","chapter":3},{"label":"Mateo 5:1-10","book_usfm":"MAT","chapter":5}]'::jsonb),
  (860, '[{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 47-48","book_usfm":"PSA","chapter":47,"chapter_end":48},{"label":"Éxodo 32:21-34","book_usfm":"EXO","chapter":32},{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1},{"label":"Mateo 5:11-16","book_usfm":"MAT","chapter":5}]'::jsonb),
  (861, '[{"label":"Salmos 119:49-72","book_usfm":"PSA","chapter":119},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Éxodo 33","book_usfm":"EXO","chapter":33},{"label":"1 Tesalonicenses 2:1-12","book_usfm":"1TH","chapter":2},{"label":"Mateo 5:17-20","book_usfm":"MAT","chapter":5}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'bcp-daily-office';

-- ---- Plan: Proverbios en 31 días (31 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('proverbios', 'Proverbios en 31 días', 'Un capítulo de Proverbios por día del mes.', 31, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'proverbios');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Proverbios 1","book_usfm":"PRO","chapter":1}]'::jsonb),
  (2, '[{"label":"Proverbios 2","book_usfm":"PRO","chapter":2}]'::jsonb),
  (3, '[{"label":"Proverbios 3","book_usfm":"PRO","chapter":3}]'::jsonb),
  (4, '[{"label":"Proverbios 4","book_usfm":"PRO","chapter":4}]'::jsonb),
  (5, '[{"label":"Proverbios 5","book_usfm":"PRO","chapter":5}]'::jsonb),
  (6, '[{"label":"Proverbios 6","book_usfm":"PRO","chapter":6}]'::jsonb),
  (7, '[{"label":"Proverbios 7","book_usfm":"PRO","chapter":7}]'::jsonb),
  (8, '[{"label":"Proverbios 8","book_usfm":"PRO","chapter":8}]'::jsonb),
  (9, '[{"label":"Proverbios 9","book_usfm":"PRO","chapter":9}]'::jsonb),
  (10, '[{"label":"Proverbios 10","book_usfm":"PRO","chapter":10}]'::jsonb),
  (11, '[{"label":"Proverbios 11","book_usfm":"PRO","chapter":11}]'::jsonb),
  (12, '[{"label":"Proverbios 12","book_usfm":"PRO","chapter":12}]'::jsonb),
  (13, '[{"label":"Proverbios 13","book_usfm":"PRO","chapter":13}]'::jsonb),
  (14, '[{"label":"Proverbios 14","book_usfm":"PRO","chapter":14}]'::jsonb),
  (15, '[{"label":"Proverbios 15","book_usfm":"PRO","chapter":15}]'::jsonb),
  (16, '[{"label":"Proverbios 16","book_usfm":"PRO","chapter":16}]'::jsonb),
  (17, '[{"label":"Proverbios 17","book_usfm":"PRO","chapter":17}]'::jsonb),
  (18, '[{"label":"Proverbios 18","book_usfm":"PRO","chapter":18}]'::jsonb),
  (19, '[{"label":"Proverbios 19","book_usfm":"PRO","chapter":19}]'::jsonb),
  (20, '[{"label":"Proverbios 20","book_usfm":"PRO","chapter":20}]'::jsonb),
  (21, '[{"label":"Proverbios 21","book_usfm":"PRO","chapter":21}]'::jsonb),
  (22, '[{"label":"Proverbios 22","book_usfm":"PRO","chapter":22}]'::jsonb),
  (23, '[{"label":"Proverbios 23","book_usfm":"PRO","chapter":23}]'::jsonb),
  (24, '[{"label":"Proverbios 24","book_usfm":"PRO","chapter":24}]'::jsonb),
  (25, '[{"label":"Proverbios 25","book_usfm":"PRO","chapter":25}]'::jsonb),
  (26, '[{"label":"Proverbios 26","book_usfm":"PRO","chapter":26}]'::jsonb),
  (27, '[{"label":"Proverbios 27","book_usfm":"PRO","chapter":27}]'::jsonb),
  (28, '[{"label":"Proverbios 28","book_usfm":"PRO","chapter":28}]'::jsonb),
  (29, '[{"label":"Proverbios 29","book_usfm":"PRO","chapter":29}]'::jsonb),
  (30, '[{"label":"Proverbios 30","book_usfm":"PRO","chapter":30}]'::jsonb),
  (31, '[{"label":"Proverbios 31","book_usfm":"PRO","chapter":31}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'proverbios';

-- ===== 0004_profiles_group_visibility.sql =====
-- ============================================================================
-- Lee Tu Biblia — Visibilidad de perfiles entre co-miembros de grupo.
-- Migración 0004. Aplicar DESPUÉS de 0002.
--
-- Motivo: la app muestra el display_name de otros miembros del grupo (autor de
-- pedidos compartidos en Oración, lista de miembros en Grupos). La política base
-- de profiles solo permite ver el propio. Acá se agrega lectura del perfil de
-- quienes comparten al menos un grupo con el usuario actual.
--
-- Solo afecta SELECT y solo expone display_name/accent en la práctica (no hay
-- datos sensibles en profiles). El resto de políticas de profiles siguen igual.
-- ============================================================================

create or replace function public.shares_group_with(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

drop policy if exists "co-members profile select" on public.profiles;
create policy "co-members profile select" on public.profiles
  for select using (id = auth.uid() or public.shares_group_with(id));

-- ===== 0005_group_rpcs.sql =====
-- ============================================================================
-- Lee Tu Biblia — RPCs de grupos (Tarea 6, documento maestro §5.6)
-- Migración 0005. Aplicar DESPUÉS de 0002.
--
-- Por qué RPCs security-definer:
--  - Unirse por código requiere LEER un grupo del que aún no sos miembro, pero la
--    RLS de groups oculta los grupos ajenos. La función definer resuelve el código
--    y crea la membresía atómicamente, validando dentro.
--  - Crear grupo + auto-membresía de owner en un solo paso atómico.
--  - Administración (regenerar código, quitar miembro) chequea owner adentro.
-- Todas validan auth.uid() y la propiedad; no exponen nada que la app no muestre.
-- ============================================================================

-- Código de invitación corto, sin caracteres ambiguos (0/O/1/I).
create or replace function public.gen_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end $$;

-- Crear grupo: inserta el grupo y la membresía de owner. Devuelve el grupo.
create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), public.gen_invite_code(), auth.uid())
  returning * into g;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'owner');

  return g;
end $$;

-- Unirse por código: valida el código e inserta la membresía como 'member'.
-- Devuelve el grupo (o null si el código no existe). Idempotente si ya sos miembro.
create or replace function public.join_group_by_code(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;

  select * into g from public.groups
  where invite_code = upper(trim(p_code));
  if g.id is null then return null; end if;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return g;
end $$;

-- Regenerar el código de invitación (solo owner). Devuelve el nuevo código.
create or replace function public.regenerate_invite_code(p_group_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare newc text;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Solo el owner puede regenerar el código'; end if;

  newc := public.gen_invite_code();
  update public.groups set invite_code = newc where id = p_group_id;
  return newc;
end $$;

-- Quitar a un miembro (solo owner; el owner no se quita a sí mismo acá).
create or replace function public.remove_member(p_group_id bigint, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Solo el owner puede quitar miembros'; end if;
  if p_user_id = auth.uid() then raise exception 'El owner no puede quitarse a sí mismo'; end if;

  delete from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
end $$;

-- ===== 0006_delete_account.sql =====
-- ============================================================================
-- Lee Tu Biblia — Eliminar cuenta en cascada (Tarea 7, documento maestro §5.7)
-- Migración 0006. Aplicar DESPUÉS de 0001.
--
-- Qué borra: el perfil y TODOS los datos del usuario — reading_progress, sus
-- prayer_requests (privados Y los compartidos a grupos: se borran, no se
-- anonimizan) y sus group_members. La mayoría cae por ON DELETE CASCADE al
-- borrar la fila de auth.users.
--
-- Caso especial (grupos): groups.created_by tiene ON DELETE CASCADE, así que
-- borrar al usuario borraría también los grupos que creó AUNQUE tengan otros
-- miembros. Para respetar la regla ("reasignar owner al miembro más antiguo, o
-- borrar el grupo si queda vacío") reasignamos ANTES de borrar el usuario.
-- ============================================================================

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  g record;
  heir uuid;
begin
  if me is null then raise exception 'Sin sesión'; end if;

  -- Grupos donde soy owner o creador: reasignar o borrar antes del cascade.
  for g in
    select distinct gr.id
    from public.groups gr
    left join public.group_members gm
      on gm.group_id = gr.id and gm.user_id = me
    where gr.created_by = me or gm.role = 'owner'
  loop
    -- Miembro más antiguo distinto de mí.
    select user_id into heir
    from public.group_members
    where group_id = g.id and user_id <> me
    order by joined_at asc
    limit 1;

    if heir is not null then
      update public.group_members set role = 'owner'
        where group_id = g.id and user_id = heir;
      -- Reasignar created_by para que el cascade no se lleve el grupo.
      update public.groups set created_by = heir where id = g.id;
    else
      -- Sin otros miembros: el grupo queda vacío, se borra.
      delete from public.groups where id = g.id;
    end if;
  end loop;

  -- Borrar el usuario de auth: el resto (profile, progress, prayers propias
  -- incl. compartidas, memberships) cae por ON DELETE CASCADE.
  delete from auth.users where id = me;
end $$;

-- ===== 0007_prayer_life.sql =====
-- ============================================================================
-- Lee Tu Biblia — Fase 2 (parte 1): vida del pedido compartido.
-- Migración 0007. Aplicar DESPUÉS de 0002 (usa is_group_member / is_group_owner).
--
-- Cubre tres funciones diferidas del documento maestro §1.6:
--   1. prayer_intercessions          — "estoy orando por esto" (quién ora por cada pedido).
--   2. prayer_requests.testimony…    — compartir una respondida como testimonio al grupo.
--   3. group_prayer_stats(gid)       — resumen pastoral del owner (activos/respondidos/orando).
--
-- Nota de alcance: la ENTREGA activa de notificaciones (push real a hora fija) es
-- otra función de Fase 2 (Edge Function + cron) y NO se incluye acá. El autor "se
-- entera" de quién ora viendo el conteo y los avatares en su propio pedido (pull),
-- no por un push. Todo es idempotente: se puede reaplicar sin daño.
-- ============================================================================

-- ---- 1. Intercesiones ("estoy orando por esto") ---------------------------
create table if not exists public.prayer_intercessions (
  id         bigint generated always as identity primary key,
  prayer_id  bigint not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (prayer_id, user_id)
);
create index if not exists prayer_interc_prayer_idx on public.prayer_intercessions(prayer_id);
create index if not exists prayer_interc_user_idx   on public.prayer_intercessions(user_id);

-- Helper: ¿el usuario actual puede VER este pedido? (su autor, o —si es compartido—
-- un miembro del grupo destino). SECURITY DEFINER para no chocar con la RLS de
-- prayer_requests al evaluarse dentro de las policies de intercessions.
create or replace function public.can_see_prayer(pid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.prayer_requests p
    where p.id = pid and (
      p.user_id = auth.uid()
      or (p.visibility = 'shared' and public.is_group_member(p.shared_group_id))
    )
  );
$$;

alter table public.prayer_intercessions enable row level security;

-- Ver: quien pueda ver el pedido ve quiénes oran por él.
drop policy if exists "intercessions visible" on public.prayer_intercessions;
create policy "intercessions visible" on public.prayer_intercessions
  for select using (public.can_see_prayer(prayer_id));

-- Registrar la propia intercesión, y solo sobre pedidos que puedo ver.
drop policy if exists "intercede as self" on public.prayer_intercessions;
create policy "intercede as self" on public.prayer_intercessions
  for insert with check (user_id = auth.uid() and public.can_see_prayer(prayer_id));

-- Retirar la propia intercesión.
drop policy if exists "unintercede self" on public.prayer_intercessions;
create policy "unintercede self" on public.prayer_intercessions
  for delete using (user_id = auth.uid());

-- ---- 2. Testimonio en el pedido respondido --------------------------------
-- El autor, al marcar respondida una compartida, puede compartirla como
-- testimonio al grupo con unas palabras. Visibilidad y edición ya las cubren las
-- políticas de prayer_requests (compartidos visibles al grupo; edita solo el autor).
alter table public.prayer_requests
  add column if not exists testimony           text,
  add column if not exists testimony_shared    boolean not null default false,
  add column if not exists testimony_shared_at timestamptz;

-- ---- 3. Resumen pastoral del grupo (solo owner) ---------------------------
-- Una sola fila: pedidos activos, respondidos y personas que oraron en los
-- últimos 7 días, sobre los pedidos COMPARTIDOS del grupo. Valida owner adentro.
create or replace function public.group_prayer_stats(p_group_id bigint)
returns table (active int, answered int, praying_week int)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el owner puede ver el resumen del grupo';
  end if;

  return query
    select
      count(*) filter (where pr.status = 'active')::int,
      count(*) filter (where pr.status = 'answered')::int,
      (
        select count(distinct i.user_id)::int
        from public.prayer_intercessions i
        join public.prayer_requests p2 on p2.id = i.prayer_id
        where p2.shared_group_id = p_group_id
          and p2.visibility = 'shared'
          and i.created_at >= now() - interval '7 days'
      )
    from public.prayer_requests pr
    where pr.shared_group_id = p_group_id
      and pr.visibility = 'shared';
end $$;

-- ===== 0008_accent_pastels.sql =====
-- ============================================================================
-- Lee Tu Biblia — Acentos pastel (público joven)
-- Migración 0008. Aplicar DESPUÉS de 0001.
--
-- Agrega 6 valores pastel al enum accent_color. Sin esto, profiles.accent_color
-- (un enum) rechaza las keys nuevas: el color elegido se ve bien en el momento
-- (localStorage) pero NO persiste entre recargas, porque ProfilePrefSync repinta
-- con el valor viejo guardado en el perfil.
--
-- Idempotente: ADD VALUE IF NOT EXISTS no falla si el valor ya existe. El script
-- solo AGREGA valores (no los usa), así que corre sin problemas de transacción.
-- Pegá esto COMPLETO en el SQL Editor de Supabase y Run.
-- ============================================================================

alter type accent_color add value if not exists 'pastel_lavender';
alter type accent_color add value if not exists 'pastel_pink';
alter type accent_color add value if not exists 'pastel_mint';
alter type accent_color add value if not exists 'pastel_sky';
alter type accent_color add value if not exists 'pastel_coral';
alter type accent_color add value if not exists 'pastel_aqua';

-- ===== 0009_push_reminders.sql =====
-- ============================================================================
-- Lee Tu Biblia — Fase 2 (función 7): recordatorio por push real a hora fija.
-- Migración 0009. Aplicar DESPUÉS de 0001.
--
-- Soporte de servidor para el recordatorio diario:
--   - push_subscriptions          : subscripciones Web Push de cada dispositivo.
--   - profiles.timezone           : zona horaria IANA (sin esto el server no sabe
--                                   qué es "las 07:00" para cada usuario).
--   - profiles.reminder_last_sent : fecha local del último envío (dedupe diario).
--
-- La Edge Function `send-reminders` lee estas filas con el service role (omite
-- RLS) y manda el push. Todo idempotente.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_sub_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Cada usuario administra solo sus propias subscripciones.
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles
  add column if not exists timezone           text,
  add column if not exists reminder_last_sent date;

-- ===== 0010_group_prayer_notifications.sql =====
-- ============================================================================
-- Lee Tu Biblia — Aviso push de pedido de oración nuevo en el grupo
-- Migración 0010. Aplicar DESPUÉS de 0009 (usa push_subscriptions).
--
-- Agrega el opt-out por usuario: cuando alguien comparte un pedido a un grupo,
-- se notifica a los demás miembros que tengan esto en true. Default true.
-- El disparo (trigger) y el deploy de la función van en el README de
-- supabase/functions/notify-group-prayer/.
-- ============================================================================

alter table public.profiles
  add column if not exists group_prayer_notifications_enabled boolean not null default true;

-- ===== 0011_rename_group.sql =====
-- Permite al owner renombrar su grupo.
create or replace function public.rename_group(p_group_id bigint, p_name text)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Solo el owner puede renombrar el grupo'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  update public.groups set name = trim(p_name) where id = p_group_id;
end $$;

revoke all on function public.rename_group(bigint, text) from public;
grant execute on function public.rename_group(bigint, text) to authenticated;

-- ===== 0012_fix_cronologico.sql =====
-- ============================================================================
-- Lee Tu Biblia — Corrección de contenido del plan Cronológico.
-- Migración 0012. Aplicar DESPUÉS de 0003.
--
-- Re-siembra los días del plan Cronológico tras normalizar las referencias a
-- nivel de capítulo (scripts/data/cronologico.txt): elimina la basura de scraping
-- que aparecía en el día 365 y los rangos de versículos imposibles (p.ej.
-- "Salmos 117:1-29"). Conserva los versículos solo donde un capítulo se reparte
-- en varios días. Idempotente: borra y re-inserta los plan_days del plan.
-- Para bases ya desplegadas con el seed viejo; los despliegues nuevos ya toman
-- el 0003 corregido. Generado a partir de 0003 — no editar a mano.
-- ============================================================================

-- ---- Plan: Cronológico (365 días) ----
insert into public.reading_plans (slug, name, description, duration_days, is_active) values
  ('cronologico', 'Cronológico', 'La Biblia en el orden en que ocurrieron los hechos, en un año.', 365, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  duration_days = excluded.duration_days, is_active = excluded.is_active;

delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = 'cronologico');
insert into public.plan_days (plan_id, day_number, refs)
select p.id, d.day_number, d.refs from public.reading_plans p
cross join (values
  (1, '[{"label":"Génesis 1","book_usfm":"GEN","chapter":1},{"label":"Génesis 2","book_usfm":"GEN","chapter":2},{"label":"Génesis 3","book_usfm":"GEN","chapter":3}]'::jsonb),
  (2, '[{"label":"Génesis 4","book_usfm":"GEN","chapter":4},{"label":"Génesis 5","book_usfm":"GEN","chapter":5},{"label":"Génesis 6","book_usfm":"GEN","chapter":6},{"label":"Génesis 7","book_usfm":"GEN","chapter":7}]'::jsonb),
  (3, '[{"label":"Génesis 8","book_usfm":"GEN","chapter":8},{"label":"Génesis 9","book_usfm":"GEN","chapter":9},{"label":"Génesis 10","book_usfm":"GEN","chapter":10},{"label":"Génesis 11","book_usfm":"GEN","chapter":11}]'::jsonb),
  (4, '[{"label":"Job 1","book_usfm":"JOB","chapter":1},{"label":"Job 2","book_usfm":"JOB","chapter":2},{"label":"Job 3","book_usfm":"JOB","chapter":3},{"label":"Job 4","book_usfm":"JOB","chapter":4},{"label":"Job 5","book_usfm":"JOB","chapter":5}]'::jsonb),
  (5, '[{"label":"Job 6","book_usfm":"JOB","chapter":6},{"label":"Job 7","book_usfm":"JOB","chapter":7},{"label":"Job 8","book_usfm":"JOB","chapter":8},{"label":"Job 9","book_usfm":"JOB","chapter":9}]'::jsonb),
  (6, '[{"label":"Job 10","book_usfm":"JOB","chapter":10},{"label":"Job 11","book_usfm":"JOB","chapter":11},{"label":"Job 12","book_usfm":"JOB","chapter":12},{"label":"Job 13","book_usfm":"JOB","chapter":13}]'::jsonb),
  (7, '[{"label":"Job 14","book_usfm":"JOB","chapter":14},{"label":"Job 15","book_usfm":"JOB","chapter":15},{"label":"Job 16","book_usfm":"JOB","chapter":16}]'::jsonb),
  (8, '[{"label":"Job 17","book_usfm":"JOB","chapter":17},{"label":"Job 18","book_usfm":"JOB","chapter":18},{"label":"Job 19","book_usfm":"JOB","chapter":19},{"label":"Job 20","book_usfm":"JOB","chapter":20}]'::jsonb),
  (9, '[{"label":"Job 21","book_usfm":"JOB","chapter":21},{"label":"Job 22","book_usfm":"JOB","chapter":22},{"label":"Job 23","book_usfm":"JOB","chapter":23}]'::jsonb),
  (10, '[{"label":"Job 24","book_usfm":"JOB","chapter":24},{"label":"Job 25","book_usfm":"JOB","chapter":25},{"label":"Job 26","book_usfm":"JOB","chapter":26},{"label":"Job 27","book_usfm":"JOB","chapter":27},{"label":"Job 28","book_usfm":"JOB","chapter":28}]'::jsonb),
  (11, '[{"label":"Job 29","book_usfm":"JOB","chapter":29},{"label":"Job 30","book_usfm":"JOB","chapter":30},{"label":"Job 31","book_usfm":"JOB","chapter":31}]'::jsonb),
  (12, '[{"label":"Job 32","book_usfm":"JOB","chapter":32},{"label":"Job 33","book_usfm":"JOB","chapter":33},{"label":"Job 34","book_usfm":"JOB","chapter":34}]'::jsonb),
  (13, '[{"label":"Job 35","book_usfm":"JOB","chapter":35},{"label":"Job 36","book_usfm":"JOB","chapter":36},{"label":"Job 37","book_usfm":"JOB","chapter":37}]'::jsonb),
  (14, '[{"label":"Job 38","book_usfm":"JOB","chapter":38},{"label":"Job 39","book_usfm":"JOB","chapter":39}]'::jsonb),
  (15, '[{"label":"Job 40","book_usfm":"JOB","chapter":40},{"label":"Job 41","book_usfm":"JOB","chapter":41},{"label":"Job 42","book_usfm":"JOB","chapter":42}]'::jsonb),
  (16, '[{"label":"Génesis 12","book_usfm":"GEN","chapter":12},{"label":"Génesis 13","book_usfm":"GEN","chapter":13},{"label":"Génesis 14","book_usfm":"GEN","chapter":14},{"label":"Génesis 15","book_usfm":"GEN","chapter":15}]'::jsonb),
  (17, '[{"label":"Génesis 16","book_usfm":"GEN","chapter":16},{"label":"Génesis 17","book_usfm":"GEN","chapter":17},{"label":"Génesis 18","book_usfm":"GEN","chapter":18}]'::jsonb),
  (18, '[{"label":"Génesis 19","book_usfm":"GEN","chapter":19},{"label":"Génesis 20","book_usfm":"GEN","chapter":20},{"label":"Génesis 21","book_usfm":"GEN","chapter":21}]'::jsonb),
  (19, '[{"label":"Génesis 22","book_usfm":"GEN","chapter":22},{"label":"Génesis 23","book_usfm":"GEN","chapter":23},{"label":"Génesis 24","book_usfm":"GEN","chapter":24}]'::jsonb),
  (20, '[{"label":"Génesis 25","book_usfm":"GEN","chapter":25},{"label":"Génesis 26","book_usfm":"GEN","chapter":26}]'::jsonb),
  (21, '[{"label":"Génesis 27","book_usfm":"GEN","chapter":27},{"label":"Génesis 28","book_usfm":"GEN","chapter":28},{"label":"Génesis 29","book_usfm":"GEN","chapter":29}]'::jsonb),
  (22, '[{"label":"Génesis 30","book_usfm":"GEN","chapter":30},{"label":"Génesis 31","book_usfm":"GEN","chapter":31}]'::jsonb),
  (23, '[{"label":"Génesis 32","book_usfm":"GEN","chapter":32},{"label":"Génesis 33","book_usfm":"GEN","chapter":33},{"label":"Génesis 34","book_usfm":"GEN","chapter":34}]'::jsonb),
  (24, '[{"label":"Génesis 35","book_usfm":"GEN","chapter":35},{"label":"Génesis 36","book_usfm":"GEN","chapter":36},{"label":"Génesis 37","book_usfm":"GEN","chapter":37}]'::jsonb),
  (25, '[{"label":"Génesis 38","book_usfm":"GEN","chapter":38},{"label":"Génesis 39","book_usfm":"GEN","chapter":39},{"label":"Génesis 40","book_usfm":"GEN","chapter":40}]'::jsonb),
  (26, '[{"label":"Génesis 41","book_usfm":"GEN","chapter":41},{"label":"Génesis 42","book_usfm":"GEN","chapter":42}]'::jsonb),
  (27, '[{"label":"Génesis 43","book_usfm":"GEN","chapter":43},{"label":"Génesis 44","book_usfm":"GEN","chapter":44},{"label":"Génesis 45","book_usfm":"GEN","chapter":45}]'::jsonb),
  (28, '[{"label":"Génesis 46","book_usfm":"GEN","chapter":46},{"label":"Génesis 47","book_usfm":"GEN","chapter":47}]'::jsonb),
  (29, '[{"label":"Génesis 48","book_usfm":"GEN","chapter":48},{"label":"Génesis 49","book_usfm":"GEN","chapter":49},{"label":"Génesis 50","book_usfm":"GEN","chapter":50}]'::jsonb),
  (30, '[{"label":"Éxodo 1","book_usfm":"EXO","chapter":1},{"label":"Éxodo 2","book_usfm":"EXO","chapter":2},{"label":"Éxodo 3","book_usfm":"EXO","chapter":3}]'::jsonb),
  (31, '[{"label":"Éxodo 4","book_usfm":"EXO","chapter":4},{"label":"Éxodo 5","book_usfm":"EXO","chapter":5},{"label":"Éxodo 6","book_usfm":"EXO","chapter":6}]'::jsonb),
  (32, '[{"label":"Éxodo 7","book_usfm":"EXO","chapter":7},{"label":"Éxodo 8","book_usfm":"EXO","chapter":8},{"label":"Éxodo 9","book_usfm":"EXO","chapter":9}]'::jsonb),
  (33, '[{"label":"Éxodo 10","book_usfm":"EXO","chapter":10},{"label":"Éxodo 11","book_usfm":"EXO","chapter":11},{"label":"Éxodo 12","book_usfm":"EXO","chapter":12}]'::jsonb),
  (34, '[{"label":"Éxodo 13","book_usfm":"EXO","chapter":13},{"label":"Éxodo 14","book_usfm":"EXO","chapter":14},{"label":"Éxodo 15","book_usfm":"EXO","chapter":15}]'::jsonb),
  (35, '[{"label":"Éxodo 16","book_usfm":"EXO","chapter":16},{"label":"Éxodo 17","book_usfm":"EXO","chapter":17},{"label":"Éxodo 18","book_usfm":"EXO","chapter":18}]'::jsonb),
  (36, '[{"label":"Éxodo 19","book_usfm":"EXO","chapter":19},{"label":"Éxodo 20","book_usfm":"EXO","chapter":20},{"label":"Éxodo 21","book_usfm":"EXO","chapter":21}]'::jsonb),
  (37, '[{"label":"Éxodo 22","book_usfm":"EXO","chapter":22},{"label":"Éxodo 23","book_usfm":"EXO","chapter":23},{"label":"Éxodo 24","book_usfm":"EXO","chapter":24}]'::jsonb),
  (38, '[{"label":"Éxodo 25","book_usfm":"EXO","chapter":25},{"label":"Éxodo 26","book_usfm":"EXO","chapter":26},{"label":"Éxodo 27","book_usfm":"EXO","chapter":27}]'::jsonb),
  (39, '[{"label":"Éxodo 28","book_usfm":"EXO","chapter":28},{"label":"Éxodo 29","book_usfm":"EXO","chapter":29}]'::jsonb),
  (40, '[{"label":"Éxodo 30","book_usfm":"EXO","chapter":30},{"label":"Éxodo 31","book_usfm":"EXO","chapter":31},{"label":"Éxodo 32","book_usfm":"EXO","chapter":32}]'::jsonb),
  (41, '[{"label":"Éxodo 33","book_usfm":"EXO","chapter":33},{"label":"Éxodo 34","book_usfm":"EXO","chapter":34},{"label":"Éxodo 35","book_usfm":"EXO","chapter":35}]'::jsonb),
  (42, '[{"label":"Éxodo 36","book_usfm":"EXO","chapter":36},{"label":"Éxodo 37","book_usfm":"EXO","chapter":37},{"label":"Éxodo 38","book_usfm":"EXO","chapter":38}]'::jsonb),
  (43, '[{"label":"Éxodo 39","book_usfm":"EXO","chapter":39},{"label":"Éxodo 40","book_usfm":"EXO","chapter":40}]'::jsonb),
  (44, '[{"label":"Levítico 1","book_usfm":"LEV","chapter":1},{"label":"Levítico 2","book_usfm":"LEV","chapter":2},{"label":"Levítico 3","book_usfm":"LEV","chapter":3},{"label":"Levítico 4","book_usfm":"LEV","chapter":4}]'::jsonb),
  (45, '[{"label":"Levítico 5","book_usfm":"LEV","chapter":5},{"label":"Levítico 6","book_usfm":"LEV","chapter":6},{"label":"Levítico 7","book_usfm":"LEV","chapter":7}]'::jsonb),
  (46, '[{"label":"Levítico 8","book_usfm":"LEV","chapter":8},{"label":"Levítico 9","book_usfm":"LEV","chapter":9},{"label":"Levítico 10","book_usfm":"LEV","chapter":10}]'::jsonb),
  (47, '[{"label":"Levítico 11","book_usfm":"LEV","chapter":11},{"label":"Levítico 12","book_usfm":"LEV","chapter":12},{"label":"Levítico 13","book_usfm":"LEV","chapter":13}]'::jsonb),
  (48, '[{"label":"Levítico 14","book_usfm":"LEV","chapter":14},{"label":"Levítico 15","book_usfm":"LEV","chapter":15}]'::jsonb),
  (49, '[{"label":"Levítico 16","book_usfm":"LEV","chapter":16},{"label":"Levítico 17","book_usfm":"LEV","chapter":17},{"label":"Levítico 18","book_usfm":"LEV","chapter":18}]'::jsonb),
  (50, '[{"label":"Levítico 19","book_usfm":"LEV","chapter":19},{"label":"Levítico 20","book_usfm":"LEV","chapter":20},{"label":"Levítico 21","book_usfm":"LEV","chapter":21}]'::jsonb),
  (51, '[{"label":"Levítico 22","book_usfm":"LEV","chapter":22},{"label":"Levítico 23","book_usfm":"LEV","chapter":23}]'::jsonb),
  (52, '[{"label":"Levítico 24","book_usfm":"LEV","chapter":24},{"label":"Levítico 25","book_usfm":"LEV","chapter":25}]'::jsonb),
  (53, '[{"label":"Levítico 26","book_usfm":"LEV","chapter":26},{"label":"Levítico 27","book_usfm":"LEV","chapter":27}]'::jsonb),
  (54, '[{"label":"Números 1","book_usfm":"NUM","chapter":1},{"label":"Números 2","book_usfm":"NUM","chapter":2}]'::jsonb),
  (55, '[{"label":"Números 3","book_usfm":"NUM","chapter":3},{"label":"Números 4","book_usfm":"NUM","chapter":4}]'::jsonb),
  (56, '[{"label":"Números 5","book_usfm":"NUM","chapter":5},{"label":"Números 6","book_usfm":"NUM","chapter":6}]'::jsonb),
  (57, '[{"label":"Números 7","book_usfm":"NUM","chapter":7}]'::jsonb),
  (58, '[{"label":"Números 8","book_usfm":"NUM","chapter":8},{"label":"Números 9","book_usfm":"NUM","chapter":9},{"label":"Números 10","book_usfm":"NUM","chapter":10}]'::jsonb),
  (59, '[{"label":"Números 11","book_usfm":"NUM","chapter":11},{"label":"Números 12","book_usfm":"NUM","chapter":12},{"label":"Números 13","book_usfm":"NUM","chapter":13}]'::jsonb),
  (60, '[{"label":"Números 14","book_usfm":"NUM","chapter":14},{"label":"Números 15","book_usfm":"NUM","chapter":15},{"label":"Salmos 90","book_usfm":"PSA","chapter":90}]'::jsonb),
  (61, '[{"label":"Números 16","book_usfm":"NUM","chapter":16},{"label":"Números 17","book_usfm":"NUM","chapter":17}]'::jsonb),
  (62, '[{"label":"Números 18","book_usfm":"NUM","chapter":18},{"label":"Números 19","book_usfm":"NUM","chapter":19},{"label":"Números 20","book_usfm":"NUM","chapter":20}]'::jsonb),
  (63, '[{"label":"Números 21","book_usfm":"NUM","chapter":21},{"label":"Números 22","book_usfm":"NUM","chapter":22}]'::jsonb),
  (64, '[{"label":"Números 23","book_usfm":"NUM","chapter":23},{"label":"Números 24","book_usfm":"NUM","chapter":24},{"label":"Números 25","book_usfm":"NUM","chapter":25}]'::jsonb),
  (65, '[{"label":"Números 26","book_usfm":"NUM","chapter":26},{"label":"Números 27","book_usfm":"NUM","chapter":27}]'::jsonb),
  (66, '[{"label":"Números 28","book_usfm":"NUM","chapter":28},{"label":"Números 29","book_usfm":"NUM","chapter":29},{"label":"Números 30","book_usfm":"NUM","chapter":30}]'::jsonb),
  (67, '[{"label":"Números 31","book_usfm":"NUM","chapter":31},{"label":"Números 32","book_usfm":"NUM","chapter":32}]'::jsonb),
  (68, '[{"label":"Números 33","book_usfm":"NUM","chapter":33},{"label":"Números 34","book_usfm":"NUM","chapter":34}]'::jsonb),
  (69, '[{"label":"Números 35","book_usfm":"NUM","chapter":35},{"label":"Números 36","book_usfm":"NUM","chapter":36}]'::jsonb),
  (70, '[{"label":"Deuteronomio 1","book_usfm":"DEU","chapter":1},{"label":"Deuteronomio 2","book_usfm":"DEU","chapter":2}]'::jsonb),
  (71, '[{"label":"Deuteronomio 3","book_usfm":"DEU","chapter":3},{"label":"Deuteronomio 4","book_usfm":"DEU","chapter":4}]'::jsonb),
  (72, '[{"label":"Deuteronomio 5","book_usfm":"DEU","chapter":5},{"label":"Deuteronomio 6","book_usfm":"DEU","chapter":6},{"label":"Deuteronomio 7","book_usfm":"DEU","chapter":7}]'::jsonb),
  (73, '[{"label":"Deuteronomio 8","book_usfm":"DEU","chapter":8},{"label":"Deuteronomio 9","book_usfm":"DEU","chapter":9},{"label":"Deuteronomio 10","book_usfm":"DEU","chapter":10}]'::jsonb),
  (74, '[{"label":"Deuteronomio 11","book_usfm":"DEU","chapter":11},{"label":"Deuteronomio 12","book_usfm":"DEU","chapter":12},{"label":"Deuteronomio 13","book_usfm":"DEU","chapter":13}]'::jsonb),
  (75, '[{"label":"Deuteronomio 14","book_usfm":"DEU","chapter":14},{"label":"Deuteronomio 15","book_usfm":"DEU","chapter":15},{"label":"Deuteronomio 16","book_usfm":"DEU","chapter":16}]'::jsonb),
  (76, '[{"label":"Deuteronomio 17","book_usfm":"DEU","chapter":17},{"label":"Deuteronomio 18","book_usfm":"DEU","chapter":18},{"label":"Deuteronomio 19","book_usfm":"DEU","chapter":19},{"label":"Deuteronomio 20","book_usfm":"DEU","chapter":20}]'::jsonb),
  (77, '[{"label":"Deuteronomio 21","book_usfm":"DEU","chapter":21},{"label":"Deuteronomio 22","book_usfm":"DEU","chapter":22},{"label":"Deuteronomio 23","book_usfm":"DEU","chapter":23}]'::jsonb),
  (78, '[{"label":"Deuteronomio 24","book_usfm":"DEU","chapter":24},{"label":"Deuteronomio 25","book_usfm":"DEU","chapter":25},{"label":"Deuteronomio 26","book_usfm":"DEU","chapter":26},{"label":"Deuteronomio 27","book_usfm":"DEU","chapter":27}]'::jsonb),
  (79, '[{"label":"Deuteronomio 28","book_usfm":"DEU","chapter":28},{"label":"Deuteronomio 29","book_usfm":"DEU","chapter":29}]'::jsonb),
  (80, '[{"label":"Deuteronomio 30","book_usfm":"DEU","chapter":30},{"label":"Deuteronomio 31","book_usfm":"DEU","chapter":31}]'::jsonb),
  (81, '[{"label":"Deuteronomio 32","book_usfm":"DEU","chapter":32},{"label":"Deuteronomio 33","book_usfm":"DEU","chapter":33},{"label":"Deuteronomio 34","book_usfm":"DEU","chapter":34},{"label":"Salmos 91","book_usfm":"PSA","chapter":91}]'::jsonb),
  (82, '[{"label":"Josué 1","book_usfm":"JOS","chapter":1},{"label":"Josué 2","book_usfm":"JOS","chapter":2},{"label":"Josué 3","book_usfm":"JOS","chapter":3},{"label":"Josué 4","book_usfm":"JOS","chapter":4}]'::jsonb),
  (83, '[{"label":"Josué 5","book_usfm":"JOS","chapter":5},{"label":"Josué 6","book_usfm":"JOS","chapter":6},{"label":"Josué 7","book_usfm":"JOS","chapter":7},{"label":"Josué 8","book_usfm":"JOS","chapter":8}]'::jsonb),
  (84, '[{"label":"Josué 9","book_usfm":"JOS","chapter":9},{"label":"Josué 10","book_usfm":"JOS","chapter":10},{"label":"Josué 11","book_usfm":"JOS","chapter":11}]'::jsonb),
  (85, '[{"label":"Josué 12","book_usfm":"JOS","chapter":12},{"label":"Josué 13","book_usfm":"JOS","chapter":13},{"label":"Josué 14","book_usfm":"JOS","chapter":14},{"label":"Josué 15","book_usfm":"JOS","chapter":15}]'::jsonb),
  (86, '[{"label":"Josué 16","book_usfm":"JOS","chapter":16},{"label":"Josué 17","book_usfm":"JOS","chapter":17},{"label":"Josué 18","book_usfm":"JOS","chapter":18}]'::jsonb),
  (87, '[{"label":"Josué 19","book_usfm":"JOS","chapter":19},{"label":"Josué 20","book_usfm":"JOS","chapter":20},{"label":"Josué 21","book_usfm":"JOS","chapter":21}]'::jsonb),
  (88, '[{"label":"Josué 22","book_usfm":"JOS","chapter":22},{"label":"Josué 23","book_usfm":"JOS","chapter":23},{"label":"Josué 24","book_usfm":"JOS","chapter":24}]'::jsonb),
  (89, '[{"label":"Jueces 1","book_usfm":"JDG","chapter":1},{"label":"Jueces 2","book_usfm":"JDG","chapter":2}]'::jsonb),
  (90, '[{"label":"Jueces 3","book_usfm":"JDG","chapter":3},{"label":"Jueces 4","book_usfm":"JDG","chapter":4},{"label":"Jueces 5","book_usfm":"JDG","chapter":5}]'::jsonb),
  (91, '[{"label":"Jueces 6","book_usfm":"JDG","chapter":6},{"label":"Jueces 7","book_usfm":"JDG","chapter":7}]'::jsonb),
  (92, '[{"label":"Jueces 8","book_usfm":"JDG","chapter":8},{"label":"Jueces 9","book_usfm":"JDG","chapter":9}]'::jsonb),
  (93, '[{"label":"Jueces 10","book_usfm":"JDG","chapter":10},{"label":"Jueces 11","book_usfm":"JDG","chapter":11},{"label":"Jueces 12","book_usfm":"JDG","chapter":12}]'::jsonb),
  (94, '[{"label":"Jueces 13","book_usfm":"JDG","chapter":13},{"label":"Jueces 14","book_usfm":"JDG","chapter":14},{"label":"Jueces 15","book_usfm":"JDG","chapter":15}]'::jsonb),
  (95, '[{"label":"Jueces 16","book_usfm":"JDG","chapter":16},{"label":"Jueces 17","book_usfm":"JDG","chapter":17},{"label":"Jueces 18","book_usfm":"JDG","chapter":18}]'::jsonb),
  (96, '[{"label":"Jueces 19","book_usfm":"JDG","chapter":19},{"label":"Jueces 20","book_usfm":"JDG","chapter":20},{"label":"Jueces 21","book_usfm":"JDG","chapter":21}]'::jsonb),
  (97, '[{"label":"Rut 1","book_usfm":"RUT","chapter":1},{"label":"Rut 2","book_usfm":"RUT","chapter":2},{"label":"Rut 3","book_usfm":"RUT","chapter":3},{"label":"Rut 4","book_usfm":"RUT","chapter":4}]'::jsonb),
  (98, '[{"label":"1 Samuel 1","book_usfm":"1SA","chapter":1},{"label":"1 Samuel 2","book_usfm":"1SA","chapter":2},{"label":"1 Samuel 3","book_usfm":"1SA","chapter":3}]'::jsonb),
  (99, '[{"label":"1 Samuel 4","book_usfm":"1SA","chapter":4},{"label":"1 Samuel 5","book_usfm":"1SA","chapter":5},{"label":"1 Samuel 6","book_usfm":"1SA","chapter":6},{"label":"1 Samuel 7","book_usfm":"1SA","chapter":7},{"label":"1 Samuel 8","book_usfm":"1SA","chapter":8}]'::jsonb),
  (100, '[{"label":"1 Samuel 9","book_usfm":"1SA","chapter":9},{"label":"1 Samuel 10","book_usfm":"1SA","chapter":10},{"label":"1 Samuel 11","book_usfm":"1SA","chapter":11},{"label":"1 Samuel 12","book_usfm":"1SA","chapter":12}]'::jsonb),
  (101, '[{"label":"1 Samuel 13","book_usfm":"1SA","chapter":13},{"label":"1 Samuel 14","book_usfm":"1SA","chapter":14}]'::jsonb),
  (102, '[{"label":"1 Samuel 15","book_usfm":"1SA","chapter":15},{"label":"1 Samuel 16","book_usfm":"1SA","chapter":16},{"label":"1 Samuel 17","book_usfm":"1SA","chapter":17}]'::jsonb),
  (103, '[{"label":"1 Samuel 18","book_usfm":"1SA","chapter":18},{"label":"1 Samuel 19","book_usfm":"1SA","chapter":19},{"label":"1 Samuel 20","book_usfm":"1SA","chapter":20},{"label":"Salmos 11","book_usfm":"PSA","chapter":11},{"label":"Salmos 59","book_usfm":"PSA","chapter":59}]'::jsonb),
  (104, '[{"label":"1 Samuel 21","book_usfm":"1SA","chapter":21},{"label":"1 Samuel 22","book_usfm":"1SA","chapter":22},{"label":"1 Samuel 23","book_usfm":"1SA","chapter":23},{"label":"1 Samuel 24","book_usfm":"1SA","chapter":24}]'::jsonb),
  (105, '[{"label":"Salmos 7","book_usfm":"PSA","chapter":7},{"label":"Salmos 27","book_usfm":"PSA","chapter":27},{"label":"Salmos 31","book_usfm":"PSA","chapter":31},{"label":"Salmos 34","book_usfm":"PSA","chapter":34},{"label":"Salmos 52","book_usfm":"PSA","chapter":52}]'::jsonb),
  (106, '[{"label":"Salmos 56","book_usfm":"PSA","chapter":56},{"label":"Salmos 120","book_usfm":"PSA","chapter":120},{"label":"Salmos 140","book_usfm":"PSA","chapter":140},{"label":"Salmos 141","book_usfm":"PSA","chapter":141},{"label":"Salmos 142","book_usfm":"PSA","chapter":142}]'::jsonb),
  (107, '[{"label":"1 Samuel 25","book_usfm":"1SA","chapter":25},{"label":"1 Samuel 26","book_usfm":"1SA","chapter":26},{"label":"1 Samuel 27","book_usfm":"1SA","chapter":27}]'::jsonb),
  (108, '[{"label":"Salmos 17","book_usfm":"PSA","chapter":17},{"label":"Salmos 35","book_usfm":"PSA","chapter":35},{"label":"Salmos 54","book_usfm":"PSA","chapter":54},{"label":"Salmos 63","book_usfm":"PSA","chapter":63}]'::jsonb),
  (109, '[{"label":"1 Samuel 28","book_usfm":"1SA","chapter":28},{"label":"1 Samuel 29","book_usfm":"1SA","chapter":29},{"label":"1 Samuel 30","book_usfm":"1SA","chapter":30},{"label":"1 Samuel 31","book_usfm":"1SA","chapter":31},{"label":"Salmos 18","book_usfm":"PSA","chapter":18}]'::jsonb),
  (110, '[{"label":"Salmos 121","book_usfm":"PSA","chapter":121},{"label":"Salmos 123","book_usfm":"PSA","chapter":123},{"label":"Salmos 124","book_usfm":"PSA","chapter":124},{"label":"Salmos 125","book_usfm":"PSA","chapter":125},{"label":"Salmos 128","book_usfm":"PSA","chapter":128},{"label":"Salmos 129","book_usfm":"PSA","chapter":129},{"label":"Salmos 130","book_usfm":"PSA","chapter":130}]'::jsonb),
  (111, '[{"label":"2 Samuel 1","book_usfm":"2SA","chapter":1},{"label":"2 Samuel 2","book_usfm":"2SA","chapter":2},{"label":"2 Samuel 3","book_usfm":"2SA","chapter":3},{"label":"2 Samuel 4","book_usfm":"2SA","chapter":4}]'::jsonb),
  (112, '[{"label":"Salmos 6","book_usfm":"PSA","chapter":6},{"label":"Salmos 8","book_usfm":"PSA","chapter":8},{"label":"Salmos 9","book_usfm":"PSA","chapter":9},{"label":"Salmos 10","book_usfm":"PSA","chapter":10},{"label":"Salmos 14","book_usfm":"PSA","chapter":14},{"label":"Salmos 16","book_usfm":"PSA","chapter":16},{"label":"Salmos 19","book_usfm":"PSA","chapter":19},{"label":"Salmos 21","book_usfm":"PSA","chapter":21}]'::jsonb),
  (113, '[{"label":"1 Crónicas 1","book_usfm":"1CH","chapter":1},{"label":"1 Crónicas 2","book_usfm":"1CH","chapter":2}]'::jsonb),
  (114, '[{"label":"Salmos 43","book_usfm":"PSA","chapter":43},{"label":"Salmos 44","book_usfm":"PSA","chapter":44},{"label":"Salmos 45","book_usfm":"PSA","chapter":45},{"label":"Salmos 49","book_usfm":"PSA","chapter":49},{"label":"Salmos 84","book_usfm":"PSA","chapter":84},{"label":"Salmos 85","book_usfm":"PSA","chapter":85},{"label":"Salmos 87","book_usfm":"PSA","chapter":87}]'::jsonb),
  (115, '[{"label":"1 Crónicas 3","book_usfm":"1CH","chapter":3},{"label":"1 Crónicas 4","book_usfm":"1CH","chapter":4},{"label":"1 Crónicas 5","book_usfm":"1CH","chapter":5}]'::jsonb),
  (116, '[{"label":"Salmos 73","book_usfm":"PSA","chapter":73},{"label":"Salmos 77","book_usfm":"PSA","chapter":77},{"label":"Salmos 78","book_usfm":"PSA","chapter":78}]'::jsonb),
  (117, '[{"label":"1 Crónicas 6","book_usfm":"1CH","chapter":6}]'::jsonb),
  (118, '[{"label":"Salmos 81","book_usfm":"PSA","chapter":81},{"label":"Salmos 88","book_usfm":"PSA","chapter":88},{"label":"Salmos 92","book_usfm":"PSA","chapter":92},{"label":"Salmos 93","book_usfm":"PSA","chapter":93}]'::jsonb),
  (119, '[{"label":"1 Crónicas 7","book_usfm":"1CH","chapter":7},{"label":"1 Crónicas 8","book_usfm":"1CH","chapter":8},{"label":"1 Crónicas 9","book_usfm":"1CH","chapter":9},{"label":"1 Crónicas 10","book_usfm":"1CH","chapter":10}]'::jsonb),
  (120, '[{"label":"Salmos 102","book_usfm":"PSA","chapter":102},{"label":"Salmos 103","book_usfm":"PSA","chapter":103},{"label":"Salmos 104","book_usfm":"PSA","chapter":104}]'::jsonb),
  (121, '[{"label":"2 Samuel 5:1-10","book_usfm":"2SA","chapter":5},{"label":"1 Crónicas 11","book_usfm":"1CH","chapter":11},{"label":"1 Crónicas 12","book_usfm":"1CH","chapter":12}]'::jsonb),
  (122, '[{"label":"Salmos 133","book_usfm":"PSA","chapter":133}]'::jsonb),
  (123, '[{"label":"Salmos 106","book_usfm":"PSA","chapter":106},{"label":"Salmos 107","book_usfm":"PSA","chapter":107}]'::jsonb),
  (124, '[{"label":"2 Samuel 5:11-25","book_usfm":"2SA","chapter":5},{"label":"2 Samuel 6","book_usfm":"2SA","chapter":6},{"label":"1 Crónicas 13","book_usfm":"1CH","chapter":13},{"label":"1 Crónicas 14","book_usfm":"1CH","chapter":14},{"label":"1 Crónicas 15","book_usfm":"1CH","chapter":15},{"label":"1 Crónicas 16","book_usfm":"1CH","chapter":16}]'::jsonb),
  (125, '[{"label":"Salmos 1","book_usfm":"PSA","chapter":1},{"label":"Salmos 2","book_usfm":"PSA","chapter":2},{"label":"Salmos 15","book_usfm":"PSA","chapter":15},{"label":"Salmos 22","book_usfm":"PSA","chapter":22},{"label":"Salmos 23","book_usfm":"PSA","chapter":23},{"label":"Salmos 24","book_usfm":"PSA","chapter":24},{"label":"Salmos 47","book_usfm":"PSA","chapter":47},{"label":"Salmos 68","book_usfm":"PSA","chapter":68}]'::jsonb),
  (126, '[{"label":"Salmos 89","book_usfm":"PSA","chapter":89},{"label":"Salmos 96","book_usfm":"PSA","chapter":96},{"label":"Salmos 100","book_usfm":"PSA","chapter":100},{"label":"Salmos 101","book_usfm":"PSA","chapter":101},{"label":"Salmos 105","book_usfm":"PSA","chapter":105},{"label":"Salmos 132","book_usfm":"PSA","chapter":132}]'::jsonb),
  (127, '[{"label":"2 Samuel 7","book_usfm":"2SA","chapter":7},{"label":"1 Crónicas 17","book_usfm":"1CH","chapter":17}]'::jsonb),
  (128, '[{"label":"Salmos 25","book_usfm":"PSA","chapter":25},{"label":"Salmos 29","book_usfm":"PSA","chapter":29},{"label":"Salmos 33","book_usfm":"PSA","chapter":33},{"label":"Salmos 36","book_usfm":"PSA","chapter":36},{"label":"Salmos 39","book_usfm":"PSA","chapter":39}]'::jsonb),
  (129, '[{"label":"2 Samuel 8","book_usfm":"2SA","chapter":8},{"label":"2 Samuel 9","book_usfm":"2SA","chapter":9},{"label":"1 Crónicas 18","book_usfm":"1CH","chapter":18}]'::jsonb),
  (130, '[{"label":"Salmos 50","book_usfm":"PSA","chapter":50},{"label":"Salmos 53","book_usfm":"PSA","chapter":53},{"label":"Salmos 60","book_usfm":"PSA","chapter":60},{"label":"Salmos 75","book_usfm":"PSA","chapter":75}]'::jsonb),
  (131, '[{"label":"2 Samuel 10","book_usfm":"2SA","chapter":10},{"label":"1 Crónicas 19","book_usfm":"1CH","chapter":19},{"label":"Salmos 20","book_usfm":"PSA","chapter":20}]'::jsonb),
  (132, '[{"label":"Salmos 65","book_usfm":"PSA","chapter":65},{"label":"Salmos 66","book_usfm":"PSA","chapter":66},{"label":"Salmos 67","book_usfm":"PSA","chapter":67},{"label":"Salmos 69","book_usfm":"PSA","chapter":69},{"label":"Salmos 70","book_usfm":"PSA","chapter":70}]'::jsonb),
  (133, '[{"label":"2 Samuel 11","book_usfm":"2SA","chapter":11},{"label":"2 Samuel 12","book_usfm":"2SA","chapter":12},{"label":"1 Crónicas 20","book_usfm":"1CH","chapter":20}]'::jsonb),
  (134, '[{"label":"Salmos 32","book_usfm":"PSA","chapter":32},{"label":"Salmos 51","book_usfm":"PSA","chapter":51},{"label":"Salmos 86","book_usfm":"PSA","chapter":86},{"label":"Salmos 122","book_usfm":"PSA","chapter":122}]'::jsonb),
  (135, '[{"label":"2 Samuel 13","book_usfm":"2SA","chapter":13},{"label":"2 Samuel 14","book_usfm":"2SA","chapter":14},{"label":"2 Samuel 15","book_usfm":"2SA","chapter":15}]'::jsonb),
  (136, '[{"label":"Salmos 3","book_usfm":"PSA","chapter":3},{"label":"Salmos 4","book_usfm":"PSA","chapter":4},{"label":"Salmos 12","book_usfm":"PSA","chapter":12},{"label":"Salmos 13","book_usfm":"PSA","chapter":13},{"label":"Salmos 28","book_usfm":"PSA","chapter":28},{"label":"Salmos 55","book_usfm":"PSA","chapter":55}]'::jsonb),
  (137, '[{"label":"2 Samuel 16","book_usfm":"2SA","chapter":16},{"label":"2 Samuel 17","book_usfm":"2SA","chapter":17},{"label":"2 Samuel 18","book_usfm":"2SA","chapter":18}]'::jsonb),
  (138, '[{"label":"Salmos 26","book_usfm":"PSA","chapter":26},{"label":"Salmos 40","book_usfm":"PSA","chapter":40},{"label":"Salmos 58","book_usfm":"PSA","chapter":58},{"label":"Salmos 61","book_usfm":"PSA","chapter":61},{"label":"Salmos 62","book_usfm":"PSA","chapter":62},{"label":"Salmos 64","book_usfm":"PSA","chapter":64}]'::jsonb),
  (139, '[{"label":"2 Samuel 19","book_usfm":"2SA","chapter":19},{"label":"2 Samuel 20","book_usfm":"2SA","chapter":20},{"label":"2 Samuel 21","book_usfm":"2SA","chapter":21}]'::jsonb),
  (140, '[{"label":"Salmos 5","book_usfm":"PSA","chapter":5},{"label":"Salmos 38","book_usfm":"PSA","chapter":38},{"label":"Salmos 41","book_usfm":"PSA","chapter":41},{"label":"Salmos 42","book_usfm":"PSA","chapter":42}]'::jsonb),
  (141, '[{"label":"2 Samuel 22","book_usfm":"2SA","chapter":22},{"label":"2 Samuel 23","book_usfm":"2SA","chapter":23},{"label":"Salmos 57","book_usfm":"PSA","chapter":57}]'::jsonb),
  (142, '[{"label":"Salmos 95","book_usfm":"PSA","chapter":95},{"label":"Salmos 97","book_usfm":"PSA","chapter":97},{"label":"Salmos 98","book_usfm":"PSA","chapter":98},{"label":"Salmos 99","book_usfm":"PSA","chapter":99}]'::jsonb),
  (143, '[{"label":"2 Samuel 24","book_usfm":"2SA","chapter":24},{"label":"1 Crónicas 21","book_usfm":"1CH","chapter":21},{"label":"1 Crónicas 22","book_usfm":"1CH","chapter":22},{"label":"Salmos 30","book_usfm":"PSA","chapter":30}]'::jsonb),
  (144, '[{"label":"Salmos 108","book_usfm":"PSA","chapter":108},{"label":"Salmos 109","book_usfm":"PSA","chapter":109},{"label":"Salmos 110","book_usfm":"PSA","chapter":110}]'::jsonb),
  (145, '[{"label":"1 Crónicas 23","book_usfm":"1CH","chapter":23},{"label":"1 Crónicas 24","book_usfm":"1CH","chapter":24},{"label":"1 Crónicas 25","book_usfm":"1CH","chapter":25}]'::jsonb),
  (146, '[{"label":"Salmos 131","book_usfm":"PSA","chapter":131},{"label":"Salmos 138","book_usfm":"PSA","chapter":138},{"label":"Salmos 139","book_usfm":"PSA","chapter":139},{"label":"Salmos 143","book_usfm":"PSA","chapter":143},{"label":"Salmos 144","book_usfm":"PSA","chapter":144},{"label":"Salmos 145","book_usfm":"PSA","chapter":145}]'::jsonb),
  (147, '[{"label":"1 Crónicas 26","book_usfm":"1CH","chapter":26},{"label":"1 Crónicas 27","book_usfm":"1CH","chapter":27},{"label":"1 Crónicas 28","book_usfm":"1CH","chapter":28},{"label":"1 Crónicas 29","book_usfm":"1CH","chapter":29},{"label":"Salmos 127","book_usfm":"PSA","chapter":127}]'::jsonb),
  (148, '[{"label":"Salmos 111","book_usfm":"PSA","chapter":111},{"label":"Salmos 112","book_usfm":"PSA","chapter":112},{"label":"Salmos 113","book_usfm":"PSA","chapter":113},{"label":"Salmos 114","book_usfm":"PSA","chapter":114},{"label":"Salmos 115","book_usfm":"PSA","chapter":115},{"label":"Salmos 116","book_usfm":"PSA","chapter":116},{"label":"Salmos 117","book_usfm":"PSA","chapter":117},{"label":"Salmos 118","book_usfm":"PSA","chapter":118}]'::jsonb),
  (149, '[{"label":"1 Reyes 1","book_usfm":"1KI","chapter":1},{"label":"1 Reyes 2","book_usfm":"1KI","chapter":2},{"label":"Salmos 37","book_usfm":"PSA","chapter":37},{"label":"Salmos 71","book_usfm":"PSA","chapter":71},{"label":"Salmos 94","book_usfm":"PSA","chapter":94}]'::jsonb),
  (150, '[{"label":"Salmos 119:1-88","book_usfm":"PSA","chapter":119}]'::jsonb),
  (151, '[{"label":"1 Reyes 3","book_usfm":"1KI","chapter":3},{"label":"1 Reyes 4","book_usfm":"1KI","chapter":4},{"label":"2 Crónicas 1","book_usfm":"2CH","chapter":1},{"label":"Salmos 72","book_usfm":"PSA","chapter":72}]'::jsonb),
  (152, '[{"label":"Salmos 119:89-176","book_usfm":"PSA","chapter":119}]'::jsonb),
  (153, '[{"label":"Cantares 1","book_usfm":"SNG","chapter":1},{"label":"Cantares 2","book_usfm":"SNG","chapter":2},{"label":"Cantares 3","book_usfm":"SNG","chapter":3},{"label":"Cantares 4","book_usfm":"SNG","chapter":4},{"label":"Cantares 5","book_usfm":"SNG","chapter":5},{"label":"Cantares 6","book_usfm":"SNG","chapter":6},{"label":"Cantares 7","book_usfm":"SNG","chapter":7},{"label":"Cantares 8","book_usfm":"SNG","chapter":8}]'::jsonb),
  (154, '[{"label":"Proverbios 1","book_usfm":"PRO","chapter":1},{"label":"Proverbios 2","book_usfm":"PRO","chapter":2},{"label":"Proverbios 3","book_usfm":"PRO","chapter":3}]'::jsonb),
  (155, '[{"label":"Proverbios 4","book_usfm":"PRO","chapter":4},{"label":"Proverbios 5","book_usfm":"PRO","chapter":5},{"label":"Proverbios 6","book_usfm":"PRO","chapter":6}]'::jsonb),
  (156, '[{"label":"Proverbios 7","book_usfm":"PRO","chapter":7},{"label":"Proverbios 8","book_usfm":"PRO","chapter":8},{"label":"Proverbios 9","book_usfm":"PRO","chapter":9}]'::jsonb),
  (157, '[{"label":"Proverbios 10","book_usfm":"PRO","chapter":10},{"label":"Proverbios 11","book_usfm":"PRO","chapter":11},{"label":"Proverbios 12","book_usfm":"PRO","chapter":12}]'::jsonb),
  (158, '[{"label":"Proverbios 13","book_usfm":"PRO","chapter":13},{"label":"Proverbios 14","book_usfm":"PRO","chapter":14},{"label":"Proverbios 15","book_usfm":"PRO","chapter":15}]'::jsonb),
  (159, '[{"label":"Proverbios 16","book_usfm":"PRO","chapter":16},{"label":"Proverbios 17","book_usfm":"PRO","chapter":17},{"label":"Proverbios 18","book_usfm":"PRO","chapter":18}]'::jsonb),
  (160, '[{"label":"Proverbios 19","book_usfm":"PRO","chapter":19},{"label":"Proverbios 20","book_usfm":"PRO","chapter":20},{"label":"Proverbios 21","book_usfm":"PRO","chapter":21}]'::jsonb),
  (161, '[{"label":"Proverbios 22","book_usfm":"PRO","chapter":22},{"label":"Proverbios 23","book_usfm":"PRO","chapter":23},{"label":"Proverbios 24","book_usfm":"PRO","chapter":24}]'::jsonb),
  (162, '[{"label":"1 Reyes 5","book_usfm":"1KI","chapter":5},{"label":"1 Reyes 6","book_usfm":"1KI","chapter":6},{"label":"2 Crónicas 2","book_usfm":"2CH","chapter":2},{"label":"2 Crónicas 3","book_usfm":"2CH","chapter":3}]'::jsonb),
  (163, '[{"label":"1 Reyes 7","book_usfm":"1KI","chapter":7},{"label":"2 Crónicas 4","book_usfm":"2CH","chapter":4}]'::jsonb),
  (164, '[{"label":"1 Reyes 8","book_usfm":"1KI","chapter":8},{"label":"2 Crónicas 5","book_usfm":"2CH","chapter":5}]'::jsonb),
  (165, '[{"label":"2 Crónicas 6","book_usfm":"2CH","chapter":6},{"label":"2 Crónicas 7","book_usfm":"2CH","chapter":7},{"label":"Salmos 136","book_usfm":"PSA","chapter":136}]'::jsonb),
  (166, '[{"label":"Salmos 134","book_usfm":"PSA","chapter":134},{"label":"Salmos 146","book_usfm":"PSA","chapter":146},{"label":"Salmos 147","book_usfm":"PSA","chapter":147},{"label":"Salmos 148","book_usfm":"PSA","chapter":148},{"label":"Salmos 149","book_usfm":"PSA","chapter":149},{"label":"Salmos 150","book_usfm":"PSA","chapter":150}]'::jsonb),
  (167, '[{"label":"1 Reyes 9","book_usfm":"1KI","chapter":9},{"label":"2 Crónicas 8","book_usfm":"2CH","chapter":8}]'::jsonb),
  (168, '[{"label":"Proverbios 25","book_usfm":"PRO","chapter":25},{"label":"Proverbios 26","book_usfm":"PRO","chapter":26}]'::jsonb),
  (169, '[{"label":"Proverbios 27","book_usfm":"PRO","chapter":27},{"label":"Proverbios 28","book_usfm":"PRO","chapter":28},{"label":"Proverbios 29","book_usfm":"PRO","chapter":29}]'::jsonb),
  (170, '[{"label":"Eclesiastés 1","book_usfm":"ECC","chapter":1},{"label":"Eclesiastés 2","book_usfm":"ECC","chapter":2},{"label":"Eclesiastés 3","book_usfm":"ECC","chapter":3},{"label":"Eclesiastés 4","book_usfm":"ECC","chapter":4},{"label":"Eclesiastés 5","book_usfm":"ECC","chapter":5},{"label":"Eclesiastés 6","book_usfm":"ECC","chapter":6}]'::jsonb),
  (171, '[{"label":"Eclesiastés 7","book_usfm":"ECC","chapter":7},{"label":"Eclesiastés 8","book_usfm":"ECC","chapter":8},{"label":"Eclesiastés 9","book_usfm":"ECC","chapter":9},{"label":"Eclesiastés 10","book_usfm":"ECC","chapter":10},{"label":"Eclesiastés 11","book_usfm":"ECC","chapter":11},{"label":"Eclesiastés 12","book_usfm":"ECC","chapter":12}]'::jsonb),
  (172, '[{"label":"1 Reyes 10","book_usfm":"1KI","chapter":10},{"label":"1 Reyes 11","book_usfm":"1KI","chapter":11},{"label":"2 Crónicas 9","book_usfm":"2CH","chapter":9}]'::jsonb),
  (173, '[{"label":"Proverbios 30","book_usfm":"PRO","chapter":30},{"label":"Proverbios 31","book_usfm":"PRO","chapter":31}]'::jsonb),
  (174, '[{"label":"1 Reyes 12","book_usfm":"1KI","chapter":12},{"label":"1 Reyes 13","book_usfm":"1KI","chapter":13},{"label":"1 Reyes 14","book_usfm":"1KI","chapter":14}]'::jsonb),
  (175, '[{"label":"2 Crónicas 10","book_usfm":"2CH","chapter":10},{"label":"2 Crónicas 11","book_usfm":"2CH","chapter":11},{"label":"2 Crónicas 12","book_usfm":"2CH","chapter":12}]'::jsonb),
  (176, '[{"label":"1 Reyes 15:1-24","book_usfm":"1KI","chapter":15},{"label":"2 Crónicas 13","book_usfm":"2CH","chapter":13},{"label":"2 Crónicas 14","book_usfm":"2CH","chapter":14},{"label":"2 Crónicas 15","book_usfm":"2CH","chapter":15},{"label":"2 Crónicas 16","book_usfm":"2CH","chapter":16}]'::jsonb),
  (177, '[{"label":"1 Reyes 15:25-34","book_usfm":"1KI","chapter":15},{"label":"1 Reyes 16","book_usfm":"1KI","chapter":16},{"label":"2 Crónicas 17","book_usfm":"2CH","chapter":17}]'::jsonb),
  (178, '[{"label":"1 Reyes 17","book_usfm":"1KI","chapter":17},{"label":"1 Reyes 18","book_usfm":"1KI","chapter":18},{"label":"1 Reyes 19","book_usfm":"1KI","chapter":19}]'::jsonb),
  (179, '[{"label":"1 Reyes 20","book_usfm":"1KI","chapter":20},{"label":"1 Reyes 21","book_usfm":"1KI","chapter":21}]'::jsonb),
  (180, '[{"label":"1 Reyes 22","book_usfm":"1KI","chapter":22},{"label":"2 Crónicas 18","book_usfm":"2CH","chapter":18}]'::jsonb),
  (181, '[{"label":"2 Crónicas 19","book_usfm":"2CH","chapter":19},{"label":"2 Crónicas 20","book_usfm":"2CH","chapter":20},{"label":"2 Crónicas 21","book_usfm":"2CH","chapter":21},{"label":"2 Crónicas 22","book_usfm":"2CH","chapter":22},{"label":"2 Crónicas 23","book_usfm":"2CH","chapter":23}]'::jsonb),
  (182, '[{"label":"Abdías 1","book_usfm":"OBA","chapter":1},{"label":"Salmos 82","book_usfm":"PSA","chapter":82},{"label":"Salmos 83","book_usfm":"PSA","chapter":83}]'::jsonb),
  (183, '[{"label":"2 Reyes 1","book_usfm":"2KI","chapter":1},{"label":"2 Reyes 2","book_usfm":"2KI","chapter":2},{"label":"2 Reyes 3","book_usfm":"2KI","chapter":3},{"label":"2 Reyes 4","book_usfm":"2KI","chapter":4}]'::jsonb),
  (184, '[{"label":"2 Reyes 5","book_usfm":"2KI","chapter":5},{"label":"2 Reyes 6","book_usfm":"2KI","chapter":6},{"label":"2 Reyes 7","book_usfm":"2KI","chapter":7},{"label":"2 Reyes 8","book_usfm":"2KI","chapter":8}]'::jsonb),
  (185, '[{"label":"2 Reyes 9","book_usfm":"2KI","chapter":9},{"label":"2 Reyes 10","book_usfm":"2KI","chapter":10},{"label":"2 Reyes 11","book_usfm":"2KI","chapter":11}]'::jsonb),
  (186, '[{"label":"2 Reyes 12","book_usfm":"2KI","chapter":12},{"label":"2 Reyes 13","book_usfm":"2KI","chapter":13},{"label":"2 Crónicas 24","book_usfm":"2CH","chapter":24}]'::jsonb),
  (187, '[{"label":"2 Reyes 14","book_usfm":"2KI","chapter":14},{"label":"2 Crónicas 25","book_usfm":"2CH","chapter":25}]'::jsonb),
  (188, '[{"label":"Jonás 1","book_usfm":"JON","chapter":1},{"label":"Jonás 2","book_usfm":"JON","chapter":2},{"label":"Jonás 3","book_usfm":"JON","chapter":3},{"label":"Jonás 4","book_usfm":"JON","chapter":4}]'::jsonb),
  (189, '[{"label":"2 Reyes 15","book_usfm":"2KI","chapter":15},{"label":"2 Crónicas 26","book_usfm":"2CH","chapter":26}]'::jsonb),
  (190, '[{"label":"Isaías 1","book_usfm":"ISA","chapter":1},{"label":"Isaías 2","book_usfm":"ISA","chapter":2},{"label":"Isaías 3","book_usfm":"ISA","chapter":3},{"label":"Isaías 4","book_usfm":"ISA","chapter":4}]'::jsonb),
  (191, '[{"label":"Isaías 5","book_usfm":"ISA","chapter":5},{"label":"Isaías 6","book_usfm":"ISA","chapter":6},{"label":"Isaías 7","book_usfm":"ISA","chapter":7},{"label":"Isaías 8","book_usfm":"ISA","chapter":8}]'::jsonb),
  (192, '[{"label":"Amós 1","book_usfm":"AMO","chapter":1},{"label":"Amós 2","book_usfm":"AMO","chapter":2},{"label":"Amós 3","book_usfm":"AMO","chapter":3},{"label":"Amós 4","book_usfm":"AMO","chapter":4},{"label":"Amós 5","book_usfm":"AMO","chapter":5}]'::jsonb),
  (193, '[{"label":"Amós 6","book_usfm":"AMO","chapter":6},{"label":"Amós 7","book_usfm":"AMO","chapter":7},{"label":"Amós 8","book_usfm":"AMO","chapter":8},{"label":"Amós 9","book_usfm":"AMO","chapter":9}]'::jsonb),
  (194, '[{"label":"2 Crónicas 27","book_usfm":"2CH","chapter":27},{"label":"Isaías 9","book_usfm":"ISA","chapter":9},{"label":"Isaías 10","book_usfm":"ISA","chapter":10},{"label":"Isaías 11","book_usfm":"ISA","chapter":11},{"label":"Isaías 12","book_usfm":"ISA","chapter":12}]'::jsonb),
  (195, '[{"label":"Miqueas 1","book_usfm":"MIC","chapter":1},{"label":"Miqueas 2","book_usfm":"MIC","chapter":2},{"label":"Miqueas 3","book_usfm":"MIC","chapter":3},{"label":"Miqueas 4","book_usfm":"MIC","chapter":4},{"label":"Miqueas 5","book_usfm":"MIC","chapter":5},{"label":"Miqueas 6","book_usfm":"MIC","chapter":6},{"label":"Miqueas 7","book_usfm":"MIC","chapter":7}]'::jsonb),
  (196, '[{"label":"2 Crónicas 28","book_usfm":"2CH","chapter":28},{"label":"2 Reyes 16","book_usfm":"2KI","chapter":16},{"label":"2 Reyes 17","book_usfm":"2KI","chapter":17}]'::jsonb),
  (197, '[{"label":"Isaías 13","book_usfm":"ISA","chapter":13},{"label":"Isaías 14","book_usfm":"ISA","chapter":14},{"label":"Isaías 15","book_usfm":"ISA","chapter":15},{"label":"Isaías 16","book_usfm":"ISA","chapter":16},{"label":"Isaías 17","book_usfm":"ISA","chapter":17}]'::jsonb),
  (198, '[{"label":"Isaías 18","book_usfm":"ISA","chapter":18},{"label":"Isaías 19","book_usfm":"ISA","chapter":19},{"label":"Isaías 20","book_usfm":"ISA","chapter":20},{"label":"Isaías 21","book_usfm":"ISA","chapter":21},{"label":"Isaías 22","book_usfm":"ISA","chapter":22}]'::jsonb),
  (199, '[{"label":"Isaías 23","book_usfm":"ISA","chapter":23},{"label":"Isaías 24","book_usfm":"ISA","chapter":24},{"label":"Isaías 25","book_usfm":"ISA","chapter":25},{"label":"Isaías 26","book_usfm":"ISA","chapter":26},{"label":"Isaías 27","book_usfm":"ISA","chapter":27}]'::jsonb),
  (200, '[{"label":"2 Reyes 18:1-8","book_usfm":"2KI","chapter":18},{"label":"2 Crónicas 29","book_usfm":"2CH","chapter":29},{"label":"2 Crónicas 30","book_usfm":"2CH","chapter":30},{"label":"2 Crónicas 31","book_usfm":"2CH","chapter":31},{"label":"Salmos 48","book_usfm":"PSA","chapter":48}]'::jsonb),
  (201, '[{"label":"Oseas 1","book_usfm":"HOS","chapter":1},{"label":"Oseas 2","book_usfm":"HOS","chapter":2},{"label":"Oseas 3","book_usfm":"HOS","chapter":3},{"label":"Oseas 4","book_usfm":"HOS","chapter":4},{"label":"Oseas 5","book_usfm":"HOS","chapter":5},{"label":"Oseas 6","book_usfm":"HOS","chapter":6},{"label":"Oseas 7","book_usfm":"HOS","chapter":7}]'::jsonb),
  (202, '[{"label":"Oseas 8","book_usfm":"HOS","chapter":8},{"label":"Oseas 9","book_usfm":"HOS","chapter":9},{"label":"Oseas 10","book_usfm":"HOS","chapter":10},{"label":"Oseas 11","book_usfm":"HOS","chapter":11},{"label":"Oseas 12","book_usfm":"HOS","chapter":12},{"label":"Oseas 13","book_usfm":"HOS","chapter":13},{"label":"Oseas 14","book_usfm":"HOS","chapter":14}]'::jsonb),
  (203, '[{"label":"Isaías 28","book_usfm":"ISA","chapter":28},{"label":"Isaías 29","book_usfm":"ISA","chapter":29},{"label":"Isaías 30","book_usfm":"ISA","chapter":30}]'::jsonb),
  (204, '[{"label":"Isaías 31","book_usfm":"ISA","chapter":31},{"label":"Isaías 32","book_usfm":"ISA","chapter":32},{"label":"Isaías 33","book_usfm":"ISA","chapter":33},{"label":"Isaías 34","book_usfm":"ISA","chapter":34}]'::jsonb),
  (205, '[{"label":"Isaías 35","book_usfm":"ISA","chapter":35},{"label":"Isaías 36","book_usfm":"ISA","chapter":36}]'::jsonb),
  (206, '[{"label":"Isaías 37","book_usfm":"ISA","chapter":37},{"label":"Isaías 38","book_usfm":"ISA","chapter":38},{"label":"Isaías 39","book_usfm":"ISA","chapter":39},{"label":"Salmos 76","book_usfm":"PSA","chapter":76}]'::jsonb),
  (207, '[{"label":"Isaías 40","book_usfm":"ISA","chapter":40},{"label":"Isaías 41","book_usfm":"ISA","chapter":41},{"label":"Isaías 42","book_usfm":"ISA","chapter":42},{"label":"Isaías 43","book_usfm":"ISA","chapter":43}]'::jsonb),
  (208, '[{"label":"Isaías 44","book_usfm":"ISA","chapter":44},{"label":"Isaías 45","book_usfm":"ISA","chapter":45},{"label":"Isaías 46","book_usfm":"ISA","chapter":46},{"label":"Isaías 47","book_usfm":"ISA","chapter":47},{"label":"Isaías 48","book_usfm":"ISA","chapter":48}]'::jsonb),
  (209, '[{"label":"2 Reyes 18:9-37","book_usfm":"2KI","chapter":18},{"label":"2 Reyes 19","book_usfm":"2KI","chapter":19},{"label":"Salmos 46","book_usfm":"PSA","chapter":46},{"label":"Salmos 80","book_usfm":"PSA","chapter":80},{"label":"Salmos 135","book_usfm":"PSA","chapter":135}]'::jsonb),
  (210, '[{"label":"Isaías 49","book_usfm":"ISA","chapter":49},{"label":"Isaías 50","book_usfm":"ISA","chapter":50},{"label":"Isaías 51","book_usfm":"ISA","chapter":51},{"label":"Isaías 52","book_usfm":"ISA","chapter":52},{"label":"Isaías 53","book_usfm":"ISA","chapter":53}]'::jsonb),
  (211, '[{"label":"Isaías 54","book_usfm":"ISA","chapter":54},{"label":"Isaías 55","book_usfm":"ISA","chapter":55},{"label":"Isaías 56","book_usfm":"ISA","chapter":56},{"label":"Isaías 57","book_usfm":"ISA","chapter":57},{"label":"Isaías 58","book_usfm":"ISA","chapter":58}]'::jsonb),
  (212, '[{"label":"Isaías 59","book_usfm":"ISA","chapter":59},{"label":"Isaías 60","book_usfm":"ISA","chapter":60},{"label":"Isaías 61","book_usfm":"ISA","chapter":61},{"label":"Isaías 62","book_usfm":"ISA","chapter":62},{"label":"Isaías 63","book_usfm":"ISA","chapter":63}]'::jsonb),
  (213, '[{"label":"Isaías 64","book_usfm":"ISA","chapter":64},{"label":"Isaías 65","book_usfm":"ISA","chapter":65},{"label":"Isaías 66","book_usfm":"ISA","chapter":66}]'::jsonb),
  (214, '[{"label":"2 Reyes 20","book_usfm":"2KI","chapter":20},{"label":"2 Reyes 21","book_usfm":"2KI","chapter":21}]'::jsonb),
  (215, '[{"label":"2 Crónicas 32","book_usfm":"2CH","chapter":32},{"label":"2 Crónicas 33","book_usfm":"2CH","chapter":33}]'::jsonb),
  (216, '[{"label":"Nahúm 1","book_usfm":"NAM","chapter":1},{"label":"Nahúm 2","book_usfm":"NAM","chapter":2},{"label":"Nahúm 3","book_usfm":"NAM","chapter":3}]'::jsonb),
  (217, '[{"label":"2 Reyes 22","book_usfm":"2KI","chapter":22},{"label":"2 Reyes 23","book_usfm":"2KI","chapter":23},{"label":"2 Crónicas 34","book_usfm":"2CH","chapter":34},{"label":"2 Crónicas 35","book_usfm":"2CH","chapter":35}]'::jsonb),
  (218, '[{"label":"Sofonías 1","book_usfm":"ZEP","chapter":1},{"label":"Sofonías 2","book_usfm":"ZEP","chapter":2},{"label":"Sofonías 3","book_usfm":"ZEP","chapter":3}]'::jsonb),
  (219, '[{"label":"Jeremías 1","book_usfm":"JER","chapter":1},{"label":"Jeremías 2","book_usfm":"JER","chapter":2},{"label":"Jeremías 3","book_usfm":"JER","chapter":3}]'::jsonb),
  (220, '[{"label":"Jeremías 4","book_usfm":"JER","chapter":4},{"label":"Jeremías 5","book_usfm":"JER","chapter":5},{"label":"Jeremías 6","book_usfm":"JER","chapter":6}]'::jsonb),
  (221, '[{"label":"Jeremías 7","book_usfm":"JER","chapter":7},{"label":"Jeremías 8","book_usfm":"JER","chapter":8},{"label":"Jeremías 9","book_usfm":"JER","chapter":9}]'::jsonb),
  (222, '[{"label":"Jeremías 10","book_usfm":"JER","chapter":10},{"label":"Jeremías 11","book_usfm":"JER","chapter":11},{"label":"Jeremías 12","book_usfm":"JER","chapter":12},{"label":"Jeremías 13","book_usfm":"JER","chapter":13}]'::jsonb),
  (223, '[{"label":"Jeremías 14","book_usfm":"JER","chapter":14},{"label":"Jeremías 15","book_usfm":"JER","chapter":15},{"label":"Jeremías 16","book_usfm":"JER","chapter":16},{"label":"Jeremías 17","book_usfm":"JER","chapter":17}]'::jsonb),
  (224, '[{"label":"Jeremías 18","book_usfm":"JER","chapter":18},{"label":"Jeremías 19","book_usfm":"JER","chapter":19},{"label":"Jeremías 20","book_usfm":"JER","chapter":20},{"label":"Jeremías 21","book_usfm":"JER","chapter":21},{"label":"Jeremías 22","book_usfm":"JER","chapter":22}]'::jsonb),
  (225, '[{"label":"Jeremías 23","book_usfm":"JER","chapter":23},{"label":"Jeremías 24","book_usfm":"JER","chapter":24},{"label":"Jeremías 25","book_usfm":"JER","chapter":25}]'::jsonb),
  (226, '[{"label":"Jeremías 26","book_usfm":"JER","chapter":26},{"label":"Jeremías 27","book_usfm":"JER","chapter":27},{"label":"Jeremías 28","book_usfm":"JER","chapter":28},{"label":"Jeremías 29","book_usfm":"JER","chapter":29}]'::jsonb),
  (227, '[{"label":"Jeremías 30","book_usfm":"JER","chapter":30},{"label":"Jeremías 31","book_usfm":"JER","chapter":31}]'::jsonb),
  (228, '[{"label":"Jeremías 32","book_usfm":"JER","chapter":32},{"label":"Jeremías 33","book_usfm":"JER","chapter":33},{"label":"Jeremías 34","book_usfm":"JER","chapter":34}]'::jsonb),
  (229, '[{"label":"Jeremías 35","book_usfm":"JER","chapter":35},{"label":"Jeremías 36","book_usfm":"JER","chapter":36},{"label":"Jeremías 37","book_usfm":"JER","chapter":37}]'::jsonb),
  (230, '[{"label":"Jeremías 38","book_usfm":"JER","chapter":38},{"label":"Jeremías 39","book_usfm":"JER","chapter":39},{"label":"Jeremías 40","book_usfm":"JER","chapter":40},{"label":"Salmos 74","book_usfm":"PSA","chapter":74},{"label":"Salmos 79","book_usfm":"PSA","chapter":79}]'::jsonb),
  (231, '[{"label":"2 Reyes 24","book_usfm":"2KI","chapter":24},{"label":"2 Reyes 25","book_usfm":"2KI","chapter":25},{"label":"2 Crónicas 36","book_usfm":"2CH","chapter":36}]'::jsonb),
  (232, '[{"label":"Habacuc 1","book_usfm":"HAB","chapter":1},{"label":"Habacuc 2","book_usfm":"HAB","chapter":2},{"label":"Habacuc 3","book_usfm":"HAB","chapter":3}]'::jsonb),
  (233, '[{"label":"Jeremías 41","book_usfm":"JER","chapter":41},{"label":"Jeremías 42","book_usfm":"JER","chapter":42},{"label":"Jeremías 43","book_usfm":"JER","chapter":43},{"label":"Jeremías 44","book_usfm":"JER","chapter":44},{"label":"Jeremías 45","book_usfm":"JER","chapter":45}]'::jsonb),
  (234, '[{"label":"Jeremías 46","book_usfm":"JER","chapter":46},{"label":"Jeremías 47","book_usfm":"JER","chapter":47},{"label":"Jeremías 48","book_usfm":"JER","chapter":48}]'::jsonb),
  (235, '[{"label":"Jeremías 49","book_usfm":"JER","chapter":49},{"label":"Jeremías 50","book_usfm":"JER","chapter":50}]'::jsonb),
  (236, '[{"label":"Jeremías 51","book_usfm":"JER","chapter":51},{"label":"Jeremías 52","book_usfm":"JER","chapter":52}]'::jsonb),
  (237, '[{"label":"Lamentaciones 1","book_usfm":"LAM","chapter":1},{"label":"Lamentaciones 2","book_usfm":"LAM","chapter":2},{"label":"Lamentaciones 3:1-36","book_usfm":"LAM","chapter":3}]'::jsonb),
  (238, '[{"label":"Lamentaciones 3:37-66","book_usfm":"LAM","chapter":3},{"label":"Lamentaciones 4","book_usfm":"LAM","chapter":4},{"label":"Lamentaciones 5","book_usfm":"LAM","chapter":5}]'::jsonb),
  (239, '[{"label":"Ezequiel 1","book_usfm":"EZK","chapter":1},{"label":"Ezequiel 2","book_usfm":"EZK","chapter":2},{"label":"Ezequiel 3","book_usfm":"EZK","chapter":3},{"label":"Ezequiel 4","book_usfm":"EZK","chapter":4}]'::jsonb),
  (240, '[{"label":"Ezequiel 5","book_usfm":"EZK","chapter":5},{"label":"Ezequiel 6","book_usfm":"EZK","chapter":6},{"label":"Ezequiel 7","book_usfm":"EZK","chapter":7},{"label":"Ezequiel 8","book_usfm":"EZK","chapter":8}]'::jsonb),
  (241, '[{"label":"Ezequiel 9","book_usfm":"EZK","chapter":9},{"label":"Ezequiel 10","book_usfm":"EZK","chapter":10},{"label":"Ezequiel 11","book_usfm":"EZK","chapter":11},{"label":"Ezequiel 12","book_usfm":"EZK","chapter":12}]'::jsonb),
  (242, '[{"label":"Ezequiel 13","book_usfm":"EZK","chapter":13},{"label":"Ezequiel 14","book_usfm":"EZK","chapter":14},{"label":"Ezequiel 15","book_usfm":"EZK","chapter":15}]'::jsonb),
  (243, '[{"label":"Ezequiel 16","book_usfm":"EZK","chapter":16},{"label":"Ezequiel 17","book_usfm":"EZK","chapter":17}]'::jsonb),
  (244, '[{"label":"Ezequiel 18","book_usfm":"EZK","chapter":18},{"label":"Ezequiel 19","book_usfm":"EZK","chapter":19}]'::jsonb),
  (245, '[{"label":"Ezequiel 20","book_usfm":"EZK","chapter":20},{"label":"Ezequiel 21","book_usfm":"EZK","chapter":21}]'::jsonb),
  (246, '[{"label":"Ezequiel 22","book_usfm":"EZK","chapter":22},{"label":"Ezequiel 23","book_usfm":"EZK","chapter":23}]'::jsonb),
  (247, '[{"label":"Ezequiel 24","book_usfm":"EZK","chapter":24},{"label":"Ezequiel 25","book_usfm":"EZK","chapter":25},{"label":"Ezequiel 26","book_usfm":"EZK","chapter":26},{"label":"Ezequiel 27","book_usfm":"EZK","chapter":27}]'::jsonb),
  (248, '[{"label":"Ezequiel 28","book_usfm":"EZK","chapter":28},{"label":"Ezequiel 29","book_usfm":"EZK","chapter":29},{"label":"Ezequiel 30","book_usfm":"EZK","chapter":30},{"label":"Ezequiel 31","book_usfm":"EZK","chapter":31}]'::jsonb),
  (249, '[{"label":"Ezequiel 32","book_usfm":"EZK","chapter":32},{"label":"Ezequiel 33","book_usfm":"EZK","chapter":33},{"label":"Ezequiel 34","book_usfm":"EZK","chapter":34}]'::jsonb),
  (250, '[{"label":"Ezequiel 35","book_usfm":"EZK","chapter":35},{"label":"Ezequiel 36","book_usfm":"EZK","chapter":36},{"label":"Ezequiel 37","book_usfm":"EZK","chapter":37}]'::jsonb),
  (251, '[{"label":"Ezequiel 38","book_usfm":"EZK","chapter":38},{"label":"Ezequiel 39","book_usfm":"EZK","chapter":39}]'::jsonb),
  (252, '[{"label":"Ezequiel 40","book_usfm":"EZK","chapter":40},{"label":"Ezequiel 41","book_usfm":"EZK","chapter":41}]'::jsonb),
  (253, '[{"label":"Ezequiel 42","book_usfm":"EZK","chapter":42},{"label":"Ezequiel 43","book_usfm":"EZK","chapter":43}]'::jsonb),
  (254, '[{"label":"Ezequiel 44","book_usfm":"EZK","chapter":44},{"label":"Ezequiel 45","book_usfm":"EZK","chapter":45}]'::jsonb),
  (255, '[{"label":"Ezequiel 46","book_usfm":"EZK","chapter":46},{"label":"Ezequiel 47","book_usfm":"EZK","chapter":47},{"label":"Ezequiel 48","book_usfm":"EZK","chapter":48}]'::jsonb),
  (256, '[{"label":"Joel 1","book_usfm":"JOL","chapter":1},{"label":"Joel 2","book_usfm":"JOL","chapter":2},{"label":"Joel 3","book_usfm":"JOL","chapter":3}]'::jsonb),
  (257, '[{"label":"Daniel 1","book_usfm":"DAN","chapter":1},{"label":"Daniel 2","book_usfm":"DAN","chapter":2},{"label":"Daniel 3","book_usfm":"DAN","chapter":3}]'::jsonb),
  (258, '[{"label":"Daniel 4","book_usfm":"DAN","chapter":4},{"label":"Daniel 5","book_usfm":"DAN","chapter":5},{"label":"Daniel 6","book_usfm":"DAN","chapter":6}]'::jsonb),
  (259, '[{"label":"Daniel 7","book_usfm":"DAN","chapter":7},{"label":"Daniel 8","book_usfm":"DAN","chapter":8},{"label":"Daniel 9","book_usfm":"DAN","chapter":9}]'::jsonb),
  (260, '[{"label":"Daniel 10","book_usfm":"DAN","chapter":10},{"label":"Daniel 11","book_usfm":"DAN","chapter":11},{"label":"Daniel 12","book_usfm":"DAN","chapter":12}]'::jsonb),
  (261, '[{"label":"Esdras 1","book_usfm":"EZR","chapter":1},{"label":"Esdras 2","book_usfm":"EZR","chapter":2},{"label":"Esdras 3","book_usfm":"EZR","chapter":3}]'::jsonb),
  (262, '[{"label":"Esdras 4","book_usfm":"EZR","chapter":4},{"label":"Esdras 5","book_usfm":"EZR","chapter":5},{"label":"Esdras 6","book_usfm":"EZR","chapter":6},{"label":"Salmos 137","book_usfm":"PSA","chapter":137}]'::jsonb),
  (263, '[{"label":"Hageo 1","book_usfm":"HAG","chapter":1},{"label":"Hageo 2","book_usfm":"HAG","chapter":2}]'::jsonb),
  (264, '[{"label":"Zacarías 1","book_usfm":"ZEC","chapter":1},{"label":"Zacarías 2","book_usfm":"ZEC","chapter":2},{"label":"Zacarías 3","book_usfm":"ZEC","chapter":3},{"label":"Zacarías 4","book_usfm":"ZEC","chapter":4},{"label":"Zacarías 5","book_usfm":"ZEC","chapter":5},{"label":"Zacarías 6","book_usfm":"ZEC","chapter":6},{"label":"Zacarías 7","book_usfm":"ZEC","chapter":7}]'::jsonb),
  (265, '[{"label":"Zacarías 8","book_usfm":"ZEC","chapter":8},{"label":"Zacarías 9","book_usfm":"ZEC","chapter":9},{"label":"Zacarías 10","book_usfm":"ZEC","chapter":10},{"label":"Zacarías 11","book_usfm":"ZEC","chapter":11},{"label":"Zacarías 12","book_usfm":"ZEC","chapter":12},{"label":"Zacarías 13","book_usfm":"ZEC","chapter":13},{"label":"Zacarías 14","book_usfm":"ZEC","chapter":14}]'::jsonb),
  (266, '[{"label":"Ester 1","book_usfm":"EST","chapter":1},{"label":"Ester 2","book_usfm":"EST","chapter":2},{"label":"Ester 3","book_usfm":"EST","chapter":3},{"label":"Ester 4","book_usfm":"EST","chapter":4},{"label":"Ester 5","book_usfm":"EST","chapter":5}]'::jsonb),
  (267, '[{"label":"Ester 6","book_usfm":"EST","chapter":6},{"label":"Ester 7","book_usfm":"EST","chapter":7},{"label":"Ester 8","book_usfm":"EST","chapter":8},{"label":"Ester 9","book_usfm":"EST","chapter":9},{"label":"Ester 10","book_usfm":"EST","chapter":10}]'::jsonb),
  (268, '[{"label":"Esdras 7","book_usfm":"EZR","chapter":7},{"label":"Esdras 8","book_usfm":"EZR","chapter":8},{"label":"Esdras 9","book_usfm":"EZR","chapter":9},{"label":"Esdras 10","book_usfm":"EZR","chapter":10}]'::jsonb),
  (269, '[{"label":"Nehemías 1","book_usfm":"NEH","chapter":1},{"label":"Nehemías 2","book_usfm":"NEH","chapter":2},{"label":"Nehemías 3","book_usfm":"NEH","chapter":3},{"label":"Nehemías 4","book_usfm":"NEH","chapter":4},{"label":"Nehemías 5","book_usfm":"NEH","chapter":5}]'::jsonb),
  (270, '[{"label":"Nehemías 6","book_usfm":"NEH","chapter":6},{"label":"Nehemías 7","book_usfm":"NEH","chapter":7}]'::jsonb),
  (271, '[{"label":"Nehemías 8","book_usfm":"NEH","chapter":8},{"label":"Nehemías 9","book_usfm":"NEH","chapter":9},{"label":"Nehemías 10","book_usfm":"NEH","chapter":10}]'::jsonb),
  (272, '[{"label":"Nehemías 11","book_usfm":"NEH","chapter":11},{"label":"Nehemías 12","book_usfm":"NEH","chapter":12},{"label":"Nehemías 13","book_usfm":"NEH","chapter":13},{"label":"Salmos 126","book_usfm":"PSA","chapter":126}]'::jsonb),
  (273, '[{"label":"Malaquías 1","book_usfm":"MAL","chapter":1},{"label":"Malaquías 2","book_usfm":"MAL","chapter":2},{"label":"Malaquías 3","book_usfm":"MAL","chapter":3},{"label":"Malaquías 4","book_usfm":"MAL","chapter":4}]'::jsonb),
  (274, '[{"label":"Lucas 1","book_usfm":"LUK","chapter":1},{"label":"Juan 1:1-14","book_usfm":"JHN","chapter":1}]'::jsonb),
  (275, '[{"label":"Mateo 1","book_usfm":"MAT","chapter":1},{"label":"Lucas 2:1-38","book_usfm":"LUK","chapter":2}]'::jsonb),
  (276, '[{"label":"Mateo 2","book_usfm":"MAT","chapter":2},{"label":"Lucas 2:39-52","book_usfm":"LUK","chapter":2}]'::jsonb),
  (277, '[{"label":"Mateo 3","book_usfm":"MAT","chapter":3},{"label":"Marcos 1","book_usfm":"MRK","chapter":1},{"label":"Lucas 3","book_usfm":"LUK","chapter":3}]'::jsonb),
  (278, '[{"label":"Mateo 4","book_usfm":"MAT","chapter":4},{"label":"Lucas 4","book_usfm":"LUK","chapter":4},{"label":"Lucas 5","book_usfm":"LUK","chapter":5},{"label":"Juan 1:15-51","book_usfm":"JHN","chapter":1}]'::jsonb),
  (279, '[{"label":"Juan 2","book_usfm":"JHN","chapter":2},{"label":"Juan 3","book_usfm":"JHN","chapter":3},{"label":"Juan 4","book_usfm":"JHN","chapter":4}]'::jsonb),
  (280, '[{"label":"Marcos 2","book_usfm":"MRK","chapter":2}]'::jsonb),
  (281, '[{"label":"Juan 5","book_usfm":"JHN","chapter":5}]'::jsonb),
  (282, '[{"label":"Mateo 12:1-21","book_usfm":"MAT","chapter":12},{"label":"Marcos 3","book_usfm":"MRK","chapter":3},{"label":"Lucas 6","book_usfm":"LUK","chapter":6}]'::jsonb),
  (283, '[{"label":"Mateo 5","book_usfm":"MAT","chapter":5},{"label":"Mateo 6","book_usfm":"MAT","chapter":6},{"label":"Mateo 7","book_usfm":"MAT","chapter":7}]'::jsonb),
  (284, '[{"label":"Mateo 8:1-13","book_usfm":"MAT","chapter":8},{"label":"Lucas 7","book_usfm":"LUK","chapter":7}]'::jsonb),
  (285, '[{"label":"Mateo 11","book_usfm":"MAT","chapter":11}]'::jsonb),
  (286, '[{"label":"Mateo 12:22-50","book_usfm":"MAT","chapter":12},{"label":"Lucas 11:1-54","book_usfm":"LUK","chapter":11}]'::jsonb),
  (287, '[{"label":"Mateo 13","book_usfm":"MAT","chapter":13},{"label":"Lucas 8","book_usfm":"LUK","chapter":8}]'::jsonb),
  (288, '[{"label":"Mateo 8:14-34","book_usfm":"MAT","chapter":8},{"label":"Marcos 4","book_usfm":"MRK","chapter":4},{"label":"Marcos 5","book_usfm":"MRK","chapter":5}]'::jsonb),
  (289, '[{"label":"Mateo 9","book_usfm":"MAT","chapter":9},{"label":"Mateo 10","book_usfm":"MAT","chapter":10}]'::jsonb),
  (290, '[{"label":"Mateo 14","book_usfm":"MAT","chapter":14},{"label":"Marcos 6","book_usfm":"MRK","chapter":6},{"label":"Lucas 9:1-17","book_usfm":"LUK","chapter":9}]'::jsonb),
  (291, '[{"label":"Juan 6","book_usfm":"JHN","chapter":6}]'::jsonb),
  (292, '[{"label":"Mateo 15","book_usfm":"MAT","chapter":15},{"label":"Marcos 7","book_usfm":"MRK","chapter":7}]'::jsonb),
  (293, '[{"label":"Mateo 16","book_usfm":"MAT","chapter":16},{"label":"Marcos 8","book_usfm":"MRK","chapter":8},{"label":"Lucas 9:18-27","book_usfm":"LUK","chapter":9}]'::jsonb),
  (294, '[{"label":"Mateo 17","book_usfm":"MAT","chapter":17},{"label":"Marcos 9","book_usfm":"MRK","chapter":9},{"label":"Lucas 9:28-62","book_usfm":"LUK","chapter":9}]'::jsonb),
  (295, '[{"label":"Mateo 18","book_usfm":"MAT","chapter":18}]'::jsonb),
  (296, '[{"label":"Juan 7","book_usfm":"JHN","chapter":7},{"label":"Juan 8","book_usfm":"JHN","chapter":8}]'::jsonb),
  (297, '[{"label":"Juan 9","book_usfm":"JHN","chapter":9},{"label":"Juan 10:1-21","book_usfm":"JHN","chapter":10}]'::jsonb),
  (298, '[{"label":"Lucas 10","book_usfm":"LUK","chapter":10},{"label":"Lucas 11:1-54","book_usfm":"LUK","chapter":11},{"label":"Juan 10:22-42","book_usfm":"JHN","chapter":10}]'::jsonb),
  (299, '[{"label":"Lucas 12","book_usfm":"LUK","chapter":12},{"label":"Lucas 13","book_usfm":"LUK","chapter":13}]'::jsonb),
  (300, '[{"label":"Lucas 14","book_usfm":"LUK","chapter":14},{"label":"Lucas 15","book_usfm":"LUK","chapter":15}]'::jsonb),
  (301, '[{"label":"Lucas 16","book_usfm":"LUK","chapter":16},{"label":"Lucas 17:1-10","book_usfm":"LUK","chapter":17}]'::jsonb),
  (302, '[{"label":"Juan 11","book_usfm":"JHN","chapter":11}]'::jsonb),
  (303, '[{"label":"Lucas 17:11-37","book_usfm":"LUK","chapter":17},{"label":"Lucas 18:1-14","book_usfm":"LUK","chapter":18}]'::jsonb),
  (304, '[{"label":"Mateo 19","book_usfm":"MAT","chapter":19},{"label":"Marcos 10","book_usfm":"MRK","chapter":10}]'::jsonb),
  (305, '[{"label":"Mateo 20","book_usfm":"MAT","chapter":20},{"label":"Mateo 21","book_usfm":"MAT","chapter":21}]'::jsonb),
  (306, '[{"label":"Lucas 18:15-43","book_usfm":"LUK","chapter":18},{"label":"Lucas 19","book_usfm":"LUK","chapter":19}]'::jsonb),
  (307, '[{"label":"Marcos 11","book_usfm":"MRK","chapter":11},{"label":"Juan 12","book_usfm":"JHN","chapter":12}]'::jsonb),
  (308, '[{"label":"Mateo 22","book_usfm":"MAT","chapter":22},{"label":"Marcos 12","book_usfm":"MRK","chapter":12}]'::jsonb),
  (309, '[{"label":"Mateo 23","book_usfm":"MAT","chapter":23},{"label":"Lucas 20","book_usfm":"LUK","chapter":20},{"label":"Lucas 21","book_usfm":"LUK","chapter":21}]'::jsonb),
  (310, '[{"label":"Marcos 13","book_usfm":"MRK","chapter":13}]'::jsonb),
  (311, '[{"label":"Mateo 24","book_usfm":"MAT","chapter":24}]'::jsonb),
  (312, '[{"label":"Mateo 25","book_usfm":"MAT","chapter":25}]'::jsonb),
  (313, '[{"label":"Mateo 26","book_usfm":"MAT","chapter":26},{"label":"Marcos 14","book_usfm":"MRK","chapter":14}]'::jsonb),
  (314, '[{"label":"Lucas 22","book_usfm":"LUK","chapter":22},{"label":"Juan 13","book_usfm":"JHN","chapter":13}]'::jsonb),
  (315, '[{"label":"Juan 14","book_usfm":"JHN","chapter":14},{"label":"Juan 15","book_usfm":"JHN","chapter":15},{"label":"Juan 16","book_usfm":"JHN","chapter":16},{"label":"Juan 17","book_usfm":"JHN","chapter":17}]'::jsonb),
  (316, '[{"label":"Mateo 27","book_usfm":"MAT","chapter":27},{"label":"Marcos 15","book_usfm":"MRK","chapter":15}]'::jsonb),
  (317, '[{"label":"Lucas 23","book_usfm":"LUK","chapter":23},{"label":"Juan 18","book_usfm":"JHN","chapter":18},{"label":"Juan 19","book_usfm":"JHN","chapter":19}]'::jsonb),
  (318, '[{"label":"Mateo 28","book_usfm":"MAT","chapter":28},{"label":"Marcos 16","book_usfm":"MRK","chapter":16}]'::jsonb),
  (319, '[{"label":"Lucas 24","book_usfm":"LUK","chapter":24},{"label":"Juan 20","book_usfm":"JHN","chapter":20},{"label":"Juan 21","book_usfm":"JHN","chapter":21}]'::jsonb),
  (320, '[{"label":"Hechos 1","book_usfm":"ACT","chapter":1},{"label":"Hechos 2","book_usfm":"ACT","chapter":2},{"label":"Hechos 3","book_usfm":"ACT","chapter":3}]'::jsonb),
  (321, '[{"label":"Hechos 4","book_usfm":"ACT","chapter":4},{"label":"Hechos 5","book_usfm":"ACT","chapter":5},{"label":"Hechos 6","book_usfm":"ACT","chapter":6}]'::jsonb),
  (322, '[{"label":"Hechos 7","book_usfm":"ACT","chapter":7},{"label":"Hechos 8","book_usfm":"ACT","chapter":8}]'::jsonb),
  (323, '[{"label":"Hechos 9","book_usfm":"ACT","chapter":9},{"label":"Hechos 10","book_usfm":"ACT","chapter":10}]'::jsonb),
  (324, '[{"label":"Hechos 11","book_usfm":"ACT","chapter":11},{"label":"Hechos 12","book_usfm":"ACT","chapter":12}]'::jsonb),
  (325, '[{"label":"Hechos 13","book_usfm":"ACT","chapter":13},{"label":"Hechos 14","book_usfm":"ACT","chapter":14}]'::jsonb),
  (326, '[{"label":"Santiago 1","book_usfm":"JAS","chapter":1},{"label":"Santiago 2","book_usfm":"JAS","chapter":2},{"label":"Santiago 3","book_usfm":"JAS","chapter":3},{"label":"Santiago 4","book_usfm":"JAS","chapter":4},{"label":"Santiago 5","book_usfm":"JAS","chapter":5}]'::jsonb),
  (327, '[{"label":"Hechos 15","book_usfm":"ACT","chapter":15},{"label":"Hechos 16","book_usfm":"ACT","chapter":16}]'::jsonb),
  (328, '[{"label":"Gálatas 1","book_usfm":"GAL","chapter":1},{"label":"Gálatas 2","book_usfm":"GAL","chapter":2},{"label":"Gálatas 3","book_usfm":"GAL","chapter":3}]'::jsonb),
  (329, '[{"label":"Gálatas 4","book_usfm":"GAL","chapter":4},{"label":"Gálatas 5","book_usfm":"GAL","chapter":5},{"label":"Gálatas 6","book_usfm":"GAL","chapter":6}]'::jsonb),
  (330, '[{"label":"Hechos 17","book_usfm":"ACT","chapter":17},{"label":"Hechos 18:1-18","book_usfm":"ACT","chapter":18}]'::jsonb),
  (331, '[{"label":"1 Tesalonicenses 1","book_usfm":"1TH","chapter":1},{"label":"1 Tesalonicenses 2","book_usfm":"1TH","chapter":2},{"label":"1 Tesalonicenses 3","book_usfm":"1TH","chapter":3},{"label":"1 Tesalonicenses 4","book_usfm":"1TH","chapter":4},{"label":"1 Tesalonicenses 5","book_usfm":"1TH","chapter":5},{"label":"2 Tesalonicenses 1","book_usfm":"2TH","chapter":1},{"label":"2 Tesalonicenses 2","book_usfm":"2TH","chapter":2},{"label":"2 Tesalonicenses 3","book_usfm":"2TH","chapter":3}]'::jsonb),
  (332, '[{"label":"Hechos 18:19-28","book_usfm":"ACT","chapter":18},{"label":"Hechos 19","book_usfm":"ACT","chapter":19}]'::jsonb),
  (333, '[{"label":"1 Corintios 1","book_usfm":"1CO","chapter":1},{"label":"1 Corintios 2","book_usfm":"1CO","chapter":2},{"label":"1 Corintios 3","book_usfm":"1CO","chapter":3},{"label":"1 Corintios 4","book_usfm":"1CO","chapter":4}]'::jsonb),
  (334, '[{"label":"1 Corintios 5","book_usfm":"1CO","chapter":5},{"label":"1 Corintios 6","book_usfm":"1CO","chapter":6},{"label":"1 Corintios 7","book_usfm":"1CO","chapter":7},{"label":"1 Corintios 8","book_usfm":"1CO","chapter":8}]'::jsonb),
  (335, '[{"label":"1 Corintios 9","book_usfm":"1CO","chapter":9},{"label":"1 Corintios 10","book_usfm":"1CO","chapter":10},{"label":"1 Corintios 11","book_usfm":"1CO","chapter":11}]'::jsonb),
  (336, '[{"label":"1 Corintios 12","book_usfm":"1CO","chapter":12},{"label":"1 Corintios 13","book_usfm":"1CO","chapter":13},{"label":"1 Corintios 14","book_usfm":"1CO","chapter":14}]'::jsonb),
  (337, '[{"label":"1 Corintios 15","book_usfm":"1CO","chapter":15},{"label":"1 Corintios 16","book_usfm":"1CO","chapter":16}]'::jsonb),
  (338, '[{"label":"2 Corintios 1","book_usfm":"2CO","chapter":1},{"label":"2 Corintios 2","book_usfm":"2CO","chapter":2},{"label":"2 Corintios 3","book_usfm":"2CO","chapter":3},{"label":"2 Corintios 4","book_usfm":"2CO","chapter":4}]'::jsonb),
  (339, '[{"label":"2 Corintios 5","book_usfm":"2CO","chapter":5},{"label":"2 Corintios 6","book_usfm":"2CO","chapter":6},{"label":"2 Corintios 7","book_usfm":"2CO","chapter":7},{"label":"2 Corintios 8","book_usfm":"2CO","chapter":8},{"label":"2 Corintios 9","book_usfm":"2CO","chapter":9}]'::jsonb),
  (340, '[{"label":"2 Corintios 10","book_usfm":"2CO","chapter":10},{"label":"2 Corintios 11","book_usfm":"2CO","chapter":11},{"label":"2 Corintios 12","book_usfm":"2CO","chapter":12},{"label":"2 Corintios 13","book_usfm":"2CO","chapter":13}]'::jsonb),
  (341, '[{"label":"Hechos 20:1-3","book_usfm":"ACT","chapter":20},{"label":"Romanos 1","book_usfm":"ROM","chapter":1},{"label":"Romanos 2","book_usfm":"ROM","chapter":2},{"label":"Romanos 3","book_usfm":"ROM","chapter":3}]'::jsonb),
  (342, '[{"label":"Romanos 4","book_usfm":"ROM","chapter":4},{"label":"Romanos 5","book_usfm":"ROM","chapter":5},{"label":"Romanos 6","book_usfm":"ROM","chapter":6},{"label":"Romanos 7","book_usfm":"ROM","chapter":7}]'::jsonb),
  (343, '[{"label":"Romanos 8","book_usfm":"ROM","chapter":8},{"label":"Romanos 9","book_usfm":"ROM","chapter":9},{"label":"Romanos 10","book_usfm":"ROM","chapter":10}]'::jsonb),
  (344, '[{"label":"Romanos 11","book_usfm":"ROM","chapter":11},{"label":"Romanos 12","book_usfm":"ROM","chapter":12},{"label":"Romanos 13","book_usfm":"ROM","chapter":13}]'::jsonb),
  (345, '[{"label":"Romanos 14","book_usfm":"ROM","chapter":14},{"label":"Romanos 15","book_usfm":"ROM","chapter":15},{"label":"Romanos 16","book_usfm":"ROM","chapter":16}]'::jsonb),
  (346, '[{"label":"Hechos 20:4-38","book_usfm":"ACT","chapter":20},{"label":"Hechos 21","book_usfm":"ACT","chapter":21},{"label":"Hechos 22","book_usfm":"ACT","chapter":22},{"label":"Hechos 23","book_usfm":"ACT","chapter":23}]'::jsonb),
  (347, '[{"label":"Hechos 24","book_usfm":"ACT","chapter":24},{"label":"Hechos 25","book_usfm":"ACT","chapter":25},{"label":"Hechos 26","book_usfm":"ACT","chapter":26}]'::jsonb),
  (348, '[{"label":"Hechos 27","book_usfm":"ACT","chapter":27},{"label":"Hechos 28","book_usfm":"ACT","chapter":28}]'::jsonb),
  (349, '[{"label":"Colosenses 1","book_usfm":"COL","chapter":1},{"label":"Colosenses 2","book_usfm":"COL","chapter":2},{"label":"Colosenses 3","book_usfm":"COL","chapter":3},{"label":"Colosenses 4","book_usfm":"COL","chapter":4},{"label":"Filemón 1","book_usfm":"PHM","chapter":1}]'::jsonb),
  (350, '[{"label":"Efesios 1","book_usfm":"EPH","chapter":1},{"label":"Efesios 2","book_usfm":"EPH","chapter":2},{"label":"Efesios 3","book_usfm":"EPH","chapter":3},{"label":"Efesios 4","book_usfm":"EPH","chapter":4},{"label":"Efesios 5","book_usfm":"EPH","chapter":5},{"label":"Efesios 6","book_usfm":"EPH","chapter":6}]'::jsonb),
  (351, '[{"label":"Filipenses 1","book_usfm":"PHP","chapter":1},{"label":"Filipenses 2","book_usfm":"PHP","chapter":2},{"label":"Filipenses 3","book_usfm":"PHP","chapter":3},{"label":"Filipenses 4","book_usfm":"PHP","chapter":4}]'::jsonb),
  (352, '[{"label":"1 Timoteo 1","book_usfm":"1TI","chapter":1},{"label":"1 Timoteo 2","book_usfm":"1TI","chapter":2},{"label":"1 Timoteo 3","book_usfm":"1TI","chapter":3},{"label":"1 Timoteo 4","book_usfm":"1TI","chapter":4},{"label":"1 Timoteo 5","book_usfm":"1TI","chapter":5},{"label":"1 Timoteo 6","book_usfm":"1TI","chapter":6}]'::jsonb),
  (353, '[{"label":"Tito 1","book_usfm":"TIT","chapter":1},{"label":"Tito 2","book_usfm":"TIT","chapter":2},{"label":"Tito 3","book_usfm":"TIT","chapter":3}]'::jsonb),
  (354, '[{"label":"1 Pedro 1","book_usfm":"1PE","chapter":1},{"label":"1 Pedro 2","book_usfm":"1PE","chapter":2},{"label":"1 Pedro 3","book_usfm":"1PE","chapter":3},{"label":"1 Pedro 4","book_usfm":"1PE","chapter":4},{"label":"1 Pedro 5","book_usfm":"1PE","chapter":5}]'::jsonb),
  (355, '[{"label":"Hebreos 1","book_usfm":"HEB","chapter":1},{"label":"Hebreos 2","book_usfm":"HEB","chapter":2},{"label":"Hebreos 3","book_usfm":"HEB","chapter":3},{"label":"Hebreos 4","book_usfm":"HEB","chapter":4},{"label":"Hebreos 5","book_usfm":"HEB","chapter":5},{"label":"Hebreos 6","book_usfm":"HEB","chapter":6}]'::jsonb),
  (356, '[{"label":"Hebreos 7","book_usfm":"HEB","chapter":7},{"label":"Hebreos 8","book_usfm":"HEB","chapter":8},{"label":"Hebreos 9","book_usfm":"HEB","chapter":9},{"label":"Hebreos 10","book_usfm":"HEB","chapter":10}]'::jsonb),
  (357, '[{"label":"Hebreos 11","book_usfm":"HEB","chapter":11},{"label":"Hebreos 12","book_usfm":"HEB","chapter":12},{"label":"Hebreos 13","book_usfm":"HEB","chapter":13}]'::jsonb),
  (358, '[{"label":"2 Timoteo 1","book_usfm":"2TI","chapter":1},{"label":"2 Timoteo 2","book_usfm":"2TI","chapter":2},{"label":"2 Timoteo 3","book_usfm":"2TI","chapter":3},{"label":"2 Timoteo 4","book_usfm":"2TI","chapter":4}]'::jsonb),
  (359, '[{"label":"2 Pedro 1","book_usfm":"2PE","chapter":1},{"label":"2 Pedro 2","book_usfm":"2PE","chapter":2},{"label":"2 Pedro 3","book_usfm":"2PE","chapter":3},{"label":"Judas 1","book_usfm":"JUD","chapter":1}]'::jsonb),
  (360, '[{"label":"1 Juan 1","book_usfm":"1JN","chapter":1},{"label":"1 Juan 2","book_usfm":"1JN","chapter":2},{"label":"1 Juan 3","book_usfm":"1JN","chapter":3},{"label":"1 Juan 4","book_usfm":"1JN","chapter":4},{"label":"1 Juan 5","book_usfm":"1JN","chapter":5}]'::jsonb),
  (361, '[{"label":"2 Juan 1","book_usfm":"2JN","chapter":1},{"label":"3 Juan 1","book_usfm":"3JN","chapter":1}]'::jsonb),
  (362, '[{"label":"Apocalipsis 1","book_usfm":"REV","chapter":1},{"label":"Apocalipsis 2","book_usfm":"REV","chapter":2},{"label":"Apocalipsis 3","book_usfm":"REV","chapter":3},{"label":"Apocalipsis 4","book_usfm":"REV","chapter":4},{"label":"Apocalipsis 5","book_usfm":"REV","chapter":5}]'::jsonb),
  (363, '[{"label":"Apocalipsis 6","book_usfm":"REV","chapter":6},{"label":"Apocalipsis 7","book_usfm":"REV","chapter":7},{"label":"Apocalipsis 8","book_usfm":"REV","chapter":8},{"label":"Apocalipsis 9","book_usfm":"REV","chapter":9},{"label":"Apocalipsis 10","book_usfm":"REV","chapter":10},{"label":"Apocalipsis 11","book_usfm":"REV","chapter":11}]'::jsonb),
  (364, '[{"label":"Apocalipsis 12","book_usfm":"REV","chapter":12},{"label":"Apocalipsis 13","book_usfm":"REV","chapter":13},{"label":"Apocalipsis 14","book_usfm":"REV","chapter":14},{"label":"Apocalipsis 15","book_usfm":"REV","chapter":15},{"label":"Apocalipsis 16","book_usfm":"REV","chapter":16},{"label":"Apocalipsis 17","book_usfm":"REV","chapter":17},{"label":"Apocalipsis 18","book_usfm":"REV","chapter":18}]'::jsonb),
  (365, '[{"label":"Apocalipsis 19","book_usfm":"REV","chapter":19},{"label":"Apocalipsis 20","book_usfm":"REV","chapter":20},{"label":"Apocalipsis 21","book_usfm":"REV","chapter":21},{"label":"Apocalipsis 22","book_usfm":"REV","chapter":22}]'::jsonb)
) as d(day_number, refs)
where p.slug = 'cronologico';

-- ===== 0013_push_automation.sql =====
-- ============================================================================
-- Lee Tu Biblia — Automatización del push (versiona lo que antes vivía suelto
-- en los README de supabase/functions/*).
-- Migración 0013. Aplicar DESPUÉS de 0009 y 0010.
--
-- Deja reproducible, en una migración, las dos piezas de entrega de push:
--   1) Cron (pg_cron + pg_net) que llama a la Edge Function `send-reminders`
--      cada minuto (recordatorio diario a hora local).
--   2) Trigger sobre prayer_requests que llama a `notify-group-prayer` cuando
--      un pedido se comparte a un grupo (al crearse o al pasar a compartido).
--
-- SECRETOS: NO van en este archivo. El cron y el trigger leen el service role y
-- la URL del proyecto desde Supabase Vault (vault.decrypted_secrets), así la
-- llave no queda en texto plano en el cuerpo del job/función ni en el repo.
--
-- Provisión por única vez (en el SQL Editor, con los valores REALES — no
-- committear):
--   select vault.create_secret('https://<TU_PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');
-- Y desplegar las funciones:  supabase functions deploy send-reminders
--                             supabase functions deploy notify-group-prayer
-- Hasta que los secrets existan, el cron/trigger simplemente no envían (no rompen).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---- 1. Trigger: aviso de pedido compartido a un grupo --------------------
-- Lee la URL y el service role desde Vault; no incrusta secretos. Dispara al
-- INSERT de un pedido ya compartido y al UPDATE que lo transiciona a compartido
-- (o le cambia el grupo). No re-notifica ediciones de un pedido que ya estaba
-- compartido al mismo grupo (p.ej. marcarlo respondido o editar el título).
create or replace function public.notify_group_prayer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- Solo pedidos compartidos a un grupo.
  if not (new.visibility = 'shared' and new.shared_group_id is not null) then
    return new;
  end if;

  -- En UPDATE, no re-notificar si ya estaba compartido al mismo grupo.
  if tg_op = 'UPDATE'
     and old.visibility = 'shared'
     and old.shared_group_id is not distinct from new.shared_group_id then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return new; -- sin provisión de Vault: no enviar (no romper el insert/update)
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-group-prayer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end $$;

drop trigger if exists prayer_shared_notify on public.prayer_requests;
create trigger prayer_shared_notify
  after insert or update on public.prayer_requests
  for each row execute function public.notify_group_prayer();

-- ---- 2. Cron: recordatorio diario cada minuto -----------------------------
-- Idempotente: desagenda el job previo (si existe) antes de re-agendar.
do $$
begin
  perform cron.unschedule('send-reminders-every-minute');
exception when others then
  null; -- no existía: seguir
end $$;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $job$
);

-- ===== 0014_intercession_notifications.sql =====
-- ============================================================================
-- Lee Tu Biblia — Aviso push al autor cuando alguien ora por su pedido (F2).
-- Migración 0014. Aplicar DESPUÉS de 0007 (prayer_intercessions) y 0013 (Vault).
--
-- Trigger AFTER INSERT en prayer_intercessions → llama a la Edge Function
-- `notify-intercession`, que avisa al autor del pedido ("alguien está orando por
-- vos"). Lee la URL del proyecto y el service role desde Supabase Vault (mismos
-- secrets que 0013, no se incrustan acá). Si los secrets no están, no envía.
--
-- Requiere desplegar la función:  supabase functions deploy notify-intercession
-- ============================================================================

create or replace function public.notify_intercession()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return new; -- sin provisión de Vault: no enviar (no romper la intercesión)
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-intercession',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end $$;

drop trigger if exists intercession_notify on public.prayer_intercessions;
create trigger intercession_notify
  after insert on public.prayer_intercessions
  for each row execute function public.notify_intercession();

-- ===== 0015_reading_reflections.sql =====
-- ============================================================================
-- Lee Tu Biblia — Fase 3: Reflexión de una línea ("Mi camino").
-- Migración 0015. Guarda el "fruto" de la lectura en palabras del usuario —NO el
-- texto bíblico (eso queda en la Biblia de papel)— y el toggle opt-in del diario.
--
-- Una reflexión por (usuario, plan, día). Privada: RLS solo-dueño. La ventana de
-- edición ("hoy sí, mañana no") es regla de UX en el cliente; acá no se fuerza
-- porque es dato privado del propio usuario. Todo idempotente.
-- ============================================================================

create table if not exists public.reading_reflections (
  id          bigint generated always as identity primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  plan_id     bigint  not null references public.reading_plans(id) on delete cascade,
  day_number  integer not null check (day_number >= 1),
  body        text    not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, plan_id, day_number)
);
create index if not exists reflections_user_idx
  on public.reading_reflections(user_id, created_at desc);

alter table public.reading_reflections enable row level security;

-- Solo el dueño ve/edita sus reflexiones.
drop policy if exists "own reflections" on public.reading_reflections;
create policy "own reflections" on public.reading_reflections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Toggle del diario (opt-in, OFF por defecto).
alter table public.profiles
  add column if not exists reflections_enabled boolean not null default false;

-- ===== 0016_reflections_on_by_default.sql =====
-- ============================================================================
-- Lee Tu Biblia — Fase 3: el diario de reflexión queda ON por defecto.
-- Migración 0016. La feature no es invasiva (el afford. aparece solo DESPUÉS de
-- marcar leído, es opcional y la nota es privada), así que se activa por defecto
-- para que se descubra sin tener que buscar el toggle en Ajustes. Quien quiera,
-- lo apaga desde Ajustes → Diario de reflexión.
--
-- (1) Default de la columna → true (nuevos usuarios arrancan con el diario on).
-- (2) Backfill ÚNICO de los usuarios existentes: la feature recién se lanzó, así
--     que el 'false' previo era el default viejo (0015), no una elección.
-- ============================================================================

alter table public.profiles alter column reflections_enabled set default true;

update public.profiles set reflections_enabled = true where reflections_enabled = false;

-- ===== 0017_group_reading_presence.sql =====
-- ============================================================================
-- Lee Tu Biblia — Fase 3: Presencia de lectura en el grupo ("de panel a sala").
-- Migración 0017. Deja ver, dentro del grupo, quiénes mantuvieron su lectura hoy
-- (señal de hábito compartido — NO el contenido). Opt-in y recíproco.
--
-- (1) profiles.share_reading: opt-in para compartir la lectura con tus grupos (off).
-- (2) RPC group_reading_today(gid): para un grupo del que sos miembro, devuelve
--     los miembros que COMPARTEN y si leyeron hoy EN SU zona horaria. Recíproco:
--     no devuelve nada si vos no compartís. Gateado por membresía (is_group_member).
-- ============================================================================

alter table public.profiles
  add column if not exists share_reading boolean not null default false;

create or replace function public.group_reading_today(p_group_id bigint)
returns table (user_id uuid, has_read boolean)
language sql security definer stable set search_path = public as $$
  select p.id,
    exists (
      select 1 from public.reading_progress rp
      where rp.user_id = p.id
        and (rp.completed_at at time zone coalesce(p.timezone, 'UTC'))::date
          = (now() at time zone coalesce(p.timezone, 'UTC'))::date
    ) as has_read
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.share_reading = true
    -- el que llama debe ser miembro del grupo…
    and public.is_group_member(p_group_id)
    -- …y compartir su propia lectura (recíproco: si no compartís, no ves).
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;

-- ===== 0018_prayer_followup.sql =====
-- Seguimiento de oración (Feature 3 Fase 3).
-- last_reviewed_at en prayer_requests: "sigue igual" reinicia el reloj de revisión.
-- prayer_followup_enabled: opt-out del aviso push semanal (default true).
-- prayer_followup_last_sent: dedupe para no mandar más de un push por semana.

alter table public.prayer_requests
  add column if not exists last_reviewed_at timestamptz;

alter table public.profiles
  add column if not exists prayer_followup_enabled boolean not null default true,
  add column if not exists prayer_followup_last_sent date;

