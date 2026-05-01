import { useReducer, useCallback } from 'react';

import type { GeocodingResult } from '../hooks/data/useGeocoding';

export interface ViewportState {
    bounds: string | null;
    debouncedBounds: string | null;
    routeFilter: string[] | null;
    selectedPlace: GeocodingResult | null;
}

export type ViewportAction =
    | { type: 'SET_BOUNDS'; payload: string | null }
    | { type: 'SET_DEBOUNCED_BOUNDS'; payload: string | null }
    | { type: 'SET_ROUTE_FILTER'; payload: string[] | null }
    | { type: 'SET_SELECTED_PLACE'; payload: GeocodingResult | null };

const getInitialState = (): ViewportState => ({
    bounds: null,
    debouncedBounds: null,
    routeFilter: null,
    selectedPlace: null,
});

function viewportReducer(state: ViewportState, action: ViewportAction): ViewportState {
    switch (action.type) {
        case 'SET_BOUNDS':
            return { ...state, bounds: action.payload };
        case 'SET_DEBOUNCED_BOUNDS':
            return { ...state, debouncedBounds: action.payload };
        case 'SET_ROUTE_FILTER':
            return { ...state, routeFilter: action.payload };
        case 'SET_SELECTED_PLACE':
            return { ...state, selectedPlace: action.payload };
        default:
            return state;
    }
}

export const useViewportReducer = () => {
    const [state, dispatch] = useReducer(viewportReducer, undefined, getInitialState);

    const createAction = useCallback(<T extends ViewportAction['type']>(type: T) => 
        (payload: Extract<ViewportAction, { type: T }> extends { payload: infer P } ? P : never) => 
            dispatch({ type, payload } as unknown as ViewportAction), []);

    return {
        state,
        actions: {
            setBounds: createAction('SET_BOUNDS'),
            setDebouncedBounds: createAction('SET_DEBOUNCED_BOUNDS'),
            setRouteFilter: createAction('SET_ROUTE_FILTER'),
            setSelectedPlace: createAction('SET_SELECTED_PLACE')
        }
    };
};
