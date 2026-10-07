import { useSyncExternalStore } from 'react';
import { LAYOUT } from '@/config/constants';

/**
 * Standardized hook for mobile breakpoint detection using useSyncExternalStore.
 * This pattern ensures consistent state between the browser's matchMedia and React,
 * avoiding hydration mismatches and unnecessary effect-based updates.
 */
export const useIsMobile = () => {
    const query = `(max-width: ${LAYOUT.MOBILE_BREAKPOINT_PX - 1}px)`;

    return useSyncExternalStore(
        (callback) => {
            if (typeof window === 'undefined') return () => {};
            const mediaQuery = window.matchMedia(query);
            mediaQuery.addEventListener('change', callback);
            return () => mediaQuery.removeEventListener('change', callback);
        },
        () => typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
        () => false // Server-side fallback
    );
};
