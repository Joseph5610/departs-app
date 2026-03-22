import { useReducer, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { VehicleDetail, SelectedStop, SearchHistoryItem, SearchHistoryBase } from '../types/transit';

/**
 * Global Map State
 */
export interface MapState {
    /**
     * The currently selected public transport stop.
     * Initialized with ID only, then enriched with name and coordinates by useMapSync.
     */
    selectedStop: SelectedStop | null;
    /**
     * Detailed data for the currently tracked vehicle.
     * Contains real-time position, delay, and static schedule information.
     */
    selectedVehicle: VehicleDetail | null;
    /** Whether the map camera is actively following the selected vehicle */
    isFollowing: boolean;
    /** Visibility toggle for all vehicle icons on the map */
    showVehicles: boolean;
    /** Visibility toggle for all stop icons on the map */
    showStops: boolean;
    /** Controls the visibility of the settings modal */
    isSettingsOpen: boolean;
    /** List of line IDs whose departure groups are expanded in the UI */
    expandedGroups: string[];
    /** Preferred sorting method for departure boards */
    departureSort: 'line' | 'departure';
    /** Current filters applied to the visible lines (null means no filter) */
    routeFilter: string[] | null;
    /** Current filters applied to vehicle types (metro, bus, etc.) */
    routeTypeFilter: string[];
    /** Current map viewport bounds string "south,west,north,east" */
    bounds: string | null;
    /** Debounced version of the map bounds to reduce API pressure */
    debouncedBounds: string | null;
    /** List of user's favorite stop IDs */
    favoriteStops: string[];
    /** Recently searched stops and lines */
    searchHistory: SearchHistoryItem[];
}

export type MapAction =
    | { type: 'UPDATE_STOP'; payload: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null) }
    | { type: 'UPDATE_VEHICLE'; payload: VehicleDetail | null | ((prev: VehicleDetail | null) => VehicleDetail | null) }
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

const getInitialState = (): MapState => ({
    selectedStop: null,
    selectedVehicle: null,
    isFollowing: false,
    showVehicles: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_VEHICLES) !== 'false' : true,
    showStops: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_STOPS) !== 'false' : true,
    isSettingsOpen: false,
    expandedGroups: [],
    departureSort: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as 'line' | 'departure')) || 'line',
    routeFilter: null,
    routeTypeFilter: [],
    bounds: null,
    debouncedBounds: null,
    favoriteStops: typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]') as string[]) : [],
    searchHistory: typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY) || '[]') as SearchHistoryItem[]) : []
});

