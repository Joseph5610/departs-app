import { useState, useMemo, useEffect } from 'react';
import { useDeferredValue } from 'react';

/**
 * Bounding box for the PID (Prague Integrated Transport) service area.
 * Covers Prague + Středočeský kraj.
 * Format: [minLng, minLat, maxLng, maxLat]
 */
const PID_BBOX = '13.5,49.5,15.5,50.8';

export interface GeocodingResult {
    id: string;
    name: string;
    subtitle: string;
    coordinates: [number, number];
}

const buildPhotonUrl = (query: string, userLocation: [number, number] | null): string => {
    // Build base params — bbox must be appended raw (commas must not be %2C-encoded)
    const params = new URLSearchParams({
        q: query,
        limit: '5',
    });

    if (userLocation) {
        params.set('lon', String(userLocation[0]));
        params.set('lat', String(userLocation[1]));
    }

    // Append bbox directly to avoid URLSearchParams encoding commas as %2C
    return `https://photon.komoot.io/api/?${params.toString()}&bbox=${PID_BBOX}`;
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
    const name = p.name || p.street || '';
    if (!name) return null;

    const subtitleParts: string[] = [];
    if (p.housenumber) subtitleParts.push(`${p.street || ''} ${p.housenumber}`.trim());
    else if (p.street && p.name) subtitleParts.push(p.street);
    if (p.city) subtitleParts.push(p.city);

    return {
        id: `photon-${p.osm_type}-${p.osm_id}-${index}`,
        name,
        subtitle: subtitleParts.join(', '),
        coordinates: feature.geometry.coordinates as [number, number],
    };
};

/**
 * useGeocoding
 *
 * Queries the Photon geocoding API (powered by OSM) for address/POI results
 * within the PID service area (Praha + Středočeský kraj).
 *
 * - Hard-bounded to PID region via `bbox` parameter.
 * - Uses user location as a soft relevance bias if available.
 * - Only fires when query length >= 3 characters.
 * - Silently swallows network errors so stops-only results still show.
 */
export const useGeocoding = (
    query: string,
    userLocation: [number, number] | null
): { results: GeocodingResult[]; isLoading: boolean } => {
    const deferredQuery = useDeferredValue(query);
    const [results, setResults] = useState<GeocodingResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const url = useMemo(() => {
        if (deferredQuery.trim().length < 3) return null;
        return buildPhotonUrl(deferredQuery.trim(), userLocation);
    }, [deferredQuery, userLocation]);

    useEffect(() => {
        if (!url) {
            setResults([]);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const fetchResults = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
                const json = await res.json() as { features: Parameters<typeof parsePhotonFeature>[0][] };

                if (!cancelled) {
                    const parsed = json.features
                        .map((f, i) => parsePhotonFeature(f, i))
                        .filter((r): r is GeocodingResult => r !== null);
                    setResults(parsed);
                }
            } catch (err) {
                if (!cancelled && (err as Error).name !== 'AbortError') {
                    // Silently degrade — stop results still work
                    setResults([]);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        // 400ms debounce
        const timer = setTimeout(fetchResults, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            controller.abort();
        };
    }, [url]);

    // Reset when query is cleared
    useEffect(() => {
        if (query.trim().length < 3) {
            setResults([]);
            setIsLoading(false);
        }
    }, [query]);

    return { results, isLoading };
};
