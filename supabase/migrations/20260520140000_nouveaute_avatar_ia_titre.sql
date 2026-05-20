-- Aligner le titre affiché sur /lab avec le libellé produit « Création d'avatar IA ».

update public.nouveautes
set
  title = 'Création d''avatar IA',
  description = $d$Créez un avatar professionnel par IA : métier, tenue et apparence au choix, portrait face puis triptyque (dos, face, gros plan) pour vos vidéos. Disponible dans ViralWorks → Avatar IA (abonnement requis).$d$,
  icon_name = 'Users',
  published_at = timestamptz '2026-05-20 14:00:00+00',
  updated_at = now()
where redirect_path = '/studio'
  and title ilike '%avatar%';

-- Si l''insert précédente n''existait pas (migration non appliquée), créer l''entrée.
insert into public.nouveautes (
  title,
  description,
  type,
  category,
  redirect_path,
  redirect_label,
  icon_name,
  is_active,
  published_at
)
select
  'Création d''avatar IA',
  $d$Créez un avatar professionnel par IA : métier, tenue et apparence au choix, portrait face puis triptyque (dos, face, gros plan) pour vos vidéos. Disponible dans ViralWorks → Avatar IA (abonnement requis).$d$,
  'feature',
  'Fonctionnalité',
  '/studio',
  'Découvrir l''Avatar IA',
  'Users',
  true,
  timestamptz '2026-05-20 14:00:00+00'
where not exists (
  select 1 from public.nouveautes where redirect_path = '/studio'
);
