-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Pendiente de aplicar: 0040 (reacciones a testimonios). NO aplicada todavía.
--
-- Pegá este archivo en el SQL Editor de Supabase y Run (o aplicala con el MCP).
-- Después volvé a vaciarlo (o regenerá todo con: node scripts/bundle-migrations.mjs).
-- ============================================================

-- ============================================================================
-- Lee Tu Biblia — Reacciones a los testimonios del grupo.
-- Migración 0040. Aplicar DESPUÉS de 0007 (can_see_prayer, testimony_shared) y
-- 0002 (is_group_member). Idempotente.
--
-- Los miembros de un grupo pueden reaccionar a un testimonio compartido con una de
-- tres frases (sin emojis ni contadores de popularidad: es acompañar, no puntuar):
--   amen    → «Amén»
--   gloria  → «Gloria a Dios»
--   alegria → «Me alegra»
-- Una reacción por persona y testimonio (cambiarla reemplaza la anterior; tocarla
-- de nuevo la quita). La ve quien pueda ver el pedido (el autor y su grupo).
-- ============================================================================

create table if not exists public.testimony_reactions (
  id         bigint generated always as identity primary key,
  prayer_id  bigint not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  kind       text   not null check (kind in ('amen', 'gloria', 'alegria')),
  created_at timestamptz not null default now(),
  unique (prayer_id, user_id)
);
create index if not exists testimony_reactions_prayer_idx on public.testimony_reactions(prayer_id);

-- ¿El pedido tiene un testimonio compartido que yo pueda ver? (SECURITY DEFINER
-- para no chocar con la RLS de prayer_requests dentro de las políticas.)
create or replace function public.can_see_testimony(pid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.prayer_requests p
    where p.id = pid
      and p.testimony_shared
      and p.visibility = 'shared'
      and public.is_group_member(p.shared_group_id)
  );
$$;

alter table public.testimony_reactions enable row level security;

drop policy if exists "testimony reactions visible" on public.testimony_reactions;
create policy "testimony reactions visible" on public.testimony_reactions
  for select using (public.can_see_testimony(prayer_id));

drop policy if exists "testimony react as self" on public.testimony_reactions;
create policy "testimony react as self" on public.testimony_reactions
  for insert with check (user_id = auth.uid() and public.can_see_testimony(prayer_id));

drop policy if exists "testimony change own reaction" on public.testimony_reactions;
create policy "testimony change own reaction" on public.testimony_reactions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_testimony(prayer_id));

drop policy if exists "testimony remove own reaction" on public.testimony_reactions;
create policy "testimony remove own reaction" on public.testimony_reactions
  for delete using (user_id = auth.uid());
