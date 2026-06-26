-- ============================================================================
-- Lee Tu Biblia — Eliminar cuenta en cascada (Tarea 7, documento maestro §5.7)
-- Migración 0006. Aplicar DESPUÉS de 0001.
--
-- Qué borra: el perfil y TODOS los datos del usuario — reading_progress, sus
-- prayer_requests (privados Y los compartidos a grupos: se borran, no se
-- anonimizan) y sus group_members. La mayoría cae por ON DELETE CASCADE al
-- borrar la fila de auth.users.
--
-- Caso especial (grupos): groups.created_by tiene ON DELETE CASCADE, así que
-- borrar al usuario borraría también los grupos que creó AUNQUE tengan otros
-- miembros. Para respetar la regla ("reasignar owner al miembro más antiguo, o
-- borrar el grupo si queda vacío") reasignamos ANTES de borrar el usuario.
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
  -- incl. compartidas, memberships) cae por ON DELETE CASCADE.
  delete from auth.users where id = me;
end $$;
