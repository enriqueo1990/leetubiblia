-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Aplicar en Supabase SQL Editor. Luego vaciar este archivo.
-- ============================================================

-- 0018_prayer_followup.sql (si no la aplicaste todavía)
alter table public.prayer_requests
  add column if not exists last_reviewed_at timestamptz;

alter table public.profiles
  add column if not exists prayer_followup_enabled boolean not null default true,
  add column if not exists prayer_followup_last_sent date;

-- 0019_prayer_duration.sql
alter table public.prayer_requests
  add column if not exists duration_type text not null default 'forever'
    check (duration_type in ('day', 'week', 'month', 'forever')),
  add column if not exists expires_at timestamptz;
