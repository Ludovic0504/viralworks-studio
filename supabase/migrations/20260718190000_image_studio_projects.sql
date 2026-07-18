-- Image Studio Projects: folders + canvas nodes/edges

create table if not exists public.image_studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cover_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.image_studio_project_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.image_studio_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  history_id uuid null,
  image_url text not null,
  prompt text null,
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.image_studio_project_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.image_studio_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid not null references public.image_studio_project_nodes(id) on delete cascade,
  target_node_id uuid not null references public.image_studio_project_nodes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint image_studio_project_edges_no_self check (source_node_id <> target_node_id),
  constraint image_studio_project_edges_unique unique (project_id, source_node_id, target_node_id)
);

create index if not exists idx_image_studio_projects_user_updated
  on public.image_studio_projects(user_id, updated_at desc);

create index if not exists idx_image_studio_project_nodes_project
  on public.image_studio_project_nodes(project_id);

create index if not exists idx_image_studio_project_nodes_user
  on public.image_studio_project_nodes(user_id);

create index if not exists idx_image_studio_project_edges_project
  on public.image_studio_project_edges(project_id);

create index if not exists idx_image_studio_project_edges_user
  on public.image_studio_project_edges(user_id);

alter table public.image_studio_projects enable row level security;
alter table public.image_studio_project_nodes enable row level security;
alter table public.image_studio_project_edges enable row level security;

drop policy if exists "image_studio_projects_select_own" on public.image_studio_projects;
create policy "image_studio_projects_select_own"
  on public.image_studio_projects for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "image_studio_projects_insert_own" on public.image_studio_projects;
create policy "image_studio_projects_insert_own"
  on public.image_studio_projects for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "image_studio_projects_update_own" on public.image_studio_projects;
create policy "image_studio_projects_update_own"
  on public.image_studio_projects for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "image_studio_projects_delete_own" on public.image_studio_projects;
create policy "image_studio_projects_delete_own"
  on public.image_studio_projects for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "image_studio_project_nodes_select_own" on public.image_studio_project_nodes;
create policy "image_studio_project_nodes_select_own"
  on public.image_studio_project_nodes for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "image_studio_project_nodes_insert_own" on public.image_studio_project_nodes;
create policy "image_studio_project_nodes_insert_own"
  on public.image_studio_project_nodes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "image_studio_project_nodes_update_own" on public.image_studio_project_nodes;
create policy "image_studio_project_nodes_update_own"
  on public.image_studio_project_nodes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "image_studio_project_nodes_delete_own" on public.image_studio_project_nodes;
create policy "image_studio_project_nodes_delete_own"
  on public.image_studio_project_nodes for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "image_studio_project_edges_select_own" on public.image_studio_project_edges;
create policy "image_studio_project_edges_select_own"
  on public.image_studio_project_edges for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "image_studio_project_edges_insert_own" on public.image_studio_project_edges;
create policy "image_studio_project_edges_insert_own"
  on public.image_studio_project_edges for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "image_studio_project_edges_update_own" on public.image_studio_project_edges;
create policy "image_studio_project_edges_update_own"
  on public.image_studio_project_edges for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "image_studio_project_edges_delete_own" on public.image_studio_project_edges;
create policy "image_studio_project_edges_delete_own"
  on public.image_studio_project_edges for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.image_studio_projects to authenticated;
grant select, insert, update, delete on public.image_studio_project_nodes to authenticated;
grant select, insert, update, delete on public.image_studio_project_edges to authenticated;
