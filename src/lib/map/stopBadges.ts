import type { Map } from 'maplibre-gl';
import type { RouteType } from '@/types';
import { MAP_ICONS, STOP_BADGE } from '@/config/mapLayers';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { STOP_BADGE_SEPARATOR, TILE_PART_SEPARATOR } from '@/domain/stops';
import { getContrastColor } from '@/lib/color';
import { TROLLEYBUS_ICON_NODE } from '@/lib/trolleybusGlyph';
import { glyphOf, strokeGlyph, type GlyphNode } from './canvasGlyph';

/** Lucide glyphs (24-unit viewBox, 2-unit stroke), drawn on the canvas since map images cannot be SVG. */
const BUS: GlyphNode[] = [
    ['path', 'M8 6v6'], ['path', 'M15 6v6'], ['path', 'M2 12h19.6'],
    ['path', 'M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3'],
    ['circle', 7, 18, 2], ['path', 'M9 18h5'], ['circle', 16, 18, 2],
];
const TRAM_FRONT: GlyphNode[] = [
    ['rect', 4, 3, 16, 16, 2], ['path', 'M4 11h16'], ['path', 'M12 3v8'],
    ['path', 'm8 19-2 3'], ['path', 'm18 22-2-3'], ['path', 'M8 15h.01'], ['path', 'M16 15h.01'],
];
const TRAIN_FRONT: GlyphNode[] = [
    ['path', 'M8 3.1V7a4 4 0 0 0 8 0V3.1'], ['path', 'm9 15-1-1'], ['path', 'm15 15 1-1'],
    ['path', 'M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z'], ['path', 'm8 19-2 3'], ['path', 'm16 19 2 3'],
];
const SHIP: GlyphNode[] = [
    ['path', 'M12 10.189V14'], ['path', 'M12 2v3'], ['path', 'M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6'],
    ['path', 'M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76'],
    ['path', 'M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'],
];
const CABLE_CAR: GlyphNode[] = [
    ['path', 'M10 3h.01'], ['path', 'M14 2h.01'], ['path', 'm2 9 20-5'], ['path', 'M12 12V6.5'],
    ['rect', 4, 12, 16, 10, 3], ['path', 'M9 12v5'], ['path', 'M15 12v5'], ['path', 'M4 17h16'],
];

const TROLLEYBUS = glyphOf(TROLLEYBUS_ICON_NODE);

/** Metro is lettered with its line rather than drawn, as on the network's own signs. */
const GLYPHS: Record<Exclude<RouteType, 'metro' | 'unknown'>, GlyphNode[]> = {
    train: TRAIN_FRONT,
    tram: TRAM_FRONT,
    trolleybus: TROLLEYBUS,
    bus: BUS,
    ferry: SHIP,
    funicular: CABLE_CAR,
};

const drawGlyph = (ctx: CanvasRenderingContext2D, nodes: GlyphNode[], x: number, size: number, color: string) => {
    const glyphPx = size * STOP_BADGE.GLYPH_SCALE;
    strokeGlyph(ctx, nodes, x + (size - glyphPx) / 2, (size - glyphPx) / 2, glyphPx, color, STOP_BADGE.GLYPH_STROKE);
};

/** Each mode's tile colour in `city`: the city's own where it sets one, else the app's. */
export const modeColorsOf = (city: string): Record<RouteType, string> =>
    ({ ...STOP_BADGE.MODE_COLORS, ...FRONTEND_CITIES_CONFIG[city]?.modeColors });

/** `letter` centred on its ink, not its line box, in a `size` square at (`x`, `y`); longer codes set smaller. */
const drawLetter = (ctx: CanvasRenderingContext2D, letter: string, x: number, size: number, color: string, y = 0, inset = 1) => {
    const scale = STOP_BADGE.LETTER_SCALES[Math.min(letter.length, STOP_BADGE.LETTER_SCALES.length) - 1]! * inset;
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.round(size * scale)}px ${STOP_BADGE.FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const ink = ctx.measureText(letter);
    ctx.fillText(
        letter,
        x + size / 2 + (ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / 2,
        y + size / 2 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2,
    );
};

/** One tile: `tram`, `bus`..., or a metro line `metro/B/F8B322` lettered in its own colour. */
const drawTile = (ctx: CanvasRenderingContext2D, tile: string, colors: Record<RouteType, string>, x: number, size: number) => {
    const [token, metroLine, metroColor] = tile.split(TILE_PART_SEPARATOR);
    const mode = (token in colors ? token : 'unknown') as RouteType;
    const fill = mode === 'metro' && metroColor ? `#${metroColor}` : colors[mode];
    const ink = getContrastColor(fill);
    ctx.fillStyle = fill;
    ctx.fillRect(x, 0, size, size);
    if (mode === 'metro') drawLetter(ctx, metroLine ?? 'M', x, size, ink);
    else if (mode !== 'unknown') drawGlyph(ctx, GLYPHS[mode], x, size, ink);
};

/** A platform's code in a white circle, as station boards head each platform's section. */
const drawPlatformCircle = (ctx: CanvasRenderingContext2D, code: string, x: number, y: number, size: number) => {
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(x + r, y + r, r - STOP_BADGE.PIXEL_RATIO / 2, 0, Math.PI * 2);
    ctx.fillStyle = STOP_BADGE.CODE_FILL;
    ctx.fill();
    ctx.lineWidth = STOP_BADGE.PIXEL_RATIO;
    ctx.strokeStyle = STOP_BADGE.CODE_INK;
    ctx.stroke();
    drawLetter(ctx, code, x, size, STOP_BADGE.CODE_INK, y, STOP_BADGE.CIRCLE_LETTER_INSET);
};

/** A favourite's five-pointed star centred on (`cx`, `cy`), outlined so it reads on any tile and on the map. */
const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * STOP_BADGE.STAR_INNER_SCALE;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * STOP_BADGE.STAR_STROKE_SCALE;
    ctx.strokeStyle = STOP_BADGE.STAR_OUTLINE;
    ctx.stroke();
    ctx.fillStyle = STOP_BADGE.STAR_COLOR;
    ctx.fill();
};

