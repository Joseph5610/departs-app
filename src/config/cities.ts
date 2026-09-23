import '../lib/zod-config';
import { z } from 'zod/mini';
import type { EnrichmentChannelAdapter } from '../types/enrichment';
import type { City } from '../types/cities';
import type { DataAttribution, DataLicenseId } from './attributions';

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
    /** Route shapes are read by the app from the static data CDN; without them the detail shows no route on the map. */
    hasTripShapes?: boolean;
    /** Kept out of the city lists until a device unlocks it with `?beta=<slug>`. */
    isHidden?: boolean;
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
    attributions: DataAttribution[];
    /** Licence departs.app republishes this city's processed data under; ODbL sources stay ODbL (share-alike). Defaults to CC BY 4.0. */
    processedDataLicense?: DataLicenseId;
    /** Line chips list the lines of the loaded departures, not the stop's timetable lines (DÚK: the platform comes from the live board). */
    lineChipsFromDepartures?: boolean;
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
        hasTripShapes: true,
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train']
        },
        hasInfotexts: true,
        dataProvider: { nameKey: 'liveStatus.providerGolemio', url: 'https://golemio.cz' },
        attributions: [
            { creator: 'ROPID', title: 'PID open data: stops, points of sale, timetables, disruptions', url: 'https://pid.cz/o-systemu/opendata/', license: 'ccBy4' },
            { creator: 'ROPID, via Operátor ICT (Golemio)', title: 'PID vehicle positions and departures (Golemio API)', url: 'https://golemio.cz', license: 'ccBy4' },
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
        hasTripShapes: true,
        filters: {
            vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
            stops: []
        },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerKordis', url: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328' },
        attributions: [
            { creator: 'Statutární město Brno, KORDIS JMK', title: 'IDS JMK timetables (GTFS, GTFS-RT)', url: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328', license: 'ccBy4' },
            { creator: 'Statutární město Brno, KORDIS JMK', title: 'Public transit vehicle positions', url: 'https://data.brno.cz/datasets/e8aa121910df41bb9a28e4ca34a263c7', license: 'ccBy4' },
            { creator: 'Lissy, FIT VUT Brno', title: 'Route shapes (Lissy API)', url: 'https://github.com/Jorgen98/Lissy', license: 'permission' },
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
        hasTripShapes: true,
        filters: {
            vehicles: ['bus', 'trolleybus'],
            stops: []
        },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerDpmp', url: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079' },
        attributions: [
            { creator: 'Dopravný podnik mesta Prešov, a.s.', title: 'GTFS – MHD Prešov', url: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079', license: 'ccBy4' },
            { creator: 'Dopravný podnik mesta Prešov, a.s.', title: 'On-line poloha vozidiel MHD mesta Prešov', url: 'https://egov.presov.sk/Default.aspx', license: 'ccBy4' },
        ],
        debugFeedLabels: { vehicles: 'DPMP CSV -> JSON', alerts: 'No alerts source' },
    },
    duk: {
        slug: 'duk',
        country: 'CZ',
        center: [14.0322, 50.6607],
        bounds: [12.93, 50.11, 14.61, 51.05],
        isHidden: true,
        filters: {
            vehicles: ['train', 'bus', 'trolleybus', 'tram', 'ferry'],
            stops: []
        },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerDuk', url: 'https://tabule.portabo.cz' },
        attributions: [
            { creator: 'Ústecký kraj (Portabo)', title: 'DÚK stops, departure boards and vehicle positions', url: 'https://lkod.portabo.cz/datasets', license: 'czOpenData' },
            { creator: 'Ministerstvo dopravy ČR (CIS JŘ)', title: 'Jízdní řády veřejné linkové dopravy (JDF)', url: 'https://data.gov.cz/datová-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F66003008%2F1463646434', license: 'czOpenData' },
        ],
        lineChipsFromDepartures: true,
        debugFeedLabels: { vehicles: 'Portabo GetTraffic -> JSON', alerts: 'No alerts source' },
    },
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
