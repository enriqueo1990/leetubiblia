-- Idioma de la interfaz por usuario (Feature: i18n es/en/pt). profiles es la
-- fuente de verdad entre dispositivos; el cliente arranca desde localStorage
-- (ltb.locale) y ProfilePrefSync empuja este valor al cargar el perfil.
-- Default 'es' → los usuarios existentes siguen en español sin cambios.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'locale') then
    create type locale as enum ('es', 'en', 'pt');
  end if;
end $$;

alter table public.profiles
  add column if not exists locale locale not null default 'es';