let sharedContext: CanvasRenderingContext2D | null | undefined;
/** One canvas for every badge, read back after each draw. */
const badgeContext = () => (sharedContext === undefined
    ? sharedContext = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    : sharedContext);

/**
 * The image for the id's `<city>:<star>:<platform code>:<badges>` part: one pill of joined mode tiles (one grey tile for a stop
 * with no lines), a platform's code in a circle beside it. A starred one gets a margin on every side, so its
 * centre, and so its place on the map, stays put.
 */
const drawStopBadge = (key: string): ImageData | null => {
    const [city, star, code, badges] = key.split(':');
    const colors = modeColorsOf(city);
    const tiles = badges ? badges.split(STOP_BADGE_SEPARATOR) : ['unknown'];
    const size = STOP_BADGE.TILE_PX * STOP_BADGE.PIXEL_RATIO;
    const divider = STOP_BADGE.DIVIDER_PX * STOP_BADGE.PIXEL_RATIO;
    const margin = star ? Math.round(size * STOP_BADGE.STAR_MARGIN_SCALE) : 0;
    const width = tiles.length * size;
    const codeGap = code ? Math.round(size * STOP_BADGE.CODE_GAP_SCALE) : 0;
    const ctx = badgeContext();
    if (!ctx) return null;
    const { canvas } = ctx;
    // Resizing clears the canvas and resets its state, so each badge starts blank.
    canvas.width = width + (code ? codeGap + size : 0) + 2 * margin;
    canvas.height = size + 2 * margin;
    ctx.save();
    ctx.translate(margin, margin);
    ctx.beginPath();
    ctx.roundRect(0, 0, width, size, size * STOP_BADGE.RADIUS_SCALE);
    ctx.clip();
    tiles.forEach((tile, i) => drawTile(ctx, tile, colors, i * size, size));
    ctx.fillStyle = STOP_BADGE.DIVIDER_COLOR;
    for (let i = 1; i < tiles.length; i++) ctx.fillRect(i * size - divider / 2, 0, divider, size);
    ctx.restore();
    if (code) drawPlatformCircle(ctx, code, margin + width + codeGap, margin, size);
    if (star) drawStar(ctx, margin + width + (code ? codeGap + size : 0), margin, size * STOP_BADGE.STAR_RADIUS_SCALE);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Draws stop badge images the first time a layer asks for one, since the mode combinations are only known from
 * the data. Badges drawn before the badge face has loaded fall back to another font, so they are redrawn once it has.
 */
export const provideStopBadges = (map: Map) => {
    const font = `700 16px ${STOP_BADGE.FONT}`;
    let fontReady = document.fonts?.check(font) ?? true;
    const drawnEarly = new Set<string>();
    const draw = (id: string) => drawStopBadge(id.slice(MAP_ICONS.STOP_BADGE_PREFIX.length));

    map.setMissingStyleImageResolver((id) => {
        if (!id.startsWith(MAP_ICONS.STOP_BADGE_PREFIX) || map.hasImage(id)) return;
        const image = draw(id);
        if (!image) return;
        map.addImage(id, image, { pixelRatio: STOP_BADGE.PIXEL_RATIO });
        if (!fontReady) drawnEarly.add(id);
    });

    if (fontReady) return;
    void document.fonts.load(font).then(() => {
        fontReady = true;
        for (const id of drawnEarly) {
            const image = draw(id);
            // A badge's size comes from its tiles, never its text, so the redrawn image fits the slot in place.
            if (image && map.hasImage(id)) map.updateImage(id, image);
        }
        drawnEarly.clear();
    });
};
