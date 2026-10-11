import { create } from 'zustand';

interface UiState {
    isSettingsOpen: boolean;
    isFeedbackOpen: boolean;
    isAlertsOpen: boolean;
    /** Alert to scroll to and expand when the alerts modal opens. */
    focusedAlertGuid: string | null;
    isMcpModalOpen: boolean;
    /** The phone's city picker, a card in the map sheet. */
    isCityPickerOpen: boolean;
}

interface UiActions {
    setIsSettingsOpen: (open: boolean) => void;
    setIsFeedbackOpen: (open: boolean) => void;
    setIsAlertsOpen: (open: boolean) => void;
    openAlert: (guid: string) => void;
    setIsMcpModalOpen: (open: boolean) => void;
    setIsCityPickerOpen: (open: boolean) => void;
}

export interface UiStore extends UiState {
    actions: UiActions;
}

/** Which app-level modals are open; per page load, never persisted. */
export const useUiStore = create<UiStore>()((set) => ({
    isSettingsOpen: false,
    isFeedbackOpen: false,
    isAlertsOpen: false,
    focusedAlertGuid: null,
    isMcpModalOpen: false,
    isCityPickerOpen: false,

    actions: {
        setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
        setIsFeedbackOpen: (open) => set({ isFeedbackOpen: open }),
        setIsAlertsOpen: (open) => set(open ? { isAlertsOpen: true } : { isAlertsOpen: false, focusedAlertGuid: null }),
        openAlert: (guid) => set({ isAlertsOpen: true, focusedAlertGuid: guid }),
        setIsMcpModalOpen: (open) => set({ isMcpModalOpen: open }),
        setIsCityPickerOpen: (open) => set({ isCityPickerOpen: open }),
    },
}));
