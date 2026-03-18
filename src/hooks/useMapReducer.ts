import { useReducer, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { VehicleDetail, SelectedStop, SearchHistoryItem, SearchHistoryBase } from '../types/transit';

/**
 * State managed by the map reducer
 */
export interface MapState {
    selectedStop: SelectedStop | null;
    selectedVehicle: VehicleDetail | null;
    isFollowing: boolean;
    showVehicles: boolean;
    showStops: boolean;
    isSettingsOpen: boolean;
    expandedGroups: string[];
    departureSort: 'line' | 'departure';
    routeFilter: string[] | null;
    routeTypeFilter: string[];
    bounds: string | null;
    debouncedBounds: string | null;
    favoriteStops: string[];
    searchHistory: SearchHistoryItem[];
}

/**
 * Available actions for the map reducer
 */
export type MapAction =
    | { type: 'SET_SELECTED_STOP'; payload: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null) }
    | { type: 'SET_SELECTED_VEHICLE'; payload: VehicleDetail | null | ((prev: VehicleDetail | null) => VehicleDetail | null) }
    | { type: 'SELECT_STOP'; payload: SelectedStop | null }
    | { type: 'SELECT_VEHICLE'; payload: VehicleDetail | null; keepStop?: boolean }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'SET_IS_FOLLOWING'; payload: boolean }
    | { type: 'SET_SHOW_VEHICLES'; payload: boolean }
    | { type: 'SET_SHOW_STOPS'; payload: boolean }
    | { type: 'SET_IS_SETTINGS_OPEN'; payload: boolean }
    | { type: 'SET_EXPANDED_GROUPS'; payload: string[] }
    | { type: 'TOGGLE_GROUP'; payload: string }
    | { type: 'SET_DEPARTURE_SORT'; payload: 'line' | 'departure' }
    | { type: 'SET_ROUTE_FILTER'; payload: string[] | null }
    | { type: 'SET_ROUTE_TYPE_FILTER'; payload: string[] }
    | { type: 'SET_BOUNDS'; payload: string | null }
    | { type: 'SET_DEBOUNCED_BOUNDS'; payload: string | null }
    | { type: 'TOGGLE_FAVORITE'; payload: string }
    | { type: 'ADD_TO_HISTORY'; payload: SearchHistoryBase }
    | { type: 'CLEAR_HISTORY' };

/**
 * Initial state factory
 */
const getInitialState = (): MapState => ({
    selectedStop: null,
    selectedVehicle: null,
    isFollowing: false,
    showVehicles: typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.SHOW_VEHICLES) !== 'false'
        : true,
    showStops: typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.SHOW_STOPS) !== 'false'
        : true,
    isSettingsOpen: false,
    expandedGroups: [],
    departureSort: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as 'line' | 'departure')) || 'line',
    routeFilter: null,
    routeTypeFilter: [],
    bounds: null,
    debouncedBounds: null,
    favoriteStops: typeof window !== 'undefined'
        ? (JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]') as string[])
        : [],
    searchHistory: typeof window !== 'undefined'
        ? (JSON.parse(localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY) || '[]') as SearchHistoryItem[])
        : []
});

/**
 * Map Reducer function
 */
function mapReducer(state: MapState, action: MapAction): MapState {
    switch (action.type) {
        case 'SET_SELECTED_STOP':
            return {
                ...state,
                selectedStop: typeof action.payload === 'function'
                    ? action.payload(state.selectedStop)
                    : action.payload
            };
        case 'SET_SELECTED_VEHICLE':
            return {
                ...state,
                selectedVehicle: typeof action.payload === 'function'
                    ? action.payload(state.selectedVehicle)
                    : action.payload
            };
        case 'SELECT_STOP':
            return {
                ...state,
                selectedStop: action.payload,
                selectedVehicle: null,
                isFollowing: false,
                expandedGroups: []
            };
        case 'SELECT_VEHICLE':
            return {
                ...state,
                selectedVehicle: action.payload,
                selectedStop: action.keepStop ? state.selectedStop : null,
                isFollowing: true
            };
        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedStop: null,
                selectedVehicle: null,
                isFollowing: false
            };
        case 'SET_IS_FOLLOWING':
            return { ...state, isFollowing: action.payload };
        case 'SET_SHOW_VEHICLES':
            localStorage.setItem(STORAGE_KEYS.SHOW_VEHICLES, String(action.payload));
            return { ...state, showVehicles: action.payload };
        case 'SET_SHOW_STOPS':
            localStorage.setItem(STORAGE_KEYS.SHOW_STOPS, String(action.payload));
            return { ...state, showStops: action.payload };
        case 'SET_IS_SETTINGS_OPEN':
            return { ...state, isSettingsOpen: action.payload };
        case 'SET_EXPANDED_GROUPS':
            return { ...state, expandedGroups: action.payload };
        case 'TOGGLE_GROUP':
            return {
                ...state,
                expandedGroups: state.expandedGroups.includes(action.payload)
                    ? state.expandedGroups.filter(g => g !== action.payload)
                    : [...state.expandedGroups, action.payload]
            };
        case 'SET_DEPARTURE_SORT':
            localStorage.setItem(STORAGE_KEYS.DEPARTURE_SORT, action.payload);
            return { ...state, departureSort: action.payload };
        case 'SET_ROUTE_FILTER':
            return { ...state, routeFilter: action.payload };
        case 'SET_ROUTE_TYPE_FILTER':
            return { ...state, routeTypeFilter: action.payload };
        case 'SET_BOUNDS':
            return { ...state, bounds: action.payload };
        case 'SET_DEBOUNCED_BOUNDS':
            return { ...state, debouncedBounds: action.payload };
        case 'TOGGLE_FAVORITE': {
            const newFavorites = state.favoriteStops.includes(action.payload)
                ? state.favoriteStops.filter(id => id !== action.payload)
                : [...state.favoriteStops, action.payload];
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(newFavorites));
            return { ...state, favoriteStops: newFavorites };
        }
        case 'ADD_TO_HISTORY': {
            const newItem = { ...action.payload, timestamp: Date.now() } as SearchHistoryItem;
            let newHistory = state.searchHistory.filter(item => {
                if (item.type === 'stop' && newItem.type === 'stop') {
                    return item.id !== newItem.id;
                }
                if (item.type === 'line' && newItem.type === 'line') {
                    return item.lines.join(',') !== newItem.lines.join(',');
                }
                return true;
            });
            newHistory = [newItem, ...newHistory].slice(0, 5);
            localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(newHistory));
            return { ...state, searchHistory: newHistory };
        }
        case 'CLEAR_HISTORY':
            localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
            return { ...state, searchHistory: [] };
        default:
            return state;
    }
}

