-- ============================================================================
-- Lee Tu Biblia — Actualizaciones en pedidos de oración.
-- Migración 0026. Aplicar DESPUÉS de 0007 (usa el helper can_see_prayer).
--
-- Un pedido hoy tiene solo dos momentos: se crea y se responde. Esta tabla le
-- da historia en el medio — el autor cuenta cómo sigue ("entró a cirugía",
-- "salió bien, falta la biopsia") y el grupo acompaña los pedidos largos sin
-- que se apaguen. Idempotente: se puede reaplicar sin daño.
-- ============================================================================

create table if not exists public.prayer_updates (
  id         bigint generated always as identity primary key,
  prayer_id  bigint not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  body       text   not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists prayer_updates_prayer_idx on public.prayer_updates(prayer_id);

alter table public.prayer_updates enable row level security;

-- Ver: quien puede ver el pedido ve su historia (autor, o miembro del grupo
-- destino si es compartido — mismo criterio que las intercesiones).
drop policy if exists "updates visible" on public.prayer_updates;
create policy "updates visible" on public.prayer_updates
  for select using (public.can_see_prayer(prayer_id));

-- Agregar: solo el AUTOR del pedido, firmando como él mismo.
drop policy if exists "author adds updates" on public.prayer_updates;
create policy "author adds updates" on public.prayer_updates
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.prayer_requests p
      where p.id = prayer_id and p.user_id = auth.uid()
    )
  );

-- Borrar: el autor borra sus propias actualizaciones.
drop policy if exists "author deletes updates" on public.prayer_updates;
create policy "author deletes updates" on public.prayer_updates
  for delete using (user_id = auth.uid());
