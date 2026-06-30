-- Logros de plan terminado (Feature 5 Fase 3).
-- Snapshot permanente al completar un plan: sobrevive aunque se renueve el plan
-- (que borra el progreso) o se cambie de plan. Alimenta el resumen / historial.
-- unique(user_id, plan_id, completed_on): idempotente por día (re-renders del
-- festejo no duplican); permite volver a completar el mismo plan otro día.

create table if not exists public.plan_completions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  plan_id        bigint not null references public.reading_plans(id) on delete cascade,
  days_read      integer not null,
  total_days     integer not null,
  longest_streak integer not null default 0,
  started_on     date,
  completed_on   date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (user_id, plan_id, completed_on)
);

create index if not exists plan_completions_user_idx
  on public.plan_completions(user_id, completed_on desc);

alter table public.plan_completions enable row level security;

create policy "own plan completions" on public.plan_completions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
