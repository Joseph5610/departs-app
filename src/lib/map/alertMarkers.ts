import type { Map } from 'maplibre-gl';
import type { AlertIconKind } from '@/domain/alerts';
import { ALERT_MARKER, MAP_ICONS } from '@/config/mapLayers';
import { strokeGlyph, type GlyphNode } from './canvasGlyph';

/** The Lucide glyphs AlertIcon draws for each kind (24-unit viewBox), for the canvas. */
const GLYPHS: Record<AlertIconKind, GlyphNode[]> = {
    noService: [['circle', 12, 12, 10], ['path', 'M4.929 4.929 19.07 19.071']],
    reducedService: [['circle', 12, 12, 10], ['path', 'M8 12h8']],
    delays: [['path', 'M5 22h14'], ['path', 'M5 2h14'], ['path', 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22'], ['path', 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2']],
    detour: [['circle', 6, 19, 3], ['path', 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15'], ['circle', 18, 5, 3]],
    addedService: [['circle', 12, 12, 10], ['path', 'M8 12h8'], ['path', 'M12 8v8']],
    stopMoved: [['path', 'M12.75 7.09a3 3 0 0 1 2.16 2.16'], ['path', 'M17.072 17.072c-1.634 2.17-3.527 3.912-4.471 4.727a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 1.432-4.568'], ['path', 'm2 2 20 20'], ['path', 'M8.475 2.818A8 8 0 0 1 20 10c0 1.183-.31 2.377-.81 3.533'], ['path', 'M9.13 9.13a3 3 0 0 0 3.74 3.74']],
    maintenance: [['path', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z']],
    protest: [['path', 'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'], ['path', 'M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14'], ['path', 'M8 6v8']],
    accident: [['path', 'm21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8'], ['path', 'M7 14h.01'], ['path', 'M17 14h.01'], ['rect', 3, 10, 18, 8, 2], ['path', 'M5 18v2'], ['path', 'M19 18v2']],
    holiday: [['path', 'M8 2v3'], ['path', 'M16 2v3'], ['rect', 3, 3, 18, 18, 2], ['path', 'M3 9h18'], ['path', 'M8 13h.01'], ['path', 'M12 13h.01'], ['path', 'M16 13h.01'], ['path', 'M8 17h.01'], ['path', 'M12 17h.01'], ['path', 'M16 17h.01']],
    weather: [['path', 'M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973'], ['path', 'm13 12-3 5h4l-3 5']],
    construction: [['rect', 2, 6, 20, 8, 1], ['path', 'M17 14v7'], ['path', 'M7 14v7'], ['path', 'M17 3v3'], ['path', 'M7 3v3'], ['path', 'M10 14 2.3 6.3'], ['path', 'm14 6 7.7 7.7'], ['path', 'm8 6 8 8']],
    police: [['path', 'M7 18v-6a5 5 0 1 1 10 0v6'], ['path', 'M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z'], ['path', 'M21 12h1'], ['path', 'M18.5 4.5 18 5'], ['path', 'M2 12h1'], ['path', 'M12 2v1'], ['path', 'm4.929 4.929.707.707'], ['path', 'M12 12v6']],
    medical: [['path', 'M10 10H6'], ['path', 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'], ['path', 'M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14'], ['path', 'M8 8v4'], ['path', 'M9 18h6'], ['circle', 17, 18, 2], ['circle', 7, 18, 2]],
    warning: [['path', 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'], ['path', 'M12 9v4'], ['path', 'M12 17h.01']],
};

type Tone = keyof typeof ALERT_MARKER.TONES;

/** A rounded square of `side` turned into a diamond centred on (`c`, `c`). */
const diamond = (ctx: CanvasRenderingContext2D, c: number, side: number) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.roundRect(-side / 2, -side / 2, side, side, side * ALERT_MARKER.RADIUS_SCALE);
    ctx.fill();
    ctx.restore();
};

/** One marker: a diamond in the tone's colour inside a white border with a thin dark rim, the kind's glyph in its centre, on a leg whose foot is the image's bottom. */
const drawMarker = (kind: AlertIconKind, tone: Tone): ImageData | null => {
    const size = ALERT_MARKER.SIZE_PX * ALERT_MARKER.PIXEL_RATIO;
    const leg = ALERT_MARKER.LEG_PX * ALERT_MARKER.PIXEL_RATIO;
    const legWidth = ALERT_MARKER.LEG_WIDTH_PX * ALERT_MARKER.PIXEL_RATIO;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + leg;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const { fill, ink } = ALERT_MARKER.TONES[tone];
    const c = size / 2;
    const rim = size * ALERT_MARKER.RIM_SCALE;
    const ring = size * ALERT_MARKER.RING_SCALE;

    ctx.lineCap = 'round';
    ctx.strokeStyle = ALERT_MARKER.RIM_COLOR;
    ctx.lineWidth = legWidth + 2 * rim;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c, canvas.height - (legWidth / 2 + rim));
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = legWidth;
    ctx.stroke();

    // A diamond's diagonal spans the canvas width, so its side is the size over √2.
    const side = (inset: number) => (size - 2 * inset) / Math.SQRT2;
    ctx.fillStyle = ALERT_MARKER.RIM_COLOR;
    diamond(ctx, c, side(0));
    ctx.fillStyle = '#ffffff';
    diamond(ctx, c, side(rim));
    ctx.fillStyle = fill;
    diamond(ctx, c, side(rim + ring));

    const glyphPx = size * ALERT_MARKER.GLYPH_SCALE;
    strokeGlyph(ctx, GLYPHS[kind], c - glyphPx / 2, c - glyphPx / 2, glyphPx, ink, ALERT_MARKER.GLYPH_STROKE);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/** Adds every kind's marker in every tone, named as the alerts layer asks for them. */
export const addAlertMarkers = (map: Map) => {
    for (const kind of Object.keys(GLYPHS) as AlertIconKind[]) {
        for (const tone of Object.keys(ALERT_MARKER.TONES) as Tone[]) {
            const name = `${MAP_ICONS.ALERT_MARKER_PREFIX}${kind}:${tone}`;
            const image = drawMarker(kind, tone);
            if (!image) continue;
            if (map.hasImage(name)) map.removeImage(name);
            map.addImage(name, image, { pixelRatio: ALERT_MARKER.PIXEL_RATIO });
        }
    }
};
