import { useEffect } from 'react';

/** Keeps the screen on while `active` and the page is visible; re-acquired when the page returns to view. */
export const useWakeLock = (active: boolean) => {
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) return;
        let lock: WakeLockSentinel | null = null;
        let released = false;
        const acquire = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                lock = await navigator.wakeLock.request('screen');
                if (released) void lock.release();
            } catch {
                lock = null;
            }
        };
        void acquire();
        document.addEventListener('visibilitychange', acquire);
        return () => {
            released = true;
            document.removeEventListener('visibilitychange', acquire);
            void lock?.release();
        };
    }, [active]);
};
