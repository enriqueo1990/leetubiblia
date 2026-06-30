-- ============================================================================
-- Lee Tu Biblia — Telemetría TEMPORAL de arranque.
-- Migración 0015. Aplicar DESPUÉS de 0001.
--
-- Objetivo: confirmar en producción cuál de los tres caminos disparaba la
-- "carga infinita en la 1ª apertura" de la PWA (ver index.html / auth.jsx):
--   - 'boot_reload'    : el watchdog tuvo que recargar (React no montó en 8 s).
--   - 'profile_retry'  : había sesión pero el perfil no existía y hubo reintentos.
--   - 'getsession_slow': supabase.auth.getSession() tardó/colgó (lock de iOS).
--
-- Solo INSERT (anon + authenticated): queremos capturar boots aún sin login y no
-- exponer lectura a clientes. Para analizar, leer con el service role / SQL.
--
-- ⚠️ TEMPORAL: borrar esta tabla y las llamadas a recordDiag() cuando se confirme
--    la causa (drop table public.boot_diagnostics;).
-- ============================================================================

create table if not exists public.boot_diagnostics (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  event      text not null,
  detail     jsonb,
  standalone boolean,
  user_agent text
);
create index if not exists boot_diag_event_idx on public.boot_diagnostics(event, created_at);

alter table public.boot_diagnostics enable row level security;

-- Cualquier cliente (anónimo o logueado) puede registrar su propio evento de
-- arranque. Nadie puede leer ni modificar desde el cliente.
drop policy if exists "anyone can insert boot diagnostics" on public.boot_diagnostics;
create policy "anyone can insert boot diagnostics" on public.boot_diagnostics
  for insert to anon, authenticated with check (true);
