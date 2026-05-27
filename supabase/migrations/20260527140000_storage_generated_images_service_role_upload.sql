-- Uploads Edge Function (service_role) vers generated-images, ex. avatars/
drop policy if exists "generated_images_service_role_insert" on storage.objects;
create policy "generated_images_service_role_insert"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'generated-images');

-- Lecture liste / select pour le propriétaire du dossier avatars/
drop policy if exists "generated_images_select_own_avatars" on storage.objects;
create policy "generated_images_select_own_avatars"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'avatars'
  );
