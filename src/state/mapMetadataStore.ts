import React from 'react';
import { create } from 'zustand';
import type { MapRef } from 'react-map-gl/maplibre';

export interface MapMetadataState {
    mapLoaded: boolean;
    labelLayerId: string | undefined;
    mapRef: React.RefObject<MapRef | null>;
}

export interface MapMetadataActions {
    setMapLoaded: (loaded: boolean) => void;
    setLabelLayerId: (id: string | undefined) => void;
}

export interface MapMetadataStore extends MapMetadataState {
    actions: MapMetadataActions;
}

export const useMapMetadataStore = create<MapMetadataStore>((set) => ({
    // State
    mapLoaded: false,
    labelLayerId: undefined,
    mapRef: React.createRef<MapRef>(),

    // Actions
    actions: {
        setMapLoaded: (mapLoaded) => set({ mapLoaded }),
        setLabelLayerId: (labelLayerId) => set({ labelLayerId }),
    },
}));
