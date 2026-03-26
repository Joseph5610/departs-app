import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Departs.app',
        short_name: 'Departs',
        description: 'Real-time Prague Public Transport Visualization',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            // Cache CARTO Map Style JSON
            urlPattern: /^https:\/\/([a-z0-9-]+\.)?basemaps\.cartocdn\.com\/gl\/.*\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'carto-map-styles',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache CARTO Sprites & Fonts
            urlPattern: /^https:\/\/([a-z0-9-]+\.)?basemaps\.cartocdn\.com\/(gl|fonts)\/.*\.(png|pbf|json)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-map-resources',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 180 * 24 * 60 * 60 // 180 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache CARTO Vector Tiles
            urlPattern: /^https:\/\/([a-z0-9-]+\.)?basemaps\.cartocdn\.com\/(vector|vectortiles)\/.*\.(mvt|pbf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-vector-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', '@tanstack/react-query'],
          'vendor-map': ['maplibre-gl'],
          'vendor-ui': ['framer-motion', 'lucide-react']
        }
      }
    }
  }
})
