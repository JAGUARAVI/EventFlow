import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    https: true,
    port: 5174,
    host: '0.0.0.0'
  },
  plugins: [
    react(), 
    tailwindcss(), 
    mkcert(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
            handler: 'NetworkOnly',
          }
        ]
      },
      manifest: {
        name: 'EventFlow - Events Manager',
        short_name: 'EventFlow',
        description: 'EventFlow is a progressive events management platform designed to streamline event organization and enhance participant engagement.',
        theme_color: '#0a0a0a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'android/android-launchericon-192-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android/android-launchericon-512-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
