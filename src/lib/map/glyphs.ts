import type { RequestParameters, ResourceType } from 'maplibre-gl';
import { MAP_GLYPHS } from '@/config/mapLayers';

const HOSTED_RANGES: ReadonlySet<number> = new Set(MAP_GLYPHS.ranges);
const GLYPH_URL = /\/fonts\/([^/]+)\/(\d+)-(\d+)\.pbf$/;

/** Map `transformRequest`: our labels' glyph ranges load from the app itself, everything else as the style asks. */
export const selfHostedGlyphs = (url: string, resourceType?: ResourceType): RequestParameters => {
    if (resourceType !== 'Glyphs') return { url };
    const match = GLYPH_URL.exec(url);
    if (!match || decodeURIComponent(match[1]) !== MAP_GLYPHS.fontStack || !HOSTED_RANGES.has(Number(match[2]))) return { url };
    return { url: `${window.location.origin}${MAP_GLYPHS.path}/${match[2]}-${match[3]}.pbf` };
};
