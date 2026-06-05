import { useDeferredValue, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { usePreferencesStore } from '../../state/preferencesStore';
import { useCities } from './useCities';
import { FALLBACK_CITY_CONFIG } from '../../config/constants';

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
        limit: '5',
        lang: photonLang,
    });

    if (userLocation) {
        // Round to 2 decimal places (~1.1km) to prevent API spam when GPS location slightly shifts
        params.set('lon', String(Math.round(userLocation[0] * 100) / 100));
        params.set('lat', String(Math.round(userLocation[1] * 100) / 100));
    }

    // Append bbox directly to avoid URLSearchParams encoding commas as %2C
    return `https://photon.komoot.io/api/?${params.toString()}&bbox=${bbox}`;
};

const parsePhotonFeature = (
    feature: {
        properties: {
            osm_id?: number;
            name?: string;
            street?: string;
            housenumber?: string;
            city?: string;
            state?: string;
            type?: string;
            osm_type?: string;
        };
        geometry: { coordinates: [number, number] };
    },
    index: number
): GeocodingResult | null => {
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
        id: `photon-${p.osm_type}-${p.osm_id}-${index}`,
        name: primaryName,
        subtitle: subtitleParts.join(', '),
        coordinates: feature.geometry.coordinates as [number, number],
    };
};

// Module-level cache for O(1) lookups by ID
export const geocodingCache = new Map<string, GeocodingResult>();

/**
 * useGeocoding
 *
 * Queries the Photon geocoding API (powered by OSM) for address/POI results
 * within the PID service area (Praha + Středočeský kraj).
 *
 * - Hard-bounded to the active city region via `bbox` parameter.
 * - Uses user location as a soft relevance bias if available.
 * - Only fires when query length >= 3 characters.
 * - Uses TanStack Query for caching and error handling.
 */
export const useGeocoding = (
    query: string,
    userLocation: [number, number] | null
): { results: GeocodingResult[]; isLoading: boolean } => {
    const { i18n } = useTranslation();
    const deferredQuery = useDeferredValue(query);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { data: citiesData } = useCities();

    const cityBounds = useMemo(() => {
        if (!citiesData?.cities) return FALLBACK_CITY_CONFIG.bounds;
        const city = citiesData.cities.find(c => c.slug === selectedCity);
        if (!city) return FALLBACK_CITY_CONFIG.bounds;
        return city.bounds.join(',');
    }, [citiesData, selectedCity]);

    const url = useMemo(() => {
        if (deferredQuery.trim().length < 3) return null;
        return buildPhotonUrl(deferredQuery.trim(), userLocation, i18n.language, cityBounds);
    }, [deferredQuery, userLocation, i18n.language, cityBounds]);

    const { data, isFetching } = useQuery({
        queryKey: ['geocoding', url],
        queryFn: async ({ signal }) => {
            if (!url) return [];
            
            const res = await fetch(url, { signal });
            if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
            
            const json = await res.json() as { features: Parameters<typeof parsePhotonFeature>[0][] };
            
            const results = json.features
                .map((f, i) => parsePhotonFeature(f, i))
                .filter((r): r is GeocodingResult => r !== null);
                
            results.forEach(r => geocodingCache.set(r.id, r));
            return results;
        },
        enabled: !!url,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        retry: false, // Don't retry on geocoding errors to avoid spamming the API
    });

    // Reset results immediately if the actual query becomes too short,
    // to avoid showing stale results while deferredQuery catches up.
    if (query.trim().length < 3) {
        return { results: [], isLoading: false };
    }

    return { 
        results: data ?? [], 
        isLoading: isFetching 
    };
};
