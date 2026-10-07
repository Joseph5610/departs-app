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

const parentImportBan = { regex: String.raw`^\.\./(?!.*package\.json$)`, message: 'Import across folders with the `@/` alias; `./` is for files in the same folder (package.json, outside src, excepted).' }

const typesDeepImportBan = { group: ['@/types/*'], message: 'Import types from `@/types`, not its files.' }

const domainDeepImportBan = { group: ['@/domain/*/*', '!@/domain/*/index'], message: 'Import a domain area through its index (`@/domain/vehicles`), not its files.' }

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
      '@typescript-eslint/no-extraneous-class': 'error',
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
      '@typescript-eslint/no-extraneous-class': 'error',
    },
  },

  // Frontend imports: `@/` across folders, `./` within one. domain/ is pure and reached through its area's index.ts;
  // hooks flow data -> derived -> features.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/domain/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [parentImportBan, typesDeepImportBan, domainDeepImportBan] }] },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: 'react', message: 'domain is plain TypeScript; React belongs in hooks and components.' }], patterns: [parentImportBan, typesDeepImportBan, ...frontendLayerBan('domain', ['hooks', 'state', 'components', 'pages'])] }] },
  },
  {
    files: ['src/hooks/data/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [parentImportBan, typesDeepImportBan, domainDeepImportBan, ...frontendLayerBan('hooks/data', ['hooks/derived', 'hooks/features'])] }] },
  },
  {
    files: ['src/hooks/derived/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [parentImportBan, typesDeepImportBan, domainDeepImportBan, ...frontendLayerBan('hooks/derived', ['hooks/features'])] }] },
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
    rules: { 'no-restricted-imports': ['error', { patterns: [...layerBan('_domain', ['_cities', '_mcp']), ...domainIoBan(['ApiClient', 'GolemioClient', 'cacheManager', 'LruCache'])] }] },
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

function frontendLayerBan(layer, banned) {
  return banned.map((target) => ({
    group: [`@/${target}`, `@/${target}/**`],
    message: `${layer} may not depend on ${target}; domain stays pure and hooks flow data -> derived -> features.`,
  }))
}
