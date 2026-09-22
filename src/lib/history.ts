import { navigate as browserNavigate, useLocationProperty } from 'wouter/use-browser-location';

/**
 * Stamped onto every history entry the app pushes. `depth` 0 is the entry the app was opened on
 * (deep link, reload, PWA cold start), where `history.back()` would leave the app; `from` is the
 * path that pushed this entry, which lets a close unwind its own entry instead of adding one.
 */
interface AppHistoryState {
    depth: number;
    from: string | null;
}

const readState = (): Partial<AppHistoryState> | null =>
    (typeof window === 'undefined' ? null : window.history.state) as Partial<AppHistoryState> | null;

export const getHistoryDepth = (): number => {
    const depth = readState()?.depth;
    return typeof depth === 'number' ? depth : 0;
};

/** Stamps depth `0` onto the entry the app booted on. Call once, before React renders. */
export const initHistoryDepth = (): void => {
    if (typeof window === 'undefined' || typeof readState()?.depth === 'number') return;
    window.history.replaceState({ ...readState(), depth: 0, from: null } satisfies AppHistoryState, '');
};

/**
 * Drop-in for wouter's `navigate` that keeps the depth stamp on every entry. Navigating to the path
 * already shown replaces it, so repeated taps cannot stack entries that `history.back()` would sit on.
 */
export const navigate = (to: string, options?: { replace?: boolean }): void => {
    const replace = options?.replace === true || to === window.location.pathname;
    const depth = replace ? getHistoryDepth() : getHistoryDepth() + 1;
    const from = replace ? readState()?.from ?? null : window.location.pathname;
    browserNavigate(to, { replace, state: { depth, from } satisfies AppHistoryState });
};

/** Rewrites the current URL (map camera params, consumed query flags) without dropping the depth stamp. */
export const replaceUrl = (url: string): void => {
    window.history.replaceState(readState(), '', url);
};

/** `/`, `/:city` — the map with no panel over it. Anything longer is a detail route. */
const isMapRoot = (path: string): boolean => path.split('/').filter(Boolean).length <= 1;

/**
 * Closes a detail view. When its own entry was opened from the bare map, that entry is unwound, so
 * opening and closing a panel leaves the history stack exactly as it was.
 */
export const closeDetail = (fallback: string): void => {
    const from = readState()?.from;
    if (getHistoryDepth() > 0 && from !== null && from !== undefined && isMapRoot(from)) {
        window.history.back();
    } else {
        navigate(fallback, { replace: true });
    }
};

/** Browser back while in-app history remains, otherwise a replace onto `fallback`. */
export const goBack = (fallback: string): void => {
    if (getHistoryDepth() > 0) {
        window.history.back();
    } else {
        navigate(fallback, { replace: true });
    }
};

/**
 * The view `history.back()` would return to, or `null` when that is the bare map or nothing of ours.
 * A panel opened straight from the map has no back target: closing it is what the close button is for.
 */
const backTarget = (): string | null => {
    const from = readState()?.from;
    if (getHistoryDepth() < 1 || !from || isMapRoot(from)) return null;
    return from;
};

const noBackTarget = () => null;

/** Re-renders on every history change, so a back affordance can follow the real stack. */
export const useBackTarget = (): string | null => useLocationProperty(backTarget, noBackTarget);
