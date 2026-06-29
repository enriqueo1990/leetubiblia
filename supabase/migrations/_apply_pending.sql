-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Aplicar en Supabase SQL Editor. Luego vaciar este archivo.
-- ============================================================

-- 0018_prayer_followup.sql
alter table public.prayer_requests
  add column if not exists last_reviewed_at timestamptz;

alter table public.profiles
  add column if not exists prayer_followup_enabled boolean not null default true,
  add column if not exists prayer_followup_last_sent date;
