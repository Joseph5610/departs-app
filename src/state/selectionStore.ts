import { create } from 'zustand';

interface SelectionState {
    isFollowing: boolean;
    selectedLine: string | null;
    /** Line filter the next opened stop starts with, then cleared; a pinned line's card sets it. */
    pendingLine: string | null;
    /** The trip the opened stop was reached from, highlighted on its board. */
    highlightedTripId: string | null;
    pendingTripId: string | null;
}

interface SelectionActions {
    setIsFollowing: (isFollowing: boolean) => void;
    toggleLineFilter: (line: string | null) => void;
    clearLineFilter: () => void;
    presetLineFilter: (line: string) => void;
    presetTripHighlight: (tripId: string) => void;
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

    actions: {
        setIsFollowing: (isFollowing) => set({ isFollowing }),

        toggleLineFilter: (line) =>
            set((state) => ({
                selectedLine: state.selectedLine === line ? null : line,
            })),
            
        clearLineFilter: () => set({ selectedLine: null }),

        presetLineFilter: (line) => set({ pendingLine: line }),

        presetTripHighlight: (tripId) => set({ pendingTripId: tripId }),

        resetStopSelection: () => set((state) => ({
            selectedLine: state.pendingLine,
            pendingLine: null,
            highlightedTripId: state.pendingTripId,
            pendingTripId: null,
        })),
    },
}));
