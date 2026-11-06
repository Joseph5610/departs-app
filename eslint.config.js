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

const tokenRuleExempt = ['src/components/ui/**', 'src/components/PlatformCircle.tsx', 'src/components/LineBadge.tsx', 'src/components/Map/LiveStatus.tsx'];
const tokenRules = ['Literal[value', 'TemplateElement[value.raw'].flatMap(node => [
  { selector: `${node}=/\\brounded(-[tblr]{1,2})?-(xs|sm|md|lg|xl|2xl|3xl|4xl|\\[)(?!inherit)/]`, message: 'Use rounded-full, rounded-surface, rounded-nested, rounded-badge or rounded-sheet.' },
  { selector: `${node}=/\\bbackdrop-(blur|saturate)/]`, message: 'Glass comes from the glassy utilities.' },
  { selector: `${node}=/\\b(hover|active|focus-visible|data-highlighted):(before:)?bg-(fill|muted|foreground)/]`, message: 'A row takes its hover from Item or row-hover; a control from its Button variant.' },
  { selector: `${node}=/--row-hover-(x|y|left|radius)/]`, message: 'A row hover shape is a row-hover-* utility in index.css.' },
  { selector: `${node}=/(^|\\s)(text-(xs|sm|base|lg|xl|2xl|3xl|title|heading|body-sm|caption|label|badge|micro|nano)|micro-label\\S*)(\\s|$)/]`, message: 'Text uses the type-* styles.' },
]);
// The primitives that own a <button>; everything else is a Button, a Pressable or an element passed to `render`.
const buttonRuleExempt = ['src/components/Pressable.tsx', 'src/components/FilterChip.tsx', 'src/components/SegmentedControl.tsx'];
const rawButtonRule = {
  selector: "JSXOpeningElement[name.name='button']:not(JSXAttribute[name.name='render'] > JSXExpressionContainer > JSXElement > JSXOpeningElement)",
  message: 'A styled control is a Button; a badge, row or card that is tapped is a Pressable.',
};

export default defineConfig([
  globalIgnores(['dist', 'scratch', 'ds-bundle', '.ds-sync', 'docs/.vitepress/cache', 'docs/.vitepress/dist']),

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

  // Corners and glass come from the design tokens, so no component can drift from the others.
  {
    files: ['src/components/**/*.tsx'],
    ignores: [...tokenRuleExempt, ...buttonRuleExempt],
    rules: { 'no-restricted-syntax': ['error', ...tokenRules, rawButtonRule] },
  },
  {
    files: buttonRuleExempt,
    ignores: tokenRuleExempt,
    rules: { 'no-restricted-syntax': ['error', ...tokenRules] },
  },
  {
    files: tokenRuleExempt.filter(f => !f.startsWith('src/components/ui/')),
    rules: { 'no-restricted-syntax': ['error', rawButtonRule] },
  },

  // Rules shared by the app and the backend: plain TypeScript that imports nothing, so both builds compile it.
  {
    files: ['shared/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': noUnusedVars,
      'no-restricted-imports': ['error', { patterns: [{ regex: String.raw`^(?!vitest$|\./)`, message: 'shared/ imports only its own files, so both builds can compile it.' }] }],
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
