import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SearchHistoryItem, SearchHistoryBase, FavoriteLine, FavoriteStop } from '@/types';
import { getDefaultCitySlug } from '@/domain/cities';
import { matchRoutePath } from '@/lib/routes';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { PREFERENCES_LIMITS, REFRESH_INTERVAL_OPTIONS_S, TRANSIT_REFRESH_S, type RefreshIntervalS } from '@/config/constants';
import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { searchHistoryKey } from '@/lib/searchHistory';
import { firstUnique } from '@/lib/search';
import { isSameFavoriteLine, reorderShown } from '@/domain/departures';
import { isSameFavoriteStop } from '@/domain/stops';


interface PreferencesState {
    showVehicles: boolean;
    showStops: boolean;
    showStopLabels: boolean;
    showPointsOfSale: boolean;
    /** The city's backbone network (metro, tram or trolleybus lines) drawn on the map at all times. */
    showNetworkLines: boolean;
    stopTypeFilter: string[];
    departureSort: 'line' | 'departure';
    routeTypeFilter: string[];
    favoriteStops: FavoriteStop[];
    favoriteLines: FavoriteLine[];
    searchHistory: SearchHistoryItem[];
    mapBaseStyle: 'nolabels' | 'labels';
    selectedCity: string;
    requireAirConditioned: boolean;
    requireWheelchairAccessible: boolean;
    colorVehiclesByDelay: boolean;
    delayFilter: string[];
    statsTab: 'screen' | 'network';
    statsViewMode: 'overview' | 'vehicles';
    /** The favourites panel's tab, shown when both lines and stops are pinned. */
    favoritesTab: 'lines' | 'stops';
    hasSeenWelcome: boolean;
    hasSeenInstallPrompt: boolean;
    /** How often live vehicles and departures refresh. */
    refreshIntervalS: RefreshIntervalS;
    /** Hidden regions this device may pick from the city list, unlocked by opening `?beta=<slug>`. */
    unlockedCities: string[];
}

interface PreferencesActions {
    setShowVehicles: (show: boolean) => void;
    setShowStops: (show: boolean) => void;
    setShowStopLabels: (show: boolean) => void;
    setShowPointsOfSale: (show: boolean) => void;
    setShowNetworkLines: (show: boolean) => void;
    setStopTypeFilter: (filter: string[]) => void;
    setHasSeenWelcome: (seen: boolean) => void;
    setHasSeenInstallPrompt: (seen: boolean) => void;
    setDepartureSort: (sort: 'line' | 'departure') => void;
    setRouteTypeFilter: (filter: string[]) => void;
    setMapBaseStyle: (style: 'nolabels' | 'labels') => void;
    setSelectedCity: (city: string) => void;
    unlockCity: (city: string) => void;
    /** Pins `pin`, or unpins it when pinned. */
    toggleFavorite: (pin: FavoriteStop) => void;
    toggleFavoriteLine: (line: FavoriteLine) => void;
    /** Puts the pinned lines the panel shows in this order. */
    reorderFavoriteLines: (shown: FavoriteLine[]) => void;
    /** Puts the pinned stops the panel shows in this order. */
    reorderFavoriteStops: (shown: FavoriteStop[]) => void;
    /** Unpins a stop pinned under any of these ids. */
    removeFavoriteStops: (pins: FavoriteStop[]) => void;
    /** Gives `city` the city-less pins its stop list knows (pins saved before they carried a city). */
    claimFavoriteStops: (city: string, pins: FavoriteStop[]) => void;
    addToHistory: (baseItem: SearchHistoryBase) => void;
    clearHistory: () => void;
    toggleRequireAirConditioned: () => void;
    toggleRequireWheelchairAccessible: () => void;
    clearVehicleFilters: () => void;
    setColorVehiclesByDelay: (enabled: boolean) => void;
    setDelayFilter: (filter: string[]) => void;
    setStatsTab: (tab: 'screen' | 'network') => void;
    setStatsViewMode: (mode: 'overview' | 'vehicles') => void;
    setFavoritesTab: (tab: 'lines' | 'stops') => void;
    setRefreshIntervalS: (seconds: RefreshIntervalS) => void;
}

export interface PreferencesStore extends PreferencesState {
    actions: PreferencesActions;
}

