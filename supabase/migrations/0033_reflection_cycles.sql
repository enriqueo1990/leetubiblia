-- ============================================================================
-- Lee Tu Biblia — Ciclos del plan para el diario ("Mi camino").
-- Migración 0033. Aplicar DESPUÉS de 0015.
--
-- Problema: al renovar un plan ("Volver a leer este plan") se borra el progreso
-- pero NO las reflexiones, y su clave única era (user, plan, día). Al releer el
-- día N, la nota vieja ocupaba el lugar de la nueva: la hoja abría sellada
-- (solo se edita el día en que se escribió) y un upsert hubiera pisado la nota
-- anterior.
--
-- Solución: un "ciclo" que sube cada vez que se activa o renueva un plan (nunca al
-- reprogramar ni al fijar "¿En qué día vas?"). La reflexión pertenece a
-- (user, plan, día, ciclo): las notas viejas quedan en el diario y las nuevas
-- conviven con ellas.
--
-- El front tolera que esta migración todavía no esté aplicada (cae al
-- comportamiento anterior), así que se puede desplegar en cualquier orden.
-- ============================================================================

alter table public.profiles
  add column if not exists plan_cycle integer not null default 0;

alter table public.reading_reflections
  add column if not exists cycle integer not null default 0;

-- Soltar la unique vieja (user_id, plan_id, day_number) sea cual sea su nombre.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.reading_reflections'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = k.attnum
      ) = array['day_number', 'plan_id', 'user_id']
  loop
    execute format('alter table public.reading_reflections drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists reflections_user_plan_day_cycle_idx
  on public.reading_reflections (user_id, plan_id, day_number, cycle);
