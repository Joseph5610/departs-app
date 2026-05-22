import { useReducer, useMemo } from 'react';

export interface SelectionState {
    selectedStopId: string | null;
    selectedTripId: string | null;
    selectedVehicleId: string | null;
    isFollowing: boolean;
    selectedLine: string | null;
}

export type SelectionAction =
    | { type: 'SELECT_STOP'; payload: string | null }
    | { type: 'SELECT_VEHICLE'; payload: { tripId: string | null; vehicleId: string | null; keepStop?: boolean } }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'SET_IS_FOLLOWING'; payload: boolean }
    | { type: 'TOGGLE_LINE_FILTER'; payload: string | null };

const getInitialState = (): SelectionState => ({
    selectedStopId: null,
    selectedTripId: null,
    selectedVehicleId: null,
    isFollowing: false,
    selectedLine: null,
});

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
    switch (action.type) {
        case 'SELECT_STOP':
            return {
                ...state,
                selectedStopId: action.payload,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                selectedLine: null
            };
        case 'SELECT_VEHICLE':
            return {
                ...state,
                selectedTripId: action.payload.tripId,
                selectedVehicleId: action.payload.vehicleId,
                selectedStopId: action.payload.keepStop ? state.selectedStopId : null,
                isFollowing: true,
                selectedLine: action.payload.keepStop ? state.selectedLine : null
            };
        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedStopId: null,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                selectedLine: null
            };
        case 'SET_IS_FOLLOWING':
            return { ...state, isFollowing: action.payload };
        case 'TOGGLE_LINE_FILTER':
            return { 
                ...state, 
                selectedLine: state.selectedLine === action.payload ? null : action.payload 
            };
        default:
            return state;
    }
}

export const useSelectionReducer = () => {
    const [state, dispatch] = useReducer(selectionReducer, undefined, getInitialState);
    const selectedId = useMemo(() => state.selectedVehicleId || state.selectedTripId, [state.selectedVehicleId, state.selectedTripId]);

    const actions = useMemo(() => ({
        selectStop: (stopId: string | null) =>
            dispatch({ type: 'SELECT_STOP', payload: stopId }),

        selectVehicle: (tripId: string | null, vehicleId: string | null, keepStop = false) =>
            dispatch({ type: 'SELECT_VEHICLE', payload: { tripId, vehicleId, keepStop } }),

        clearSelection: () =>
            dispatch({ type: 'CLEAR_SELECTION' }),

        setIsFollowing: (isFollowing: boolean) =>
            dispatch({ type: 'SET_IS_FOLLOWING', payload: isFollowing }),

        toggleLineFilter: (line: string | null) =>
            dispatch({ type: 'TOGGLE_LINE_FILTER', payload: line }),
    }), [dispatch]);

    const selectionState = useMemo(() => ({
        ...state,
        selectedId
    }), [state, selectedId]);

    const contextValue = useMemo(() => ({
        state: selectionState,
        actions
    }), [selectionState, actions]);

    return contextValue;
};
