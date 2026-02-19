import { useReducer, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { TrackedVehicle } from '../types/transit';

/**
 * State managed by the map reducer
 */
export interface MapState {
    selectedStop: { id: string; name: string; coordinates?: [number, number] } | null;
    selectedVehicle: TrackedVehicle | null;
    isFollowing: boolean;
    showVehicles: boolean;
    isSettingsOpen: boolean;
    expandedGroups: string[];
    departureSort: 'line' | 'departure';
    routeFilter: string[] | null;
    bounds: string | null;
    debouncedBounds: string | null;
}

/**
 * Available actions for the map reducer
 */
export type MapAction =
    | { type: 'SET_SELECTED_STOP'; payload: { id: string; name: string; coordinates?: [number, number] } | null | ((prev: { id: string; name: string; coordinates?: [number, number] } | null) => { id: string; name: string; coordinates?: [number, number] } | null) }
    | { type: 'SET_SELECTED_VEHICLE'; payload: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null) }
    | { type: 'SELECT_STOP'; payload: { id: string; name: string; coordinates?: [number, number] } | null }
    | { type: 'SELECT_VEHICLE'; payload: TrackedVehicle | null; keepStop?: boolean }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'SET_IS_FOLLOWING'; payload: boolean }
    | { type: 'SET_SHOW_VEHICLES'; payload: boolean }
    | { type: 'SET_IS_SETTINGS_OPEN'; payload: boolean }
    | { type: 'SET_EXPANDED_GROUPS'; payload: string[] }
    | { type: 'TOGGLE_GROUP'; payload: string }
    | { type: 'SET_DEPARTURE_SORT'; payload: 'line' | 'departure' }
    | { type: 'SET_ROUTE_FILTER'; payload: string[] | null }
    | { type: 'SET_BOUNDS'; payload: string | null }
    | { type: 'SET_DEBOUNCED_BOUNDS'; payload: string | null };

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
    isSettingsOpen: false,
    expandedGroups: [],
    departureSort: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as 'line' | 'departure')) || 'line',
    routeFilter: null,
    bounds: null,
    debouncedBounds: null
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
        case 'SET_BOUNDS':
            return { ...state, bounds: action.payload };
        case 'SET_DEBOUNCED_BOUNDS':
            return { ...state, debouncedBounds: action.payload };
        default:
            return state;
    }
}

/**
 * Hook to use the map state reducer
 */
export const useMapReducer = () => {
    const [state, dispatch] = useReducer(mapReducer, undefined, getInitialState);

    const setSelectedStop = useCallback((stop: { id: string; name: string; coordinates?: [number, number] } | null | ((prev: { id: string; name: string; coordinates?: [number, number] } | null) => { id: string; name: string; coordinates?: [number, number] } | null)) =>
        dispatch({ type: 'SET_SELECTED_STOP', payload: stop }), []);

    const setSelectedVehicle = useCallback((vehicle: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null)) =>
        dispatch({ type: 'SET_SELECTED_VEHICLE', payload: vehicle }), []);

    const selectStop = useCallback((stop: { id: string; name: string; coordinates?: [number, number] } | null) =>
        dispatch({ type: 'SELECT_STOP', payload: stop }), []);

    const selectVehicle = useCallback((vehicle: TrackedVehicle | null, keepStop = false) =>
        dispatch({ type: 'SELECT_VEHICLE', payload: vehicle, keepStop }), []);

    const clearSelection = useCallback(() =>
        dispatch({ type: 'CLEAR_SELECTION' }), []);

    const setIsFollowing = useCallback((val: boolean) =>
        dispatch({ type: 'SET_IS_FOLLOWING', payload: val }), []);

    const setShowVehicles = useCallback((val: boolean) =>
        dispatch({ type: 'SET_SHOW_VEHICLES', payload: val }), []);

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

    const setBounds = useCallback((bounds: string | null) =>
        dispatch({ type: 'SET_BOUNDS', payload: bounds }), []);

    const setDebouncedBounds = useCallback((bounds: string | null) =>
        dispatch({ type: 'SET_DEBOUNCED_BOUNDS', payload: bounds }), []);

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
        setIsSettingsOpen,
        setExpandedGroups,
        toggleGroup,
        setDepartureSort,
        setRouteFilter,
        setBounds,
        setDebouncedBounds
    };
};
