import { create } from 'zustand';

export interface SelectionState {
    selectedStopId: string | null;
    selectedTripId: string | null;
    selectedVehicleId: string | null;
    isFollowing: boolean;
    selectedLine: string | null;
}

export interface SelectionActions {
    selectStop: (stopId: string | null) => void;
    selectVehicle: (tripId: string | null, vehicleId: string | null, keepStop?: boolean) => void;
    clearSelection: () => void;
    setIsFollowing: (isFollowing: boolean) => void;
    toggleLineFilter: (line: string | null) => void;
}

export interface SelectionStore extends SelectionState {
    selectedId: string | null;
    actions: SelectionActions;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    // State
    selectedStopId: null,
    selectedTripId: null,
    selectedVehicleId: null,
    isFollowing: false,
    selectedLine: null,
    selectedId: null,

    // Actions
    actions: {
        selectStop: (stopId) =>
            set({
                selectedStopId: stopId,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                selectedLine: null,
                selectedId: null,
            }),

        selectVehicle: (tripId, vehicleId, keepStop = false) =>
            set((state) => {
                const selectedId = vehicleId || tripId;
                return {
                    selectedTripId: tripId,
                    selectedVehicleId: vehicleId,
                    selectedStopId: keepStop ? state.selectedStopId : null,
                    isFollowing: true,
                    selectedLine: keepStop ? state.selectedLine : null,
                    selectedId,
                };
            }),

        clearSelection: () =>
            set({
                selectedStopId: null,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                selectedLine: null,
                selectedId: null,
            }),

        setIsFollowing: (isFollowing) => set({ isFollowing }),

        toggleLineFilter: (line) =>
            set((state) => ({
                selectedLine: state.selectedLine === line ? null : line,
            })),
    },
}));
