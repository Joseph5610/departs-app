import '../lib/zod-config';
import { z } from 'zod/mini';
import type { EnrichmentChannelAdapter } from '../types/enrichment';
import type { City } from '../types/cities';

/** A Brno KORDIS StreamServer vehicle message; other messages (e.g. the filter acknowledgement) have no attributes. */
const kordisMessageSchema = z.object({
    attributes: z.object({
        ID: z.union([z.number(), z.string().check(z.minLength(1))]),
        /** Minutes */
        Delay: z.optional(z.nullable(z.number())),
        /** Low floor, sent as "true" / "false" */
        LF: z.optional(z.nullable(z.union([z.string(), z.boolean()]))),
        Course: z.optional(z.nullable(z.union([z.string(), z.number()]))),
        /** Unix ms */
        TimeUpdated: z.optional(z.nullable(z.number())),
    }),
});

export interface InitialCityConfig {
    slug: string;
    /** ISO 3166-1 alpha-2 code; must match the backend `CITY_REGISTRY`. */
    country: string;
    center: [number, number];
    bounds: [number, number, number, number];
    hasPointsOfSale?: boolean;
    /** Mirrors the backend `hasAlerts`; used until /api/cities has loaded. */
    hasAlerts?: boolean;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
    enrichmentChannel?: EnrichmentChannelAdapter;
    hasInfotexts?: boolean;
    /** Realtime data provider shown in the system status modal. */
    dataProvider: { nameKey: string; url: string };
    /** Data sources credited in Settings, in display order. */
    attributions: Array<{ label: string; url: string }>;
    /** Upstream feed descriptions shown in the admin Feed Explorer. */
    debugFeedLabels: { vehicles: string; alerts: string };
    /** Local line conventions; cities without them get DEFAULT_LINE_RULES. */
    lineRules?: Partial<LineRules>;
}

export interface LineRules {
    /** Metro line names, recognised even when a departure's type isn't marked as metro. */
    metroLineNames: string[];
    /** Line-name prefixes treated as trains when the type is missing. */
    trainLinePrefixes: string[];
    /** Local hours [from, to) with no metro service, to explain an empty metro board. */
    metroClosedHours: [number, number] | null;
    /** Night lines are listed after the day lines of their mode. */
    isNightLine: (routeType: string, lineName: string) => boolean;
    /** Line-name shape accepted as a line filter even before the stop data has loaded. */
    linePattern: RegExp;
}

export const DEFAULT_LINE_RULES: LineRules = {
    metroLineNames: [],
    trainLinePrefixes: ['S', 'R'],
    metroClosedHours: null,
    isNightLine: () => false,
    linePattern: /^([0-9]{1,3}[A-Z]?|[SR]\d{1,2})$/i,
};

export const FRONTEND_CITIES_CONFIG: Record<string, InitialCityConfig> = {
    prague: {
        slug: 'prague',
        country: 'CZ',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        hasPointsOfSale: true,
        hasAlerts: true,
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train']
        },
        hasInfotexts: true,
        dataProvider: { nameKey: 'liveStatus.providerGolemio', url: 'https://golemio.cz' },
        attributions: [
            { label: 'Golemio (Prague)', url: 'https://golemio.cz' },
        ],
        debugFeedLabels: { vehicles: 'Golemio (/v2/public/vehiclepositions)', alerts: 'PID (GTFS-RT PB + RSS XML)' },
        lineRules: {
            metroLineNames: ['A', 'B', 'C'],
            metroClosedHours: [0, 5],
            isNightLine: (routeType, lineName) => {
                const num = parseInt(lineName.replace(/\D/g, ''), 10);
                if (Number.isNaN(num)) return false;
                return (routeType === 'tram' && num >= 90 && num < 100) || (routeType === 'bus' && num >= 900);
            },
            linePattern: /^([A-C]|S\d{1,2}|R\d{1,2}|X[A-Z0-9-]{1,3}|[0-9]{1,3}[A-Z]?|AE|LD|P\d|H\d|MHD\s?\d{1,2})$/i,
        },
    },
    brno: {
        slug: 'brno',
        country: 'CZ',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        hasAlerts: true,
        filters: {
            vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
            stops: []
        },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerKordis', url: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328' },
        attributions: [
            { label: 'IDS JMK (Brno)', url: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328' },
            { label: 'Lissy API (Brno Shapes)', url: 'https://github.com/Jorgen98/Lissy' },
        ],
        debugFeedLabels: { vehicles: 'GTFS-RT -> JSON', alerts: 'GTFS-RT Alerts -> JSON' },
        enrichmentChannel: {
            url: 'wss://gis.brno.cz/geoevent/ws/services/Kordis_stream/StreamServer/subscribe',
            // Send filtering instructions right after the websocket connects
            wsFilterPayload: { 
                filter: { 
                    outFields: "ID,Delay,LF,Course,TimeUpdated"
                }
            },
            normalize: (rawMsg: unknown) => {
                const msg = kordisMessageSchema.safeParse(rawMsg);
                if (!msg.success) return null;
                const attr = msg.data.attributes;

                // Delay is in minutes from WS, our app uses seconds
                const delaySeconds = typeof attr.Delay === 'number' ? Math.round(attr.Delay * 60) : null;
                
                // LF is a string "true" or "false" in the schema
                const is_wheelchair_accessible = attr.LF === "true" || attr.LF === true ? true : attr.LF === "false" || attr.LF === false ? false : null;

                return {
                    vehicleId: String(attr.ID),
                    // KORDIS TimeUpdated is a date integer (Unix timestamp in ms)
                    dataTimestamp: typeof attr.TimeUpdated === 'number' ? attr.TimeUpdated : Date.now(),
                    delay: delaySeconds,
                    is_wheelchair_accessible,
                    run_number: attr.Course ? String(attr.Course) : undefined,
                };
            }
        }
    },
    presov: {
        slug: 'presov',
        country: 'SK',
        center: [21.2393, 48.9985],
        bounds: [21.13, 48.93, 21.37, 49.08],
        filters: {
            vehicles: ['bus', 'trolleybus'],
            stops: []
        },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerDpmp', url: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079' },
        attributions: [
            { label: 'DPMP (Prešov)', url: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079' },
        ],
        debugFeedLabels: { vehicles: 'DPMP CSV -> JSON', alerts: 'No alerts source' },
    },
    // duk: {
    //     slug: 'duk',
    //     country: 'CZ',
    //     center: [14.0322, 50.6607],
    //     bounds: [12.93, 50.11, 14.61, 51.05],
    //     filters: {
    //         vehicles: ['train', 'bus', 'trolleybus', 'tram', 'ferry'],
    //         stops: []
    //     }
    // }
};

export const DEFAULT_CITY_SLUG = 'prague';

/** Device time zones that identify the viewer's country when the browser language does not. */
export const VIEWER_COUNTRY_BY_TIMEZONE: Record<string, string> = {
    'Europe/Prague': 'CZ',
    'Europe/Bratislava': 'SK',
};

/** Primary browser language prefixes that identify the viewer's country. */
export const VIEWER_COUNTRY_BY_LANGUAGE: Record<string, string> = {
    cs: 'CZ',
    sk: 'SK',
};

export const FALLBACK_CITY_CONFIG = FRONTEND_CITIES_CONFIG[DEFAULT_CITY_SLUG];

/** A bundled city config with its `/api/cities` entry laid over it. */
export type CityConfig = InitialCityConfig & Partial<City>;
