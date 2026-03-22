import { useReducer, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { SearchHistoryItem, SearchHistoryBase } from '../types/transit';

export interface MapState {
    selectedStopId: string | null;
    selectedTripId: string | null;
    selectedVehicleId: string | null;
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

export type MapAction =
    | { type: 'SELECT_STOP'; payload: string | null }
    | { type: 'SELECT_VEHICLE'; tripId: string | null; vehicleId: string | null; keepStop?: boolean }
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
    selectedStopId: null,
    selectedTripId: null,
    selectedVehicleId: null,
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
        case 'SELECT_STOP':
            return {
                ...state,
                selectedStopId: action.payload,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                expandedGroups: []
            };
        case 'SELECT_VEHICLE':
            return {
                ...state,
                selectedTripId: action.tripId,
                selectedVehicleId: action.vehicleId,
                selectedStopId: action.keepStop ? state.selectedStopId : null,
                isFollowing: true
            };
        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedStopId: null,
                selectedTripId: null,
                selectedVehicleId: null,
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
            const exists = state.favoriteStops.includes(action.payload);
            const newFavorites = exists
                ? state.favoriteStops.filter(id => id !== action.payload)
                : [...state.favoriteStops, action.payload];
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(newFavorites));
            return { ...state, favoriteStops: newFavorites };
        }
        case 'ADD_TO_HISTORY': {
            const newItem = { ...action.payload, timestamp: Date.now() } as SearchHistoryItem;
            let newHistory = state.searchHistory.filter(item => {
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
        case 'CLEAR_HISTORY':
            localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
            return { ...state, searchHistory: [] };
        default:
            return state;
    }
}

export const useMapReducer = () => {
    const [state, dispatch] = useReducer(mapReducer, undefined, getInitialState);

    const selectedId = useMemo(() => state.selectedVehicleId || state.selectedTripId, [state.selectedVehicleId, state.selectedTripId]);

    const createAction = useCallback((type: MapAction['type']) => (payload: any) => dispatch({ type, payload } as MapAction), []);

    return {
        state: { ...state, selectedId },
        dispatch,
        selectStop: createAction('SELECT_STOP'),
        selectVehicle: useCallback((tripId: string | null, vehicleId: string | null = null, keepStop = false) => dispatch({ type: 'SELECT_VEHICLE', tripId, vehicleId, keepStop }), []),
        clearSelection: useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []),
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
        clearHistory: useCallback(() => dispatch({ type: 'CLEAR_HISTORY' }), [])
    };
};
