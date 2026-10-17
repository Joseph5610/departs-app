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

interface CoarseClock {
    listeners: Set<() => void>;
    timer: number | undefined;
    value: number;
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => number;
}

const coarseClocks = new Map<number, CoarseClock>();

const coarseClockOf = (stepMs: number): CoarseClock => {
    const held = coarseClocks.get(stepMs);
    if (held) return held;
    const floored = () => Math.floor(Date.now() / stepMs) * stepMs;
    const clock: CoarseClock = {
        listeners: new Set(),
        timer: undefined,
        value: 0,
        subscribe: (listener) => {
            clock.listeners.add(listener);
            if (clock.timer === undefined) {
                clock.value = floored();
                schedule();
            }
            return () => {
                clock.listeners.delete(listener);
                if (clock.listeners.size === 0) {
                    window.clearTimeout(clock.timer);
                    clock.timer = undefined;
                }
            };
        },
        getSnapshot: () => (clock.timer === undefined ? floored() : clock.value),
    };
    // Fires once per step, at the wall-clock boundary, rather than riding the one-second ticker.
    const schedule = () => {
        clock.timer = window.setTimeout(() => {
            clock.value = floored();
            schedule();
            clock.listeners.forEach(l => l());
        }, stepMs - (Date.now() % stepMs));
    };
    coarseClocks.set(stepMs, clock);
    return clock;
};

/** The current time floored to `stepMs`, from a timer that fires once per step; a component using it re-renders only then. */
export const useNowEvery = (stepMs: number): number => {
    const clock = coarseClockOf(stepMs);
    return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
};
