-- ============================================================================
-- Lee Tu Biblia — Plan de grupo (leer lo mismo, juntos).
-- Migración 0027. Aplicar DESPUÉS de 0002 (usa is_group_owner).
--
-- El grupo puede adoptar un plan común: el administrador lo elige (arranca ese
-- día como día 1) y cada miembro decide sumarse — su plan activo pasa a ser el
-- del grupo, anclado a la MISMA fecha de inicio, así todos leen lo mismo el
-- mismo día y "3 leyeron hoy" pasa a significar "leímos lo mismo hoy".
-- Sumarse es SIEMPRE decisión del miembro (nada se cambia solo).
--
-- groups.plan_id / plan_start_date: el plan elegido y su día 1 compartido.
-- RPC set_group_plan: solo el owner; con plan null lo quita. La fecha de
-- inicio la manda el cliente (su "hoy" local); si no llega, current_date.
-- Idempotente: se puede reaplicar sin daño.
-- ============================================================================

alter table public.groups
  add column if not exists plan_id bigint references public.reading_plans(id) on delete set null,
  add column if not exists plan_start_date date;

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
end;
$$;
