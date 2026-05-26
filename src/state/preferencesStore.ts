import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '../config/constants';
import type { SearchHistoryItem, SearchHistoryBase } from '../types/transit';

export interface PreferencesState {
    showVehicles: boolean;
    showStops: boolean;
    showStopLabels: boolean;
    stopTypeFilter: string[];
    isSettingsOpen: boolean;
    isAlertsOpen: boolean;
    departureSort: 'line' | 'departure';
    routeTypeFilter: string[];
    favoriteStops: string[];
    searchHistory: SearchHistoryItem[];
    mapBaseStyle: 'nolabels' | 'labels';
}

export interface PreferencesActions {
    setShowVehicles: (show: boolean) => void;
    setShowStops: (show: boolean) => void;
    setShowStopLabels: (show: boolean) => void;
    setStopTypeFilter: (filter: string[]) => void;
    setIsSettingsOpen: (open: boolean) => void;
    setIsAlertsOpen: (open: boolean) => void;
    setDepartureSort: (sort: 'line' | 'departure') => void;
    setRouteTypeFilter: (filter: string[]) => void;
    setMapBaseStyle: (style: 'nolabels' | 'labels') => void;
    toggleFavorite: (stopId: string) => void;
    addToHistory: (item: SearchHistoryBase) => void;
    clearHistory: () => void;
}

export interface PreferencesStore extends PreferencesState {
    actions: PreferencesActions;
}

const migrateLegacyPreferences = () => {
    const safeJsonParse = <T>(key: string, fallback: T): T => {
        try {
            const item = localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : fallback;
        } catch {
            return fallback;
        }
    };

    return {
        showVehicles: localStorage.getItem(STORAGE_KEYS.SHOW_VEHICLES) !== 'false',
        showStops: localStorage.getItem(STORAGE_KEYS.SHOW_STOPS) !== 'false',
        showStopLabels: localStorage.getItem(STORAGE_KEYS.SHOW_STOP_LABELS) !== 'false',
        stopTypeFilter: safeJsonParse<string[]>(STORAGE_KEYS.STOP_TYPE_FILTER, []),
        departureSort: (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as 'line' | 'departure') || 'line',
        mapBaseStyle: (localStorage.getItem(STORAGE_KEYS.MAP_BASE_STYLE) as 'nolabels' | 'labels') || 'labels',
        favoriteStops: safeJsonParse<string[]>(STORAGE_KEYS.FAVORITES, []),
        searchHistory: safeJsonParse<SearchHistoryItem[]>(STORAGE_KEYS.SEARCH_HISTORY, []),
    };
};

export const usePreferencesStore = create<PreferencesStore>()(
    persist(
        (set) => ({
            // State
            ...migrateLegacyPreferences(),
            isSettingsOpen: false,
            isAlertsOpen: false,
            routeTypeFilter: [],

            // Actions
            actions: {
                setShowVehicles: (show) => set({ showVehicles: show }),
                setShowStops: (show) => set({ showStops: show }),
                setShowStopLabels: (show) => set({ showStopLabels: show }),
                setStopTypeFilter: (filter) => set({ stopTypeFilter: filter }),
                setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
                setIsAlertsOpen: (open) => set({ isAlertsOpen: open }),
                setDepartureSort: (sort) => set({ departureSort: sort }),
                setRouteTypeFilter: (filter) => set({ routeTypeFilter: filter }),
                setMapBaseStyle: (style) => set({ mapBaseStyle: style }),
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
                        let newHistory = state.searchHistory.filter((item) => {
                            if (item.type === 'stop' && newItem.type === 'stop') {
                                return item.stop_id !== newItem.stop_id;
                            }
                            if (item.type === 'line' && newItem.type === 'line') {
                                return item.lines.join(',') !== newItem.lines.join(',');
                            }
                            return true;
                        });
                        newHistory = [newItem, ...newHistory].slice(0, 5);
                        return { searchHistory: newHistory };
                    }),
                clearHistory: () => set({ searchHistory: [] }),
            },
        }),
        {
            name: 'departs-preferences', // Prefix for all keys or single key if using default storage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                showVehicles: state.showVehicles,
                showStops: state.showStops,
                showStopLabels: state.showStopLabels,
                stopTypeFilter: state.stopTypeFilter,
                departureSort: state.departureSort,
                mapBaseStyle: state.mapBaseStyle,
                favoriteStops: state.favoriteStops,
                searchHistory: state.searchHistory,
            }),
            // Manual migration from legacy keys if needed, but for now we'll just start fresh or use the persist default
            // To maintain compatibility with existing legacy keys, we could use a custom storage or onRehydrateStorage
        }
    )
);
