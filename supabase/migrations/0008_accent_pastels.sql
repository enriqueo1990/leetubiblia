-- ============================================================================
-- Lee Tu Biblia — Acentos pastel (público joven)
-- Migración 0008. Aplicar DESPUÉS de 0001.
--
-- Agrega 6 valores pastel al enum accent_color. Sin esto, profiles.accent_color
-- (un enum) rechaza las keys nuevas: el color elegido se ve bien en el momento
-- (localStorage) pero NO persiste entre recargas, porque ProfilePrefSync repinta
-- con el valor viejo guardado en el perfil.
--
-- Idempotente: ADD VALUE IF NOT EXISTS no falla si el valor ya existe. El script
-- solo AGREGA valores (no los usa), así que corre sin problemas de transacción.
-- Pegá esto COMPLETO en el SQL Editor de Supabase y Run.
-- ============================================================================

alter type accent_color add value if not exists 'pastel_lavender';
alter type accent_color add value if not exists 'pastel_pink';
alter type accent_color add value if not exists 'pastel_mint';
alter type accent_color add value if not exists 'pastel_sky';
alter type accent_color add value if not exists 'pastel_coral';
alter type accent_color add value if not exists 'pastel_aqua';
