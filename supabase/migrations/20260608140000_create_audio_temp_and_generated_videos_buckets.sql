-- Bucket temporaire pour pistes voix TTS (Edge Function video-postprocess, lecture publique).
insert into storage.buckets (id, name, public)
values ('audio-temp', 'audio-temp', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "audio_temp_public_read" on storage.objects;
create policy "audio_temp_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'audio-temp');

drop policy if exists "audio_temp_service_role_insert" on storage.objects;
create policy "audio_temp_service_role_insert"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'audio-temp');

-- Bucket sorties vidéo fusionnées côté client (ffmpeg.wasm).
insert into storage.buckets (id, name, public)
values ('generated-videos', 'generated-videos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "generated_videos_public_read" on storage.objects;
create policy "generated_videos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'generated-videos');

drop policy if exists "generated_videos_insert_own_folder" on storage.objects;
create policy "generated_videos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'generated-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated_videos_delete_own_folder" on storage.objects;
create policy "generated_videos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'generated-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
