import { useReducer, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { SearchHistoryItem, SearchHistoryBase } from '../types/transit';

export interface PreferencesState {
    showVehicles: boolean;
    showStops: boolean;
    isSettingsOpen: boolean;
    departureSort: 'line' | 'departure';
    routeTypeFilter: string[];
    favoriteStops: string[];
    searchHistory: SearchHistoryItem[];
}

export type PreferencesAction =
    | { type: 'SET_SHOW_VEHICLES'; payload: boolean }
    | { type: 'SET_SHOW_STOPS'; payload: boolean }
    | { type: 'SET_IS_SETTINGS_OPEN'; payload: boolean }
    | { type: 'SET_DEPARTURE_SORT'; payload: 'line' | 'departure' }
    | { type: 'SET_ROUTE_TYPE_FILTER'; payload: string[] }
    | { type: 'TOGGLE_FAVORITE'; payload: string }
    | { type: 'ADD_TO_HISTORY'; payload: SearchHistoryBase }
    | { type: 'CLEAR_HISTORY' };

const getInitialState = (): PreferencesState => ({
    showVehicles: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_VEHICLES) !== 'false' : true,
    showStops: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_STOPS) !== 'false' : true,
    isSettingsOpen: false,
    departureSort: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as 'line' | 'departure')) || 'line',
    routeTypeFilter: [],
    favoriteStops: typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]') as string[]) : [],
    searchHistory: typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY) || '[]') as SearchHistoryItem[]) : []
});

function preferencesReducer(state: PreferencesState, action: PreferencesAction): PreferencesState {
    switch (action.type) {
        case 'SET_SHOW_VEHICLES':
            localStorage.setItem(STORAGE_KEYS.SHOW_VEHICLES, String(action.payload));
            return { ...state, showVehicles: action.payload };
        case 'SET_SHOW_STOPS':
            localStorage.setItem(STORAGE_KEYS.SHOW_STOPS, String(action.payload));
            return { ...state, showStops: action.payload };
        case 'SET_IS_SETTINGS_OPEN':
            return { ...state, isSettingsOpen: action.payload };
        case 'SET_DEPARTURE_SORT':
            localStorage.setItem(STORAGE_KEYS.DEPARTURE_SORT, action.payload);
            return { ...state, departureSort: action.payload };
        case 'SET_ROUTE_TYPE_FILTER':
            return { ...state, routeTypeFilter: action.payload };
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

export const usePreferencesReducer = () => {
    const [state, dispatch] = useReducer(preferencesReducer, undefined, getInitialState);

    const createAction = useCallback(<T extends PreferencesAction['type']>(type: T) => 
        (payload: Extract<PreferencesAction, { type: T }> extends { payload: infer P } ? P : never) => 
            dispatch({ type, payload } as unknown as PreferencesAction), []);

    return {
        state,
        actions: {
            setShowVehicles: createAction('SET_SHOW_VEHICLES'),
            setShowStops: createAction('SET_SHOW_STOPS'),
            setIsSettingsOpen: createAction('SET_IS_SETTINGS_OPEN'),
            setDepartureSort: createAction('SET_DEPARTURE_SORT'),
            setRouteTypeFilter: createAction('SET_ROUTE_TYPE_FILTER'),
            toggleFavorite: createAction('TOGGLE_FAVORITE'),
            addToHistory: createAction('ADD_TO_HISTORY'),
            clearHistory: useCallback(() => dispatch({ type: 'CLEAR_HISTORY' }), [])
        }
    };
};
