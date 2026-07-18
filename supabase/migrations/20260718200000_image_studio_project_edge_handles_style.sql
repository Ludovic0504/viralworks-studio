-- Persist connection handles + visual style for project edges

alter table public.image_studio_project_edges
  add column if not exists source_handle text null,
  add column if not exists target_handle text null,
  add column if not exists edge_style text not null default 'arrow';

comment on column public.image_studio_project_edges.source_handle is
  'React Flow source handle id (left|top|right|bottom).';
comment on column public.image_studio_project_edges.target_handle is
  'React Flow target handle id (left|top|right|bottom).';
comment on column public.image_studio_project_edges.edge_style is
  'Visual style: arrow | solid | dashed.';

alter table public.image_studio_project_edges
  drop constraint if exists image_studio_project_edges_style_check;

alter table public.image_studio_project_edges
  add constraint image_studio_project_edges_style_check
  check (edge_style in ('arrow', 'solid', 'dashed'));
