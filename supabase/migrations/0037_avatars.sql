-- ============================================================================
-- Lee Tu Biblia — Foto de perfil.
-- Migración 0037. Aplicar DESPUÉS de 0001 (profiles). Idempotente. Solo agrega:
-- quien no sube foto sigue con su inicial.
--
-- 1) profiles.avatar_url: la URL pública de la foto (con ?v= para que el
--    navegador no muestre la anterior al cambiarla). La ven quienes ya ven tu
--    nombre (vos y quienes comparten un grupo con vos: políticas de 0004).
-- 2) Bucket público "avatars": cada foto vive en avatars/<user_id>/avatar.webp.
--    Se lee por URL pública; subir, reemplazar y borrar solo en tu carpeta.
--    Límite de 300 KB y solo imágenes (la app la achica a ~20 KB en WebP).
-- ============================================================================

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars own insert" on storage.objects;
create policy "avatars own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- El upsert de supabase-js necesita poder leer el objeto propio para reemplazarlo.
drop policy if exists "avatars own select" on storage.objects;
create policy "avatars own select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
