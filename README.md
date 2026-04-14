# ViralWorks — démarrage local + Supabase

## Structure

- **Front**: Vite/React (`src/`) → `npm run dev` (port 5173)
- **Backend**: `backend/video-audio-pipeline/server.mjs` → `npm run backend:video-audio` (port 8788)
- **Supabase**: Edge Functions dans `supabase/functions/*`

## 1) Configurer les variables d’environnement (sans commiter de secrets)

1. Copie `.env.example` vers `.env.local`
2. Remplis ces 2 variables **minimum** pour connecter le front à ton projet Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Ces valeurs se trouvent dans Supabase → **Project Settings → API**.

> Important: tout ce qui commence par `VITE_` est exposé au navigateur.  
> Ne mets jamais `SERVICE_ROLE_KEY` côté `VITE_`.

## 2) Lancer en local

```bash
npm ci
npm run dev
```

Optionnel (pipeline vidéo/audio):

```bash
npm run backend:video-audio
```

## 3) Secrets des Edge Functions Supabase

Les fichiers dans `supabase/functions/*` lisent leurs secrets via `Deno.env.get(...)`.
Il faut donc définir les secrets directement dans Supabase (ou via la CLI Supabase).

Variables clés utilisées par les fonctions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Pipeline: `VIDEO_AUDIO_PIPELINE_URL`, `VIDEO_AUDIO_PIPELINE_TOKEN`

## 4) Vérifications rapides

- Front: `http://localhost:5173`
- Backend pipeline: `http://localhost:8788/health`

