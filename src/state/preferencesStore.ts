import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SearchHistoryItem, SearchHistoryBase } from '../types/transit';
import { getDefaultCitySlug } from '../utils/viewerCountry';
import { PREFERENCES_LIMITS } from '../config/constants';
import { searchHistoryKey } from '../utils/searchHistory';

interface PreferencesState {
    showVehicles: boolean;
    showStops: boolean;
    showStopLabels: boolean;
    showPointsOfSale: boolean;
    stopTypeFilter: string[];
    departureSort: 'line' | 'departure';
    routeTypeFilter: string[];
    favoriteStops: string[];
    searchHistory: SearchHistoryItem[];
    mapBaseStyle: 'nolabels' | 'labels';
    selectedCity: string;
    requireAirConditioned: boolean;
    colorVehiclesByDelay: boolean;
    delayFilter: string[];
    statsTab: 'screen' | 'network';
    statsViewMode: 'overview' | 'vehicles';
    isMcpBannerDismissed: boolean;
    hasSeenWelcome: boolean;
}

interface PreferencesActions {
    setShowVehicles: (show: boolean) => void;
    setShowStops: (show: boolean) => void;
    setShowStopLabels: (show: boolean) => void;
    setShowPointsOfSale: (show: boolean) => void;
    setStopTypeFilter: (filter: string[]) => void;
    setIsMcpBannerDismissed: (dismissed: boolean) => void;
    setHasSeenWelcome: (seen: boolean) => void;
    setDepartureSort: (sort: 'line' | 'departure') => void;
    setRouteTypeFilter: (filter: string[]) => void;
    setMapBaseStyle: (style: 'nolabels' | 'labels') => void;
    setSelectedCity: (city: string) => void;
    toggleFavorite: (stopId: string) => void;
    addToHistory: (baseItem: SearchHistoryBase) => void;
    clearHistory: () => void;
    toggleRequireAirConditioned: () => void;
    setColorVehiclesByDelay: (enabled: boolean) => void;
    setDelayFilter: (filter: string[]) => void;
    setStatsTab: (tab: 'screen' | 'network') => void;
    setStatsViewMode: (mode: 'overview' | 'vehicles') => void;
}

export interface PreferencesStore extends PreferencesState {
    actions: PreferencesActions;
}

const PERSISTED_KEYS = [
    'showVehicles',
    'showStops',
    'showStopLabels',
    'showPointsOfSale',
    'stopTypeFilter',
    'departureSort',
    'mapBaseStyle',
    'favoriteStops',
    'searchHistory',
    'selectedCity',
    'routeTypeFilter',
    'requireAirConditioned',
    'colorVehiclesByDelay',
    'delayFilter',
    'isMcpBannerDismissed',
    'hasSeenWelcome',
] as const satisfies ReadonlyArray<keyof PreferencesState>;

type PersistedPreferences = Pick<PreferencesState, typeof PERSISTED_KEYS[number]>;

const ALLOWED_VALUES: Partial<Record<keyof PersistedPreferences, readonly string[]>> = {
    departureSort: ['line', 'departure'],
    mapBaseStyle: ['nolabels', 'labels'],
};

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string');

const isCoordinates = (value: unknown): boolean =>
    Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n));

const isSearchHistoryItem = (value: unknown): value is SearchHistoryItem => {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    if (typeof item.timestamp !== 'number') return false;
    switch (item.type) {
        case 'stop': return typeof item.stop_id === 'string' && typeof item.stop_name === 'string' && isCoordinates(item.coordinates);
        case 'line': return isStringArray(item.lines);
        case 'place': return typeof item.place_id === 'string' && typeof item.name === 'string' && isCoordinates(item.coordinates);
        default: return false;
    }
};

