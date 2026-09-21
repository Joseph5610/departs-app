import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const noUnusedVars = ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}]

export default defineConfig([
  globalIgnores(['dist', 'scratch', 'ds-bundle', '.ds-sync']),

  // Frontend: browser globals, React rules.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': noUnusedVars,
    },
  },
  {
    files: ['src/components/ui/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Backend: Workers runtime, no React. `caches` and the Cloudflare types come from
  // @cloudflare/workers-types, which only tsc sees, so they are declared here for no-undef.
  {
    files: ['functions/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.serviceworker,
        KVNamespace: 'readonly',
        PagesFunction: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': noUnusedVars,
    },
  },

  // Backend layering: _core -> _feeds -> _domain -> _cities -> api/, _mcp/. A layer imports only from layers to its left.
  {
    files: ['functions/_core/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: layerBan('_core', ['_feeds', '_domain', '_cities', '_mcp']) }] },
  },
  {
    files: ['functions/_feeds/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: layerBan('_feeds', ['_domain', '_cities', '_mcp']) }] },
  },
  {
    files: ['functions/_domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [...layerBan('_domain', ['_cities', '_mcp']), ...domainIoBan(['ApiClient', 'GolemioClient', 'CacheManager', 'LruCache'])] }] },
  },
  {
    // Bearing history across feed snapshots is state the mapping keeps, not an upstream cache.
    files: ['functions/_domain/duk/vehicles/DukVehicleSource.ts', 'functions/_domain/dpmp/vehicles/DpmpVehicleSource.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [...layerBan('_domain', ['_cities', '_mcp']), ...domainIoBan(['ApiClient', 'GolemioClient', 'CacheManager'])] }] },
  },
])

function domainIoBan(modules) {
  return modules.map((name) => ({
    group: [`**/${name}`],
    message: `_domain never fetches or caches upstream data; do it in _feeds and read the result (${name}).`,
  }))
}

function layerBan(layer, banned) {
  return banned.map((target) => ({
    group: [`**/${target}`, `**/${target}/**`],
    message: `${layer} may not depend on ${target}; dependencies flow _core -> _feeds -> _domain -> _cities.`,
  }))
}
