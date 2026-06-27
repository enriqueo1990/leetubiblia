-- ============================================================================
-- Lee Tu Biblia — Fase 3: el diario de reflexión queda ON por defecto.
-- Migración 0016. La feature no es invasiva (el afford. aparece solo DESPUÉS de
-- marcar leído, es opcional y la nota es privada), así que se activa por defecto
-- para que se descubra sin tener que buscar el toggle en Ajustes. Quien quiera,
-- lo apaga desde Ajustes → Diario de reflexión.
--
-- (1) Default de la columna → true (nuevos usuarios arrancan con el diario on).
-- (2) Backfill ÚNICO de los usuarios existentes: la feature recién se lanzó, así
--     que el 'false' previo era el default viejo (0015), no una elección.
-- ============================================================================

alter table public.profiles alter column reflections_enabled set default true;

update public.profiles set reflections_enabled = true where reflections_enabled = false;
