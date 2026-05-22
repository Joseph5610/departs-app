import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { SearchHistoryItem, SearchHistoryBase } from '../types/transit';

export interface PreferencesState {
    showVehicles: boolean;
    showStops: boolean;
    showStopLabels: boolean;
    stopTypeFilter: string[]; // empty = show all, ['metro'] = show only metro, etc.
    isSettingsOpen: boolean;
    isAlertsOpen: boolean;
    departureSort: 'line' | 'departure';
    routeTypeFilter: string[];
    favoriteStops: string[];
    searchHistory: SearchHistoryItem[];
    mapBaseStyle: 'nolabels' | 'labels';
}

export type PreferencesAction =
    | { type: 'SET_SHOW_VEHICLES'; payload: boolean }
    | { type: 'SET_SHOW_STOPS'; payload: boolean }
    | { type: 'SET_SHOW_STOP_LABELS'; payload: boolean }
    | { type: 'SET_STOP_TYPE_FILTER'; payload: string[] }
    | { type: 'SET_IS_SETTINGS_OPEN'; payload: boolean }
    | { type: 'SET_IS_ALERTS_OPEN'; payload: boolean }
    | { type: 'SET_DEPARTURE_SORT'; payload: 'line' | 'departure' }
    | { type: 'SET_ROUTE_TYPE_FILTER'; payload: string[] }
    | { type: 'SET_MAP_BASE_STYLE'; payload: 'nolabels' | 'labels' }
    | { type: 'TOGGLE_FAVORITE'; payload: string }
    | { type: 'ADD_TO_HISTORY'; payload: SearchHistoryBase }
    | { type: 'CLEAR_HISTORY' };

const safeJsonParse = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : fallback;
    } catch (e) {
        console.warn(`Failed to parse localStorage key "${key}":`, e);
        return fallback;
    }
};

const getInitialState = (): PreferencesState => ({
    showVehicles: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_VEHICLES) !== 'false' : true,
    showStops: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_STOPS) !== 'false' : true,
    showStopLabels: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_STOP_LABELS) !== 'false' : true,
    stopTypeFilter: typeof window !== 'undefined' ? safeJsonParse<string[]>(STORAGE_KEYS.STOP_TYPE_FILTER, []) : [],
    isSettingsOpen: false,
    isAlertsOpen: false,
    departureSort: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as 'line' | 'departure')) || 'line',
    routeTypeFilter: [],
    favoriteStops: typeof window !== 'undefined' ? safeJsonParse<string[]>(STORAGE_KEYS.FAVORITES, []) : [],
    searchHistory: typeof window !== 'undefined' ? safeJsonParse<SearchHistoryItem[]>(STORAGE_KEYS.SEARCH_HISTORY, []) : [],
    mapBaseStyle: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEYS.MAP_BASE_STYLE) as 'nolabels' | 'labels')) || 'labels'
});

function preferencesReducer(state: PreferencesState, action: PreferencesAction): PreferencesState {
    switch (action.type) {
        case 'SET_SHOW_VEHICLES':
            return { ...state, showVehicles: action.payload };
        case 'SET_SHOW_STOPS':
            return { ...state, showStops: action.payload };
        case 'SET_SHOW_STOP_LABELS':
            return { ...state, showStopLabels: action.payload };
        case 'SET_STOP_TYPE_FILTER':
            return { ...state, stopTypeFilter: action.payload };
        case 'SET_IS_SETTINGS_OPEN':
            return { ...state, isSettingsOpen: action.payload };
        case 'SET_IS_ALERTS_OPEN':
            return { ...state, isAlertsOpen: action.payload };
        case 'SET_DEPARTURE_SORT':
            return { ...state, departureSort: action.payload };
        case 'SET_ROUTE_TYPE_FILTER':
            return { ...state, routeTypeFilter: action.payload };
        case 'SET_MAP_BASE_STYLE':
            return { ...state, mapBaseStyle: action.payload };
        case 'TOGGLE_FAVORITE': {
            const exists = state.favoriteStops.includes(action.payload);
            const newFavorites = exists
                ? state.favoriteStops.filter(id => id !== action.payload)
                : [...state.favoriteStops, action.payload];
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
            return { ...state, searchHistory: newHistory };
        }
        case 'CLEAR_HISTORY':
            return { ...state, searchHistory: [] };
        default:
            return state;
    }
}

export const usePreferencesReducer = () => {
    const [state, dispatch] = useReducer(preferencesReducer, undefined, getInitialState);

    const createAction = useCallback(<T extends PreferencesAction['type']>(type: T) => 
        (payload: Extract<PreferencesAction, { type: T }> extends { payload: infer P } ? P : never) => 
            dispatch({ type, payload } as unknown as PreferencesAction), []);

    // Persistence Effect: Keep localStorage in sync with pure state
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SHOW_VEHICLES, String(state.showVehicles));
        localStorage.setItem(STORAGE_KEYS.SHOW_STOPS, String(state.showStops));
        localStorage.setItem(STORAGE_KEYS.SHOW_STOP_LABELS, String(state.showStopLabels));
        localStorage.setItem(STORAGE_KEYS.STOP_TYPE_FILTER, JSON.stringify(state.stopTypeFilter));
        localStorage.setItem(STORAGE_KEYS.DEPARTURE_SORT, state.departureSort);
        localStorage.setItem(STORAGE_KEYS.MAP_BASE_STYLE, state.mapBaseStyle);
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(state.favoriteStops));
        localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(state.searchHistory));
    }, [state.showVehicles, state.showStops, state.showStopLabels, state.stopTypeFilter, state.departureSort, state.mapBaseStyle, state.favoriteStops, state.searchHistory]);

    const actions = useMemo(() => ({
        setShowVehicles: createAction('SET_SHOW_VEHICLES'),
        setShowStops: createAction('SET_SHOW_STOPS'),
        setShowStopLabels: createAction('SET_SHOW_STOP_LABELS'),
        setStopTypeFilter: createAction('SET_STOP_TYPE_FILTER'),
        setIsSettingsOpen: createAction('SET_IS_SETTINGS_OPEN'),
        setIsAlertsOpen: createAction('SET_IS_ALERTS_OPEN'),
        setDepartureSort: createAction('SET_DEPARTURE_SORT'),
        setRouteTypeFilter: createAction('SET_ROUTE_TYPE_FILTER'),
        setMapBaseStyle: createAction('SET_MAP_BASE_STYLE'),
        toggleFavorite: createAction('TOGGLE_FAVORITE'),
        addToHistory: createAction('ADD_TO_HISTORY'),
        clearHistory: () => dispatch({ type: 'CLEAR_HISTORY' })
    }), [createAction, dispatch]);

    const contextValue = useMemo(() => ({
        state,
        actions
    }), [state, actions]);

    return contextValue;
};
