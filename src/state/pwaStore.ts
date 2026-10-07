import { create } from 'zustand';

/** Chromium-only event (Android Chrome, Edge, Samsung Internet); absent from lib.dom. */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
    needRefresh: boolean;
    /** The browser offered an install prompt that has not been used yet. */
    canInstall: boolean;
}

interface PWAActions {
    promptInstall: () => Promise<void>;
}

export interface PWAStore extends PWAState {
    actions: PWAActions;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export const usePWAStore = create<PWAStore>((set) => ({
    needRefresh: false,
    canInstall: false,

    actions: {
        promptInstall: async () => {
            const event = deferredInstallPrompt;
            if (!event) return;
            deferredInstallPrompt = null;
            set({ canInstall: false });
            await event.prompt();
        },
    },
}));

// Registered at import, not in a hook: the event can fire before React mounts and is not re-sent.
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event as BeforeInstallPromptEvent;
        usePWAStore.setState({ canInstall: true });
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        usePWAStore.setState({ canInstall: false });
    });
}
