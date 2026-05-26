import { create } from 'zustand';

export interface MapMetadataState {
    mapLoaded: boolean;
    labelLayerId: string | undefined;
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

    // Actions
    actions: {
        setMapLoaded: (mapLoaded) => set({ mapLoaded }),
        setLabelLayerId: (labelLayerId) => set({ labelLayerId }),
    },
}));
