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
