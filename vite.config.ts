import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      // Dev-only relay for DPMP_REALTIME_URL (bound by `npm run dev`): egov.presov.sk offers only legacy TLS ciphers local workerd rejects.
      '/__dev/dpmp.csv': {
        target: 'https://egov.presov.sk',
        changeOrigin: true,
        rewrite: () => '/geodatakatalog/dpmp.csv',
      },
    },
  },
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
      includeAssets: ['favicon.png', 'icon.png', 'cities/*.webp'],
      // Icons, favicon and iOS launch screens come from pwa-assets.config.ts; their <link> tags are injected into index.html.
      pwaAssets: {
        config: true,
        overrideManifestIcons: true,
      },
      manifest: {
        id: '/',
        name: 'Departs.app',
        short_name: 'Departs',
        description: 'Real-time Public Transport Visualization',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
      },
      workbox: {
        // Admin pages load on demand; precaching them would ship them to every installed PWA.
        globIgnores: ['**/AdminRoutes-*'],
        // Generated icons aren't picked up by includeManifestIcons; #boot-splash needs pwa-192x192.png offline.
        globPatterns: ['**/*.{js,css,html}', 'pwa-*.png', 'maskable-icon-*.png', 'apple-touch-icon-*.png', 'favicon.ico'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/admin/, /^\/mcp/, /^\/api/, /^\/cdn-cgi/, /\.well-known/, /manifest\.webmanifest$/, /\.json$/, /\.xml$/],
        manifestTransforms: [
          (manifestEntries) => {
            const manifest = manifestEntries.map((entry) => {
              if (entry.url === 'index.html') {
                entry.url = '/';
              }
              return entry;
            });
            return { manifest, warnings: [] };
          }
        ],
        runtimeCaching: [
          {
            // Cache CARTO Map Style & Tiles JSON
            urlPattern: /^https:\/\/([a-z0-9-]+\.)?basemaps\.cartocdn\.com\/(gl|vector)\/.*\.json$/i,
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
  // maplibre-gl v6 spawns its worker with { type: 'module' }, so the bundled
  // worker must be emitted as ESM rather than Vite's default IIFE.
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/@tanstack/react-query/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/maplibre-gl/')) {
            return 'vendor-map';
          }
          if (id.includes('node_modules/framer-motion/') || id.includes('node_modules/lucide-react/')) {
            return 'vendor-ui';
          }
        }
      }
    }
  }
})

