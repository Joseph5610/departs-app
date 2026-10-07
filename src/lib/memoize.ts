/**
 * Caches the result for the most recent arguments (compared with `Object.is`). Several hook instances
 * deriving the same value from the same query data and store state then share one computation
 * instead of each running it. Keep one memoized function per call site so different inputs don't evict each other.
 */
export function memoizeLast<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    let lastArgs: A | null = null;
    let lastResult: R;

    return (...args: A): R => {
        const previous = lastArgs;
        if (previous && previous.length === args.length && args.every((arg, i) => Object.is(arg, previous[i]))) {
            return lastResult;
        }
        lastResult = fn(...args);
        lastArgs = args;
        return lastResult;
    };
}

/**
 * `items.map(fn)`, but `items` itself when `fn` returns every item unchanged, so memoized consumers
 * keyed on the array's identity don't recompute.
 */
export function mapStable<T>(items: T[], fn: (item: T) => T): T[] {
    let changed = false;
    const result = items.map((item) => {
        const next = fn(item);
        if (next !== item) changed = true;
        return next;
    });
    return changed ? result : items;
}
