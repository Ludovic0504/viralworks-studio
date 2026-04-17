-- Aligne les encadrés « exemple » sur les captures d’écran d’origine (flèches ->).

update public.informations_utiles_items i
set
  example = 'Contexte -> Action -> Style',
  updated_at = now()
from public.informations_utiles_sections s
where i.section_id = s.id and s.slug = 'prompts' and i.title = 'Structure efficace';

update public.informations_utiles_items i
set
  example = 'Projet ''Campagne Marketing'' -> 5 prompts, 10 images',
  updated_at = now()
from public.informations_utiles_sections s
where i.section_id = s.id and s.slug = 'workflow' and i.title = 'Organisation par projets';

update public.informations_utiles_items i
set
  example = 'Version 1 -> Ajustement -> Version 2 -> Final',
  updated_at = now()
from public.informations_utiles_sections s
where i.section_id = s.id and s.slug = 'workflow' and i.title = 'Itérations rapides';

update public.informations_utiles_items i
set
  example =
    'Simple: ''Un chat dans un jardin'' -> Avancé: ''Un chat persan orange dans un jardin japonais, style photographie macro, éclairage naturel matinal''',
  updated_at = now()
from public.informations_utiles_sections s
where i.section_id = s.id and s.slug = 'tips' and i.title = 'Commence simple';
