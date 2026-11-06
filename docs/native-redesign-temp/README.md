# Native redesign: temporary working notes

Delete this folder before merging `feat/native-redesign` to `master`.

## Why

Redesign to a native iOS feel, keeping Geist, the CARTO map, the mint brand and the app's character. The first pass only recoloured existing components, so rows, hovers, headings and pills kept their own classes and drifted apart. This pass moved them onto shared definitions and went through every screen with the owner.

## What changed

- **Type:** one scale of `type-*` roles in `src/index.css`, based on production sizes, not the larger mockup sizes.
- **Shared components:** `Item variant="row"`, `SectionTitle`, `SectionHeading` (with `lead` and `count`), `FilterChip`, `CopyButton`, `HeroNotice`, `StatsCard`, `SearchRowBody`, `Badge` variants `info` and `count`, `Button` variants `selected` and `quiet`, sizes `inline` and `icon-2xs`.
- **Hover:** `row-hover-group`, `row-hover-board`, `row-hover-nested`, defined once in `index.css`. Lint bans hover fills and shape variables elsewhere.
- **Colour, dark:** cooler and darker surfaces, brighter mint, red and amber, solid `--selected`, solid mint segment thumb, stronger `fill`, `field` and `sep`, `label-2` equal to production's muted text.
- **Colour, light:** thinner glass with more saturation.
- **Trip detail:** rail and marker in the line colour, grey past section, past stops as a row on the rail, transfers in a card, production hero gradient, restored amenity tile.
- **Alerts:** `Virtuoso` stays. The pinned heading sits over a masked list, and `ListTail` lets a short last section reach the top.
- **My trip on phones:** opens exactly at half height, alert times use `FilterChip`.
- **Search:** mobile and desktop share `SearchRowBody`, and history reads line colours from each entry's own city.

## Deviations from the original spec

Recorded in `SPEC.md`: updated values in place, reasons under "Decisions after implementation".

## To do

- Update the mockup to the decisions in `SPEC.md`.
- Light mode, open with the owner (audit contact sheets of every screen, mobile and desktop):
  - Selected segment is mint in dark but white in light (stats scope, favourites, settings theme, feedback type); decide one.
  - Off switches nearly vanish on light glass (disruption push in Settings and Alerts).
  - Thin light glass shows the map as pastel blotches behind empty parts of a sheet (favourites, search, My trip on desktop).
  - The disabled primary button (feedback `Odoslať`) reads as washed out mint in light.
- Check on an iPhone as an installed PWA: home, board, swipe, sheet controls while dragging, blur performance.
- Review the undone screens with the owner: stats, vehicle list, ride bar, feedback, MCP.
- Check the delay chips and long validity pills on narrow phones.

Done: raw `<button>`s are `Pressable` (a tap target without a look) or `Button`, enforced by lint; headings among the direct `type-label` uses are `SectionHeading`, the rest are labels, kickers and meta.

## Files here

- `SPEC.md`, `mockup/`, `assets/`: approved spec and mockup source.
- `scripts/`: Playwright helpers. Copy them to `scratch/native-redesign/` to run them, with the dev server on 8788.
  - `audit.mjs`: measures text, radii and tap heights on all screens, mobile and desktop.
  - `auditBrno.mjs`: the same on Brno, which needs no Golemio key; `SCHEME=light` or `dark`, output in `scratch/audit-<scheme>/`.
  - `pairs.mjs <dir>`: contact sheets with dark and light side by side, per screen.
  - `canon.mjs`: lists non-canonical Tailwind classes; `fix` rewrites them.
  - `undef.mjs`: lists classes Tailwind cannot resolve.
  - `fontcmp.mjs`, `hero.mjs`: compare the local app with production.
  - `sheet.mjs`: joins audit screenshots into contact sheets.
