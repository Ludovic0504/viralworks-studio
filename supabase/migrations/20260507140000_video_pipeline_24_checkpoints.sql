-- Checkpoints du pipeline vidéo 24s (3×8s Veo) pour reprise après échec ou refresh.

create extension if not exists "pgcrypto";

create table if not exists public.video_pipeline_24_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt_hash text not null,
  prompts jsonb not null,
  pipeline_step smallint not null check (pipeline_step >= 1 and pipeline_step <= 6),
  segments jsonb not null default '{}'::jsonb,
  frame_hook_after_seg1_url text null,
  frame_hook_after_seg2_url text null,
  updated_at timestamptz not null default now(),
  unique (user_id, prompt_hash)
);

create index if not exists idx_video_pipeline_24_checkpoints_user_updated
  on public.video_pipeline_24_checkpoints (user_id, updated_at desc);

alter table public.video_pipeline_24_checkpoints enable row level security;

drop policy if exists "video_pipeline_24_checkpoints_select_own" on public.video_pipeline_24_checkpoints;
create policy "video_pipeline_24_checkpoints_select_own"
  on public.video_pipeline_24_checkpoints for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "video_pipeline_24_checkpoints_insert_own" on public.video_pipeline_24_checkpoints;
create policy "video_pipeline_24_checkpoints_insert_own"
  on public.video_pipeline_24_checkpoints for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "video_pipeline_24_checkpoints_update_own" on public.video_pipeline_24_checkpoints;
create policy "video_pipeline_24_checkpoints_update_own"
  on public.video_pipeline_24_checkpoints for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "video_pipeline_24_checkpoints_delete_own" on public.video_pipeline_24_checkpoints;
create policy "video_pipeline_24_checkpoints_delete_own"
  on public.video_pipeline_24_checkpoints for delete
  to authenticated
  using (auth.uid() = user_id);
