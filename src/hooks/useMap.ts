import React, { createContext, useContext } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';
import type { useMapReducer } from './useMapReducer';
import type { Departure } from '../types/transit';

/**
 * Context type defining state and actions available to the entire map component tree.
 */
export interface MapContextType {
    mapRef: React.RefObject<MapRef | null>;
    state: ReturnType<typeof useMapReducer>['state'] & {
        mapLoaded: boolean;
        labelLayerId: string | undefined;
        userLocation: [number, number] | null;
        selectedId: string | number | null;
    };
    actions: Omit<ReturnType<typeof useMapReducer>, 'state' | 'dispatch'> & {
        handleLocate: (e?: React.MouseEvent | React.TouchEvent) => void;
        handleDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => Promise<void>;
        performGeolocation: (jump?: boolean) => void;
        setMapLoaded: (loaded: boolean) => void;
        setLabelLayerId: (id: string | undefined) => void;
    };
    mapEvents: {
        onMove: (evt: { viewState: { zoom: number }; target: Map; originalEvent?: unknown }) => void;
        onMoveEnd: (evt: { viewState: { latitude: number; longitude: number; zoom: number }; target: Map; originalEvent?: unknown }) => void;
        onLoad: (evt: { target: Map }) => void;
        onDragStart: () => void;
    };
}

export const MapContext = createContext<MapContextType | null>(null);

export const useMap = () => {
    const context = useContext(MapContext);
    if (!context) throw new Error('useMap must be used within a MapProvider');
    return context;
};
