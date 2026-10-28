import '@/lib/zodConfig';
import { z } from 'zod/mini';
import type { EnrichmentChannelAdapter, RouteType } from '@/types';
import type { DataAttribution } from './attributions';
import { CITY_FACTS, type CityFacts } from '@shared/cities';

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

/** A city as the app bundles it: the facts it shares with the server plus how the app shows it. */
export interface CityConfig extends CityFacts {
    /** Route shapes are read by the app from the static data CDN; without them the route is drawn straight from stop to stop. */
    hasTripShapes?: boolean;
    /** The city publishes `network.json`, its backbone lines (e.g. metro) drawn on the map at all times. */
    hasNetworkLines?: boolean;
    enrichmentChannel?: EnrichmentChannelAdapter;
    /** The feed reports no delay, so the app estimates it from `stop_times/<HH>.json` and the vehicle positions. */
    estimatesDelay?: boolean;
    hasInfotexts?: boolean;
    /** Fleet register on the static data CDN (`<city>/<file>`) for vehicle detail; a vehicle it does not list keeps the backend's network operator. */
    vehicleMetadata?: { file: string };
    /** Realtime data provider shown in the system status modal. */
    dataProvider: { nameKey: string; url: string };
    /** Data sources credited on the licences page, in display order. */
    attributions: DataAttribution[];
    /** Line chips list the lines of the loaded departures, not the stop's timetable lines (DÚK: the platform comes from the live board). */
    lineChipsFromDepartures?: boolean;
    /** Upstream feed descriptions shown in the admin Feed Explorer. */
    debugFeedLabels: { vehicles: string; alerts: string };
    /** Local line conventions; cities without them get DEFAULT_LINE_RULES. */
    lineRules?: Partial<LineRules>;
    /** Colour by mode for lines the city's routes.json does not list (DÚK: trains come from the live feed only). */
    routeTypeColors?: Partial<Record<RouteType, string>>;
    /** Short network name, as riders know it (on the stop panel's link to the same stop in this network). */
    networkLabel: string;
    /** Colour of each mode's tile in the map's stop badges; a mode left out takes `STOP_BADGE.MODE_COLORS`. */
    modeColors?: Partial<Record<RouteType, string>>;
}

export interface LineRules {
    /** Line-name prefixes treated as trains when the type is missing. */
    trainLinePrefixes: string[];
    /** Local hours [from, to) with no metro service, to explain an empty metro board. */
    metroClosedHours: [number, number] | null;
    /** Local hours [from, to), wrapping past midnight, in which stop badges show night lines (`RouteInfo.night`). */
    nightHours: [number, number];
}

export const DEFAULT_LINE_RULES: LineRules = {
    trainLinePrefixes: ['S', 'R'],
    metroClosedHours: null,
    nightHours: [22, 5],
};

