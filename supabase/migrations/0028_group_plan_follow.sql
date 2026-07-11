-- ============================================================================
-- Lee Tu Biblia — Seguir el plan del grupo como lectura adicional.
-- Migración 0028. Aplicar DESPUÉS de 0027 (extiende set_group_plan).
--
-- Sumarse al plan del grupo tenía un solo modo: hacerlo TU plan activo. Pero un
-- pastor puede acompañar 3 grupos (cada uno con su plan) sin resignar su plan
-- personal. Este modo liviano hace que la lectura del grupo aparezca en Hoy
-- como lectura adicional — sin racha ni progreso propio; el día lo dicta el
-- calendario del grupo. Marcarla escribe en reading_progress con el plan_id del
-- grupo, así el pulso "quién leyó hoy" (0017) la cuenta igual.
--
-- group_members.follow_plan: la elección vive en la membresía — se limpia sola
-- al salir del grupo, y si el admin cambia el plan todo deriva del grupo.
-- RPC follow_group_plan: cada miembro prende/apaga SOLO su propia fila (por eso
-- RPC y no una policy de UPDATE, que dejaría tocar role).
-- set_group_plan (reemplazo): al cambiar o quitar el plan, apaga los follow de
-- todos — nada aparece solo en el Hoy de nadie; cada plan nuevo invita de nuevo.
-- Idempotente: se puede reaplicar sin daño.
-- ============================================================================

alter table public.group_members
  add column if not exists follow_plan boolean not null default false;

create or replace function public.follow_group_plan(
  p_group_id bigint,
  p_follow boolean
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  update public.group_members
     set follow_plan = p_follow
   where group_id = p_group_id
     and user_id = auth.uid();
  if not found then
    raise exception 'No sos miembro de este grupo';
  end if;
end;
$$;

create or replace function public.set_group_plan(
  p_group_id bigint,
  p_plan_id bigint,
  p_start_date date default null
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el administrador puede elegir el plan del grupo';
  end if;

  if p_plan_id is null then
    update public.groups
       set plan_id = null, plan_start_date = null
     where id = p_group_id;
  else
    update public.groups
       set plan_id = p_plan_id,
           plan_start_date = coalesce(p_start_date, current_date)
     where id = p_group_id;
  end if;

  -- El plan que seguían ya no es este: cada miembro vuelve a decidir.
  update public.group_members
     set follow_plan = false
   where group_id = p_group_id;
end;
$$;
