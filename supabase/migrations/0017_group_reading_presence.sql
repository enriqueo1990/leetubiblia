-- ============================================================================
-- Lee Tu Biblia — Fase 3: Presencia de lectura en el grupo ("de panel a sala").
-- Migración 0017. Deja ver, dentro del grupo, quiénes mantuvieron su lectura hoy
-- (señal de hábito compartido — NO el contenido). Opt-in y recíproco.
--
-- (1) profiles.share_reading: opt-in para compartir la lectura con tus grupos (off).
-- (2) RPC group_reading_today(gid): para un grupo del que sos miembro, devuelve
--     los miembros que COMPARTEN y si leyeron hoy EN SU zona horaria. Recíproco:
--     no devuelve nada si vos no compartís. Gateado por membresía (is_group_member).
-- ============================================================================

alter table public.profiles
  add column if not exists share_reading boolean not null default false;

create or replace function public.group_reading_today(p_group_id bigint)
returns table (user_id uuid, has_read boolean)
language sql security definer stable set search_path = public as $$
  select p.id,
    exists (
      select 1 from public.reading_progress rp
      where rp.user_id = p.id
        and (rp.completed_at at time zone coalesce(p.timezone, 'UTC'))::date
          = (now() at time zone coalesce(p.timezone, 'UTC'))::date
    ) as has_read
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.share_reading = true
    -- el que llama debe ser miembro del grupo…
    and public.is_group_member(p_group_id)
    -- …y compartir su propia lectura (recíproco: si no compartís, no ves).
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;
