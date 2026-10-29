import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
};

/** The window's width, following every resize. */
export const useViewportWidth = (): number =>
    useSyncExternalStore(subscribe, () => window.innerWidth, () => 0);
