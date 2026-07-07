-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Contiene: 0024_reading_materials.sql (materiales de lectura opcionales),
--           0025_profile_locale.sql (idioma de interfaz por usuario, i18n).
-- Pegá este archivo en el SQL Editor de Supabase y Run. Idempotente.
-- ============================================================

-- Materiales de lectura opcionales (catecismos/devocionales que acompañan la
-- lectura, activables desde Ajustes). El contenido vive como JSON estático en el
-- bundle; acá solo guardamos QUÉ materiales activó cada usuario y en qué posición va.
--
-- active_materials: array de { "slug": "westminster-menor", "position": 12 }.
--   - slug: identifica el material (mismo slug que el JSON en src/data/materials).
--   - position: índice 1-based de la pregunta/entrada actual. Al terminar (position >
--     total) se muestra el estado "completado". El avance es a ritmo del usuario.
-- Default '[]' → nadie tiene materiales activos hasta que los active a mano.

alter table public.profiles
  add column if not exists active_materials jsonb not null default '[]'::jsonb;

-- Idioma de la interfaz por usuario (i18n es/en/pt). El cliente arranca desde
-- localStorage (ltb.locale) y ProfilePrefSync empuja este valor al cargar el
-- perfil. Default 'es' → los usuarios existentes siguen en español.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'locale') then
    create type locale as enum ('es', 'en', 'pt');
  end if;
end $$;

alter table public.profiles
  add column if not exists locale locale not null default 'es';
