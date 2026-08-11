-- ============================================================================
-- Lee Tu Biblia — Vista previa de invitación a grupo, sin sesión.
-- Migración 0032. Aplicar DESPUÉS de 0029.
--
-- Un invitado frío llega a /join?code=X desde el WhatsApp de su líder y hoy ve
-- una bienvenida genérica: el nombre del grupo recién aparece después de crear
-- la cuenta. Esta RPC deja mostrar "Te invitaron a {grupo}" ANTES del registro,
-- que es el momento donde más importa entender para qué es la cuenta.
--
-- Superficie expuesta a anon, a propósito mínima: solo nombre y cantidad de
-- miembros — sin ids, sin miembros, sin plan. Quien tiene un código válido ya
-- recibió esa información de su líder; enumerar códigos al azar (32^6) solo
-- podría revelar nombres de grupo, nunca contenido. Unirse sigue requiriendo
-- sesión (join_group_by_code, endurecida en 0029).
-- ============================================================================

create or replace function public.peek_group_by_code(p_code text)
returns table (name text, member_count bigint)
language sql security definer stable set search_path = public as $$
  select g.name, count(gm.user_id) as member_count
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  where g.invite_code = upper(trim(p_code))
  group by g.name;
$$;

revoke execute on function public.peek_group_by_code(text) from public;
grant execute on function public.peek_group_by_code(text) to anon, authenticated;
