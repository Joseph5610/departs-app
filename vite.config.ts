import path from "path"
import fs from "fs"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import license from 'rollup-plugin-license'
import { SITE, SITE_PLACEHOLDERS } from './src/config/site.ts'

const SITE_PLACEHOLDER = /%(SITE_[A-Z_]+)%/g

/** Licences a bundled dependency may carry; anything else fails the build. */
const ALLOWED_LICENSES = '(MIT OR ISC OR BSD-2-Clause OR BSD-3-Clause OR Apache-2.0 OR 0BSD OR Unlicense OR OFL-1.1)'

/** Packages bundled through CSS, which the licence plugin does not see. */
const CSS_PACKAGES = ['@fontsource-variable/geist', '@fontsource-variable/fira-code']

interface LicenseNotice { name: string | null; version: string | null; license: string | null; licenseText: string | null }

const cssPackageNotice = (name: string): LicenseNotice => {
  const dir = path.resolve(import.meta.dirname, 'node_modules', name)
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version: string; license: string }
  return { name, version: pkg.version, license: pkg.license, licenseText: fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8') }
}

/** THIRD_PARTY_LICENSES.txt: every bundled package with its full licence text. */
const thirdPartyNotices = (bundled: LicenseNotice[]): string =>
  [...bundled, ...CSS_PACKAGES.map(cssPackageNotice)]
    .map((dep) => `${dep.name} ${dep.version} (${dep.license})\n\n${dep.licenseText?.trim() ?? ''}`)
    .join('\n\n---\n\n')

const fillSitePlaceholders = (text: string): string =>
  text.replace(SITE_PLACEHOLDER, (_match, key: string) => {
    const value = SITE_PLACEHOLDERS[key]
    if (value === undefined) throw new Error(`Unknown placeholder %${key}%; add it to SITE_PLACEHOLDERS in src/config/site.ts`)
    return value
  })

/** Text files under `dir`, relative to it. */
const textFilesIn = (dir: string): string[] =>
  fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /(\.(txt|json|html|xml)|_headers|_redirects)$/.test(file) && fs.statSync(path.join(dir, file)).isFile())

/** Fills `src/config/site.ts` values into index.html and the copied public files. */
const siteTemplate = (): Plugin => {
  let outDir = 'dist'
  let publicDir = 'public'
  return {
    name: 'site-template',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      publicDir = config.publicDir
    },
    transformIndexHtml: { order: 'pre', handler: fillSitePlaceholders },
    writeBundle() {
      for (const file of textFilesIn(publicDir)) {
        const target = path.join(outDir, file)
        const text = fs.readFileSync(target, 'utf8')
        if (text.includes('%SITE_')) fs.writeFileSync(target, fillSitePlaceholders(text))
      }
    },
  }
}

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
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    siteTemplate(),
    license({
      thirdParty: {
        includePrivate: false,
        allow: { test: ALLOWED_LICENSES, failOnUnlicensed: true, failOnViolation: true },
        output: { file: path.resolve(import.meta.dirname, 'dist/THIRD_PARTY_LICENSES.txt'), template: thirdPartyNotices },
      },
    }),
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
        name: SITE.INSTALL_NAME,
        short_name: SITE.INSTALL_SHORT_NAME,
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

