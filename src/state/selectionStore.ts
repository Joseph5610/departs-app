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
    actions: SelectionActions;
}

/**
 * Selector to get the active vehicle or trip identifier.
 */
export const getSelectedId = (state: SelectionState) => state.selectedVehicleId || state.selectedTripId;

export const useSelectionStore = create<SelectionStore>((set) => ({
    // State
    selectedStopId: null,
    selectedTripId: null,
    selectedVehicleId: null,
    isFollowing: false,
    selectedLine: null,

    // Actions
    actions: {
        selectStop: (stopId) =>
            set({
                selectedStopId: stopId,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                selectedLine: null,
            }),

        selectVehicle: (tripId, vehicleId, keepStop = false) =>
            set((state) => {
                return {
                    selectedTripId: tripId,
                    selectedVehicleId: vehicleId,
                    selectedStopId: keepStop ? state.selectedStopId : null,
                    isFollowing: true,
                    selectedLine: keepStop ? state.selectedLine : null,
                };
            }),

        clearSelection: () =>
            set({
                selectedStopId: null,
                selectedTripId: null,
                selectedVehicleId: null,
                isFollowing: false,
                selectedLine: null,
            }),

        setIsFollowing: (isFollowing) => set({ isFollowing }),

        toggleLineFilter: (line) =>
            set((state) => ({
                selectedLine: state.selectedLine === line ? null : line,
            })),
    },
}));