const PERSISTED_KEYS = [
    'showVehicles',
    'showStops',
    'showStopLabels',
    'showPointsOfSale',
    'showNetworkLines',
    'stopTypeFilter',
    'departureSort',
    'mapBaseStyle',
    'favoriteStops',
    'favoriteLines',
    'searchHistory',
    'selectedCity',
    'routeTypeFilter',
    'requireAirConditioned',
    'requireWheelchairAccessible',
    'colorVehiclesByDelay',
    'delayFilter',
    'hasSeenWelcome',
    'hasSeenInstallPrompt',
    'unlockedCities',
    'refreshIntervalS',
    'favoritesTab',
] as const satisfies ReadonlyArray<keyof PreferencesState>;

type PersistedPreferences = Pick<PreferencesState, typeof PERSISTED_KEYS[number]>;

const ALLOWED_VALUES: Partial<Record<keyof PersistedPreferences, readonly string[]>> = {
    departureSort: ['line', 'departure'],
    mapBaseStyle: ['nolabels', 'labels'],
    favoritesTab: ['lines', 'stops'],
};

const coordinatesSchema = z.tuple([z.number(), z.number()]);

/** Each stored entry is checked on its own, so one corrupt entry is dropped instead of the whole list. */
const searchHistoryItemSchema = z.discriminatedUnion('type', [
    z.looseObject({ type: z.literal('stop'), timestamp: z.number(), stop_id: z.string(), stop_name: z.string() }),
    z.looseObject({ type: z.literal('line'), timestamp: z.number(), lines: z.array(z.string()) }),
    z.looseObject({ type: z.literal('place'), timestamp: z.number(), place_id: z.string(), name: z.string(), coordinates: coordinatesSchema }),
    z.looseObject({ type: z.literal('pos'), timestamp: z.number(), pos_id: z.string(), name: z.string(), coordinates: coordinatesSchema }),
]);

const favoriteLineSchema = z.looseObject({ city: z.string(), stopId: z.string(), line: z.string(), headsign: z.string() });

/** A pin as stored: `{ city, stopId }`, or a bare id saved before pins carried their city. */
const favoriteStopSchema = z.union([z.string(), z.looseObject({ city: z.optional(z.string()), stopId: z.string() })]);

const stringArraySchema = z.array(z.string());

/** The entries of a stored list that pass `schema`; null when the stored value is not a list at all. */
const validEntries = <T,>(value: unknown, schema: z.ZodMiniType<unknown, T>): T[] | null =>
    Array.isArray(value) ? value.filter((entry): entry is T => z.validate(schema, entry)) : null;

/** The hidden region `?beta=<slug>` in the page URL unlocks, so testers can switch to it from the city list. */
export const getUrlUnlockedCity = (): string | null => {
    if (typeof window === 'undefined') return null;
    const slug = new URLSearchParams(window.location.search).get('beta');
    return slug && FRONTEND_CITIES_CONFIG[slug]?.isHidden ? slug : null;
};

/** The city in the page URL; it wins over the stored one so the first render already fetches that city. */
const getUrlCitySlug = (): string | null => {
    if (typeof window === 'undefined') return null;
    const { city } = matchRoutePath(window.location.pathname);
    return city && FRONTEND_CITIES_CONFIG[city] ? city : null;
};

/** Takes each stored value only if it has the default's shape, so a corrupt or outdated entry falls back instead of crashing. */
export const mergePersisted = (persisted: unknown, current: PreferencesStore): PreferencesStore => {
    if (!persisted || typeof persisted !== 'object') return current;
    const stored = persisted as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current };

    for (const key of PERSISTED_KEYS) {
        const value = stored[key];
        const fallback = current[key];
        if (value === undefined) continue;
        if (key === 'refreshIntervalS') {
            if ((REFRESH_INTERVAL_OPTIONS_S as readonly unknown[]).includes(value)) merged[key] = value;
        } else if (key === 'searchHistory') {
            const history = validEntries(value, searchHistoryItemSchema);
            if (history) merged[key] = firstUnique(history, searchHistoryKey, Infinity);
        } else if (key === 'favoriteStops') {
            const pins = validEntries(value, favoriteStopSchema);
            if (pins) merged[key] = pins.map((pin): FavoriteStop => (typeof pin === 'string' ? { stopId: pin } : { city: pin.city, stopId: pin.stopId }));
        } else if (key === 'favoriteLines') {
            const favorites = validEntries(value, favoriteLineSchema);
            if (favorites) merged[key] = favorites;
        } else if (Array.isArray(fallback)) {
            if (z.validate(stringArraySchema, value)) merged[key] = value;
        } else if (typeof value === typeof fallback && (!ALLOWED_VALUES[key] || ALLOWED_VALUES[key].includes(value as string))) {
            merged[key] = value;
        }
    }
    merged.selectedCity = getUrlCitySlug() ?? merged.selectedCity;
    return merged as unknown as PreferencesStore;
};

