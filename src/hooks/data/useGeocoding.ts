import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import '../../lib/zod-config';
import { z } from 'zod/mini';

import { useCityConfig } from './useCities';
import { EXTERNAL_URLS, GEOCODING_CONFIG, QUERY_TIMING_MS } from '../../config/constants';
import { useDebouncedValue } from '../useDebouncedValue';

export interface GeocodingResult {
    id: string;
    name: string;
    subtitle: string;
    coordinates: [number, number];
}

const buildPhotonUrl = (query: string, userLocation: [number, number] | null, lang: string, bbox: string): string => {
    // Build base params — bbox must be appended raw (commas must not be %2C-encoded)
    // Photon supports: default, de, en, fr
    const photonLang = lang.startsWith('en') ? 'en' : 'default';

    const params = new URLSearchParams({
        q: query,
        limit: String(GEOCODING_CONFIG.RESULT_LIMIT),
        lang: photonLang,
    });

    if (userLocation) {
        // Round to 2 decimal places (~1.1km) to prevent API spam when GPS location slightly shifts
        params.set('lon', String(Math.round(userLocation[0] * 100) / 100));
        params.set('lat', String(Math.round(userLocation[1] * 100) / 100));
    }

    // Append bbox directly to avoid URLSearchParams encoding commas as %2C
    return `${EXTERNAL_URLS.GEOCODER_API}?${params.toString()}&bbox=${bbox}`;
};

const photonFeatureSchema = z.object({
    properties: z.object({
        osm_id: z.number(),
        osm_type: z.string(),
        name: z.optional(z.string()),
        street: z.optional(z.string()),
        housenumber: z.optional(z.string()),
        city: z.optional(z.string()),
        state: z.optional(z.string()),
        type: z.optional(z.string()),
    }),
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
});

const photonResponseSchema = z.object({ features: z.array(z.unknown()) });

const parsePhotonFeature = (feature: z.infer<typeof photonFeatureSchema>): GeocodingResult | null => {
    const p = feature.properties;
    
    let primaryName = p.name || '';
    const address = p.street && p.housenumber ? `${p.street} ${p.housenumber}` : (p.street || '');

    // If there's no POI name, or the name is just the street name, use the full address (with number) as the primary name
    if (!primaryName || primaryName === p.street) {
        primaryName = address || primaryName;
    }

    if (!primaryName) return null;

    const subtitleParts: string[] = [];
    // If the primary name is a POI (e.g. "Kavárna"), put the address in the subtitle
    if (primaryName !== address && address) {
        subtitleParts.push(address);
    }
    
    if (p.city) subtitleParts.push(p.city);
    else if (p.state) subtitleParts.push(p.state);

    return {
        id: `photon-${p.osm_type}-${p.osm_id}`,
        name: primaryName,
        subtitle: subtitleParts.join(', '),
        coordinates: feature.geometry.coordinates,
    };
};

/** Places seen in results or history, for resolving the selected place ID; bounded, oldest dropped first. */
const geocodingCache = new Map<string, GeocodingResult>();
const placeListeners = new Set<() => void>();

export const rememberPlace = (place: GeocodingResult) => {
    geocodingCache.delete(place.id);
    geocodingCache.set(place.id, place);
    if (geocodingCache.size > GEOCODING_CONFIG.CACHE_LIMIT) {
        const oldest = geocodingCache.keys().next().value;
        if (oldest !== undefined) geocodingCache.delete(oldest);
    }
    placeListeners.forEach(notify => notify());
};

const subscribeToPlaces = (listener: () => void) => {
    placeListeners.add(listener);
    return () => { placeListeners.delete(listener); };
};

/** The remembered place with this ID; re-renders when it is remembered or evicted. */
export const useRememberedPlace = (id: string | null): GeocodingResult | null =>
    useSyncExternalStore(subscribeToPlaces, () => (id ? geocodingCache.get(id) ?? null : null));

/**
 * useGeocoding
 *
 * Queries the Photon geocoding API (powered by OSM) for address/POI results in the selected city.
 *
 * - Hard-bounded to the city region via the `bbox` parameter.
 * - Uses the user location as a soft relevance bias if available.
 * - Fires once typing pauses, for queries of at least `GEOCODING_CONFIG.MIN_QUERY_LENGTH` characters.
 */
export const useGeocoding = (
    query: string,
    userLocation: [number, number] | null
): { results: GeocodingResult[]; isLoading: boolean } => {
    const { i18n } = useTranslation();
    const debouncedQuery = useDebouncedValue(query.trim(), GEOCODING_CONFIG.DEBOUNCE_MS);
    const cityBounds = useCityConfig().bounds.join(',');

    const url = useMemo(() => {
        if (debouncedQuery.length < GEOCODING_CONFIG.MIN_QUERY_LENGTH) return null;
        return buildPhotonUrl(debouncedQuery, userLocation, i18n.language, cityBounds);
    }, [debouncedQuery, userLocation, i18n.language, cityBounds]);

    const { data, isFetching } = useQuery({
        queryKey: ['geocoding', url],
        queryFn: async ({ signal }) => {
            if (!url) return [];
            
            const res = await fetch(url, { signal });
            if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
            
            const json = photonResponseSchema.parse(await res.json());

            const seen = new Set<string>();
            const results: GeocodingResult[] = [];
            for (const raw of json.features) {
                const feature = photonFeatureSchema.safeParse(raw);
                const place = feature.success ? parsePhotonFeature(feature.data) : null;
                if (!place || seen.has(place.id)) continue;
                seen.add(place.id);
                results.push(place);
                rememberPlace(place);
            }
            return results;
        },
        enabled: !!url,
        staleTime: QUERY_TIMING_MS.GEOCODING_STALE,
        retry: false, // Don't retry on geocoding errors to avoid spamming the API
    });

    // Clear at once when the query gets too short instead of waiting for the debounce.
    if (query.trim().length < GEOCODING_CONFIG.MIN_QUERY_LENGTH) {
        return { results: [], isLoading: false };
    }

    return { 
        results: data ?? [], 
        isLoading: isFetching 
    };
};
