-- Proveedor externo para abrir pasajes bíblicos (Ajustes → Proveedor de Biblia).
-- A diferencia de locale, no hace falta detectar nada del dispositivo: YouVersion
-- es el proveedor con el que la app siempre trabajó, así que el default not null
-- preserva el comportamiento actual para todos los usuarios existentes.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bible_provider') then
    create type bible_provider as enum ('youversion', 'biblegateway');
  end if;
end $$;

alter table public.profiles
  add column if not exists bible_provider bible_provider not null default 'youversion';
