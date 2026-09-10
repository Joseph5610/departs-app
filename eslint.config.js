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
  globalIgnores(['dist', 'scratch']),

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
])
