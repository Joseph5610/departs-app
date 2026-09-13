import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;
const listeners = new Set<() => void>();
let timer: number | undefined;
let now = 0;

const currentSecond = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (timer === undefined) {
        now = currentSecond();
        timer = window.setInterval(() => {
            now = currentSecond();
            listeners.forEach(l => l());
        }, TICK_MS);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            window.clearInterval(timer);
            timer = undefined;
        }
    };
};

// Whole seconds, so repeated reads within one render agree.
const getSnapshot = () => (timer === undefined ? currentSecond() : now);

/**
 * The current time in milliseconds, advancing once a second. Every subscriber shares a single
 * interval, which runs only while at least one component is mounted.
 */
export const useNow = (): number => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
