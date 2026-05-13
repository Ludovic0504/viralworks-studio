-- Plafond d'affichage « vidéos / X » dans le menu profil (mis à jour lors des ajouts de solde côté Stripe / sync).

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS video_display_cap integer;

UPDATE public.user_credits
SET video_display_cap = 30
WHERE video_display_cap IS NULL;

ALTER TABLE public.user_credits
  ALTER COLUMN video_display_cap SET DEFAULT 30,
  ALTER COLUMN video_display_cap SET NOT NULL;
