-- ============================================================================
-- Lee Tu Biblia — Visibilidad de perfiles entre co-miembros de grupo.
-- Migración 0004. Aplicar DESPUÉS de 0002.
--
-- Motivo: la app muestra el display_name de otros miembros del grupo (autor de
-- pedidos compartidos en Oración, lista de miembros en Grupos). La política base
-- de profiles solo permite ver el propio. Acá se agrega lectura del perfil de
-- quienes comparten al menos un grupo con el usuario actual.
--
-- Solo afecta SELECT y solo expone display_name/accent en la práctica (no hay
-- datos sensibles en profiles). El resto de políticas de profiles siguen igual.
-- ============================================================================

create or replace function public.shares_group_with(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

drop policy if exists "co-members profile select" on public.profiles;
create policy "co-members profile select" on public.profiles
  for select using (id = auth.uid() or public.shares_group_with(id));