function mapReducer(state: MapState, action: MapAction): MapState {
    switch (action.type) {
        case 'UPDATE_STOP': {
            const payload = typeof action.payload === 'function' ? action.payload(state.selectedStop) : action.payload;
            return { ...state, selectedStop: payload };
        }
        case 'UPDATE_VEHICLE': {
            const payload = typeof action.payload === 'function' ? action.payload(state.selectedVehicle) : action.payload;
            return { ...state, selectedVehicle: payload };
        }
        case 'SELECT_STOP': {
            return { ...state, selectedStop: action.payload, selectedVehicle: null, isFollowing: false, expandedGroups: [] };
        }
        case 'SELECT_VEHICLE': {
            return { ...state, selectedVehicle: action.payload, selectedStop: action.keepStop ? state.selectedStop : null, isFollowing: true };
        }
        case 'CLEAR_SELECTION': {
            return { ...state, selectedStop: null, selectedVehicle: null, isFollowing: false };
        }
        case 'SET_IS_FOLLOWING': {
            return { ...state, isFollowing: action.payload };
        }
        case 'SET_SHOW_VEHICLES': {
            localStorage.setItem(STORAGE_KEYS.SHOW_VEHICLES, String(action.payload));
            return { ...state, showVehicles: action.payload };
        }
        case 'SET_SHOW_STOPS': {
            localStorage.setItem(STORAGE_KEYS.SHOW_STOPS, String(action.payload));
            return { ...state, showStops: action.payload };
        }
        case 'SET_IS_SETTINGS_OPEN': {
            return { ...state, isSettingsOpen: action.payload };
        }
        case 'SET_EXPANDED_GROUPS': {
            return { ...state, expandedGroups: action.payload };
        }
        case 'TOGGLE_GROUP': {
            const exists = state.expandedGroups.includes(action.payload);
            return {
                ...state,
                expandedGroups: exists
                    ? state.expandedGroups.filter((g) => { return g !== action.payload; })
                    : [...state.expandedGroups, action.payload]
            };
        }
        case 'SET_DEPARTURE_SORT': {
            localStorage.setItem(STORAGE_KEYS.DEPARTURE_SORT, action.payload);
            return { ...state, departureSort: action.payload };
        }
        case 'SET_ROUTE_FILTER': {
            return { ...state, routeFilter: action.payload };
        }
        case 'SET_ROUTE_TYPE_FILTER': {
            return { ...state, routeTypeFilter: action.payload };
        }
        case 'SET_BOUNDS': {
            return { ...state, bounds: action.payload };
        }
        case 'SET_DEBOUNCED_BOUNDS': {
            return { ...state, debouncedBounds: action.payload };
        }
        case 'TOGGLE_FAVORITE': {
            const exists = state.favoriteStops.includes(action.payload);
            const newFavorites = exists
                ? state.favoriteStops.filter((id) => { return id !== action.payload; })
                : [...state.favoriteStops, action.payload];
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(newFavorites));
            return { ...state, favoriteStops: newFavorites };
        }
        case 'ADD_TO_HISTORY': {
            const newItem = { ...action.payload, timestamp: Date.now() } as SearchHistoryItem;
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
            localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(newHistory));
            return { ...state, searchHistory: newHistory };
        }
        case 'CLEAR_HISTORY': {
            localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
            return { ...state, searchHistory: [] };
        }
        default: {
            return state;
        }
    }
}

/**
 * useMapReducer Hook
 *
 * Provides a structured way to interact with the map state.
 */
export const useMapReducer = () => {
    const [state, dispatch] = useReducer(mapReducer, undefined, getInitialState);

    const selectedId = useMemo(() => {
        return state.selectedVehicle?.vehicle_id || null;
    }, [state.selectedVehicle?.vehicle_id]);

    const createAction = useCallback((type: MapAction['type']) => {
        return (payload: any) => { dispatch({ type, payload } as MapAction); };
    }, []);

    return {
        state: { ...state, selectedId },
        updateStop: createAction('UPDATE_STOP'),
        updateVehicle: createAction('UPDATE_VEHICLE'),
        selectStop: createAction('SELECT_STOP'),
        selectVehicle: (payload: VehicleDetail | null, keepStop = false) => { dispatch({ type: 'SELECT_VEHICLE', payload, keepStop }); },
        clearSelection: () => { dispatch({ type: 'CLEAR_SELECTION' }); },
        setIsFollowing: createAction('SET_IS_FOLLOWING'),
        setShowVehicles: createAction('SET_SHOW_VEHICLES'),
        setShowStops: createAction('SET_SHOW_STOPS'),
        setIsSettingsOpen: createAction('SET_IS_SETTINGS_OPEN'),
        setExpandedGroups: createAction('SET_EXPANDED_GROUPS'),
        toggleGroup: createAction('TOGGLE_GROUP'),
        setDepartureSort: createAction('SET_DEPARTURE_SORT'),
        setRouteFilter: createAction('SET_ROUTE_FILTER'),
        setRouteTypeFilter: createAction('SET_ROUTE_TYPE_FILTER'),
        setBounds: createAction('SET_BOUNDS'),
        setDebouncedBounds: createAction('SET_DEBOUNCED_BOUNDS'),
        toggleFavorite: createAction('TOGGLE_FAVORITE'),
        addToHistory: createAction('ADD_TO_HISTORY'),
        clearHistory: () => { dispatch({ type: 'CLEAR_HISTORY' }); }
    };
};
