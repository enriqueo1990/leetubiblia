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
