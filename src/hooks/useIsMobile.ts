import { useState, useEffect } from 'react';
import { MOBILE_BREAKPOINT } from '../config/constants';

/**
 * useIsMobile
 * 
 * Standardized hook for mobile breakpoint detection using matchMedia.
 * More performant than ResizeObserver or window size listeners.
 */
export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState<boolean>(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        
        const handleQueryChange = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
        };

        // Initialize
        setIsMobile(mediaQuery.matches);

        // Modern browsers
        mediaQuery.addEventListener('change', handleQueryChange);
        
        return () => mediaQuery.removeEventListener('change', handleQueryChange);
    }, []);

    return isMobile;
};
