

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Meta Pixel ID (public). Si absent, tracking désactivé. */
  readonly VITE_META_PIXEL_ID?: string
  /** URL complète du callback auth, ex. https://mondomaine.fr/auth/callback (optionnel) */
  readonly VITE_AUTH_REDIRECT_URL?: string
  readonly VITE_SITE_URL?: string
  /** Clé publique Stripe : pk_test_… (dev) ou pk_live_… (prod). Fichier .env.local / .env.production uniquement. */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  /** Clé API Pexels (aperçus cartes format Campagne VWS). https://www.pexels.com/api/ */
  readonly VITE_PEXELS_API_KEY?: string
  /** Si "1", appels prod vers `/api/pexels-search` (clé serveur PEXELS_API_KEY ou VITE_PEXELS_API_KEY sur Vercel). */
  readonly VITE_PEXELS_SERVER?: string
  /** Si "true", affiche l'entrée "Décors & Lieux" dans le dropdown ViralWorks. */
  readonly VITE_FEATURE_DECORS?: string
  // VITE_OPENAI_API_KEY n'est plus nécessaire côté client
  // La clé est gérée par Supabase Edge Functions
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

