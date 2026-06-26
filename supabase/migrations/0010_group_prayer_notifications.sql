-- ============================================================================
-- Lee Tu Biblia — Aviso push de pedido de oración nuevo en el grupo
-- Migración 0010. Aplicar DESPUÉS de 0009 (usa push_subscriptions).
--
-- Agrega el opt-out por usuario: cuando alguien comparte un pedido a un grupo,
-- se notifica a los demás miembros que tengan esto en true. Default true.
-- El disparo (trigger) y el deploy de la función van en el README de
-- supabase/functions/notify-group-prayer/.
-- ============================================================================

alter table public.profiles
  add column if not exists group_prayer_notifications_enabled boolean not null default true;
