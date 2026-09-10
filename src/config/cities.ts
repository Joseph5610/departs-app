import type { EnrichmentChannelAdapter } from '../types/enrichment';

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
}

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
        hasInfotexts: true
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
        enrichmentChannel: {
            url: 'wss://gis.brno.cz/geoevent/ws/services/Kordis_stream/StreamServer/subscribe',
            transport: 'websocket',
            // Send filtering instructions right after the websocket connects
            wsFilterPayload: { 
                filter: { 
                    outFields: "ID,Delay,LF,Course,TimeUpdated"
                }
            },
            normalize: (rawMsg: unknown) => {
                const msg = rawMsg as { attributes?: Record<string, unknown> };
                if (!msg || !msg.attributes) return null;
                const attr = msg.attributes;

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
        hasInfotexts: false
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

/**
 * Device time zones that identify the viewer's country. The time zone is the only location hint
 * available without a server round-trip, and unlike the browser language it survives an English OS.
 */
export const VIEWER_COUNTRY_BY_TIMEZONE: Record<string, string> = {
    'Europe/Prague': 'CZ',
    'Europe/Bratislava': 'SK',
};

/** Browser language prefixes that identify the viewer's country when the time zone does not. */
export const VIEWER_COUNTRY_BY_LANGUAGE: Record<string, string> = {
    cs: 'CZ',
    sk: 'SK',
};
export const FALLBACK_CITY_CONFIG = FRONTEND_CITIES_CONFIG[DEFAULT_CITY_SLUG];

/**
 * Resolves a city configuration by slug, safely falling back to the default city config.
 */
export function getCityConfig(citySlug?: string | null): InitialCityConfig {
    if (!citySlug) return FALLBACK_CITY_CONFIG;
    return FRONTEND_CITIES_CONFIG[citySlug] || FALLBACK_CITY_CONFIG;
}
