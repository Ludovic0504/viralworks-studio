-- Test : accès Avatar Studio pour jeanlmt.pro@gmail.com (3 générations restantes ce mois-ci)
-- Limite mensuelle = 5 ; avatar_studio_count = 2 → 3 générations disponibles.

update public.profiles
set
  is_tester = true,
  avatar_studio_count = 2,
  avatar_studio_reset_at = date_trunc('month', now())
where lower(email) = lower('jeanlmt.pro@gmail.com');

notify pgrst, 'reload schema';
