-- ============================================================================
-- Lee Tu Biblia — Historial de lectura del grupo (últimos 7 días, solo owner).
-- Migración 0023. Complementa la 0017 (presencia "hoy"): el pulso diario se
-- pierde si el líder no entra un día; esta RPC le da la semana completa de
-- cada miembro que comparte, para acompañar (no para perseguir).
--
-- group_reading_week(gid) → (user_id, week boolean[7])
--   week[1] = hace 6 días … week[7] = hoy, cada día calculado EN LA ZONA
--   HORARIA del miembro (misma regla que group_reading_today: "marcó su
--   lectura ese día", no "abrió su Biblia").
--
-- Gates (mismos principios que 0017 + resumen pastoral de 0007):
--   - Solo el owner del grupo (is_group_owner) recibe filas.
--   - Recíproco: el owner también tiene que compartir su lectura.
--   - Solo aparecen los miembros con share_reading = true (opt-in).
-- ============================================================================

create or replace function public.group_reading_week(p_group_id bigint)
returns table (user_id uuid, week boolean[])
language sql security definer stable set search_path = public as $$
  select p.id,
    (
      select array_agg(
        exists (
          select 1 from public.reading_progress rp
          where rp.user_id = p.id
            and (rp.completed_at at time zone coalesce(p.timezone, 'UTC'))::date
              = (now() at time zone coalesce(p.timezone, 'UTC'))::date - (6 - d.i)
        )
        order by d.i
      )
      from generate_series(0, 6) as d(i)
    ) as week
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.share_reading = true
    -- solo el owner ve la semana…
    and public.is_group_owner(p_group_id)
    -- …y también él tiene que compartir la suya (recíproco, como en 0017).
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;
