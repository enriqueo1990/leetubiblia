-- Idioma de la interfaz por usuario (Feature: i18n es/en/pt).
-- La columna es NULLABLE a propósito: null = "el usuario no eligió idioma
-- todavía". Así el cliente puede detectar el idioma del dispositivo
-- (navigator.language) en el primer uso y sembrarlo en el perfil vía
-- ProfilePrefSync, en vez de que un default 'es' pise la detección.
--   - Usuarios NUEVOS: el trigger crea el perfil sin locale → null → el
--     cliente detecta el idioma del celular y lo guarda.
--   - Usuarios EXISTENTES: backfill a 'es' acá abajo, así no se les cambia
--     el idioma de golpe (la app nació en español).
-- Cuando el usuario elige idioma en Ajustes, ese valor manda entre dispositivos.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'locale') then
    create type locale as enum ('es', 'en', 'pt');
  end if;
end $$;

alter table public.profiles
  add column if not exists locale locale;

-- Los usuarios que YA existen se quedan en español (no tocamos su experiencia).
update public.profiles set locale = 'es' where locale is null;
