-- Journal Nouveautés (/lab) : annonce Studio Avatar IA (insert uniquement).

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
values (
  'Création d''avatar IA',
  $d$Tu peux maintenant concevoir un avatar IA sur mesure : choisis ton métier, ta tenue et ton apparence, génère un portrait face, puis un triptyque (dos, face, gros plan) prêt pour tes vidéos. Accède au studio via le menu ViralWorks → Avatar IA.$d$,
  'feature',
  'Fonctionnalité',
  '/studio',
  'Découvrir l''Avatar IA',
  'User',
  true,
  timestamptz '2026-05-20 12:00:00+00'
);
