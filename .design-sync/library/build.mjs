#!/usr/bin/env node
/**
 * Builds the design-sync component library into scratch/ds-lib: a package the
 * design-sync converter treats as a published DS (index.ts entry, emitted .d.ts
 * tree, compiled Tailwind stylesheet + fonts). Run from the repo root.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LIB = join(ROOT, '.design-sync/library');
const OUT = join(ROOT, 'scratch/ds-lib');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
writeFileSync(join(OUT, 'package.json'), JSON.stringify({
  name: 'departs-ui',
  version: rootPkg.version,
  private: true,
  type: 'module',
  module: 'index.ts',
  types: 'types/index.d.ts',
}, null, 2) + '\n');

const barrel = readFileSync(join(LIB, 'index.ts'), 'utf8');
writeFileSync(join(OUT, 'index.ts'), barrel);

const sources = [...barrel.matchAll(/from '@\/([^']+)'/g)].map((m) => `../../src/${m[1]}.tsx`)
  .map((p) => (statSync(join(OUT, p), { throwIfNoEntry: false }) ? p : p.replace(/\.tsx$/, '.ts')));
writeFileSync(join(OUT, 'tsconfig.json'), JSON.stringify({
  extends: '../../tsconfig.app.json',
  compilerOptions: {
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    rootDir: '../../src',
    outDir: './types/src',
    tsBuildInfoFile: null,
    noUnusedLocals: false,
    noUnusedParameters: false,
  },
  files: sources,
  include: [],
}, null, 2) + '\n');

try {
  execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(OUT, 'tsconfig.json')], { stdio: 'inherit' });
} catch {
  console.error('tsc reported errors; declarations were still emitted');
}

const typesRoot = join(OUT, 'types');
const rewriteAliases = (file, text) => text.replace(/(from\s+|import\()(['"])@\/([^'"]+)\2/g, (_, pre, q, p) => {
  let rel = relative(dirname(file), join(typesRoot, 'src', p));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return `${pre}${q}${rel}${q}`;
});
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
for (const f of walk(join(typesRoot, 'src')).filter((f) => f.endsWith('.d.ts'))) {
  writeFileSync(f, rewriteAliases(f, readFileSync(f, 'utf8')));
}
const indexDts = join(typesRoot, 'index.d.ts');
writeFileSync(indexDts, rewriteAliases(indexDts, barrel));

const { build } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const { default: tailwindcss } = await import(join(ROOT, 'node_modules/@tailwindcss/vite/dist/index.mjs'));
await build({
  configFile: false,
  root: ROOT,
  base: './',
  logLevel: 'warn',
  plugins: [tailwindcss()],
  build: {
    outDir: join(OUT, 'dist'),
    emptyOutDir: true,
    copyPublicDir: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { ds: join(LIB, 'ds.css') },
      output: { assetFileNames: '[name][extname]' },
    },
  },
});
console.log(`built ${relative(ROOT, OUT)}: ${sources.length} sources, css ${(statSync(join(OUT, 'dist/ds.css')).size / 1024).toFixed(0)} KB`);
