import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
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
      // Proxy pour les fonctions Netlify en développement
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
})
// test