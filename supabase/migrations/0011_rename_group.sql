-- Permite al owner renombrar su grupo.
create or replace function public.rename_group(p_group_id bigint, p_name text)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Solo el owner puede renombrar el grupo'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  update public.groups set name = trim(p_name) where id = p_group_id;
end $$;

revoke all on function public.rename_group(bigint, text) from public;
grant execute on function public.rename_group(bigint, text) to authenticated;
