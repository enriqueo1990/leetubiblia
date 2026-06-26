-- ============================================================================
-- Lee Tu Biblia — Fase 2 (parte 1): vida del pedido compartido.
-- Migración 0007. Aplicar DESPUÉS de 0002 (usa is_group_member / is_group_owner).
--
-- Cubre tres funciones diferidas del documento maestro §1.6:
--   1. prayer_intercessions          — "estoy orando por esto" (quién ora por cada pedido).
--   2. prayer_requests.testimony…    — compartir una respondida como testimonio al grupo.
--   3. group_prayer_stats(gid)       — resumen pastoral del owner (activos/respondidos/orando).
--
-- Nota de alcance: la ENTREGA activa de notificaciones (push real a hora fija) es
-- otra función de Fase 2 (Edge Function + cron) y NO se incluye acá. El autor "se
-- entera" de quién ora viendo el conteo y los avatares en su propio pedido (pull),
-- no por un push. Todo es idempotente: se puede reaplicar sin daño.
-- ============================================================================

-- ---- 1. Intercesiones ("estoy orando por esto") ---------------------------
create table if not exists public.prayer_intercessions (
  id         bigint generated always as identity primary key,
  prayer_id  bigint not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (prayer_id, user_id)
);
create index if not exists prayer_interc_prayer_idx on public.prayer_intercessions(prayer_id);
create index if not exists prayer_interc_user_idx   on public.prayer_intercessions(user_id);

-- Helper: ¿el usuario actual puede VER este pedido? (su autor, o —si es compartido—
-- un miembro del grupo destino). SECURITY DEFINER para no chocar con la RLS de
-- prayer_requests al evaluarse dentro de las policies de intercessions.
create or replace function public.can_see_prayer(pid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.prayer_requests p
    where p.id = pid and (
      p.user_id = auth.uid()
      or (p.visibility = 'shared' and public.is_group_member(p.shared_group_id))
    )
  );
$$;

alter table public.prayer_intercessions enable row level security;

-- Ver: quien pueda ver el pedido ve quiénes oran por él.
drop policy if exists "intercessions visible" on public.prayer_intercessions;
create policy "intercessions visible" on public.prayer_intercessions
  for select using (public.can_see_prayer(prayer_id));

-- Registrar la propia intercesión, y solo sobre pedidos que puedo ver.
drop policy if exists "intercede as self" on public.prayer_intercessions;
create policy "intercede as self" on public.prayer_intercessions
  for insert with check (user_id = auth.uid() and public.can_see_prayer(prayer_id));

-- Retirar la propia intercesión.
drop policy if exists "unintercede self" on public.prayer_intercessions;
create policy "unintercede self" on public.prayer_intercessions
  for delete using (user_id = auth.uid());

-- ---- 2. Testimonio en el pedido respondido --------------------------------
-- El autor, al marcar respondida una compartida, puede compartirla como
-- testimonio al grupo con unas palabras. Visibilidad y edición ya las cubren las
-- políticas de prayer_requests (compartidos visibles al grupo; edita solo el autor).
alter table public.prayer_requests
  add column if not exists testimony           text,
  add column if not exists testimony_shared    boolean not null default false,
  add column if not exists testimony_shared_at timestamptz;

-- ---- 3. Resumen pastoral del grupo (solo owner) ---------------------------
-- Una sola fila: pedidos activos, respondidos y personas que oraron en los
-- últimos 7 días, sobre los pedidos COMPARTIDOS del grupo. Valida owner adentro.
create or replace function public.group_prayer_stats(p_group_id bigint)
returns table (active int, answered int, praying_week int)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el owner puede ver el resumen del grupo';
  end if;

  return query
    select
      count(*) filter (where pr.status = 'active')::int,
      count(*) filter (where pr.status = 'answered')::int,
      (
        select count(distinct i.user_id)::int
        from public.prayer_intercessions i
        join public.prayer_requests p2 on p2.id = i.prayer_id
        where p2.shared_group_id = p_group_id
          and p2.visibility = 'shared'
          and i.created_at >= now() - interval '7 days'
      )
    from public.prayer_requests pr
    where pr.shared_group_id = p_group_id
      and pr.visibility = 'shared';
end $$;