const uniqueHistory = (items: SearchHistoryItem[]): SearchHistoryItem[] => {
    const seen = new Set<string>();
    return items.filter(item => {
        const key = searchHistoryKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/** Takes each stored value only if it has the default's shape, so a corrupt or outdated entry falls back instead of crashing. */
const mergePersisted = (persisted: unknown, current: PreferencesStore): PreferencesStore => {
    if (!persisted || typeof persisted !== 'object') return current;
    const stored = persisted as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current };

    for (const key of PERSISTED_KEYS) {
        const value = stored[key];
        const fallback = current[key];
        if (value === undefined) continue;
        if (key === 'searchHistory') {
            if (Array.isArray(value)) merged[key] = uniqueHistory(value.filter(isSearchHistoryItem));
        } else if (Array.isArray(fallback)) {
            if (isStringArray(value)) merged[key] = value;
        } else if (typeof value === typeof fallback && (!ALLOWED_VALUES[key] || ALLOWED_VALUES[key].includes(value as string))) {
            merged[key] = value;
        }
    }
    return merged as unknown as PreferencesStore;
};

export const usePreferencesStore = create<PreferencesStore>()(
    persist(
        (set) => ({
            // State
            showVehicles: true,
            showStops: true,
            showStopLabels: true,
            showPointsOfSale: false,
            stopTypeFilter: [],
            departureSort: 'departure',
            routeTypeFilter: [],
            favoriteStops: [],
            searchHistory: [],
            mapBaseStyle: 'labels',
            selectedCity: getDefaultCitySlug(),
            requireAirConditioned: false,
            colorVehiclesByDelay: false,
            delayFilter: [],
            statsTab: 'screen',
            statsViewMode: 'overview',
            isMcpBannerDismissed: false,
            hasSeenWelcome: false,

            // Actions
            actions: {
                setShowVehicles: (show) => set({ showVehicles: show }),
                setShowStops: (show) => set({ showStops: show }),
                setShowStopLabels: (show) => set({ showStopLabels: show }),
                setShowPointsOfSale: (show) => set({ showPointsOfSale: show }),
                setStopTypeFilter: (filter) => set({ stopTypeFilter: filter }),
                setIsMcpBannerDismissed: (dismissed) => set({ isMcpBannerDismissed: dismissed }),
                setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
                setDepartureSort: (sort) => set({ departureSort: sort }),
                setRouteTypeFilter: (filter) => set({ routeTypeFilter: filter }),
                setMapBaseStyle: (style) => set({ mapBaseStyle: style }),
                setSelectedCity: (city) => set({ selectedCity: city }),
                toggleFavorite: (stopId) =>
                    set((state) => {
                        const exists = state.favoriteStops.includes(stopId);
                        const newFavorites = exists
                            ? state.favoriteStops.filter((id) => id !== stopId)
                            : [...state.favoriteStops, stopId];
                        return { favoriteStops: newFavorites };
                    }),
                addToHistory: (baseItem) =>
                    set((state) => {
                        const newItem = { ...baseItem, timestamp: Date.now() } as SearchHistoryItem;
                        const newKey = searchHistoryKey(newItem);
                        const rest = state.searchHistory.filter(item => searchHistoryKey(item) !== newKey);
                        return { searchHistory: [newItem, ...rest].slice(0, PREFERENCES_LIMITS.SEARCH_HISTORY) };
                    }),
                clearHistory: () => set({ searchHistory: [] }),
                toggleRequireAirConditioned: () => set((state) => ({ requireAirConditioned: !state.requireAirConditioned })),
                setColorVehiclesByDelay: (enabled) => set({ colorVehiclesByDelay: enabled }),
                setDelayFilter: (filter) => set({ delayFilter: filter }),
                setStatsTab: (tab) => set({ statsTab: tab }),
                setStatsViewMode: (mode) => set({ statsViewMode: mode }),
            },
        }),
        {
            name: 'departs-preferences', // Prefix for all keys or single key if using default storage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => Object.fromEntries(PERSISTED_KEYS.map(key => [key, state[key]])) as PersistedPreferences,
            merge: mergePersisted,
        }
    )
);
