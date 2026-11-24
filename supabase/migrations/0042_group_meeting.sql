-- ============================================================================
-- Lee Tu Biblia — Cada cuánto se junta el grupo.
-- Migración 0042. Aplicar DESPUÉS de 0002 (usa is_group_owner).
--
-- groups.meet_every / meet_unit: «cada N semanas» o «cada N meses» (N de 1 a
-- 12). Los dos van juntos: o están los dos, o ninguno (todavía no lo definieron).
-- RPC set_group_meeting: solo el administrador; con null lo quita.
-- create_group no cambia: la app crea el grupo y después fija la frecuencia, así
-- crear sigue andando aunque esta migración todavía no esté aplicada.
-- Idempotente: se puede reaplicar sin daño.
-- ============================================================================

alter table public.groups
  add column if not exists meet_every smallint,
  add column if not exists meet_unit text;

alter table public.groups drop constraint if exists groups_meeting_check;
alter table public.groups add constraint groups_meeting_check check (
  (meet_every is null and meet_unit is null)
  or (meet_every between 1 and 12 and meet_unit in ('week', 'month'))
);

create or replace function public.set_group_meeting(
  p_group_id bigint,
  p_every smallint,
  p_unit text
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el administrador puede cambiar cada cuánto se junta el grupo';
  end if;

  if p_every is null or p_unit is null then
    update public.groups set meet_every = null, meet_unit = null where id = p_group_id;
  else
    update public.groups set meet_every = p_every, meet_unit = p_unit where id = p_group_id;
  end if;
end;
$$;

revoke all on function public.set_group_meeting(bigint, smallint, text) from public, anon;
grant execute on function public.set_group_meeting(bigint, smallint, text) to authenticated;
