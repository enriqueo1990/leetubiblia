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
