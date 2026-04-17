-- Page « Informations utiles » : catégories + entrées, lecture publique, écriture admin.

create table if not exists public.informations_utiles_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  icon_name text not null default 'FileText',
  color text not null default 'cyan'
    check (color in ('cyan', 'violet', 'yellow', 'emerald')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.informations_utiles_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.informations_utiles_sections (id) on delete cascade,
  title text not null,
  content text not null,
  example text null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_informations_utiles_items_section_sort
  on public.informations_utiles_items (section_id, sort_order);

alter table public.informations_utiles_sections enable row level security;
alter table public.informations_utiles_items enable row level security;

-- Lecture publique : catégories actives uniquement
drop policy if exists "informations_utiles_sections_select_public" on public.informations_utiles_sections;
create policy "informations_utiles_sections_select_public"
  on public.informations_utiles_sections for select
  to anon, authenticated
  using (is_active = true);

-- Admins : voir aussi les catégories inactives
drop policy if exists "informations_utiles_sections_select_admin" on public.informations_utiles_sections;
create policy "informations_utiles_sections_select_admin"
  on public.informations_utiles_sections for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "informations_utiles_sections_insert_admin" on public.informations_utiles_sections;
create policy "informations_utiles_sections_insert_admin"
  on public.informations_utiles_sections for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "informations_utiles_sections_update_admin" on public.informations_utiles_sections;
create policy "informations_utiles_sections_update_admin"
  on public.informations_utiles_sections for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "informations_utiles_sections_delete_admin" on public.informations_utiles_sections;
create policy "informations_utiles_sections_delete_admin"
  on public.informations_utiles_sections for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

-- Entrées : lecture si la catégorie parente est active (visiteurs)
drop policy if exists "informations_utiles_items_select_public" on public.informations_utiles_items;
create policy "informations_utiles_items_select_public"
  on public.informations_utiles_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.informations_utiles_sections s
      where s.id = section_id and s.is_active = true
    )
  );

drop policy if exists "informations_utiles_items_select_admin" on public.informations_utiles_items;
create policy "informations_utiles_items_select_admin"
  on public.informations_utiles_items for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "informations_utiles_items_insert_admin" on public.informations_utiles_items;
create policy "informations_utiles_items_insert_admin"
  on public.informations_utiles_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "informations_utiles_items_update_admin" on public.informations_utiles_items;
create policy "informations_utiles_items_update_admin"
  on public.informations_utiles_items for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "informations_utiles_items_delete_admin" on public.informations_utiles_items;
create policy "informations_utiles_items_delete_admin"
  on public.informations_utiles_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );

grant select on public.informations_utiles_sections to anon;
grant select on public.informations_utiles_items to anon;
grant select, insert, update, delete on public.informations_utiles_sections to authenticated;
grant select, insert, update, delete on public.informations_utiles_items to authenticated;

-- Données initiales (équivalent à l’ancien contenu statique)
insert into public.informations_utiles_sections (id, slug, title, icon_name, color, sort_order, is_active)
values
  ('a1000000-0000-4000-8000-000000000001', 'prompts', 'Création de prompts', 'FileText', 'cyan', 0, true),
  ('a1000000-0000-4000-8000-000000000002', 'images', 'Génération d''images', 'ImageIcon', 'violet', 1, true),
  ('a1000000-0000-4000-8000-000000000003', 'workflow', 'Workflow optimisé', 'Zap', 'yellow', 2, true),
  ('a1000000-0000-4000-8000-000000000004', 'tips', 'Conseils pratiques', 'Lightbulb', 'emerald', 3, true)
on conflict (slug) do nothing;

