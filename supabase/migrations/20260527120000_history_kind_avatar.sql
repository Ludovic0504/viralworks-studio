-- Allow studio avatar entries in history (kind = 'avatar')
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_kind_check;

ALTER TABLE public.history
  ADD CONSTRAINT history_kind_check
  CHECK (kind = ANY (ARRAY['prompt'::text, 'image'::text, 'video'::text, 'avatar'::text]));
