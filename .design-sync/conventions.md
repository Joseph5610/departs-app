# departs.app UI conventions

Real-time transit app (Prague PID, Brno IDS JMK). shadcn/ui components on Base UI, styled with precompiled Tailwind v4 utilities and oklch CSS tokens. Brand accent is emerald `primary`; surfaces are near-white cards on a light-grey page.

## Setup

- No provider needed. Load `styles.css`; it carries the tokens, the Geist / Fira Code fonts and every utility class listed below. Page background comes from `body` (`bg-background`).
- Dark mode: put `class="dark"` on `<html>` (or any ancestor). Tokens swap automatically, so never use `dark:` colour overrides for token colours.
- Toasts: render `<Toaster />` once, then call `toast('…')`, `toast.success('…')`, `toast.error('…')`. Both are exported.
- Forms: `const form = useForm({ defaultValues })` (exported), then `<Form {...form}>` with `FormField` > `FormItem` > `FormLabel` + `FormControl` + `FormMessage`.
- Tooltips work standalone; wrap many in one `TooltipProvider` for shared delay.
- `cn(...)` (clsx + tailwind-merge) is exported for merging class names.

## Composition rules

- Parts are flat named exports: `CardHeader`, not `Card.Header`.
- Triggers take Base UI's `render` prop, not `asChild`: `<TooltipTrigger render={<Button variant="ghost" size="icon-xs" />} />`. The same goes for `DialogTrigger`, `PopoverTrigger`, `DropdownMenuTrigger` and `CollapsibleTrigger`.
- Anatomy:
  - Card: `Card(variant default|subtle, size default|sm|none)` > `CardHeader`(`CardTitle`, `CardDescription`, `CardAction`) + `CardContent` + `CardFooter`
  - Item: `Item(variant default|outline|muted|settings)` > `ItemMedia(variant="icon")` + `ItemContent`(`ItemTitle`, `ItemDescription`) + `ItemActions`. For settings lists, put `variant="settings"` rows inside `<Card variant="subtle" size="none">`.
  - Dialog: `DialogContent` is full-height with zero padding by default (settings-style: header `px-6 pt-6 pb-2`, then `ScrollArea className="flex-1 min-h-0 px-6"`). For a compact confirm dialog, pass `className="h-auto max-w-105 p-6 gap-6!"`.
  - Sheet (`side`, `variant default|glassy`) and Drawer (mobile bottom sheet) use `*Header`/`*Title`/`*Description`/`*Footer`.
  - Tabs: `TabsList(variant default|pill|line)` > `TabsTrigger`; `TabsContent`.
  - Alert: icon + `AlertTitle` + `AlertDescription` (+ `AlertAction`); `variant default|subtle|warning|destructive`.
  - Empty states always use `Empty` > `EmptyHeader`(`EmptyMedia variant="icon"`, `EmptyTitle`, `EmptyDescription`) + `EmptyContent`. Never build a dashed placeholder box.
- Button `variant`: default|secondary|outline|ghost|tinted|destructive|link. `size`: sm|default|lg|xl|icon|icon-sm|icon-xs (icon sizes are round).
- Transit lines are always `<LineBadge name="22" routeColor="#7A0603" size="sm|md|lg|xl" />`, with routeColor taken from GTFS data. Sample colours: metro A `#00A562`, B `#F8B322`, C `#CF003D`; tram `#7A0603`; bus `#007DA8`; night `#000000`.
- Icons: lucide icons live on the same global. Use the `…Icon` names (`BusIcon`, `TramFrontIcon`, `TrainFrontIcon`, `TrainIcon`, `ShipIcon`, `CableCarIcon`, `MapPinIcon`, `StarIcon`), because `Badge`, `Command`, `Form` and `Sheet` resolve to components.

## Styling vocabulary (only these compile)

Utilities are precompiled, so a class not listed here or used by the app will not exist. Colours are token names, never palette hexes:

| Family | Classes |
|---|---|
| Surface / text | `bg-background` `bg-card` `bg-popover` `bg-muted` `bg-secondary` `bg-accent` · `text-foreground` `text-muted-foreground` `text-card-foreground` |
| Brand / status | `bg-primary` `text-primary` `text-primary-foreground` `bg-destructive` `text-destructive`; opacity steps `/10 /20 /30 /50 /80` (e.g. `bg-primary/10 border-primary/20`) |
| Borders | `border` `border-border` `border-border/50` `border-input` · `rounded-md` `rounded-xl` `rounded-2xl` (cards, rows) `rounded-full` |
| Depth | `shadow-2xs`…`shadow-2xl` · `glassy` (frosted floating panel) |
| Type | `text-xs`…`text-2xl` · `font-medium` `font-semibold` `font-bold` · `font-mono` · `tabular-nums` for times · `micro-label` (10px bold uppercase) |
| Layout | `flex` `grid` `grid-cols-2..6` `gap-*` `p-*` `px-*` `py-*` with the 0.5–24 scale · `w-full` `max-w-xs..7xl` `min-w-0` `truncate` · `safe-top` `safe-bottom` (safe-area padding) |

Section-label idiom: `text-[10px] font-bold uppercase tracking-widest text-muted-foreground`. Departure-row idiom: `flex items-center gap-3 rounded-2xl bg-card border border-border/50 px-3 py-2.5`.

## Where the truth lives

`styles.css` → `_ds_bundle.css` (all tokens in `:root` / `.dark`, every compiled class) and `fonts/fonts.css`. Each component's `<Name>.prompt.md` holds verified examples, and `<Name>.d.ts` holds its props.

## Example

```jsx
const { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, Button, LineBadge, StarIcon } = window.DepartsUI;

<Card variant="subtle" size="none" className="w-full max-w-sm">
  <CardHeader className="p-3.5 pb-2">
    <CardTitle className="text-sm">Náměstí Míru</CardTitle>
    <CardDescription>Metro A, trams 4, 10, 22</CardDescription>
    <CardAction>
      <Button variant="ghost" size="icon-xs" aria-label="Favorite"><StarIcon /></Button>
    </CardAction>
  </CardHeader>
  <CardContent className="p-3.5 pt-0 flex flex-col gap-2">
    <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/50 px-3 py-2.5">
      <LineBadge name="A" routeColor="#00A562" size="lg" />
      <span className="flex-1 text-sm font-semibold truncate">Depo Hostivař</span>
      <span className="text-sm font-bold tabular-nums text-primary">2 min</span>
    </div>
  </CardContent>
</Card>
```