/** Keyed by URL slug; null-prototype so a slug like `toString` is not a city. */
export const FRONTEND_CITIES_CONFIG: Record<string, CityConfig> = Object.assign(Object.create(null) as Record<string, CityConfig>, {
    prague: {
        ...CITY_FACTS.prague,
        networkLabel: 'PID',
        modeColors: { train: '#251E62', tram: '#7A0603', trolleybus: '#80166F', bus: '#007DA8', ferry: '#00B3CB', funicular: '#B2B943' },
        hasTripShapes: true,
        hasNetworkLines: true,
        hasInfotexts: true,
        dataProvider: { nameKey: 'liveStatus.providerGolemio', url: 'https://golemio.cz' },
        attributions: [
            { creator: 'ROPID', title: 'PID open data: stops, points of sale, timetables, disruptions', url: 'https://pid.cz/o-systemu/opendata/', license: 'ccBy4' },
            { creator: 'ROPID, via Operátor ICT (Golemio)', title: 'PID vehicle positions and departures (Golemio API)', url: 'https://golemio.cz', license: 'ccBy4' },
        ],
        debugFeedLabels: { vehicles: 'Golemio (/v2/public/vehiclepositions)', alerts: 'PID (GTFS-RT PB + RSS XML)' },
        lineRules: {
            metroClosedHours: [0, 5],
        },
    },
    brno: {
        ...CITY_FACTS.brno,
        networkLabel: 'IDS JMK',
        modeColors: { tram: '#D40000', trolleybus: '#008033', bus: '#2C82C8', ferry: '#00224B' },
        hasTripShapes: true,
        hasNetworkLines: true,
        hasInfotexts: false,
        estimatesDelay: true,
        vehicleMetadata: { file: 'vehicles.json' },
        dataProvider: { nameKey: 'liveStatus.providerKordis', url: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328' },
        attributions: [
            { creator: 'Statutární město Brno, KORDIS JMK', title: 'IDS JMK timetables (GTFS, GTFS-RT)', url: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328', license: 'ccBy4' },
            { creator: 'Statutární město Brno, KORDIS JMK', title: 'Public transit vehicle positions', url: 'https://data.brno.cz/datasets/e8aa121910df41bb9a28e4ca34a263c7', license: 'ccBy4' },
            { creator: 'Lissy, FIT VUT Brno', title: 'Route shapes (Lissy API)', url: 'https://github.com/Jorgen98/Lissy', license: 'permission' },
            { creator: 'KORDIS JMK, Statutární město Brno', title: 'IDS JMK – výluky a odklony', url: 'https://data.brno.cz/datasets/227c819ed9fc4d2e8498e9ea9c93c965', license: 'notStated' },
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
        ...CITY_FACTS.presov,
        networkLabel: 'DPMP',
        hasTripShapes: true,
        hasNetworkLines: true,
        vehicleMetadata: { file: 'dpmp-vehicles.json' },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerDpmp', url: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079' },
        attributions: [
            { creator: 'Dopravný podnik mesta Prešov, a.s.', title: 'GTFS – MHD Prešov', url: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079', license: 'ccBy4' },
            { creator: 'Dopravný podnik mesta Prešov, a.s.', title: 'On-line poloha vozidiel MHD mesta Prešov', url: 'https://egov.presov.sk/Default.aspx', license: 'ccBy4' },
        ],
        debugFeedLabels: { vehicles: 'DPMP CSV -> JSON', alerts: 'No alerts source' },
    },
    duk: {
        ...CITY_FACTS.duk,
        networkLabel: 'DÚK',
        modeColors: { train: '#004B90', tram: '#CF003D', trolleybus: '#00829B', bus: '#5E9E1F', funicular: '#C9A100' },
        hasInfotexts: false,
        dataProvider: { nameKey: 'liveStatus.providerDuk', url: 'https://tabule.portabo.cz' },
        attributions: [
            { creator: 'Ústecký kraj (Portabo)', title: 'DÚK stops, departure boards and vehicle positions', url: 'https://lkod.portabo.cz/datasets', license: 'czOpenData' },
            { creator: 'Ministerstvo dopravy ČR (CIS JŘ)', title: 'Jízdní řády veřejné linkové dopravy (JDF)', url: 'https://data.gov.cz/datová-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F66003008%2F1463646434', license: 'czOpenData' },
            { creator: 'Spojenka', title: 'Train timetables (Data jízdních řádů, GTFS)', url: 'https://www.spojenka.cz/jrdata', license: 'nonCommercial' },
        ],
        lineChipsFromDepartures: true,
        routeTypeColors: { train: '#004B90' },
        debugFeedLabels: { vehicles: 'Portabo GetTraffic -> JSON', alerts: 'No alerts source' },
    },
} satisfies Record<string, CityConfig>);

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

/** Every city, hidden ones included, in the order the city lists show them. */
export const CITY_LIST: CityConfig[] = Object.values(FRONTEND_CITIES_CONFIG);

