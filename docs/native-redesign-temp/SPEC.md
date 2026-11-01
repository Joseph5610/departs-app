# Native-like redesign: implementation spec

Mockup (visual source of truth): https://claude.ai/artifact/BaaHonFE5bTuDfEX4Q6WfF
Local copy of the mockup source: `scratch/native-redesign/mockup/` (`Main`, `Board` and `mock.css` hold every value).
Apple references: HIG Materials, Sheets, Scroll views, Toolbars, Search fields, Color, Dark Mode, Typography; WWDC25 "Get to know the new design system".

## How to work

1. Read this file, then the mockup source of the component you touch, before writing code.
2. Copy values exactly. If a value cannot be applied, stop and report it; never substitute a nearby Tailwind step or an old token.
3. Do one phase per PR or commit. Do not start the next phase until the current one passes the checks below.
4. In conflicts: AGENTS.md wins on architecture, this spec on visuals, the mockup on anything the spec omits.
5. Report every deviation in the phase summary, with the reason.

## Scope

Keep: Geist, the CARTO basemap and map layers, line badge colours, mint as brand colour, the desktop panel behaviour, all data, routes, endpoints and logic.
The `NAŽIVO` pill changes only its material and text size. Pills on departure rows stay.
Desktop gets tokens and shared components only; the bottom toolbar, capsule peek and swipe visuals are mobile work.

## Tokens (`src/index.css`)

Radii, the only allowed values: `sheet` 38 (34 for the peek capsule), `surface` 22, `nested` 16, `badge` 6, and capsule = half the height.
`surface` is 38 − 16, so everything inside a sheet shares one corner: cards, groups, hero, alerts, menus, swipe blocks. Field, segmented control and primary button are capsules. Stacked full-width blocks must always show the same corner. Compact controls (32px chips, 28px pills) are capsules. A selected segment is 20, the track minus its 2px padding.
Rule: a nested corner radius equals parent radius minus padding, and margins must share the corner's centre.

| Token | Dark | Light |
| --- | --- | --- |
| label | `oklch(0.985 0 0)` | `oklch(0.22 0.01 260)` |
| label-2 | `oklch(0.75 0.01 260)` | `rgb(50 50 58 / .78)` |
| label-3 | `rgb(255 255 255 / .62)` | `rgb(50 50 58 / .72)` |
| fill | `rgb(255 255 255 / .1)` | `rgb(0 0 0 / .05)` |
| fill-2 | `rgb(255 255 255 / .17)` | `rgb(0 0 0 / .09)` |
| field | `rgb(255 255 255 / .15)` | `rgb(0 0 0 / .06)` |
| sep | `rgb(255 255 255 / .13)` | `rgb(0 0 0 / .09)` |
| mat (controls) | `oklch(0.27 0.014 255 / .62)` | `oklch(0.97 0.006 250 / .42)` |
| mat-thick (sheet) | `oklch(0.2 0.014 255 / .88)` | `oklch(0.97 0.006 250 / .66)` |
| mat-solid (full) | `oklch(0.18 0.014 255 / .94)` | `oklch(0.97 0.006 250 / .84)` |
| edge-top | `rgb(255 255 255 / .22)` | `rgb(255 255 255 / .8)` |
| edge-bottom | `rgb(255 255 255 / .05)` | `rgb(255 255 255 / .3)` |
| float shadow | `0 8px 28px rgb(0 0 0 / .38)` | `0 10px 34px rgb(0 0 0 / .16), 0 2px 6px rgb(0 0 0 / .08)` |

| tint-mint | `oklch(0.8 0.17 162)` | `oklch(0.52 0.12 162.48)` |
| tint-amber | `oklch(0.82 0.17 75)` | `oklch(0.55 0.13 60)` |
| tint-red | `oklch(0.7 0.2 25)` | `oklch(0.58 0.21 25.33)` |
| tint-sky | `oklch(0.685 0.169 237.32)` | `oklch(0.52 0.15 240)` |

Delay signal icon in dark: `oklch(0.74 0.17 22)`, as `tint-red` is too dark for a small icon. Light adds an outer hairline `0 0 0 .5px rgb(0 0 0 / .06)`.
Meaning: mint live data, red delay and incidents, amber closures and favourites, sky information. Row icons are monochrome; colour only for status.

