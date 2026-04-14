

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SITE_URL?: string
  // VITE_OPENAI_API_KEY n'est plus nécessaire côté client
  // La clé est gérée par Supabase Edge Functions
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

