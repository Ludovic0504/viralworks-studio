-- Journal Nouveautés (/lab) : mode « À partir de ma photo » sur Avatar IA.

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
  'Créez votre avatar à votre image',
  $d$Importez une photo de votre visage et laissez l'IA générer votre character sheet professionnel en respectant vos traits. Disponible dans Avatar IA → "À partir de ma photo".$d$,
  'feature',
  'Fonctionnalité',
  '/studio',
  'Essayer',
  'Users',
  true,
  timestamptz '2026-06-03 12:00:00+00'
);
