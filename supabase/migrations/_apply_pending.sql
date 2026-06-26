-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES
-- Pegá esto COMPLETO en el SQL Editor de Supabase y Run.
-- Todo es idempotente: si ya aplicaste la 0006, reaplicarla no hace daño.
--   0006 — Eliminar cuenta en cascada (Tarea 7).
--   0007 — Fase 2 (parte 1): "estoy orando", testimonios, resumen del owner.
--   0009 — Fase 2 (función 7): push real (subscripciones, timezone, dedupe).
-- (0008 = acentos pastel; va aparte en su propio archivo, es independiente.)
-- ============================================================

-- ============================================================================
-- Lee Tu Biblia — Eliminar cuenta en cascada (Tarea 7, documento maestro §5.7)
-- Migración 0006. Aplicar DESPUÉS de 0001.
-- ============================================================================

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  g record;
  heir uuid;
begin
  if me is null then raise exception 'Sin sesión'; end if;

  -- Grupos donde soy owner o creador: reasignar o borrar antes del cascade.
  for g in
    select distinct gr.id
    from public.groups gr
    left join public.group_members gm
      on gm.group_id = gr.id and gm.user_id = me
    where gr.created_by = me or gm.role = 'owner'
  loop
    -- Miembro más antiguo distinto de mí.
    select user_id into heir
    from public.group_members
    where group_id = g.id and user_id <> me
    order by joined_at asc
    limit 1;

    if heir is not null then
      update public.group_members set role = 'owner'
        where group_id = g.id and user_id = heir;
      -- Reasignar created_by para que el cascade no se lleve el grupo.
      update public.groups set created_by = heir where id = g.id;
    else
      -- Sin otros miembros: el grupo queda vacío, se borra.
      delete from public.groups where id = g.id;
    end if;
  end loop;

  -- Borrar el usuario de auth: el resto (profile, progress, prayers propias
  -- incl. compartidas, memberships, intercesiones) cae por ON DELETE CASCADE.
  delete from auth.users where id = me;
end $$;

-- ============================================================================
-- Lee Tu Biblia — Fase 2 (parte 1): vida del pedido compartido.
-- Migración 0007. Aplicar DESPUÉS de 0002 (usa is_group_member / is_group_owner).
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

drop policy if exists "intercessions visible" on public.prayer_intercessions;
create policy "intercessions visible" on public.prayer_intercessions
  for select using (public.can_see_prayer(prayer_id));

drop policy if exists "intercede as self" on public.prayer_intercessions;
create policy "intercede as self" on public.prayer_intercessions
  for insert with check (user_id = auth.uid() and public.can_see_prayer(prayer_id));

drop policy if exists "unintercede self" on public.prayer_intercessions;
create policy "unintercede self" on public.prayer_intercessions
  for delete using (user_id = auth.uid());

-- ---- 2. Testimonio en el pedido respondido --------------------------------
alter table public.prayer_requests
  add column if not exists testimony           text,
  add column if not exists testimony_shared    boolean not null default false,
  add column if not exists testimony_shared_at timestamptz;

-- ---- 3. Resumen pastoral del grupo (solo owner) ---------------------------
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

-- ============================================================================
-- Lee Tu Biblia — Fase 2 (función 7): recordatorio por push real a hora fija.
-- Migración 0009. Aplicar DESPUÉS de 0001.
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

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles
  add column if not exists timezone           text,
  add column if not exists reminder_last_sent date;
