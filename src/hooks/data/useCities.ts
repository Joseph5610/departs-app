import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CitiesResponse } from '../../types/transit';
import { apiFetch } from '@/lib/api-client';
import { QUERY_TIMING_MS } from '../../config/constants';
import { DEFAULT_LINE_RULES, FALLBACK_CITY_CONFIG, FRONTEND_CITIES_CONFIG, type CityConfig, type LineRules } from '../../config/cities';
import { usePreferencesStore } from '../../state/preferencesStore';

export function useCities() {
    return useQuery<CitiesResponse, Error>({
        queryKey: ['cities', 'v2'],
        queryFn: () => apiFetch<CitiesResponse>('/cities'),
        staleTime: QUERY_TIMING_MS.CITIES_STALE,
        gcTime: QUERY_TIMING_MS.CITIES_GC,
        refetchOnWindowFocus: false,
    });
}

/**
 * Config for one city (the selected city by default): its `/api/cities` entry over the bundled config.
 * The bundled values apply until the API responds, and to fields an older cached response lacks.
 */
export function useCityConfig(slug?: string): CityConfig {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const citySlug = slug ?? selectedCity;
    const { data } = useCities();

    return useMemo(() => {
        const bundled = FRONTEND_CITIES_CONFIG[citySlug];
        if (!bundled) return FALLBACK_CITY_CONFIG;
        const fromApi = data?.cities.find(c => c.slug === citySlug);
        return fromApi ? { ...bundled, ...fromApi } : bundled;
    }, [citySlug, data]);
}

/** The selected city's line conventions, with the generic defaults for anything it doesn't define. */
export function useLineRules(): LineRules {
    const lineRules = useCityConfig().lineRules;
    return useMemo(() => ({ ...DEFAULT_LINE_RULES, ...lineRules }), [lineRules]);
}
