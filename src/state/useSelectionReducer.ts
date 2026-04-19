import { useReducer, useMemo } from 'react';

export interface SelectionState {
    selectedStopId: string | null;
    selectedTripId: string | null;
    selectedVehicleId: string | null;
    isFollowing: boolean;
}

export type SelectionAction =
    | { type: 'SELECT_STOP'; payload: string | null }
    | { type: 'SELECT_VEHICLE'; payload: { tripId: string | null; vehicleId: string | null; keepStop?: boolean } }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'SET_IS_FOLLOWING'; payload: boolean };

const getInitialState = (): SelectionState => ({
    selectedStopId: null,
    selectedTripId: null,
    selectedVehicleId: null,
    isFollowing: false,
});

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
    switch (action.type) {
        case 'SELECT_STOP':
            return {
                ...state,
                selectedStopId: action.payload,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false
            };
        case 'SELECT_VEHICLE':
            return {
                ...state,
                selectedTripId: action.payload.tripId,
                selectedVehicleId: action.payload.vehicleId,
                selectedStopId: action.payload.keepStop ? state.selectedStopId : null,
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
    }), [dispatch]);

    return {
        state: { ...state, selectedId },
        actions
    };
};
