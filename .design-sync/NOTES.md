# design-sync notes (departs.app)

- This repo is an app, not a published DS package. `node .design-sync/library/build.mjs` (cfg.buildCmd) builds a synthetic `departs-ui` package into `scratch/ds-lib/`: `index.ts` barrel (copied from `.design-sync/library/index.ts`), `types/` from `tsc --emitDeclarationOnly` with `@/` aliases rewritten to relative paths, and `dist/ds.css` + fonts from a Vite + `@tailwindcss/vite` build of `.design-sync/library/ds.css`. Always run it before the converter.
- `ds.css` imports `src/index.css`, scans `src/` and `.design-sync/previews/`, and adds an `@source inline()` safelist so designs get a layout and token vocabulary. Compiled CSS contains only scanned classes. After adding classes in a preview, rerun buildCmd so the CSS picks them up.
- `ds.css` overrides the app-shell rules in index.css (`html/body/#root` fixed to 100vw/100dvh, overflow hidden, and an `html` background). Without that, cards are clipped and a grey band shows under white cards.
- Vite `base: './'` in build.mjs is required; otherwise font URLs are absolute (`/geist-…woff2`) and fonts dangle.
- Subparts (`CardHeader`, `DialogContent`, …) are excluded from cards via `componentSrcMap: null`. They ship in the bundle and are documented through the parent's preview examples and conventions.md. shadcn exports are flat, so the converter's compound detection doesn't apply.
- Groups come from `.design-sync/groups/*.md` category stubs via `docsMap`.
- `lucide-react` is merged via `extraEntries`. `[EXPORT_COLLISION]` for Badge, Command, Form and Sheet is expected; the DS components win, so use the `…Icon` names.
- `useForm` (react-hook-form), `toast` (sonner) and `cn` are exported from the barrel so designs can drive Form and Toaster.
- Previews: keep sample data inside each export so `.prompt.md` examples are self-contained. Size wrappers with `w-full max-w-*`, never fixed widths over ~300px, or the grid overflows.
- `.design-sync/tsconfig.json` maps `departs-ui` to `library/index.ts` so VS Code and `tsc -p .design-sync` can type-check previews. esbuild also reads it when compiling previews (it adds `"use strict"`), so editing it changes every preview's bytes.
- Base UI triggers use `render={<Button/>}`, not `asChild`. `DropdownMenuLabel` outside a `DropdownMenuGroup` renders nothing.
- App fixes made during the first sync (2026-09-13): Fira Code added via `@fontsource-variable/fira-code`; `data-horizontal`/`data-vertical` custom variants mapped to `data-orientation` in index.css (Separator and ToggleGroup were invisible or unstyled).
- Also fixed on 2026-09-13: IconToggle active tint now keys off `aria-pressed` (Base UI sets no `data-state`); Input got the same `aria-invalid` red border and ring as Textarea.

## Known render warns

- `[RENDER_THIN]` on Dialog, Sheet, Toaster: the content portals out of the root, and the screenshots were confirmed to render correctly.

## Re-sync risks

- `scratch/ds-lib` is gitignored build output. On a fresh clone, run `npm ci`, then buildCmd, then the driver.
- Sample route colours in previews and conventions.md are hardcoded PID values; real colours come from backend GTFS data.
- The safelist in ds.css is hand-curated. If designs need a utility family that's missing, extend it there, and keep conventions.md's vocabulary table in sync.
- `_ds_bundle.js` is ~2.4 MB, mostly lucide-react. Drop it from `extraEntries` if the size becomes a problem.
- Previews reflect the working tree at sync time, including uncommitted `src/` edits.
