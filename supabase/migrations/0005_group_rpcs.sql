-- ============================================================================
-- Lee Tu Biblia — RPCs de grupos (Tarea 6, documento maestro §5.6)
-- Migración 0005. Aplicar DESPUÉS de 0002.
--
-- Por qué RPCs security-definer:
--  - Unirse por código requiere LEER un grupo del que aún no sos miembro, pero la
--    RLS de groups oculta los grupos ajenos. La función definer resuelve el código
--    y crea la membresía atómicamente, validando dentro.
--  - Crear grupo + auto-membresía de owner en un solo paso atómico.
--  - Administración (regenerar código, quitar miembro) chequea owner adentro.
-- Todas validan auth.uid() y la propiedad; no exponen nada que la app no muestre.
-- ============================================================================

-- Código de invitación corto, sin caracteres ambiguos (0/O/1/I).
create or replace function public.gen_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end $$;

-- Crear grupo: inserta el grupo y la membresía de owner. Devuelve el grupo.
create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), public.gen_invite_code(), auth.uid())
  returning * into g;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'owner');

  return g;
end $$;

-- Unirse por código: valida el código e inserta la membresía como 'member'.
-- Devuelve el grupo (o null si el código no existe). Idempotente si ya sos miembro.
create or replace function public.join_group_by_code(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;

  select * into g from public.groups
  where invite_code = upper(trim(p_code));
  if g.id is null then return null; end if;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return g;
end $$;

-- Regenerar el código de invitación (solo owner). Devuelve el nuevo código.
create or replace function public.regenerate_invite_code(p_group_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare newc text;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Solo el owner puede regenerar el código'; end if;

  newc := public.gen_invite_code();
  update public.groups set invite_code = newc where id = p_group_id;
  return newc;
end $$;

-- Quitar a un miembro (solo owner; el owner no se quita a sí mismo acá).
create or replace function public.remove_member(p_group_id bigint, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Solo el owner puede quitar miembros'; end if;
  if p_user_id = auth.uid() then raise exception 'El owner no puede quitarse a sí mismo'; end if;

  delete from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
end $$;