export const usePreferencesStore = create<PreferencesStore>()(
    persist(
        (set) => ({
            showVehicles: true,
            showStops: true,
            showStopLabels: true,
            showPointsOfSale: false,
            showNetworkLines: true,
            stopTypeFilter: [],
            departureSort: 'departure',
            routeTypeFilter: [],
            favoriteStops: [],
            favoriteLines: [],
            searchHistory: [],
            mapBaseStyle: 'labels',
            selectedCity: getUrlCitySlug() ?? getDefaultCitySlug(),
            requireAirConditioned: false,
            requireWheelchairAccessible: false,
            colorVehiclesByDelay: false,
            delayFilter: [],
            statsTab: 'screen',
            statsViewMode: 'overview',
            favoritesTab: 'lines',
            unlockedCities: [getUrlUnlockedCity()].filter((slug): slug is string => slug !== null),
            hasSeenWelcome: false,
            hasSeenInstallPrompt: false,
            refreshIntervalS: TRANSIT_REFRESH_S,

            actions: {
                setShowVehicles: (show) => set({ showVehicles: show }),
                setShowStops: (show) => set({ showStops: show }),
                setShowStopLabels: (show) => set({ showStopLabels: show }),
                setShowPointsOfSale: (show) => set({ showPointsOfSale: show }),
                setShowNetworkLines: (show) => set({ showNetworkLines: show }),
                setStopTypeFilter: (filter) => set({ stopTypeFilter: filter }),
                setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
                setHasSeenInstallPrompt: (seen) => set({ hasSeenInstallPrompt: seen }),
                setDepartureSort: (sort) => set({ departureSort: sort }),
                setRouteTypeFilter: (filter) => set({ routeTypeFilter: filter }),
                setMapBaseStyle: (style) => set({ mapBaseStyle: style }),
                setSelectedCity: (city) => set({ selectedCity: city }),
                unlockCity: (city) => set((state) => (state.unlockedCities.includes(city) ? state : { unlockedCities: [...state.unlockedCities, city] })),
                toggleFavoriteLine: (line) =>
                    set((state) => {
                        const exists = state.favoriteLines.some(f => isSameFavoriteLine(f, line));
                        return {
                            favoriteLines: exists
                                ? state.favoriteLines.filter(f => !isSameFavoriteLine(f, line))
                                : [...state.favoriteLines, line],
                        };
                    }),
                reorderFavoriteLines: (shown) => set((state) => {
                    const favoriteLines = reorderShown(state.favoriteLines, shown);
                    return favoriteLines === state.favoriteLines ? state : { favoriteLines };
                }),
                reorderFavoriteStops: (shown) => set((state) => {
                    const favoriteStops = reorderShown(state.favoriteStops, shown);
                    return favoriteStops === state.favoriteStops ? state : { favoriteStops };
                }),
                removeFavoriteStops: (pins) => set((state) => ({ favoriteStops: state.favoriteStops.filter(f => !pins.some(pin => isSameFavoriteStop(f, pin))) })),
                claimFavoriteStops: (city, pins) => set((state) => pins.length === 0 ? state : {
                    favoriteStops: state.favoriteStops.map(f => (!f.city && pins.some(pin => isSameFavoriteStop(f, pin)) ? { city, stopId: f.stopId } : f)),
                }),
                toggleFavorite: (pin) =>
                    set((state) => {
                        const exists = state.favoriteStops.some(f => isSameFavoriteStop(f, pin));
                        return { favoriteStops: exists ? state.favoriteStops.filter(f => !isSameFavoriteStop(f, pin)) : [...state.favoriteStops, pin] };
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
                toggleRequireWheelchairAccessible: () => set((state) => ({ requireWheelchairAccessible: !state.requireWheelchairAccessible })),
                clearVehicleFilters: () => set({ requireAirConditioned: false, requireWheelchairAccessible: false }),
                setColorVehiclesByDelay: (enabled) => set({ colorVehiclesByDelay: enabled }),
                setDelayFilter: (filter) => set({ delayFilter: filter }),
                setStatsTab: (tab) => set({ statsTab: tab }),
                setStatsViewMode: (mode) => set({ statsViewMode: mode }),
                setFavoritesTab: (tab) => set({ favoritesTab: tab }),
                setRefreshIntervalS: (refreshIntervalS) => set({ refreshIntervalS }),
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
