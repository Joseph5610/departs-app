import type { EnrichmentChannelAdapter } from '../types/enrichment';

export interface InitialCityConfig {
    slug: string;
    center: [number, number];
    bounds: [number, number, number, number];
    filters?: {
        vehicles: string[];
        stops: string[];
    };
    enrichmentChannel?: EnrichmentChannelAdapter;
}

export const FRONTEND_CITIES_CONFIG: Record<string, InitialCityConfig> = {
    prague: {
        slug: 'prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train']
        }
    },
    brno: {
        slug: 'brno',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        filters: {
            vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
            stops: []
        },
        enrichmentChannel: {
            url: 'wss://gis.brno.cz/geoevent/ws/services/stream_kordis_26/StreamServer/subscribe',
            transport: 'websocket',
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
    }
};

export const DEFAULT_CITY_SLUG = 'prague';
export const FALLBACK_CITY_CONFIG = FRONTEND_CITIES_CONFIG[DEFAULT_CITY_SLUG];

/**
 * Resolves a city configuration by slug, safely falling back to the default city config.
 */
export function getCityConfig(citySlug?: string | null): InitialCityConfig {
    if (!citySlug) return FALLBACK_CITY_CONFIG;
    return FRONTEND_CITIES_CONFIG[citySlug] || FALLBACK_CITY_CONFIG;
}
