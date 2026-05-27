import React from 'react';
import { create } from 'zustand';
import type { MapRef } from 'react-map-gl/maplibre';
import type { FlyToOptions, EaseToOptions } from 'maplibre-gl';

export interface MapMetadataState {
    mapLoaded: boolean;
    labelLayerId: string | undefined;
    mapRef: React.RefObject<MapRef | null>;
}

export interface MapMetadataActions {
    setMapLoaded: (loaded: boolean) => void;
    setLabelLayerId: (id: string | undefined) => void;
    flyTo: (options: FlyToOptions) => void;
    easeTo: (options: EaseToOptions) => void;
    zoomIn: () => void;
    zoomOut: () => void;
}

export interface MapMetadataStore extends MapMetadataState {
    actions: MapMetadataActions;
}

export const useMapMetadataStore = create<MapMetadataStore>((set, get) => ({
    // State
    mapLoaded: false,
    labelLayerId: undefined,
    mapRef: React.createRef<MapRef>(),

    // Actions
    actions: {
        setMapLoaded: (mapLoaded) => set({ mapLoaded }),
        setLabelLayerId: (labelLayerId) => set({ labelLayerId }),
        flyTo: (options) => {
            const ref = get().mapRef;
            if (ref.current) {
                ref.current.flyTo(options);
            }
        },
        easeTo: (options) => {
            const ref = get().mapRef;
            if (ref.current) {
                ref.current.easeTo(options);
            }
        },
        zoomIn: () => {
            const ref = get().mapRef;
            if (ref.current) {
                ref.current.zoomIn();
            }
        },
        zoomOut: () => {
            const ref = get().mapRef;
            if (ref.current) {
                ref.current.zoomOut();
            }
        },
    },
}));
