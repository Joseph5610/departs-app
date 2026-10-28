import { useMemo } from 'react';
import type { CityFacts } from '@shared/cities';
import { isCityVisible, lineRulesOf } from '@/domain/cities';
import { CITY_LIST, FALLBACK_CITY_CONFIG, FRONTEND_CITIES_CONFIG, type CityConfig, type LineRules } from '@/config/cities';
import { usePreferencesStore } from '@/state/preferencesStore';

/** Config for one city (the selected city by default). */
export function useCityConfig(slug?: string): CityConfig {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    return FRONTEND_CITIES_CONFIG[slug ?? selectedCity] ?? FALLBACK_CITY_CONFIG;
}

/** The selected city's line conventions, with the generic defaults for anything it doesn't define. */
export function useLineRules(): LineRules {
    const lineRules = useCityConfig().lineRules;
    return useMemo(() => lineRulesOf(lineRules), [lineRules]);
}

/** The cities a user may pick: the hidden ones only on a device that unlocked them with `?beta=<slug>`. */
export function useVisibleCities(): CityFacts[] {
    const unlockedCities = usePreferencesStore(s => s.unlockedCities);
    return useMemo(() => CITY_LIST.filter(city => isCityVisible(city, unlockedCities)), [unlockedCities]);
}
