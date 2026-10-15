import type { Map } from 'maplibre-gl';
import type { RouteType } from '@/types';
import { MAP_ICONS, STOP_BADGE } from '@/config/mapLayers';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { METRO_TILE_SEPARATOR, STOP_BADGE_SEPARATOR } from '@/domain/stops';
import { getContrastColor } from '@/lib/color';

type GlyphNode =
    | ['path', string]
    | ['circle', number, number, number]
    | ['rect', number, number, number, number, number];

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

/** The trolleybus is the bus lowered under its two trolley poles, so it never reads as a bus. */
const TROLLEY_POLES: GlyphNode[] = [['path', 'M11 8 7 2'], ['path', 'M16 8 12 2']];
const TROLLEYBUS_BUS_DROP = 2;

/** Metro is lettered with its line rather than drawn, as on the network's own signs. */
const GLYPHS: Record<Exclude<RouteType, 'metro' | 'unknown'>, GlyphNode[]> = {
    train: TRAIN_FRONT,
    tram: TRAM_FRONT,
    trolleybus: BUS,
    bus: BUS,
    ferry: SHIP,
    funicular: CABLE_CAR,
};

const drawGlyph = (ctx: CanvasRenderingContext2D, nodes: GlyphNode[], x: number, size: number, color: string, dy = 0) => {
    const glyphPx = size * STOP_BADGE.GLYPH_SCALE;
    const scale = glyphPx / 24;
    ctx.save();
    ctx.translate(x + (size - glyphPx) / 2, (size - glyphPx) / 2);
    ctx.scale(scale, scale);
    ctx.translate(0, dy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const node of nodes) {
        if (node[0] === 'path') {
            ctx.stroke(new Path2D(node[1]));
            continue;
        }
        ctx.beginPath();
        if (node[0] === 'circle') ctx.arc(node[1], node[2], node[3], 0, Math.PI * 2);
        else ctx.roundRect(node[1], node[2], node[3], node[4], node[5]);
        ctx.stroke();
    }
    ctx.restore();
};

/** Each mode's tile colour in `city`: the city's own where it sets one, else the app's. */
export const modeColorsOf = (city: string): Record<RouteType, string> =>
    ({ ...STOP_BADGE.MODE_COLORS, ...FRONTEND_CITIES_CONFIG[city]?.modeColors });

const drawLetter = (ctx: CanvasRenderingContext2D, letter: string, x: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.round(size * (letter.length > 1 ? 0.48 : 0.62))}px Montserrat, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x + size / 2, size / 2 + size * 0.04);
};

/** One tile: `tram`, `bus`..., or a metro line `metro/B/F8B322` lettered in its own colour. */
const drawTile = (ctx: CanvasRenderingContext2D, tile: string, colors: Record<RouteType, string>, x: number, size: number) => {
    const [token, metroLine, metroColor] = tile.split(METRO_TILE_SEPARATOR);
    const mode = (token in colors ? token : 'unknown') as RouteType;
    const fill = mode === 'metro' && metroColor ? `#${metroColor}` : colors[mode];
    const ink = getContrastColor(fill);
    ctx.fillStyle = fill;
    ctx.fillRect(x, 0, size, size);
    if (mode === 'metro') drawLetter(ctx, metroLine ?? 'M', x, size, ink);
    else if (mode === 'trolleybus') {
        drawGlyph(ctx, TROLLEY_POLES, x, size, ink);
        drawGlyph(ctx, BUS, x, size, ink, TROLLEYBUS_BUS_DROP);
    } else if (mode !== 'unknown') drawGlyph(ctx, GLYPHS[mode], x, size, ink);
};

/** A favourite's five-pointed star centred on (`cx`, `cy`), outlined so it reads on any tile and on the map. */
const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.48;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 0.35;
    ctx.strokeStyle = STOP_BADGE.STAR_OUTLINE;
    ctx.stroke();
    ctx.fillStyle = STOP_BADGE.STAR_COLOR;
    ctx.fill();
};

/**
 * One pill of joined tiles for the image id's `<city>:<star>:<badges>` part; one grey tile for a stop with
 * no lines. A starred pill gets a margin on every side, so its centre, and so its place on the map, stays put.
 */
const drawStopBadge = (key: string): ImageData | null => {
    const [city, star, badges] = key.split(':');
    const colors = modeColorsOf(city);
    const tiles = badges ? badges.split(STOP_BADGE_SEPARATOR) : ['unknown'];
    const size = STOP_BADGE.TILE_PX * STOP_BADGE.PIXEL_RATIO;
    const divider = STOP_BADGE.DIVIDER_PX * STOP_BADGE.PIXEL_RATIO;
    const margin = star ? Math.round(size * STOP_BADGE.STAR_MARGIN_SCALE) : 0;
    const width = tiles.length * size;
    const canvas = document.createElement('canvas');
    canvas.width = width + 2 * margin;
    canvas.height = size + 2 * margin;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.save();
    ctx.translate(margin, margin);
    ctx.beginPath();
    ctx.roundRect(0, 0, width, size, size * STOP_BADGE.RADIUS_SCALE);
    ctx.clip();
    tiles.forEach((tile, i) => drawTile(ctx, tile, colors, i * size, size));
    ctx.fillStyle = STOP_BADGE.DIVIDER_COLOR;
    for (let i = 1; i < tiles.length; i++) ctx.fillRect(i * size - divider / 2, 0, divider, size);
    ctx.restore();
    if (star) drawStar(ctx, margin + width, margin, size * STOP_BADGE.STAR_RADIUS_SCALE);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/** Draws stop badge images the first time a layer asks for one, since the mode combinations are only known from the data. */
export const provideStopBadges = (map: Map) => {
    map.setMissingStyleImageResolver((id) => {
        if (!id.startsWith(MAP_ICONS.STOP_BADGE_PREFIX) || map.hasImage(id)) return;
        const image = drawStopBadge(id.slice(MAP_ICONS.STOP_BADGE_PREFIX.length));
        if (image) map.addImage(id, image, { pixelRatio: STOP_BADGE.PIXEL_RATIO });
    });
};
