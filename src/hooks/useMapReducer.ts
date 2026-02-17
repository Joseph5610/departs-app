
import { useReducer, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config/constants';
import type { TrackedVehicle } from '../types/transit';

/**
 * State structure for the entire Map application UI.
 */
export interface MapState {
    selectedStop: { id: string; name: string } | null;
    selectedVehicle: TrackedVehicle | null;
    isFollowing: boolean;
    showVehicles: boolean;
    isSettingsOpen: boolean;
    expandedGroups: string[];
    departureSort: 'line' | 'departure';
    routeFilter: string[] | null;
}

/**
 * Action types for the Map Reducer.
 */
export type MapAction =
    | { type: 'SET_STOP'; stop: { id: string; name: string } | null }
    | { type: 'SET_VEHICLE'; vehicle: TrackedVehicle | null; follow?: boolean }
    | { type: 'UPDATE_SELECTED_VEHICLE'; vehicle: TrackedVehicle }
    | { type: 'SET_FOLLOWING'; following: boolean }
    | { type: 'TOGGLE_VEHICLES'; show: boolean }
    | { type: 'TOGGLE_SETTINGS'; open: boolean }
    | { type: 'SET_SORT'; sort: 'line' | 'departure' }
    | { type: 'TOGGLE_GROUP'; groupId: string }
    | { type: 'SET_EXPANDED_GROUPS'; groups: string[] }
    | { type: 'SET_ROUTE_FILTER'; routes: string[] | null }
    | { type: 'RESET_SELECTION' };

const initialState: MapState = {
    selectedStop: null,
    selectedVehicle: null,
    isFollowing: false,
    showVehicles: typeof window !== 'undefined'
        ? (localStorage.getItem(LS_KEYS.SHOW_VEHICLES) !== 'false')
        : true,
    isSettingsOpen: false,
    expandedGroups: [],
    departureSort: typeof window !== 'undefined'
        ? (localStorage.getItem(LS_KEYS.DEPARTURE_SORT) as 'line' | 'departure' || 'line')
        : 'line',
    routeFilter: null,
};

function mapReducer(state: MapState, action: MapAction): MapState {
    switch (action.type) {
        case 'SET_STOP':
            return {
                ...state,
                selectedStop: action.stop,
                selectedVehicle: action.stop ? null : state.selectedVehicle,
                isFollowing: action.stop ? false : state.isFollowing,
                expandedGroups: []
            };
        case 'SET_VEHICLE':
            return {
                ...state,
                selectedVehicle: action.vehicle,
                selectedStop: action.vehicle ? null : state.selectedStop,
                isFollowing: action.vehicle ? (action.follow ?? true) : false,
            };
        case 'UPDATE_SELECTED_VEHICLE':
            if (!state.selectedVehicle) return state;
            return {
                ...state,
                selectedVehicle: action.vehicle
            };
        case 'SET_FOLLOWING':
            return { ...state, isFollowing: action.following };
        case 'TOGGLE_VEHICLES':
            return { ...state, showVehicles: action.show };
        case 'TOGGLE_SETTINGS':
            return { ...state, isSettingsOpen: action.open };
        case 'SET_SORT':
            return { ...state, departureSort: action.sort };
        case 'TOGGLE_GROUP':
            return {
                ...state,
                expandedGroups: state.expandedGroups.includes(action.groupId)
                    ? state.expandedGroups.filter(g => g !== action.groupId)
                    : [...state.expandedGroups, action.groupId]
            };
        case 'SET_EXPANDED_GROUPS':
            return { ...state, expandedGroups: action.groups };
        case 'SET_ROUTE_FILTER':
            return { ...state, routeFilter: action.routes };
        case 'RESET_SELECTION':
            return {
                ...state,
                selectedStop: null,
                selectedVehicle: null,
                isFollowing: false,
                expandedGroups: []
            };
        default:
            return state;
    }
}

/**
 * Hook to manage Map state using a reducer.
 * Consolidates UI and selection logic into a single predictable state machine.
 */
export const useMapReducer = () => {
    const [state, dispatch] = useReducer(mapReducer, initialState);

    // Persist settings on change
    useEffect(() => {
        localStorage.setItem(LS_KEYS.SHOW_VEHICLES, String(state.showVehicles));
    }, [state.showVehicles]);

    useEffect(() => {
        localStorage.setItem(LS_KEYS.DEPARTURE_SORT, state.departureSort);
    }, [state.departureSort]);

    const toggleGroup = useCallback((groupId: string) => {
        dispatch({ type: 'TOGGLE_GROUP', groupId });
    }, []);

    return {
        state,
        dispatch,
        toggleGroup
    };
};
