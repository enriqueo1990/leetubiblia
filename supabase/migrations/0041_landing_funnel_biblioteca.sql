-- ============================================================================
-- Lee Tu Biblia — El embudo de las landings suma /biblioteca. Migración 0041.
-- Aplicar DESPUÉS de 0039 (que crea admin_landing_funnel). Idempotente.
--
-- Contexto: la landing pública /biblioteca registra landing_view y landing_cta con
-- detail.from = 'biblioteca' (ver src/lib/landingTrack.js). La tabla boot_diagnostics
-- ya los acepta (0039 no restringe el valor de `from`, solo los nombres de evento), así
-- que NO hay nada que cambiar en el CHECK ni en las políticas: los eventos se guardan
-- solos. Lo único que no la ve es admin_landing_funnel(days), que arma sus filas desde
-- una lista fija de páginas ('info', 'lideres', 'ayuda', 'privacidad'): sin esta
-- migración /biblioteca queda en la tabla pero fuera del reporte.
--
-- Misma función y mismo contrato que en 0039, con 'biblioteca' como quinta página
-- (después de 'lideres', como en el menú del sitio).
-- ============================================================================

create or replace function public.admin_landing_funnel(days int default 30)
returns table(source text, views int, clicks int, welcomes int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;
  return query
    select s.source,
           coalesce(c.views, 0)::int,
           coalesce(c.clicks, 0)::int,
           coalesce(c.welcomes, 0)::int
    from unnest(array['info', 'lideres', 'biblioteca', 'ayuda', 'privacidad']) with ordinality as s(source, ord)
    left join (
      select d.detail->>'from' as source,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))
               filter (where d.event = 'landing_view') as views,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))
               filter (where d.event = 'landing_cta') as clicks,
             count(distinct coalesce(d.detail->>'device', d.user_id::text, d.id::text))
               filter (where d.event = 'ob_welcome') as welcomes
      from boot_diagnostics d
      where d.event in ('landing_view', 'landing_cta', 'ob_welcome')
        and d.detail->>'from' is not null
        and d.created_at >= now() - greatest(days, 1) * interval '1 day'
      group by d.detail->>'from'
    ) c on c.source = s.source
    order by s.ord;
end $$;

grant execute on function public.admin_landing_funnel(int) to authenticated;
