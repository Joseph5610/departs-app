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
