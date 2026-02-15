
import { useReducer, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { TrackedVehicle } from '../types/transit';

export interface MapState {
    mapLoaded: boolean;
    bounds: string | null;
    debouncedBounds: string | null;
    selectedStop: { id: string; name: string } | null;
    selectedVehicle: TrackedVehicle | null;
    isFollowing: boolean;
    showVehicles: boolean;
    isSettingsOpen: boolean;
    expandedGroups: string[];
    departureSort: 'line' | 'departure';
    routeFilter: string[] | null;
    labelLayerId: string | undefined;
}

export type MapAction =
    | { type: 'SET_MAP_LOADED'; payload: boolean }
    | { type: 'SET_BOUNDS'; payload: string | null }
    | { type: 'SET_DEBOUNCED_BOUNDS'; payload: string | null }
    | { type: 'SET_SELECTED_STOP'; payload: { id: string; name: string } | null }
    | { type: 'SET_SELECTED_VEHICLE'; payload: TrackedVehicle | null }
    | { type: 'SET_IS_FOLLOWING'; payload: boolean }
    | { type: 'TOGGLE_VEHICLES' }
    | { type: 'SET_SHOW_VEHICLES'; payload: boolean }
    | { type: 'SET_SETTINGS_OPEN'; payload: boolean }
    | { type: 'SET_EXPANDED_GROUPS'; payload: string[] | ((prev: string[]) => string[]) }
    | { type: 'TOGGLE_GROUP'; payload: string }
    | { type: 'SET_DEPARTURE_SORT'; payload: 'line' | 'departure' }
    | { type: 'SET_ROUTE_FILTER'; payload: string[] | null }
    | { type: 'SET_LABEL_LAYER_ID'; payload: string | undefined };

const initialState: MapState = {
    mapLoaded: false,
    bounds: null,
    debouncedBounds: null,
    selectedStop: null,
    selectedVehicle: null,
    isFollowing: false,
    showVehicles: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SHOW_VEHICLES) !== 'false' : true,
    isSettingsOpen: false,
    expandedGroups: [],
    departureSort: typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.DEPARTURE_SORT) as any) || 'line' : 'line',
    routeFilter: null,
    labelLayerId: undefined,
};

function mapReducer(state: MapState, action: MapAction): MapState {
    switch (action.type) {
        case 'SET_MAP_LOADED':
            return { ...state, mapLoaded: action.payload };
        case 'SET_BOUNDS':
            return { ...state, bounds: action.payload };
        case 'SET_DEBOUNCED_BOUNDS':
            return { ...state, debouncedBounds: action.payload };
        case 'SET_SELECTED_STOP':
            return { ...state, selectedStop: action.payload };
        case 'SET_SELECTED_VEHICLE':
            return { ...state, selectedVehicle: action.payload };
        case 'SET_IS_FOLLOWING':
            return { ...state, isFollowing: action.payload };
        case 'TOGGLE_VEHICLES':
            return { ...state, showVehicles: !state.showVehicles };
        case 'SET_SHOW_VEHICLES':
            return { ...state, showVehicles: action.payload };
        case 'SET_SETTINGS_OPEN':
            return { ...state, isSettingsOpen: action.payload };
        case 'SET_EXPANDED_GROUPS':
            return {
                ...state,
                expandedGroups: typeof action.payload === 'function'
                    ? action.payload(state.expandedGroups)
                    : action.payload
            };
        case 'TOGGLE_GROUP':
            return {
                ...state,
                expandedGroups: state.expandedGroups.includes(action.payload)
                    ? state.expandedGroups.filter(g => g !== action.payload)
                    : [...state.expandedGroups, action.payload]
            };
        case 'SET_DEPARTURE_SORT':
            return { ...state, departureSort: action.payload };
        case 'SET_ROUTE_FILTER':
            return { ...state, routeFilter: action.payload };
        case 'SET_LABEL_LAYER_ID':
            return { ...state, labelLayerId: action.payload };
        default:
            return state;
    }
}

export const useMapReducer = () => {
    const [state, dispatch] = useReducer(mapReducer, initialState);

    const setMapLoaded = useCallback((val: boolean) => dispatch({ type: 'SET_MAP_LOADED', payload: val }), []);
    const setBounds = useCallback((val: string | null) => dispatch({ type: 'SET_BOUNDS', payload: val }), []);
    const setDebouncedBounds = useCallback((val: string | null) => dispatch({ type: 'SET_DEBOUNCED_BOUNDS', payload: val }), []);
    const setSelectedStop = useCallback((val: { id: string; name: string } | null) => dispatch({ type: 'SET_SELECTED_STOP', payload: val }), []);
    const setSelectedVehicle = useCallback((val: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null)) => {
        if (typeof val === 'function') {
            dispatch({ type: 'SET_SELECTED_VEHICLE', payload: val(state.selectedVehicle) });
        } else {
            dispatch({ type: 'SET_SELECTED_VEHICLE', payload: val });
        }
    }, [state.selectedVehicle]);
    const setIsFollowing = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        if (typeof val === 'function') {
            dispatch({ type: 'SET_IS_FOLLOWING', payload: val(state.isFollowing) });
        } else {
            dispatch({ type: 'SET_IS_FOLLOWING', payload: val });
        }
    }, [state.isFollowing]);
    const setShowVehicles = useCallback((val: boolean) => dispatch({ type: 'SET_SHOW_VEHICLES', payload: val }), []);
    const setIsSettingsOpen = useCallback((val: boolean) => dispatch({ type: 'SET_SETTINGS_OPEN', payload: val }), []);
    const setExpandedGroups = useCallback((val: string[] | ((prev: string[]) => string[])) => dispatch({ type: 'SET_EXPANDED_GROUPS', payload: val }), []);
    const toggleGroup = useCallback((id: string) => dispatch({ type: 'TOGGLE_GROUP', payload: id }), []);
    const setDepartureSort = useCallback((val: 'line' | 'departure') => dispatch({ type: 'SET_DEPARTURE_SORT', payload: val }), []);
    const setRouteFilter = useCallback((val: string[] | null) => dispatch({ type: 'SET_ROUTE_FILTER', payload: val }), []);
    const setLabelLayerId = useCallback((val: string | undefined) => dispatch({ type: 'SET_LABEL_LAYER_ID', payload: val }), []);

    return {
        state,
        dispatch,
        setMapLoaded,
        setBounds,
        setDebouncedBounds,
        setSelectedStop,
        setSelectedVehicle,
        setIsFollowing,
        setShowVehicles,
        setIsSettingsOpen,
        setExpandedGroups,
        toggleGroup,
        setDepartureSort,
        setRouteFilter,
        setLabelLayerId
    };
};
