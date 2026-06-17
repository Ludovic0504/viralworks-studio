-- Sync Image Studio (canvas + historique) across user sessions via Supabase Realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.history;
  END IF;
END $$;
