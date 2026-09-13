/** Shared empty collection for sources with nothing to show; `never[]` keeps callers from adding features to it. */
export const EMPTY_FEATURE_COLLECTION = Object.freeze({
    type: 'FeatureCollection' as const,
    features: [] as never[],
});
