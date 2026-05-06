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

## 5) Mot de passe oublié / erreur HTTP 500 sur `/auth/v1/recover`

L’appel part du navigateur vers **ton projet Supabase** ; un **500** ou le message *Error sending recovery email* signifie que **Supabase n’a pas réussi à envoyer l’email** (ce n’est pas un bug du formulaire de login).

À faire dans le [dashboard Supabase](https://supabase.com/dashboard) du projet (référence = sous-domaine de `VITE_SUPABASE_URL`, ex. `xxxx.supabase.co` → `xxxx`) :

1. **Authentication → URL Configuration**  
   - Ajoute la redirect utilisée en local : `http://localhost:5173/auth/callback`  
   - En production, ajoute aussi `https://<ton-domaine>/auth/callback`  
   - Optionnel : fixe `VITE_AUTH_REDIRECT_URL` dans `.env.local` si l’URL doit être imposée au build.

2. **SMTP intégré (sans fournisseur perso)**  
   - Par défaut, Supabase **n’envoie des emails qu’aux adresses des membres de l’organisation** du projet.  
   - Si tu testes avec un Gmail « quelconque », l’envoi peut échouer : invite ce compte dans **l’organisation → Team**, ou passe à un **SMTP personnalisé**.  
   - Doc officielle : [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

3. **SMTP personnalisé**  
   - **Authentication → SMTP** (ou équivalent selon l’UI) : vérifie hôte, port (souvent 587 ou 465), utilisateur, mot de passe, expéditeur, TLS.  
   - Après modification, reteste « Mot de passe oublié ».

4. **Logs (indispensable pour comprendre le 500)**  
   - **Logs → Auth** (ou requêtes vers `recover`) au moment du clic : copie le message d’erreur exact côté serveur (refus SMTP, CAPTCHA, etc.). Sans cette étape, on ne fait que deviner.

5. **Attack Protection / CAPTCHA**  
   - Si la protection bot / CAPTCHA s’applique aux flux par email, une requête **sans** `captchaToken` peut échouer. Désactive temporairement pour tester, ou intègre Turnstile / hCaptcha et passe le jeton à `resetPasswordForEmail` ([doc](https://supabase.com/docs/guides/auth/auth-captcha)).

6. **API de gestion (optionnel)**  
   - Pour automatiser la config SMTP : [Management API – config auth](https://supabase.com/docs/guides/auth/auth-smtp) (token compte + `PROJECT_REF`).

Sur l’écran de connexion, en cas d’échec, des **liens directs** vers SMTP, URL Configuration, Team et la doc peuvent s’afficher (dérivés de `VITE_SUPABASE_URL`).

En local, tu peux aussi lancer (ouvre l’onglet SMTP dans le navigateur, à partir de `.env.local` / `.env`) :

```bash
npm run supabase:dashboard-auth
```