Material: `backdrop-filter: blur(22px) saturate(140%)` on every surface in dark and `saturate(190%)` in light, one flat colour with no gradient, never a blue tint.
Edge: `inset 0 .5px 0 edge-top, inset 0 0 0 .5px edge-bottom`; at half and full, where the sheet runs off the screen sides, only the top line (`glassy-edge-top`). A surface floating free on all sides, such as the desktop panel, a centred modal or the search dropdown, keeps the full edge. No outlined rectangles, no border on cards or fields.
Text on mint: `oklch(0.22 0.04 165)` (6.74:1); white on mint is 2.54:1 and is forbidden.
Colour on glass is only for live state, delay, alerts and primary actions. Separators are 0.5px and inset to the text.
Keep the app's default text smoothing; do not add `antialiased` to text, it thins Geist.
Type comes only from the `type-*` utilities and follows production sizes, not the mockup's: title 20/700, section 17/700, headsign 15/600, row 14/500, group 13/600, meta 13/400, note 12/400, control 12/600, label 10/700 caps with .1em tracking, badge 10/700, micro 9/700. Only line badges and platform circles size their own codes.
Detents: the home sheet and every card share one half height, 56% (`SHEET.HALF`), and full; a modal sheet may use its own height and scrim .4.
A screen's rows reuse one row: favourites use the board row, with the same struck time, signal, amenities and `Moja cesta` chip.

## Apple HIG rules

These bind every screen, including ones not in the mockup. Source: HIG and WWDC25; no separate iOS 27 rule was found.

