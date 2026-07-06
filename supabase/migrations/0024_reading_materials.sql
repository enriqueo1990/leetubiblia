-- Materiales de lectura opcionales (Feature: catecismos/devocionales que acompañan
-- la lectura, activables desde Ajustes). El contenido vive como JSON estático en el
-- bundle; acá solo guardamos QUÉ materiales activó cada usuario y en qué posición va.
--
-- active_materials: array de { "slug": "westminster-menor", "position": 12 }.
--   - slug: identifica el material (mismo slug que el JSON en src/data/materials).
--   - position: índice 1-based de la pregunta/entrada actual. Al terminar (position >
--     total) se muestra el estado "completado". El avance es a ritmo del usuario.
-- Default '[]' → nadie tiene materiales activos hasta que los active a mano.

alter table public.profiles
  add column if not exists active_materials jsonb not null default '[]'::jsonb;
