CREATE TABLE IF NOT EXISTS public.user_credit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  text_generation integer NOT NULL DEFAULT 0 CHECK (text_generation >= 0),
  image_generation integer NOT NULL DEFAULT 0 CHECK (image_generation >= 0),
  image_modification integer NOT NULL DEFAULT 0 CHECK (image_modification >= 0),
  video_generation integer NOT NULL DEFAULT 0 CHECK (video_generation >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_credit_buckets_select_own" ON public.user_credit_buckets;
CREATE POLICY "user_credit_buckets_select_own"
  ON public.user_credit_buckets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_credit_buckets_insert_own" ON public.user_credit_buckets;
CREATE POLICY "user_credit_buckets_insert_own"
  ON public.user_credit_buckets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_credit_buckets_update_own" ON public.user_credit_buckets;
CREATE POLICY "user_credit_buckets_update_own"
  ON public.user_credit_buckets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_credit_buckets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credit_buckets TO service_role;