insert into public.informations_utiles_items (id, section_id, title, content, example, sort_order)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Structure efficace',
    $c$Commence par définir le contexte, puis l'action principale, et termine par le style souhaité. Exemple : 'Un développeur dans un bureau moderne, en train de coder sur un écran lumineux, style cinématique avec éclairage dramatique'.$c$,
    $c$Contexte -> Action -> Style$c$,
    0
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Détails techniques',
    $c$Spécifie la caméra, l'éclairage et le ton. Pour VEO3, utilise les paramètres Scene, Style, Camera, Lighting et Tone pour un contrôle précis du rendu final.$c$,
    $c$Camera: close-up | Lighting: golden hour$c$,
    1
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'Dialogues en français',
    $c$Pour les vidéos avec dialogues, indique clairement les répliques en français. Le système traduira et adaptera automatiquement la prononciation.$c$,
    $c$Dialogue: 'Bonjour, comment allez-vous ?'$c$,
    2
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000002',
    'Descriptions précises',
    $c$Plus ta description est détaillée, meilleur sera le résultat. Mentionne la composition, les couleurs, l'ambiance et le style artistique souhaité.$c$,
    $c$Portrait d'une femme, style réaliste, éclairage doux, fond flou$c$,
    0
  ),
  (
    'b2000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000002',
    'Personnages de référence',
    $c$Utilise l'option de personnage de référence pour maintenir la cohérence visuelle dans une série d'images. Idéal pour créer des personnages récurrents.$c$,
    $c$Même personnage, différentes poses$c$,
    1
  ),
  (
    'b2000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000002',
    'Formats adaptés',
    $c$Choisis le format selon l'usage : carré pour Instagram, paysage pour bannières, portrait pour stories. Chaque format a son impact visuel.$c$,
    $c$16:9 pour vidéos | 1:1 pour posts$c$,
    2
  ),
  (
    'b2000000-0000-4000-8000-000000000007',
    'a1000000-0000-4000-8000-000000000003',
    'Organisation par projets',
    $c$Regroupe tes créations par projet pour garder une vue d'ensemble. Un projet peut contenir plusieurs prompts, images et vidéos liés.$c$,
    $c$Projet 'Campagne Marketing' -> 5 prompts, 10 images$c$,
    0
  ),
  (
    'b2000000-0000-4000-8000-000000000008',
    'a1000000-0000-4000-8000-000000000003',
    'Historique intelligent',
    $c$Tous tes contenus sont sauvegardés automatiquement. Tu peux retrouver, modifier et réutiliser n'importe quelle création précédente.$c$,
    $c$Accès rapide aux dernières créations$c$,
    1
  ),
  (
    'b2000000-0000-4000-8000-000000000009',
    'a1000000-0000-4000-8000-000000000003',
    'Itérations rapides',
    $c$Teste plusieurs variations en ajustant légèrement tes prompts. Les meilleurs résultats viennent souvent de petites modifications successives.$c$,
    $c$Version 1 -> Ajustement -> Version 2 -> Final$c$,
    2
  ),
  (
    'b2000000-0000-4000-8000-000000000010',
    'a1000000-0000-4000-8000-000000000004',
    'Commence simple',
    $c$Pour tes premiers essais, utilise des prompts courts et clairs. Une fois que tu maîtrises, tu peux ajouter plus de détails et de complexité.$c$,
    $c$Simple: 'Un chat dans un jardin' -> Avancé: 'Un chat persan orange dans un jardin japonais, style photographie macro, éclairage naturel matinal'$c$,
    0
  ),
  (
    'b2000000-0000-4000-8000-000000000011',
    'a1000000-0000-4000-8000-000000000004',
    'Expérimente les styles',
    $c$N'hésite pas à tester différents styles artistiques : réaliste, cartoon, cinématique, abstrait. Chaque style apporte une émotion différente.$c$,
    $c$Même sujet, styles différents = résultats uniques$c$,
    1
  ),
  (
    'b2000000-0000-4000-8000-000000000012',
    'a1000000-0000-4000-8000-000000000004',
    'Sauvegarde tes favoris',
    $c$Quand tu trouves un prompt qui fonctionne bien, sauvegarde-le comme modèle. Tu pourras le réutiliser et l'adapter pour d'autres créations.$c$,
    $c$Modèles réutilisables dans l'historique$c$,
    2
  )
on conflict (id) do nothing;