/**
 * Hook to use the map state reducer
 */
export const useMapReducer = () => {
    const [state, dispatch] = useReducer(mapReducer, undefined, getInitialState);

    const setSelectedStop = useCallback((stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) =>
        dispatch({ type: 'SET_SELECTED_STOP', payload: stop }), []);

    const setSelectedVehicle = useCallback((vehicle: VehicleDetail | null | ((prev: VehicleDetail | null) => VehicleDetail | null)) =>
        dispatch({ type: 'SET_SELECTED_VEHICLE', payload: vehicle }), []);

    const selectStop = useCallback((stop: SelectedStop | null) =>
        dispatch({ type: 'SELECT_STOP', payload: stop }), []);

    const selectVehicle = useCallback((vehicle: VehicleDetail | null, keepStop = false) =>
        dispatch({ type: 'SELECT_VEHICLE', payload: vehicle, keepStop }), []);

    const clearSelection = useCallback(() =>
        dispatch({ type: 'CLEAR_SELECTION' }), []);

    const setIsFollowing = useCallback((val: boolean) =>
        dispatch({ type: 'SET_IS_FOLLOWING', payload: val }), []);

    const setShowVehicles = useCallback((val: boolean) =>
        dispatch({ type: 'SET_SHOW_VEHICLES', payload: val }), []);

    const setShowStops = useCallback((val: boolean) =>
        dispatch({ type: 'SET_SHOW_STOPS', payload: val }), []);

    const setIsSettingsOpen = useCallback((val: boolean) =>
        dispatch({ type: 'SET_IS_SETTINGS_OPEN', payload: val }), []);

    const setExpandedGroups = useCallback((groups: string[]) =>
        dispatch({ type: 'SET_EXPANDED_GROUPS', payload: groups }), []);

    const toggleGroup = useCallback((groupId: string) =>
        dispatch({ type: 'TOGGLE_GROUP', payload: groupId }), []);

    const setDepartureSort = useCallback((sort: 'line' | 'departure') =>
        dispatch({ type: 'SET_DEPARTURE_SORT', payload: sort }), []);

    const setRouteFilter = useCallback((filter: string[] | null) =>
        dispatch({ type: 'SET_ROUTE_FILTER', payload: filter }), []);

    const setRouteTypeFilter = useCallback((filter: string[]) =>
        dispatch({ type: 'SET_ROUTE_TYPE_FILTER', payload: filter }), []);

    const setBounds = useCallback((bounds: string | null) =>
        dispatch({ type: 'SET_BOUNDS', payload: bounds }), []);

    const setDebouncedBounds = useCallback((bounds: string | null) =>
        dispatch({ type: 'SET_DEBOUNCED_BOUNDS', payload: bounds }), []);

    const toggleFavorite = useCallback((stopId: string) =>
        dispatch({ type: 'TOGGLE_FAVORITE', payload: stopId }), []);

    const addToHistory = useCallback((item: SearchHistoryBase) =>
        dispatch({ type: 'ADD_TO_HISTORY', payload: item }), []);

    const clearHistory = useCallback(() =>
        dispatch({ type: 'CLEAR_HISTORY' }), []);

    return {
        state,
        dispatch,
        setSelectedStop,
        setSelectedVehicle,
        selectStop,
        selectVehicle,
        clearSelection,
        setIsFollowing,
        setShowVehicles,
        setShowStops,
        setIsSettingsOpen,
        setExpandedGroups,
        toggleGroup,
        setDepartureSort,
        setRouteFilter,
        setRouteTypeFilter,
        setBounds,
        setDebouncedBounds,
        toggleFavorite,
        addToHistory,
        clearHistory
    };
};