- Liquid Glass-style material is for controls and navigation only, and sparingly. Content stays on standard surfaces. Never glass on glass; elements on glass use fills and label colours.
- Larger surfaces are more opaque, controls stay thinner. A sheet gets denser at full height but stays glass (`mat-solid`, a deliberate choice over Apple's fully opaque sheet); the scrim behind it is .25.
- Colour on glass is reserved for status and primary actions. A primary action colours its background, not its symbol.
- Corners are concentric: fixed, capsule (half the height) or `parent radius − padding`. A nested container that looks pinched or flared is wrong.
- Phone controls near a screen edge are capsules with extra margin.
- Only one sheet at a time: My trip replaces the sheet's content at a 330px detent with a back button, it never stacks a second sheet. Swiping it away with unsaved changes asks first.
- Sheets have a grabber that drags and cycles detents on tap, support vertical swipe, and show one sheet at a time.
- Search sits at the bottom when there is room and becomes a field above the keyboard on tap.
- A scroll edge effect appears only behind floating controls, once per view, so Settings and other screens without a toolbar have none. It blurs and fades content; it never darkens or blocks it.
- Lists use the style that fits the data: grouped with headers and spacing for short groups, plain for the long departure list.
- In Dark Mode, foreground surfaces are brighter than what sits behind them.
- Contrast is at least 4.5:1; aim for 7:1 for custom colours in small text. Test with Increase Contrast and Reduce Transparency.
- Hit regions are at least 44×44. Text is 11pt or larger, 17pt is the iOS default. Avoid light font weights.
- Map attribution stays reachable: its button sits above the peek capsule, never under it.
- Over the map, custom controls need enough contrast: a thin stroke or light shadow.
- Toolbars use recognisable symbols without borders; share, close and back keep their standard meaning.
- Swipe reveals actions, the first action runs on a full swipe, symbols are filled and may be tinted.
- Keep few controls on screen and make secondary actions discoverable. Reachable actions belong in the lower half.

## Elements

Rows are 8/14px padded, minimum 44px, separators start at the text. Vertical rhythm: 20 between groups and sections, 8 from a header to its group. Icons: rows 20, fields 18, toolbar 21, chevrons 17.
Compare with the mockup board "Rádiusy, hrany, paleta, typografia, materiály".

- Primary button: capsule, 36px high, 20px side padding, 13/600, mint with the text colour above.
- Selected filter chip: solid mint with `on-mint` text, or solid in its delay colour. `Moja cesta` and tinted surfaces use `--selected`, solid `oklch(0.42 0.105 162)` in dark.
- Secondary capsule (`Otvoriť Mapy`): 32px high, radius 16, `field` fill, 13/600, no border.
- Switch: 46×26, thumb 22, no border.
- Segmented control: 36px, capsule, thumb sliding and draggable, `fill-2` track, 2px padding, items radius 20, 13/600, selected item solid mint with `on-mint` text. Inside a row: 28px.
- Menu: `mat`, edge and float shadow, radius 22, rows 40px high, 14px text, a deliberate step below the 44px target to keep the menu compact.
- Departure pill: 28px high, radius 14, `fill`, 13/600, tabular numbers.
- Cards: `fill`, radius 22, no border or shadow. A card is brighter than the sheet behind it.

## Phases

### 1. Tokens and primitives
Files: `src/index.css`, `src/lib/cn` (register new radius classes), `ui/card`, `ui/button`, `ui/switch`, `SegmentedControl`, `ui/dropdown-menu`.
`glassy` becomes the three materials. Remove nested card borders and raw `#161616`.

### 2. Mobile sheet and search (`MobileSheet`, `drawer`, `MobileSearch`, `constants.SHEET`)
Peek: 68px high, 12px from the screen sides, 12px from the bottom in a browser and 30px over the home indicator of an installed app, radius 34, field 44px radius 22, padding 12 on every side, grabber 36×4 centred in the top 12px. Result is a capsule inside a capsule.
Half and full: edge to edge, top radius 38, padding 16, grabber zone 16px.
Morph one sheet, never two components: animate only the glass layer through a `--sheet-morph` (0 to 1) written in `requestAnimationFrame`, outside React. Full uses `mat-solid`.
Typing stays in the overlay; an input inside the sheet flies away with the iOS keyboard.

### 3. Home (`HomeSections`, `NearbyStopRow`)
Favourites, Nearby and Network are grouped with `fill`, radius 22. Section titles 20/600; Favourites links through a chevron next to the title. Nearby icons neutral. Network icons monochrome, the alert icon red only while incidents exist.

### 4. Departure board (`DepartureBoardHeader`, `BoardRow`, `NextDepartureRow`, `DepartureChip`, `PanelActions`)
Rows are flat on the sheet, without the card. Header: platform circle 24px and title 20/700 on one line, close button 32px. `Otvoriť Mapy` is a 32px capsule, `Načas` next to it. Keep chips, signals, amenities and the struck scheduled time. Filter chips sit 6px apart.
Replace the row bell with a `Moja cesta` mint chip, shown only on a taken trip.
Bottom toolbar on mobile: glass capsule 136×48 with favourite, share, more: 40px circles inset 4px, 44px hit areas, 19px icons. While scrolling down at full height it collapses to a 48px `…` button at right 16; it expands on scroll up, at the top and when leaving full height, not at the end of the list, as Apple's minimize behaviour restores only on scrolling back. A run of 24px in one direction changes the state, after the first 24px of the list, so a flick's turnarounds never flip it. Menu keeps sort, board and feedback; share moves to the toolbar.
Scroll edge: content fades from 92px to 28px above the bottom, just around the toolbar, and the list keeps 104px of bottom padding so its end is never dimmed; no dark gradient and no solid backing.

### 5. Swipe (`useSwipeAction`, `BoardRow`)
Keep the gesture logic, `SWIPE_ACTION_PX` 72 and `SWIPE_MAX_PX` 96; keep writing to the DOM without re-rendering.
Action block: inset 8px top and bottom, radius 22, width `abs(offset) - 8`. Before arming: tint at 22% with a tinted filled icon. Armed: solid tint, icon scale 1.15. Left is amber star, right is mint route icon, each with a short 11/13/600 label from 56px of block width. Right swipe still opens the My trip sheet.

### 6. Accessibility
Visible controls may be smaller, the hit area is always at least 44×44, including filter chips and the ride chip. `NAŽIVO` stays as it is. Raise text to 11px only where it helps reading, not as a blanket rule; sizes tuned on a real phone stay, such as line badges and the map attribution.
Add `prefers-contrast: more` and reduced transparency variants (mockup rows "Vyšší kontrast"): no blur, `mat` `oklch(0.2 0 0)`, `mat-thick` and `mat-solid` `oklch(0.17 0 0)`, `label-2` .84, `label-3` .74, `fill` .13, `field` .2, `sep` .3, `edge-top` .5, `edge-bottom` .32, no scroll fade. Dark values as listed; light only gets opaque materials and no blur so far. Check Safari support before relying on either query.

### 7. Other screens
Reference: mockup board "Ďalšie obrazovky", file `MoreScreens.dc.html` with `screens.css`, today and proposal side by side. Dark only so far.
Content inside scroll views never shrinks; a group is never clipped by its own layout.
Caps is for labels and subheaders only, such as `SMER`, `DP PRAHA`, `OBEH 16` and section subheaders, 10/700, tracking .1em. Never on anything interactive or stateful: segments, chips, capsules, buttons, tabs. Those use normal case, 13/600. `NAŽIVO` is the one exception and stays as today.
Subheaders are the small caps level: 10/700, uppercase, tracking .1em, `label-2`, on Settings, Alerts, Trip, Search and filter groups. The 20/600 section title is for the home sheet only. Row text is short; explanations move to a footnote under the group.
- Favourites: stops become section headers (platform circle, 17/600 name, chevron, amber star), rows live in a group. `Usporiadať` is a 32px capsule next to close.
- Settings: reference `ScreenSettings.dc.html`, full length in `SettingsFull.dc.html`. Keep every control and description of today's screen: push toggle, theme, refresh, vehicle switch with type filter chips and delay filter chips, delay colours, stops with labels and stop type filter, network lines, alerts on map, points of sale, base map, language, AI integrations, clear history, feedback, install, update check with version, legal links, last stop update. Chips: 32px capsules, selected mint tint, delay chips with a coloured dot. Nested filters appear only while their switch is on.
- Alerts: search field first, the segmented control under it as its scope; both 44px, radius 22. Sentence-case headers with a count, grouped rows. The disruption push toggle stays in Settings and must remain reachable from here; decide its place before implementing.
- Trip: reference `ScreenTrip.dc.html`, full length in `TripFull.dc.html`. The vehicle hero stays one line-tinted card, with no border: direction, follow button, delay and data age capsules, notices, operator, vehicle, linked number, run, vehicle id, amenities. Alerts stay a separate titled section; never merge them into the vehicle card. `Idem týmto spojom` is the primary capsule without a subtitle, an active trip keeps today's My trip card. Past stops are a disclosure row at the top of the route, on the rail: `6 prejdených zastávok` with a chevron, 44px high, 13/500, expanding in place; no button in the section header. The route keeps zones, interchange badges, past stops and the next-stop marker. Connections stay a collapsible part of the stop, only where data exists: a card with an icon, `Prestupy` in caps, waiting lines and a chevron; expanded it keeps line, headsign, wait or risk note and time; share and more go to the bottom toolbar.
- My trip: replaces the sheet content at the half detent, whatever height the sheet stood at, back button, two capsule buttons in one row directly under the card; alert times are `FilterChip`s.
- Search: capsule field with a round close button instead of the text `Zrušiť`, recent items in a group.
- Desktop search dropdown: `glassy-thick`, radius 22, padding 6, rows radius 16 (22 − 6), 8/14 padded, minimum 44, bare 20px icons without a tile, amber only for favourites; group subheaders as above with the count in a pill next to the title.

## Decisions after implementation

Made with the owner during the screen review; they replace the original values above.

- Sizes follow production because the mockup's type felt too large. Tags stay readable through colour and weight, not size.
- Dark surfaces are cooler and darker and mint, red and amber brighter, as the original palette lacked contrast. This changes the brand mint.
- Selected is solid, never a grey or a thin tint.
- Colour beyond status is allowed on section heading icons, stats card icons, amenity icons and copy actions. Icons in plain rows stay monochrome.
- Inline text actions in mint are allowed, such as `Viac informácií`, `Všetko` and `Iná zastávka`.
- Hover has three shapes, all in `index.css`: `row-hover-group` edge to edge, clipped by the card; `row-hover-board` over the text column, leaving the badge out; `row-hover-nested` for rows under a lead row. Search rows use plain `row-hover`.
- The stop timeline follows the line colour: rail and ring in the line's colour, white dots, grey past section. Past stops are a row on the rail, the terminus has a ring.
- The vehicle hero keeps production's gradient, its lighter lower section with a full-width divider, a tile for amenities in colour and a mono vehicle id, 9px caps with wide tracking.
- Status pills in the hero stay as in production: 24px, 9px caps.
- Alerts keep `Virtuoso`; the section heading is pinned over a masked list with no backing colour, since none matches the glass.

## Shared components

Corners and glass are enforced by ESLint in `src/components`, `pages/board` and `pages/legal`: only `rounded-full`, `rounded-surface`, `rounded-nested` (16), `rounded-badge` and `rounded-sheet`, no `backdrop-blur`, no custom row hover fills and no `--row-hover-*` outside `index.css`. Switches between options are `SegmentedControl`, filters and single choices `FilterChip`, grouped rows `Item variant="row"`, section titles `SectionTitle`, small caps headings `SectionHeading`, read-only facts `Badge variant="info"`, counts `Badge variant="count"`, stats cards `StatsCard`, hero notes `HeroNotice`, search rows `SearchRowBody`, empty and error tiles `EmptyMedia variant="tile"`.

Control heights are the `control-sm/md/lg` spacing tokens: 28, 32 and 36. Line badges are `row` (18) and `lg` (24), plus `xl` on the full-screen board.

## Definition of done per phase

- `node scratch/native-redesign/complianceMockup.mjs` must print no radius outside the tokens, no text below 11px and no hit area below 44×44.
- `node scratch/native-redesign/auditMockup.mjs` shows the mockup's computed values per element; compare the app against it.
- `npm run build`, `npx tsc -p functions`, `npm run lint`, `npm run test:unit` pass. No `eslint-disable`, no raw colours or pixel font sizes.
- Playwright screenshots at 390×844, dark and light, sit next to the matching mockup board in the summary. `node scratch/native-redesign/renderMockup.mjs Board.dc.html:390:844` renders a board.
- E2E specs assert computed values for what changed (radius, height, padding, opacity), not only that elements exist. Update `tests/e2e/home-sheet.spec.ts`.
- New i18n keys in `cs`, `sk`, `en`. Single version bump and changelog entry per AGENTS.md.
- Phases 2, 4 and 5 are also checked on an iPhone as an installed PWA, including blur performance while dragging. An agent cannot do this; list it for the owner, do not claim it.
