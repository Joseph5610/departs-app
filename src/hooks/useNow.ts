import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;
const listeners = new Set<() => void>();
let timer: number | undefined;
let now = 0;

const currentSecond = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

// Re-aligned to the wall-clock second on every tick, so `now` never trails real time by a full second.
const scheduleTick = () => {
    timer = window.setTimeout(() => {
        now = currentSecond();
        scheduleTick();
        listeners.forEach(l => l());
    }, TICK_MS - (Date.now() % TICK_MS));
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (timer === undefined) {
        now = currentSecond();
        scheduleTick();
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            window.clearTimeout(timer);
            timer = undefined;
        }
    };
};

// Whole seconds, so repeated reads within one render agree.
const getSnapshot = () => (timer === undefined ? currentSecond() : now);

/**
 * The current time in milliseconds, floored to the second and advancing on each wall-clock second.
 * Every subscriber shares a single timer, which runs only while at least one component is mounted.
 */
export const useNow = (): number => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
