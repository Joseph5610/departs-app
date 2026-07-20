import { create } from 'zustand';

export interface SelectionState {
    isFollowing: boolean;
    selectedLine: string | null;
    returnPath: string | null;
}

export interface SelectionActions {
    setIsFollowing: (isFollowing: boolean) => void;
    toggleLineFilter: (line: string | null) => void;
    clearLineFilter: () => void;
    setReturnPath: (path: string | null) => void;
}

export interface SelectionStore extends SelectionState {
    actions: SelectionActions;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    // State
    isFollowing: false,
    selectedLine: null,
    returnPath: null,

    // Actions
    actions: {
        setIsFollowing: (isFollowing) => set({ isFollowing }),

        toggleLineFilter: (line) =>
            set((state) => ({
                selectedLine: state.selectedLine === line ? null : line,
            })),
            
        clearLineFilter: () => set({ selectedLine: null }),

        setReturnPath: (path) => set({ returnPath: path }),
    },
}));
