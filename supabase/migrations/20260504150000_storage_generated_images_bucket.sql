-- Bucket public (lecture) pour les URL `getPublicUrl` consommées par l’Edge `vertex-veo-video` et l’app.
-- Écriture : uniquement le dossier `auth.uid()`/ — aligné sur `uploadImageFromUrl` (storage.ts) et le pipeline Veo.
insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "generated_images_public_read" on storage.objects;
create policy "generated_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'generated-images');

drop policy if exists "generated_images_insert_own_folder" on storage.objects;
create policy "generated_images_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated_images_delete_own_folder" on storage.objects;
create policy "generated_images_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
