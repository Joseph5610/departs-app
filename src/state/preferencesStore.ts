import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SearchHistoryItem, SearchHistoryBase } from '../types/transit';
import { DEFAULT_CITY_SLUG } from '../config/cities';

export interface PreferencesState {
    showVehicles: boolean;
    showStops: boolean;
    showStopLabels: boolean;
    stopTypeFilter: string[];
    isSettingsOpen: boolean;
    isFeedbackOpen: boolean;
    isAlertsOpen: boolean;
    departureSort: 'line' | 'departure';
    routeTypeFilter: string[];
    favoriteStops: string[];
    searchHistory: SearchHistoryItem[];
    mapBaseStyle: 'nolabels' | 'labels';
    selectedCity: string;
    requireAirConditioned: boolean;
    statsTab: 'screen' | 'network';
    isMcpBannerDismissed: boolean;
    isMcpModalOpen: boolean;
}

export interface PreferencesActions {
    setShowVehicles: (show: boolean) => void;
    setShowStops: (show: boolean) => void;
    setShowStopLabels: (show: boolean) => void;
    setStopTypeFilter: (filter: string[]) => void;
    setIsSettingsOpen: (open: boolean) => void;
    setIsFeedbackOpen: (open: boolean) => void;
    setIsAlertsOpen: (open: boolean) => void;
    setIsMcpModalOpen: (open: boolean) => void;
    setIsMcpBannerDismissed: (dismissed: boolean) => void;
    setDepartureSort: (sort: 'line' | 'departure') => void;
    setRouteTypeFilter: (filter: string[]) => void;
    setMapBaseStyle: (style: 'nolabels' | 'labels') => void;
    setSelectedCity: (city: string) => void;
    toggleFavorite: (stopId: string) => void;
    addToHistory: (item: SearchHistoryBase) => void;
    clearHistory: () => void;
    toggleRequireAirConditioned: () => void;
    setStatsTab: (tab: 'screen' | 'network') => void;
}

export interface PreferencesStore extends PreferencesState {
    actions: PreferencesActions;
}

export const usePreferencesStore = create<PreferencesStore>()(
    persist(
        (set) => ({
            // State
            showVehicles: true,
            showStops: true,
            showStopLabels: true,
            stopTypeFilter: [],
            isSettingsOpen: false,
            isFeedbackOpen: false,
            isAlertsOpen: false,
            departureSort: 'departure',
            routeTypeFilter: [],
            favoriteStops: [],
            searchHistory: [],
            mapBaseStyle: 'labels',
            selectedCity: DEFAULT_CITY_SLUG,
            requireAirConditioned: false,
            statsTab: 'screen',
            isMcpBannerDismissed: false,
            isMcpModalOpen: false,

            // Actions
            actions: {
                setShowVehicles: (show) => set({ showVehicles: show }),
                setShowStops: (show) => set({ showStops: show }),
                setShowStopLabels: (show) => set({ showStopLabels: show }),
                setStopTypeFilter: (filter) => set({ stopTypeFilter: filter }),
                setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
                setIsFeedbackOpen: (open) => set({ isFeedbackOpen: open }),
                setIsAlertsOpen: (open) => set({ isAlertsOpen: open }),
                setIsMcpModalOpen: (open) => set({ isMcpModalOpen: open }),
                setIsMcpBannerDismissed: (dismissed) => set({ isMcpBannerDismissed: dismissed }),
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
                toggleRequireAirConditioned: () => set((state) => ({ requireAirConditioned: !state.requireAirConditioned })),
                setStatsTab: (tab) => set({ statsTab: tab }),
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
                selectedCity: state.selectedCity,
                routeTypeFilter: state.routeTypeFilter,
                requireAirConditioned: state.requireAirConditioned,
                isMcpBannerDismissed: state.isMcpBannerDismissed,
            }),
        }
    )
);
