-- Cron Supabase: synchronisation périodique du statut fournisseur des cadeaux.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'welcome_gift_provider_sync_every_15_min'
  ) then
    perform cron.unschedule('welcome_gift_provider_sync_every_15_min');
  end if;
end
$$;

select cron.schedule(
  'welcome_gift_provider_sync_every_15_min',
  '*/15 * * * *',
  $$
  select
    net.http_post(
      url := 'https://wuvtfhletxieocetzppo.functions.supabase.co/welcome-gift-provider-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dnRmaGxldHhpZW9jZXR6cHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyODE1NDksImV4cCI6MjA3Njg1NzU0OX0.1cxd2ldRI843G_gv58fJrTeNosrzf6-eQETwjdKXAys'
      ),
      body := '{}'::jsonb
    );
  $$
);
