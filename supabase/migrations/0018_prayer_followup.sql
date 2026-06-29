-- Seguimiento de oración (Feature 3 Fase 3).
-- last_reviewed_at en prayer_requests: "sigue igual" reinicia el reloj de revisión.
-- prayer_followup_enabled: opt-out del aviso push semanal (default true).
-- prayer_followup_last_sent: dedupe para no mandar más de un push por semana.

alter table public.prayer_requests
  add column if not exists last_reviewed_at timestamptz;

alter table public.profiles
  add column if not exists prayer_followup_enabled boolean not null default true,
  add column if not exists prayer_followup_last_sent date;
