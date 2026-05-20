/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { studioAvatarApiDev } from './vite-plugins/studioAvatarApiDev.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let pexelsKey = (env.VITE_PEXELS_API_KEY || '').trim().replace(/^\uFEFF/, '')
  if (pexelsKey.toLowerCase().startsWith('bearer ')) {
    pexelsKey = pexelsKey.slice(7).trim()
  }

  return {
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  plugins: [studioAvatarApiDev(), react()],
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@welcome-gifts': path.resolve(
        __dirname,
        'supabase/functions/_shared/welcome-gifts.catalog.ts'
      ),
    },
  },
  server: {
    port: 5173, // pour npm run dev
    proxy: {
      // Pexels : la clé est ajoutée par Node (évite 401 / encodage différent du bundle client)
      '/__pexels': {
        target: 'https://api.pexels.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__pexels/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (pexelsKey) proxyReq.setHeader('Authorization', pexelsKey)
          })
        },
      },
      // Autres routes /api → Netlify Dev si lancé (npx netlify dev)
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
        bypass(req) {
          const pathname = req.url?.split('?')[0] ?? '';
          if (pathname === '/api/studio/generate-avatar') {
            return false;
          }
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Séparer React et React DOM
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Séparer Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor';
          }
          // Séparer les icônes (lucide-react peut être volumineux)
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          // Prisma n'est pas utilisé côté client, donc pas besoin de le bundler
          // Si Vite le détecte quand même, il sera dans le chunk vendor par défaut
        },
      },
    },
    // Augmenter la limite d'avertissement à 600 kB (optionnel)
    chunkSizeWarningLimit: 600,
  },
  }
})