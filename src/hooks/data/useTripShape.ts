import '../../lib/zod-config';
import { z } from 'zod/mini';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCityConfig } from './useCities';
import { apiFetch } from '../../lib/api-client';
import { bucketOf } from '../../lib/staticBuckets';
import { EXTERNAL_URLS, QUERY_TIMING_MS, TRIP_SHAPES_CONFIG } from '../../config/constants';

/** A trip's route line, with each point's distance along it where the network publishes one (Prague). */
export interface TripShape {
    coordinates: [number, number][];
    distances: number[] | null;
}

const tripShapeBucketSchema = z.record(z.string(), z.string());
const shapePointSchema = z.union([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number(), z.number()])]);
const shapeSegmentsSchema = z.array(z.array(shapePointSchema));

export interface TripShapeResult {
    /** Null for other cities, or when the trip has no shape. */
    shape: TripShape | null;
    /** Still reading the shape, so an absent one does not mean the trip has none. */
    isLoading: boolean;
}

/**
 * The precise route geometry of a trip, read straight from the static data CDN for cities with
 * `hasTripShapes`: its shape id from `trip_shape_buckets/`, then its segments from `shape_buckets/`,
 * flattened into one line.
 */
export function useTripShape(tripId: string | null | undefined): TripShapeResult {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasTripShapes = Boolean(useCityConfig().hasTripShapes);
    const baseUrl = `${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}`;

    const tripBucket = tripId ? bucketOf(tripId, TRIP_SHAPES_CONFIG.TRIP_BUCKET_COUNT) : undefined;
    const selectShapeId = useCallback((bucket: Record<string, string>) => (tripId ? bucket[tripId] ?? null : null), [tripId]);

    const { data: shapeId, isLoading: isLoadingId } = useQuery({
        queryKey: ['trip-shape-ids', selectedCity, tripBucket],
        queryFn: async () => tripShapeBucketSchema.parse(await apiFetch<unknown>(`${baseUrl}/trip_shape_buckets/${tripBucket}.json`)),
        enabled: hasTripShapes && !!tripBucket,
        select: selectShapeId,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
    });

    const shapeBucket = shapeId ? bucketOf(shapeId, TRIP_SHAPES_CONFIG.SHAPE_BUCKET_COUNT) : undefined;
    const selectShape = useCallback((bucket: Record<string, unknown>): TripShape | null => {
        const segments = shapeId ? shapeSegmentsSchema.safeParse(bucket[shapeId]) : null;
        if (!segments?.success) return null;
        const points = segments.data.flat();
        if (points.length < 2) return null;
        return {
            coordinates: points.map(p => [p[0], p[1]]),
            distances: points.every((p): p is [number, number, number] => p.length === 3) ? points.map(p => p[2]) : null,
        };
    }, [shapeId]);

    const { data: shape, isLoading: isLoadingShape } = useQuery({
        queryKey: ['trip-shape-geometry', selectedCity, shapeBucket],
        queryFn: () => apiFetch<Record<string, unknown>>(`${baseUrl}/shape_buckets/${shapeBucket}.json`),
        enabled: hasTripShapes && !!shapeBucket,
        select: selectShape,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_GC,
    });

    if (!hasTripShapes) return { shape: null, isLoading: false };
    return { shape: shape ?? null, isLoading: isLoadingId || isLoadingShape };
}
