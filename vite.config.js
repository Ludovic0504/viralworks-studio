/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'
import { vwsBuildBootPlugin } from './scripts/vws-build-boot.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let pexelsKey = (env.VITE_PEXELS_API_KEY || '').trim().replace(/^\uFEFF/, '')
  if (pexelsKey.toLowerCase().startsWith('bearer ')) {
    pexelsKey = pexelsKey.slice(7).trim()
  }

  const vwsBuildId =
    process.env.GITHUB_SHA?.slice(0, 12) ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  return {
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts'],
  },
  plugins: [
    vwsBuildBootPlugin(vwsBuildId),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['sw-activate-reload.js'],
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff,woff2,webmanifest,json,txt}'],
        globIgnores: ['**/index.html', '**/recover.html', '**/sw-activate-reload.js'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vws-html-navigate',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
      includeAssets: ['logo.png', 'Logo_VWS_sans_bordure.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'ViralWorks Studio',
        short_name: 'ViralWorks',
        description: 'Créez des vidéos virales pour vos réseaux sociaux',
        theme_color: '#0C1116',
        background_color: '#0C1116',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      }
    }),
    react(),
  ],
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
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
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