-- ============================================================================
-- Lee Tu Biblia — Fecha local estable para cada lectura.
-- Migración 0030. Aplicar DESPUÉS de 0029.
-- ============================================================================

-- completed_at conserva el instante UTC; completed_on conserva el día local que
-- el usuario marcó. Sin esta segunda columna, cambiar de zona horaria podía mover
-- lecturas históricas y alterar rachas o el pulso semanal.
alter table public.reading_progress
  add column if not exists completed_on date;

update public.reading_progress rp
set completed_on = (rp.completed_at at time zone coalesce(p.timezone, 'UTC'))::date
from public.profiles p
where p.id = rp.user_id
  and rp.completed_on is null;

-- Fallback defensivo para filas huérfanas/imprevistas; normalmente el update
-- anterior cubre todo porque user_id referencia auth.users y profiles es 1:1.
update public.reading_progress
set completed_on = completed_at::date
where completed_on is null;

alter table public.reading_progress
  alter column completed_on set default current_date,
  alter column completed_on set not null;

create index if not exists reading_progress_user_date_idx
  on public.reading_progress(user_id, completed_on);

-- Presencia de hoy: usa el día guardado, no vuelve a reinterpretar el timestamp
-- histórico con la zona horaria actual del miembro.
create or replace function public.group_reading_today(p_group_id bigint)
returns table (user_id uuid, has_read boolean)
language sql security definer stable set search_path = public as $$
  select p.id,
    exists (
      select 1 from public.reading_progress rp
      where rp.user_id = p.id
        and rp.completed_on = (now() at time zone coalesce(p.timezone, 'UTC'))::date
    ) as has_read
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and p.share_reading = true
    and public.is_group_member(p_group_id)
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;

-- Historial semanal: misma regla estable para los siete días.
create or replace function public.group_reading_week(p_group_id bigint)
returns table (user_id uuid, week boolean[])
language sql security definer stable set search_path = public as $$
  select p.id,
    (
      select array_agg(
        exists (
          select 1 from public.reading_progress rp
          where rp.user_id = p.id
            and rp.completed_on
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
    and public.is_group_owner(p_group_id)
    and (select share_reading from public.profiles where id = auth.uid()) = true;
$$;
