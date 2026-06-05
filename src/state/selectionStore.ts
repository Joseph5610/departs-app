import { create } from 'zustand';

export interface SelectionState {
    isFollowing: boolean;
    selectedLine: string | null;
    lastStopId: string | null;
}

export interface SelectionActions {
    setIsFollowing: (isFollowing: boolean) => void;
    toggleLineFilter: (line: string | null) => void;
    clearLineFilter: () => void;
    setLastStopId: (stopId: string | null) => void;
}

export interface SelectionStore extends SelectionState {
    actions: SelectionActions;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    // State
    isFollowing: false,
    selectedLine: null,
    lastStopId: null,

    // Actions
    actions: {
        setIsFollowing: (isFollowing) => set({ isFollowing }),

        toggleLineFilter: (line) =>
            set((state) => ({
                selectedLine: state.selectedLine === line ? null : line,
            })),
            
        clearLineFilter: () => set({ selectedLine: null }),

        setLastStopId: (stopId) => set({ lastStopId: stopId }),
    },
}));
