-- ============================================================================
-- Lee Tu Biblia — Sugerencias y reportes de error desde la app.
-- Migración 0034. Aplicar DESPUÉS de 0021 (usa public.is_admin()).
--
-- Ajustes › "Quién hace la app" tiene dos puertas: "Sugerir una mejora" y
-- "Avisar de un error". Ambas guardan una fila acá, sellada con la versión de la
-- app y el tipo de dispositivo (lo mismo que ya registra app_diag), para que el
-- dueño pueda reproducir el problema sin pedir datos de vuelta.
--
-- Seguridad: cada usuario solo inserta filas propias (user_id = auth.uid()) y
-- nadie lee salvo el dueño (is_admin()). No hay update ni delete desde el
-- cliente: el buzón es de solo escritura para quien envía.
-- ============================================================================

create table if not exists public.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  kind        text not null check (kind in ('suggestion', 'bug')),
  body        text not null check (char_length(body) between 1 and 2000),
  app_version text,
  locale      text,
  platform    text,
  standalone  boolean,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists app_feedback_created_idx
  on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "feedback insert own" on public.app_feedback;
create policy "feedback insert own" on public.app_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "feedback admin reads" on public.app_feedback;
create policy "feedback admin reads" on public.app_feedback
  for select to authenticated
  using (public.is_admin());

grant insert, select on public.app_feedback to authenticated;
