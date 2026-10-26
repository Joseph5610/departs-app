import { create } from 'zustand';

interface SelectionState {
    isFollowing: boolean;
    selectedLine: string | null;
    /** Line filter the next opened stop starts with, then cleared; a pinned line's card sets it. */
    pendingLine: string | null;
    /** The trip the opened stop was reached from, highlighted on its board. */
    highlightedTripId: string | null;
    pendingTripId: string | null;
    /** The stop a trip was opened from, from a departure board: where a departure reminder is offered. */
    boardingStop: { tripId: string; stopId: string } | null;
}

interface SelectionActions {
    setIsFollowing: (isFollowing: boolean) => void;
    toggleLineFilter: (line: string | null) => void;
    clearLineFilter: () => void;
    presetLineFilter: (line: string) => void;
    presetTripHighlight: (tripId: string) => void;
    setBoardingStop: (tripId: string, stopId: string | null) => void;
    /** Applies the presets for a newly opened stop, or clears the filter and highlight when none is pending. */
    resetStopSelection: () => void;
}

export interface SelectionStore extends SelectionState {
    actions: SelectionActions;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    isFollowing: false,
    selectedLine: null,
    pendingLine: null,
    highlightedTripId: null,
    pendingTripId: null,
    boardingStop: null,

    actions: {
        setIsFollowing: (isFollowing) => set({ isFollowing }),

        toggleLineFilter: (line) =>
            set((state) => ({
                selectedLine: state.selectedLine === line ? null : line,
            })),
            
        clearLineFilter: () => set({ selectedLine: null }),

        presetLineFilter: (line) => set({ pendingLine: line }),

        presetTripHighlight: (tripId) => set({ pendingTripId: tripId }),

        setBoardingStop: (tripId, stopId) => set({ boardingStop: stopId ? { tripId, stopId } : null }),

        resetStopSelection: () => set((state) => ({
            selectedLine: state.pendingLine,
            pendingLine: null,
            highlightedTripId: state.pendingTripId,
            pendingTripId: null,
        })),
    },
}));
